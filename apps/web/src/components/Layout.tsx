import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { useSession } from "../lib/session";
import { Avatar } from "./Avatar";

export function Layout({ children }: { children: ReactNode }) {
  const { me, loading } = useSession();
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand" aria-label="龍角鎮首頁">
          <Avatar appearance={{ body: "round", accessory: "dragon_horns", main: "#F2C6A8", accent: "#A9C7DE" }} name="龍角鎮" size={34} />
          龍角鎮
        </Link>
        {!loading && !me && <Link to="/login" className="btn small ghost mobile-login">登入</Link>}
        <nav className="nav" aria-label="主要導覽">
          <NavLink to="/" end>家</NavLink>
          <NavLink to="/map">地圖</NavLink>
          <NavLink to="/cabinet">收藏櫃</NavLink>
          {!loading && !me && <NavLink to="/login">登入</NavLink>}
        </nav>
      </header>
      <main className="page">{children}</main>
      <nav className="tabbar" aria-label="快速導覽">
        <NavLink to="/" end><span className="icon" aria-hidden>🏠</span>家</NavLink>
        <NavLink to="/map"><span className="icon" aria-hidden>🗺️</span>地圖</NavLink>
        <NavLink to="/cabinet"><span className="icon" aria-hidden>🧺</span>收藏櫃</NavLink>
      </nav>
    </div>
  );
}
