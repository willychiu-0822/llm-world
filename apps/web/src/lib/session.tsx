import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { api, ApiError } from "./api";
import type { Me } from "./types";

export interface PublicConfig {
  appName: string;
  devLogin: boolean;
  googleLogin: boolean;
  mcpUrl: string;
}

interface SessionValue {
  me: Me | null;
  config: PublicConfig | null;
  configError: boolean;
  reloadConfig(): Promise<void>;
  loading: boolean;
  reload(): Promise<void>;
  toast(msg: string): void;
  message: string;
  dismissMessage(): void;
}

const Ctx = createContext<SessionValue>({ me: null, config: null, configError: false, reloadConfig: async () => {}, loading: true, reload: async () => {}, toast: () => {}, message: "", dismissMessage: () => {} });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [configError, setConfigError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const latest = useRef(0);
  const reload = useCallback(async () => {
    const mine = ++latest.current;
    try {
      const next = (await api<{ me: Me | null }>("/api/session")).me;
      if (mine !== latest.current) return;
      setMe(next);
    } catch (e) {
      if (mine !== latest.current) return;
      if (e instanceof ApiError && e.status === 401) setMe(null);
      else throw e;
    } finally {
      if (mine === latest.current) setLoading(false);
    }
  }, []);

  const reloadConfig = useCallback(async () => {
    setConfig(null);
    setConfigError(false);
    try {
      setConfig(await api<PublicConfig>("/api/config"));
    } catch {
      setConfigError(true);
    }
  }, []);

  useEffect(() => {
    void reload();
    void reloadConfig();
    // A restored page keeps loading=true and the aborted /api/session promise.
    // Read it again, or the whole app stays on「載入中……」.
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) void reload();
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, [reload, reloadConfig]);

  const toast = useCallback((msg: string) => setMessage(msg), []);
  const dismissMessage = useCallback(() => setMessage(""), []);

  return (
    <Ctx.Provider value={{ me, config, configError, reloadConfig, loading, reload, toast, message, dismissMessage }}>
      {children}
    </Ctx.Provider>
  );
}

export const useSession = () => useContext(Ctx);
