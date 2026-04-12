import { useEffect, useEffectEvent } from "react";

export function usePoller(
  callback: () => void | Promise<void>,
  intervalMs: number
) {
  const onTick = useEffectEvent(callback);

  useEffect(() => {
    let active = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      try {
        await onTick();
      } catch {
        // Polling callers handle their own error state; keep the loop alive.
      } finally {
        if (active) {
          timeoutId = setTimeout(() => {
            void tick();
          }, intervalMs);
        }
      }
    };

    void tick();

    return () => {
      active = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [intervalMs]);
}
