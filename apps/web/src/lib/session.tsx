import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
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
}

const Ctx = createContext<SessionValue>({ me: null, config: null, configError: false, reloadConfig: async () => {}, loading: true, reload: async () => {}, toast: () => {} });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [configError, setConfigError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const reload = useCallback(async () => {
    try {
      setMe((await api<{ me: Me | null }>("/api/session")).me);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setMe(null);
      else throw e;
    } finally {
      setLoading(false);
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
  }, [reload, reloadConfig]);

  const toast = useCallback((msg: string) => {
    setMessage(msg);
    window.setTimeout(() => setMessage(""), 2800);
  }, []);

  return (
    <Ctx.Provider value={{ me, config, configError, reloadConfig, loading, reload, toast }}>
      {children}
      {message && (
        <div className="toast" role="status">
          <span>{message}</span>
          <button type="button" onClick={() => setMessage("")}>好</button>
        </div>
      )}
    </Ctx.Provider>
  );
}

export const useSession = () => useContext(Ctx);
