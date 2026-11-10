import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ErrorBox, Loading } from "../components/Bits";
import { GrownGate } from "../components/GrownGate";
import { StepForm, type StepPayload } from "../components/StepForm";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import type { DeedView, Predecessor, TrialView } from "../lib/types";
import { useFetch } from "../lib/useFetch";

export function NewStepPage() {
  return <GrownGate><NewStepBody /></GrownGate>;
}

function NewStepBody() {
  const [params] = useSearchParams();
  const deedId = params.get("deedId") ?? undefined;
  const qsTrial = params.get("trialId") ?? undefined;
  const { me, toast, reload } = useSession();
  const nav = useNavigate();
  const deed = useFetch<DeedView>(deedId ? `/api/deeds/${deedId}` : null);
  const trialId = qsTrial ?? deed.data?.trialId ?? undefined;
  const trial = useFetch<TrialView>(trialId ? `/api/trials/${trialId}` : null);
  const q = new URLSearchParams();
  if (deedId) q.set("deedId", deedId);
  if (trialId) q.set("trialId", trialId);
  const sug = useFetch<{ predecessors: Predecessor[]; hints: { ai: string; self: string } | null }>(deedId || trialId ? `/api/first-steps/suggestions?${q}` : null);
  const [error, setError] = useState<Error | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const sourceError = deed.error ?? trial.error ?? sug.error;
  if (sourceError) return (
    <section className="panel stack" style={{ maxWidth: 760, margin: "0 auto" }}>
      <h1>這個起點暫時無法使用</h1>
      <p>來源可能已改成私人、下架，或暫時載入不了。你可以再試一次，也可以回地圖找別的靈感。</p>
      <ErrorBox error={sourceError} />
      <div className="row wrap">
        <Link className="btn primary" to="/map">回地圖找靈感</Link>
        <button className="btn ghost" disabled={deed.loading || trial.loading || sug.loading} onClick={() => void Promise.all([deed.reload(), trial.reload(), sug.reload()])}>再試一次</button>
      </div>
    </section>
  );
  if ((deedId && deed.loading && !deed.data) || sug.loading || (trialId && trial.loading && !trial.data)) return <Loading />;
  const submit = async (p: StepPayload) => {
    setSubmitting(true);
    try {
      await api("/api/first-steps", { method: "POST", body: p });
      await reload();
      toast(p.executor === "ai" ? "交給 AI 角色了" : "第一步定好了");
      nav("/steps");
    } catch (e) {
      setError(e as Error);
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div className="stack" style={{ maxWidth: 760, margin: "0 auto" }}>
      <section className="panel hero">
        <h1>定義你的第一步</h1>
        {deed.data && <p>看到「{deed.data.character?.name ?? "某位鎮民"}」的「{deed.data.title}」，你也想做。</p>}
        {trial.data && <p>想試試「{trial.data.title}」。</p>}
        <p className="muted">第一步越小越好：一次就能完成、清楚知道何時何地。可以交給 AI 角色，也可以本人去做。</p>
        {me && me.wants.length === 0 && <p className="notice">你還沒有寫下想做的事，<Link to="/me/character">去寫一件</Link>會讓角色更懂你。</p>}
      </section>
      <ErrorBox error={error} />
      <section className="panel">
        <StepForm
          wants={me?.wants ?? []}
          initialWantId={deed.data || trial.data ? me?.wants.find(w => w.status === "active" && w.districtKey === (trial.data?.place.districtKey ?? deed.data?.districtKey))?.id ?? "" : undefined}
          sourceDistrictKey={deed.data?.districtKey}
          trialPlace={trial.data?.place}
          predecessors={sug.data?.predecessors ?? []}
          hints={sug.data?.hints ?? null}
          sessions={trial.data?.sessions ?? []}
          trialId={trialId}
          initialSourceIds={deedId && !deed.data?.isMine ? [deedId] : []}
          submitting={submitting}
          onSubmit={submit}
        />
      </section>
    </div>
  );
}
