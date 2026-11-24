import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";

export function useFetch<T>(path: string | null) {
  const [data, setDataState] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  // Only the newest read may publish. A slow response from the previous path,
  // or from a page the browser froze, must not clear「載入中」or overwrite the new one.
  const latest = useRef(0);

  const reload = useCallback(async () => {
    if (!path) {
      setLoading(false);
      return;
    }
    const mine = ++latest.current;
    setLoading(true);
    try {
      const next = await api<T>(path);
      if (mine !== latest.current) return;
      setDataState(next);
      setError(null);
    } catch (e) {
      if (mine !== latest.current) return;
      setError(e as Error);
    } finally {
      if (mine === latest.current) setLoading(false);
    }
  }, [path]);

  const setData = useCallback((next: T | null) => {
    latest.current += 1;
    setDataState(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    setDataState(null);
    setError(null);
    setLoading(Boolean(path));
    void reload();
    // Back/forward cache restores the frozen page, including a read that the
    // browser already aborted. That leaves the screen on「載入中」unless we start again.
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) void reload();
    };
    window.addEventListener("pageshow", onShow);
    return () => {
      latest.current += 1;
      window.removeEventListener("pageshow", onShow);
    };
  }, [path, reload]);

  return { data, error, loading, reload, setData };
}
