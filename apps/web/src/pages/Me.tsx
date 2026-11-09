import { Link } from "react-router-dom";
import { Avatar } from "../components/Avatar";
import { api } from "../lib/api";
import { useSession } from "../lib/session";

export function MePage() {
  const { me } = useSession();
  if (!me) return null;
  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" });
    window.location.assign("/");
  };
  const remove = async () => {
    if (!window.confirm("確定要刪除帳號嗎？你的角色、事蹟、隨筆都會被永久刪除。")) return;
    await api("/api/me", { method: "DELETE" });
    window.location.assign("/");
  };
  const isAdmin = me.user.roles.includes("admin");
  return (
    <div className="stack" style={{ maxWidth: 640, margin: "0 auto" }}>
      <section className="panel row">
        <Avatar appearance={me.character?.appearance} name={me.character?.name ?? "未設定"} size={64} />
        <div className="grow">
          <h1 style={{ margin: 0 }}>{me.character?.name ?? "還沒有角色"}</h1>
          <small>{me.user.displayName}・{me.user.email}（只有你看得到）</small>
        </div>
      </section>
      <nav className="panel stack" aria-label="我的選單">
        <Link to="/me/character">🙂 角色與想做的事</Link>
        <Link to="/connect">🔌 連接 AI</Link>
        <Link to="/notifications">🔔 通知{me.unread.notifications > 0 && <span className="badge">{me.unread.notifications}</span>}</Link>
        <Link to="/provider">🏠 提供者後台{me.provider ? `（${me.provider.status === "approved" ? "已核准" : me.provider.status === "pending" ? "審核中" : "已停權"}）` : ""}</Link>
        {isAdmin && <Link to="/admin">🛠 管理</Link>}
        <Link to="/privacy">隱私權政策</Link>
        <Link to="/terms">服務條款</Link>
      </nav>
      <div className="row wrap">
        <button className="btn" onClick={logout}>登出</button>
        <button className="btn danger" onClick={remove}>刪除帳號</button>
      </div>
    </div>
  );
}
