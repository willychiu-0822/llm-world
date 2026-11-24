import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";

export function useFetch<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  // 只認最新一次請求：換了網址或又重抓時，慢到的舊回應不能蓋掉新的，也不能把「載入中」關掉。
  const latest = useRef(0);

  const reload = useCallback(async () => {
    if (!path) return;
    const mine = ++latest.current;
    setLoading(true);
    try {
      const next = await api<T>(path);
      if (mine !== latest.current) return;
      setData(next);
      setError(null);
    } catch (e) {
      if (mine !== latest.current) return;
      setError(e as Error);
    } finally {
      if (mine === latest.current) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    // 網址變了（例如從一個地點換到另一個，或登入後才有網址）就先清掉舊內容，免得閃出別人的資料。
    setData(null);
    setError(null);
    setLoading(Boolean(path));
    void reload();
    return () => {
      latest.current++;
    };
  }, [path, reload]);

  return { data, error, loading, reload, setData };
}
