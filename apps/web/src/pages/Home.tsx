import { BABY_LINES, stageLabel } from "@lj/core";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Avatar } from "../components/Avatar";
import { MapBoard } from "../components/MapBoard";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import type { KeepsakeItem, PetSummary, Step, Town } from "../lib/types";
import { useFetch } from "../lib/useFetch";

const EMPTY: PetSummary = { stars: 0, stage: 0, nextAt: 3, accessories: [], canWalk: true, collected: 0, total: 0, letter: false, notify: true };
const OUTING_MS = 2400;

interface WalkResult {
  keepsake: KeepsakeItem;
  reward: "backpack" | null;
  pet: PetSummary;
}

function GuestHome() {
  const town = useFetch<Town>("/api/town");
  return (
    <div className="stack">
      <section className="panel hero stack">
        <h1>龍角鎮</h1>
        <p>有一顆蛋在龍角鎮門口滾來滾去。好像在等你。</p>
        <Link to="/login" className="btn primary">把牠撿回家</Link>
      </section>
      <MapBoard town={town.data} error={town.error} loading={town.loading} />
    </div>
  );
}

export function HomePage() {
  const { me, loading, reload } = useSession();
  const nav = useNavigate();
  const steps = useFetch<Step[]>(me?.character ? "/api/first-steps?status=confirmed" : null);
  const [phase, setPhase] = useState<"home" | "walking" | "found">("home");
  const [keepsake, setKeepsake] = useState<KeepsakeItem | null>(null);
  const [reward, setReward] = useState(false);
  const [error, setError] = useState("");
  const [bubble, setBubble] = useState<string | null>(null);
  const [jump, setJump] = useState(false);
  const [letterOpen, setLetterOpen] = useState(false);

  if (loading && !me) return <p className="empty">載入中……</p>;
  if (!me) return <GuestHome />;
  if (!me.character) {
    return (
      <section className="panel hero stack adopt-prompt">
        <h1>有一顆蛋在門口。</h1>
        <p>滾來滾去，好像在等你。</p>
        <Link to="/me/character" className="btn primary">把牠撿回家</Link>
      </section>
    );
  }

  const pet = me.pet ?? EMPTY;
  const baby = me.character;
  const backpack = pet.accessories.includes("backpack") || reward;
  const goal = pet.nextAt ?? pet.stars;
  const openTries = (steps.data ?? []).length;

  const poke = () => {
    setBubble(BABY_LINES[Math.floor(Math.random() * BABY_LINES.length)] ?? BABY_LINES[0]);
    setJump(true);
    window.setTimeout(() => setJump(false), 450);
  };

  const walk = async () => {
    if (!pet.canWalk || phase !== "home") return;
    setError("");
    setPhase("walking");
    try {
      const res = await api<WalkResult>("/api/me/walk", { method: "POST" });
      setKeepsake(res.keepsake);
      await new Promise((r) => window.setTimeout(r, OUTING_MS));
      setReward(res.reward === "backpack");
      setPhase("found");
      await reload();
    } catch (err) {
      setPhase("home");
      setError((err as Error).message || "咦，小龍迷路了。再試一次？");
    }
  };

  const dismissLetter = async () => {
    await api("/api/me/pet", { method: "PATCH", body: { letterDismissed: true } });
    await reload();
    setLetterOpen(false);
  };

  return (
    <div className="stack baby-home">
      <div className="home-chrome">
        <p className="star-line">★ {pet.stars}/{goal || 0}　{stageLabel(pet.stage)}</p>
        <div className="row">
          {pet.letter ? (
            <button type="button" className="icon-btn" aria-label="郵筒" onClick={() => setLetterOpen(true)}>✉️</button>
          ) : (
            <Link to="/notifications" className="icon-btn" aria-label="郵筒">
              ✉️
              {pet.notify && me.unread.notifications > 0 && <span className="badge">{me.unread.notifications}</span>}
            </Link>
          )}
          <Link to="/me" className="icon-btn" aria-label="設定">⚙️</Link>
        </div>
      </div>

      {bubble && <p className="bubble baby-bubble" role="status">{bubble}</p>}
      <div className={`baby-wrap stage-${pet.stage}`}>
        <button type="button" className={jump ? "baby-hit jump" : "baby-hit"} onClick={poke} aria-label={baby.name}>
          <Avatar appearance={baby.appearance} name={baby.name} size={156} />
          {backpack && <span className="backpack" aria-label="小背包">🎒</span>}
          {pet.stage >= 2 && baby.appearance.accessory !== "scarf" && <span className="scarf-extra" aria-hidden>🧣</span>}
        </button>
        <strong>{baby.name}</strong>
      </div>

      {phase !== "found" && (
        <button type="button" className="btn primary walk-btn" disabled={!pet.canWalk || phase === "walking"} onClick={() => void walk()}>
          {phase === "walking" || !pet.canWalk ? "寶寶在外面，晚點回來" : "出門逛逛"}
        </button>
      )}
      {phase === "home" && openTries > 0 && <Link to="/tries">我接下的事</Link>}
      {phase === "walking" && (
        <div className="outing" aria-live="polite">
          <p>小龍出門了，大概在{keepsake?.placeName || "草叢"}附近亂聞。</p>
          <div className="outing-track" aria-hidden><span className="outing-dot">🐾</span></div>
        </div>
      )}
      {error && <p role="alert" className="error">{/[㐀-鿿]/.test(error) ? error : "咦，小龍迷路了。再試一次？"}</p>}
      {phase === "found" && keepsake && (
        <article className="panel keepsake-card stack">
          <p className="keepsake-emoji" aria-hidden>{keepsake.emoji}</p>
          <p>從{keepsake.placeName || "鎮上"}撿到的{keepsake.object}</p>
          <p>{keepsake.warmLine}</p>
          {!reward && (
            <>
              <button type="button" className="btn primary" onClick={() => nav(`/tries/new?deed=${keepsake.deedId}`)}>我也去摸摸看</button>
              <button type="button" className="btn ghost" onClick={() => { setPhase("home"); setKeepsake(null); }}>收進櫃裡</button>
            </>
          )}
        </article>
      )}

      {reward && (
        <div className="veil" role="dialog" aria-label="新配件" onClick={() => setReward(false)}>
          <div className="celebrate" onClick={(e) => e.stopPropagation()}>
            <p className="star-pop">🎒</p>
            <h2>新配件！</h2>
            <p>小背包。小龍背好了。</p>
            <button type="button" className="btn primary" onClick={() => setReward(false)}>好耶</button>
          </div>
        </div>
      )}
      {letterOpen && (
        <div className="veil" role="dialog" aria-label="小龍的信">
          <div className="celebrate stack">
            <p>📮</p>
            <p>小龍寫了一封歪歪扭扭的信：「我想交一個會說話的朋友，幫我去打聽消息。你有認識的嗎？」</p>
            <Link to="/connect" className="btn primary">我有在用 ChatGPT／Claude</Link>
            <button type="button" className="btn ghost" onClick={() => void dismissLetter()}>沒有，下次再說</button>
          </div>
        </div>
      )}
    </div>
  );
}
