"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type JobProgressRefreshProps = {
  active: boolean;
};

export function JobProgressRefresh({ active }: JobProgressRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    if (!active) {
      return;
    }

    const intervalId = window.setInterval(() => {
      router.refresh();
    }, 2000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [active, router]);

  return null;
}
