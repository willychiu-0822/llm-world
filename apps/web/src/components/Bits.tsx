import { DISTRICT_BY_KEY, type DistrictKey } from "@lj/core";
import type { ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { timeAgo } from "../lib/format";
import { useSession } from "../lib/session";
import type { Deed, Trial } from "../lib/types";
import { Avatar } from "./Avatar";

export function ExecutorTag({ executor }: { executor: string }) {
  return executor === "ai" ? <span className="tag tag-ai">朋友做的</span> : <span className="tag tag-self">自己做的</span>;
}

export function RealTag({ demo, executor }: { demo: boolean; executor: string }) {
  return demo ? <span className="tag tag-demo">示範</span> : executor === "ai" ? null : <span className="tag tag-real">真人做過</span>;
}

export function DistrictTag({ k }: { k: string }) {
  const d = DISTRICT_BY_KEY[k as DistrictKey];
  return <span className="tag tag-district">{d ? d.name : k}</span>;
}

export function Loading() {
  return <p className="empty">載入中……</p>;
}

export function ErrorBox({ error }: { error: Error | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="error panel soft">
      {error.message}
    </p>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function RequireLogin({ children }: { children: ReactNode }) {
  const { me, loading } = useSession();
  const loc = useLocation();
  if (loading) return <Loading />;
  if (!me) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  return <>{children}</>;
}

export function DeedCard({ deed }: { deed: Deed }) {
  return (
    <Link to={`/deeds/${deed.id}`} className="card-link">
      <div className="panel stack" style={{ gap: 8 }}>
        <div className="row">
          <Avatar appearance={deed.character?.appearance} name={deed.character?.name ?? "鎮民"} size={44} />
          <div className="grow">
            <strong>{deed.character?.name ?? "某位鎮民"}</strong>
            <div className="row wrap" style={{ gap: 6 }}>
              <RealTag demo={deed.isDemo} executor={deed.executor} />
              <ExecutorTag executor={deed.executor} />
              {deed.isFirst && <span className="tag tag-first">第一次</span>}
            </div>
          </div>
        </div>
        <p style={{ fontWeight: 700 }}>「{deed.title}」</p>
        {deed.summary && <p className="muted">{deed.summary.length > 80 ? `${deed.summary.slice(0, 80)}…` : deed.summary}</p>}
        <small>{timeAgo(deed.createdAt)}</small>
      </div>
    </Link>
  );
}

export function TrialCard({ trial }: { trial: Trial }) {
  return (
    <Link to={`/trials/${trial.id}`} className="card-link">
      <div className="panel stack" style={{ gap: 6, background: "var(--butter-soft)" }}>
        <div className="row wrap" style={{ gap: 6 }}>
          <span className="tag tag-first">試用機會</span>
          {trial.isDemo && <span className="tag tag-demo">示範</span>}
        </div>
        <strong>{trial.title}</strong>
        <small>
          {trial.durationMin} 分鐘{trial.exitAnytime ? "・隨時可以離開" : ""}
          {trial.buddyOk ? "・可以帶朋友" : ""}
          {trial.whenText ? `・${trial.whenText}` : ""}
        </small>
      </div>
    </Link>
  );
}
