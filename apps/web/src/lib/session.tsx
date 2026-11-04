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
  loading: boolean;
  reload(): Promise<void>;
  toast(msg: string): void;
}

const Ctx = createContext<SessionValue>({ me: null, config: null, loading: true, reload: async () => {}, toast: () => {} });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const reload = useCallback(async () => {
    try {
      setMe(await api<Me>("/api/me"));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setMe(null);
      else throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    void api<PublicConfig>("/api/config").then(setConfig).catch(() => setConfig(null));
  }, [reload]);

  const toast = useCallback((msg: string) => {
    setMessage(msg);
    window.setTimeout(() => setMessage(""), 2800);
  }, []);

  return (
    <Ctx.Provider value={{ me, config, loading, reload, toast }}>
      {children}
      {message && (
        <div className="toast" role="status">
          {message}
        </div>
      )}
    </Ctx.Provider>
  );
}

export const useSession = () => useContext(Ctx);
