"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type JsonEnvelope<T> = { ok: true; data: T } | { ok: false; error: string };

type UsePollJsonOptions<T> = {
  url: string;
  intervalMs: number;
  initialData: T;
  mutateEventName?: string;
  /** When set, interval polling runs only while this returns true. Mutate events always trigger one fetch. */
  shouldPoll?: (data: T) => boolean;
};

export function usePollJson<T>({
  url,
  intervalMs,
  initialData,
  mutateEventName,
  shouldPoll,
}: UsePollJsonOptions<T>) {
  const [data, setData] = useState<T>(initialData);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const dataRef = useRef(initialData);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const requestGenerationRef = useRef(0);

  const applyPayload = useCallback((next: T) => {
    dataRef.current = next;
    setData(next);
  }, []);

  const fetchOnce = useCallback(async () => {
    if (document.visibilityState === "hidden") {
      return;
    }

    if (inFlightRef.current) {
      return inFlightRef.current;
    }

    const generation = requestGenerationRef.current + 1;
    requestGenerationRef.current = generation;

    const run = async () => {
      try {
        const response = await fetch(url, { credentials: "same-origin", cache: "no-store" });
        if (generation !== requestGenerationRef.current) {
          return;
        }

        const contentType = response.headers.get("content-type") || "";

        if (!contentType.includes("application/json")) {
          if (response.status === 401 || response.status === 403 || response.redirected) {
            window.location.replace("/login");
          }
          return;
        }

        const body = (await response.json()) as JsonEnvelope<T>;
        if (generation !== requestGenerationRef.current) {
          return;
        }

        if (!body.ok) {
          setFetchError(body.error);
          return;
        }

        setFetchError(null);
        applyPayload(body.data);
      } catch (error) {
        if (generation !== requestGenerationRef.current) {
          return;
        }
        setFetchError(error instanceof Error ? error.message : "Failed to refresh");
      }
    };

    const promise = run().finally(() => {
      if (inFlightRef.current === promise) {
        inFlightRef.current = null;
      }
    });
    inFlightRef.current = promise;
    return promise;
  }, [applyPayload, url]);

  const polling = shouldPoll ? shouldPoll(data) : true;

  useEffect(() => {
    if (!polling) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void fetchOnce();
    }, intervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [polling, fetchOnce, intervalMs]);

  useEffect(() => {
    if (!mutateEventName) {
      return;
    }

    const onMutated = () => {
      void fetchOnce();
    };

    window.addEventListener(mutateEventName, onMutated);
    return () => {
      window.removeEventListener(mutateEventName, onMutated);
    };
  }, [fetchOnce, mutateEventName]);

  return { data, fetchError, refresh: fetchOnce };
}