"use client";

import { useEffect, useState } from "react";

export function TelegramBridge() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void fetch("/api/settings")
        .then((response) => response.json())
        .then((data: { telegramConfigured?: boolean; telegramPolling?: boolean }) => {
          if (!cancelled) {
            setEnabled(Boolean(data.telegramConfigured && data.telegramPolling));
          }
        })
        .catch(() => undefined);
    };
    load();
    const timer = window.setInterval(load, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let busy = false;
    const tick = () => {
      if (busy) return;
      busy = true;
      void fetch("/api/telegram/poll", { method: "POST" }).finally(() => {
        busy = false;
      });
    };
    tick();
    const timer = window.setInterval(tick, 2500);
    return () => window.clearInterval(timer);
  }, [enabled]);

  return null;
}
