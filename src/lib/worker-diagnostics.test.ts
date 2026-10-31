import { spawn } from "node:child_process";
import { expect, it } from "vitest";

it("reports an unresponsive main thread before it unblocks, then reports recovery", async () => {
  // A real child and real timers are essential: fake timers cannot reproduce a blocked Node event loop.
  const child = spawn(process.execPath, ["--require", "tsx/cjs", "--eval", `
    const { startWorkerDiagnostics, updateWorkerDiagnostics, withWorkerDiagnosticStage } = require("./src/lib/worker-diagnostics.ts");
    const stop = startWorkerDiagnostics("diagnostic-test");
    updateWorkerDiagnostics({
      jobId: "job-diagnostic-test", phase: "fetch_album", sourceMessageId: 600055,
      operationStartedAt: new Date().toISOString(), mainStage: "operation",
    });
    process.stdin.on("data", async (data) => {
      if (data.toString().trim() === "block") {
        withWorkerDiagnosticStage("control_read", () => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 17000));
        console.log(JSON.stringify({ event: "block_finished" }));
      } else {
        await stop();
        process.exit(0);
      }
    });
  `], { cwd: process.cwd(), stdio: ["pipe", "pipe", "pipe"] });
  const events: Record<string, unknown>[] = [];
  const buffers = { stdout: "", stderr: "" };
  let unresponsiveBeforeBlockFinished = false;
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error(`Diagnostic child timed out: ${JSON.stringify(events)}`));
      }, 32_000);
      child.once("error", (error) => { clearTimeout(timeout); reject(error); });
      child.once("exit", (code) => {
        clearTimeout(timeout);
        if (code === 0) resolve();
        else reject(new Error(`Diagnostic child exited ${code}: ${buffers.stderr}`));
      });
      for (const stream of ["stdout", "stderr"] as const) {
        child[stream].on("data", (chunk: Buffer) => {
          buffers[stream] += chunk.toString();
          let newline: number;
          while ((newline = buffers[stream].indexOf("\n")) >= 0) {
            const line = buffers[stream].slice(0, newline);
            buffers[stream] = buffers[stream].slice(newline + 1);
            let event: Record<string, unknown>;
            try { event = JSON.parse(line); } catch { continue; }
            events.push(event);
            if (event.event === "worker_health") child.stdin.write("block\n");
            if (event.event === "worker_main_thread_unresponsive") {
              unresponsiveBeforeBlockFinished ||= !events.some((item) => item.event === "block_finished");
            }
            if (event.event === "worker_main_thread_responsive_again") child.stdin.write("stop\n");
          }
        });
      }
    });
    expect(events.find((event) => event.event === "worker_health")).toMatchObject({
      workerId: "diagnostic-test", jobId: "job-diagnostic-test", phase: "fetch_album", mainStage: "operation",
    });
    expect(unresponsiveBeforeBlockFinished).toBe(true);
    const stalled = events.find((event) => event.event === "worker_main_thread_unresponsive")!;
    expect(stalled).toMatchObject({ jobId: "job-diagnostic-test", sourceMessageId: 600055, mainStage: "control_read" });
    expect(stalled.mainThreadSilentMs).toBeGreaterThanOrEqual(10_000);
    expect(stalled.rssBytes).toBeGreaterThan(0);
    expect(events.find((event) => event.event === "worker_synchronous_stage_slow")).toMatchObject({ stage: "control_read" });
    expect(events.find((event) => event.event === "worker_main_thread_responsive_again")?.eventLoopLagMsMaxSinceLastReport).toBeGreaterThan(10_000);
    console.info(events.map((event) => JSON.stringify(event)).join("\n"));
  } finally {
    if (child.exitCode === null) child.kill("SIGKILL");
  }
}, 35_000);
