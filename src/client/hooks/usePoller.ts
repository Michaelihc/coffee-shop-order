import { useEffect, useEffectEvent } from "react";

export function usePoller(callback: () => void, intervalMs: number) {
  const onTick = useEffectEvent(callback);

  useEffect(() => {
    onTick();
    const id = setInterval(() => onTick(), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}
