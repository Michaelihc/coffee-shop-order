import { useRef, useEffect, useCallback } from "react";

export function usePoller(callback: () => void, intervalMs: number) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const start = useCallback(() => {
    callbackRef.current();
    const id = setInterval(() => callbackRef.current(), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  useEffect(() => {
    const stop = start();
    return stop;
  }, [start]);
}
