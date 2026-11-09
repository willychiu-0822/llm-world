import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { useSession } from "../lib/session";
import { Avatar } from "./Avatar";

const Badge = ({ n }: { n: number }) => (n > 0 ? <span className="badge" aria-label={`${n} 則未讀`}>{n}</span> : null);

export function Layout({ children }: { children: ReactNode }) {
  const { me, loading } = useSession();
  const unread = me?.unread ?? { notifications: 0, discoveries: 0 };
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand" aria-label="龍角鎮首頁">
          <Avatar appearance={{ body: "round", accessory: "dragon_horns", main: "#F2C6A8", accent: "#A9C7DE" }} name="龍角鎮" size={34} />
          龍角鎮
        </Link>
        {!loading && !me && <Link to="/login" className="btn small ghost mobile-login">登入</Link>}
        <nav className="nav" aria-label="主要導覽">
          <NavLink to="/" end>地圖</NavLink>
          {me ? (
            <>
              <NavLink to="/discoveries">發現匣<Badge n={unread.discoveries} /></NavLink>
              <NavLink to="/steps">我的步驟</NavLink>
              <NavLink to="/mirror">鏡子</NavLink>
              <NavLink to="/notifications">通知<Badge n={unread.notifications} /></NavLink>
              <NavLink to="/me">我</NavLink>
            </>
          ) : (
            <NavLink to="/login">登入</NavLink>
          )}
        </nav>
      </header>
      <main className="page">{children}</main>
      <nav className="tabbar" aria-label="快速導覽">
        <NavLink to="/" end><span className="icon" aria-hidden>🗺️</span>地圖</NavLink>
        <NavLink to="/discoveries"><span className="icon" aria-hidden>📮</span>發現<Badge n={unread.discoveries} /></NavLink>
        <NavLink to="/steps"><span className="icon" aria-hidden>👣</span>步驟</NavLink>
        <NavLink to="/mirror"><span className="icon" aria-hidden>🪞</span>鏡子</NavLink>
        <NavLink to="/me"><span className="icon" aria-hidden>🙂</span>我<Badge n={unread.notifications} /></NavLink>
      </nav>
    </div>
  );
}
