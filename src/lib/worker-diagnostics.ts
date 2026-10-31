import { performance } from "node:perf_hooks";
import { Worker } from "node:worker_threads";
import { systemLog } from "@/lib/logger";

type DiagnosticContext = {
  jobId?: string | null;
  accountId?: string | null;
  sourceMessageId?: number | null;
  phase?: string;
  operationStartedAt?: string | null;
  lastProgressAt?: string | null;
  mainStage?: string;
  stageStartedAt?: string;
};

let context: DiagnosticContext = {};
let observer: Worker | undefined;

export function updateWorkerDiagnostics(fields: DiagnosticContext) {
  if (!observer) return;
  context = { ...context, ...fields };
  observer.postMessage({ context });
}

export function withWorkerDiagnosticStage<T>(stage: string, operation: () => T): T {
  if (!observer) return operation();
  const previous = { mainStage: context.mainStage, stageStartedAt: context.stageStartedAt };
  const startedAt = performance.now();
  updateWorkerDiagnostics({ mainStage: stage, stageStartedAt: new Date().toISOString() });
  try {
    return operation();
  } finally {
    const elapsedMs = Math.round(performance.now() - startedAt);
    if (elapsedMs >= 1_000) systemLog("warn", "worker_synchronous_stage_slow", { jobId: context.jobId, stage, elapsedMs });
    updateWorkerDiagnostics(previous);
  }
}

export function startWorkerDiagnostics(workerId: string) {
  // This thread never reads SQLite or Telegram sessions. Write directly to fd 2: Worker stdout/stderr
  // forwarding normally relies on the very main event loop we are trying to diagnose.
  const thread = new Worker(`
    const { parentPort, workerData } = require("node:worker_threads");
    const { performance } = require("node:perf_hooks");
    const { writeSync } = require("node:fs");
    let context = {};
    let memory = {};
    let maxEventLoopLagMs = 0;
    let lastCheckIn = performance.now();
    let lastReport = -Infinity;
    let wasUnresponsive = false;
    let lastCpu = process.cpuUsage();
    let lastCpuAt = performance.now();
    parentPort.on("message", (message) => {
      lastCheckIn = performance.now();
      if (message.context) context = message.context;
      if (message.memory) {
        memory = message.memory;
        maxEventLoopLagMs = Math.max(maxEventLoopLagMs, memory.eventLoopLagMsLastSample);
      }
    });
    setInterval(() => {
      const now = performance.now();
      const mainThreadSilentMs = Math.round(now - lastCheckIn);
      const unresponsive = mainThreadSilentMs >= 10_000;
      const cpu = process.cpuUsage();
      const cpuPercent = Math.round((cpu.user - lastCpu.user + cpu.system - lastCpu.system) / ((now - lastCpuAt) * 10));
      lastCpu = cpu;
      lastCpuAt = now;
      if (!unresponsive && !wasUnresponsive && now - lastReport < 30_000) return;
      const timestamp = new Date().toISOString();
      const event = unresponsive ? "worker_main_thread_unresponsive" : wasUnresponsive ? "worker_main_thread_responsive_again" : "worker_health";
      writeSync(2, JSON.stringify({
        timestamp, level: unresponsive ? "error" : "info", event,
        workerId: workerData.workerId, pid: process.pid, ...context,
        mainThreadSilentMs, cpuPercent, rssBytes: process.memoryUsage.rss(),
        ...memory, eventLoopLagMsMaxSinceLastReport: maxEventLoopLagMs,
        operationElapsedMs: context.operationStartedAt ? Date.now() - Date.parse(context.operationStartedAt) : null,
        progressIdleMs: context.lastProgressAt ? Date.now() - Date.parse(context.lastProgressAt) : null,
        stageElapsedMs: context.stageStartedAt ? Date.now() - Date.parse(context.stageStartedAt) : null,
      }) + "\\n");
      wasUnresponsive = unresponsive;
      lastReport = now;
      maxEventLoopLagMs = 0;
    }, 5_000);
  `, { eval: true, workerData: { workerId } });
  observer = thread;
  thread.unref();
  thread.on("error", () => {
    if (observer === thread) observer = undefined;
    systemLog("error", "worker_diagnostics_failed", { workerId });
  });
  let lastPulse = performance.now();
  const timer = setInterval(() => {
    if (observer !== thread) return;
    const now = performance.now();
    const memory = process.memoryUsage();
    thread.postMessage({ memory: {
      mainHeapUsedBytesLastSample: memory.heapUsed,
      mainExternalBytesLastSample: memory.external,
      eventLoopLagMsLastSample: Math.max(0, Math.round(now - lastPulse - 1_000)),
    } });
    lastPulse = now;
  }, 1_000);
  timer.unref();
  return async () => {
    clearInterval(timer);
    if (observer === thread) observer = undefined;
    await thread.terminate();
  };
}
