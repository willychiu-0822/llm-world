import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { Avatar } from "../components/Avatar";
import { ErrorBox, Loading } from "../components/Bits";
import { useSession } from "../lib/session";
import type { Town } from "../lib/types";
import { useFetch } from "../lib/useFetch";

const TownMap = lazy(() => import("../components/TownMap").then(m => ({ default: m.TownMap })));

export function HomePage() {
  const { me, loading } = useSession();
  const town = useFetch<Town>("/api/town");
  return (
    <div className="stack">
      {!loading && !me && (
        <section className="panel hero stack" style={{ gap: 8 }}>
          <h1>歡迎來到龍角鎮</h1>
          <p>這是一個由真人真實事蹟組成的小鎮。帶著你的 AI 角色進來逛逛，看看跟你相似的人做到了什麼，然後踏出你自己的第一步。</p>
          <div className="row wrap">
            <Link to="/login" className="btn primary">進入小鎮</Link>
            <a href="#map" className="btn ghost">先隨便看看</a>
          </div>
        </section>
      )}
      {me && !me.character && (
        <section className="panel hero row wrap">
          <div className="grow">
            <h2>先來設定你的角色吧</h2>
            <p>角色可以跟你完全不同。牠會替你在鎮上探索，也是你嘗試新事物時的「許可證」。</p>
          </div>
          <Link to="/me/character" className="btn primary">設定角色</Link>
        </section>
      )}
      {me?.character && (
        <section className="panel row wrap">
          <Avatar appearance={me.character.appearance} name={me.character.name} size={64} />
          <div className="grow">
            <h2 style={{ margin: 0 }}>{me.character.name} 正在鎮上</h2>
            <p className="muted">
              {me.wants.length ? `想做的事：${me.wants.filter((w) => w.status === "active").map((w) => `「${w.text}」`).join("、") || "（暫時沒有）"}` : "還沒有想做的事，去角色頁寫下一件吧。"}
            </p>
          </div>
          <div className="row wrap">
            {me.unread.discoveries > 0 && <Link to="/discoveries" className="btn primary">看看 {me.unread.discoveries} 個新發現</Link>}
            <Link to="/connect" className="btn ghost">連接 AI</Link>
          </div>
        </section>
      )}
      <section id="map" className="stack" style={{ gap: 8 }}>
        <div>
          <h2 style={{ margin: 0 }}>龍角鎮地圖</h2>
          <small>拖曳移動、滾輪或雙指縮放；點建築看看大家的事蹟</small>
        </div>
        <ErrorBox error={town.error} />
        {town.loading && !town.data ? <Loading /> : town.data && <Suspense fallback={<Loading />}><TownMap districts={town.data.districts} places={town.data.places} /></Suspense>}
      </section>
    </div>
  );
}
