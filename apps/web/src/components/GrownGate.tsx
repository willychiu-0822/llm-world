import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Loading } from "./Bits";
import { useSession } from "../lib/session";

/** Old pages stay put until the baby reaches stage 2. Before that, no leftover vocabulary. */
export function GrownGate({ children }: { children: ReactNode }) {
  const { me, loading } = useSession();
  if (loading) return <Loading />;
  if ((me?.pet?.stage ?? 0) < 2) {
    return (
      <section className="panel stack" style={{ maxWidth: 520, margin: "0 auto" }}>
        <h1>小龍還沒長大</h1>
        <p>圍巾尺寸之後，再來看這些。先回家陪牠。</p>
        <Link to="/" className="btn primary">回家陪小龍</Link>
      </section>
    );
  }
  return children;
}
