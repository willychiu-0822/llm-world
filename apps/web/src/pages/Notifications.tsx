import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Empty, ErrorBox, Loading } from "../components/Bits";
import { api } from "../lib/api";
import { timeAgo } from "../lib/format";
import { useSession } from "../lib/session";
import { useFetch } from "../lib/useFetch";

interface N {
  id: string;
  kind: string;
  payload: Record<string, string | null>;
  readAt: string | null;
  createdAt: string;
}

function describe(n: N): { text: string; to?: string } {
  const p = n.payload;
  switch (n.kind) {
    case "followed_referenced":
      return { text: `有人參考了你的第一步「${p.deedTitle}」，正準備去做。`, to: `/deeds/${p.deedId}` };
    case "followed_completed":
      return { text: `有人參考你的「${p.deedTitle}」，也做到了！`, to: `/deeds/${p.deedId}` };
    case "step_proposed":
      return { text: `你的 AI 角色建議了一個第一步：「${p.text}」，等你確認。`, to: "/steps" };
    case "ai_step_done":
      return { text: `你的 AI 角色完成了「${p.text}」。`, to: p.deedId ? `/deeds/${p.deedId}` : "/steps" };
    case "question_answered":
      return { text: `「${p.trialTitle}」回答了你的 AI 問的問題：「${p.question}」→ ${p.answer}`, to: `/trials/${p.trialId}` };
    case "attendance_confirmed":
      return { text: `「${p.trialTitle}」確認了你的出席。要不要寫一段做之後的隨筆？`, to: "/steps" };
    case "provider_approved":
      return { text: `你的提供者申請「${p.name}」通過了，可以在鎮上開店了。`, to: "/provider" };
    case "new_question":
      return { text: `有人的 AI 問了一個問題：「${p.question}」`, to: "/provider" };
    default:
      return { text: "你有一則新通知。" };
  }
}

export function NotificationsPage() {
  const { reload } = useSession();
  const { data, error, loading } = useFetch<N[]>("/api/notifications");
  useEffect(() => {
    if (data?.some((n) => !n.readAt)) void api("/api/notifications/read-all", { method: "POST" }).then(() => reload());
  }, [data]);
  if (loading && !data) return <Loading />;
  return (
    <div className="stack" style={{ maxWidth: 760, margin: "0 auto" }}>
      <h1>通知</h1>
      <ErrorBox error={error} />
      {!data?.length ? <Empty>還沒有通知。</Empty> : (
        <ul className="plain">
          {data.map((n) => {
            const d = describe(n);
            const body = (
              <div className="panel row" style={{ padding: 12, borderColor: n.readAt ? undefined : "var(--rose)" }}>
                <span className="grow">{d.text}</span>
                <small>{timeAgo(n.createdAt)}</small>
              </div>
            );
            return <li key={n.id}>{d.to ? <Link to={d.to} className="card-link">{body}</Link> : body}</li>;
          })}
        </ul>
      )}
    </div>
  );
}
