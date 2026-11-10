import { BABY_LINES, joinWords, stageLabel } from "@lj/core";
import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Avatar } from "../components/Avatar";
import { Dialog } from "../components/Dialog";
import { MapBoard } from "../components/MapBoard";
import { api } from "../lib/api";
import { acceptKeepsake } from "../lib/keepsake";
import { useSession } from "../lib/session";
import type { KeepsakeItem, PetSummary, Step, Town } from "../lib/types";
import { useFetch } from "../lib/useFetch";

const EMPTY: PetSummary = { stars: 0, stage: 0, nextAt: 3, accessories: [], canWalk: true, collected: 0, total: 0, letter: false, notify: true, pending: null };
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
  const [found, setFound] = useState<KeepsakeItem | null>(null);
  const [backpackNote, setBackpackNote] = useState(false);
  const [shelved, setShelved] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");
  const [bubble, setBubble] = useState<string | null>(null);
  const [jump, setJump] = useState(false);
  const [letterOpen, setLetterOpen] = useState(false);
  const [mailOpen, setMailOpen] = useState(false);
  const [didWalk, setDidWalk] = useState(false);
  const gate = useRef(false);

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
  const backpack = pet.accessories.includes("backpack") || backpackNote;
  const goal = pet.nextAt ?? pet.stars;
  const openTries = (steps.data ?? []).length;
  const card = phase === "walking" || shelved ? null : (found ?? (phase === "home" ? pet.pending : null));

  const poke = () => {
    setBubble(BABY_LINES[Math.floor(Math.random() * BABY_LINES.length)] ?? BABY_LINES[0]);
    setJump(true);
    window.setTimeout(() => setJump(false), 450);
  };

  const walk = async () => {
    if (!pet.canWalk || phase !== "home" || gate.current) return;
    gate.current = true;
    setError("");
    setShelved(false);
    setPhase("walking");
    try {
      const res = await api<WalkResult>("/api/me/walk", { method: "POST" });
      setFound(res.keepsake);
      setBackpackNote(res.reward === "backpack");
      await new Promise((r) => window.setTimeout(r, OUTING_MS));
      setDidWalk(true);
      setPhase("found");
      await reload();
    } catch (err) {
      setPhase("home");
      setError((err as Error).message || "咦，小龍迷路了。再試一次？");
    } finally {
      gate.current = false;
    }
  };

  const accept = async (item: KeepsakeItem) => {
    if (gate.current) return;
    gate.current = true;
    setAccepting(true);
    setError("");
    try {
      await acceptKeepsake(item);
      await reload();
      nav("/tries", { state: { hello: true } });
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg.includes("事蹟") || msg.includes("參考") ? "這顆信物先放著。換一顆摸摸看？" : "咦，小龍迷路了。再試一次？");
      gate.current = false;
      setAccepting(false);
    }
  };

  const walkedToday = (!pet.canWalk || didWalk) && phase !== "walking";
  const walkLabel = phase === "walking" ? "小龍還在外面晃…" : "出門逛逛";

  return (
    <div className="stack baby-home">
      <div className="home-chrome">
        <p className="star-line">★ {pet.stars}/{goal || 0}　{stageLabel(pet.stage)}</p>
        <div className="row">
          <button type="button" className="icon-btn" aria-label="郵筒" onClick={() => (pet.letter ? setLetterOpen(true) : setMailOpen(true))}>
            ✉️
            {!pet.letter && pet.notify && me.unread.notifications > 0 && <span className="badge">{me.unread.notifications}</span>}
          </button>
          <Link to="/me" className="icon-btn" aria-label="設定">⚙️</Link>
        </div>
      </div>

      <div className="baby-stage">
        {bubble && <p className="bubble baby-bubble" role="status">{bubble}</p>}
        <div className={`baby-wrap stage-${pet.stage}`}>
          <button type="button" className={jump ? "baby-hit jump" : "baby-hit"} onClick={poke} aria-label={baby.name}>
            <Avatar appearance={baby.appearance} name={baby.name} size={156} />
            {backpack && <span className="backpack" aria-label="小背包">🎒</span>}
            {pet.stage >= 2 && baby.appearance.accessory !== "scarf" && <span className="scarf-extra" aria-hidden>🧣</span>}
          </button>
          <strong>{baby.name}</strong>
        </div>
      </div>
      <div className="baby-actions stack">

      {!card && phase !== "found" && ((pet.canWalk && !didWalk) || phase === "walking") && (
        <button type="button" className="btn primary walk-btn" disabled={phase === "walking"} aria-busy={phase === "walking"} onClick={() => void walk()}>
          {walkLabel}
        </button>
      )}
      {!card && walkedToday && (
        <>
          <p>今天已經出門了。收藏櫃還有位子。</p>
          <Link to="/cabinet" className="btn primary">去收藏櫃看看</Link>
        </>
      )}
      {phase === "home" && !card && openTries > 0 && <Link to="/tries" className="btn ghost">我接下的事</Link>}
      {phase === "walking" && (
        <div className="outing" aria-live="polite">
          <p>小龍出門了，大概{joinWords("在", found?.placeName || "草叢")}附近亂聞。</p>
          <div className="outing-track" aria-hidden><span className="outing-dot">🐾</span></div>
        </div>
      )}
      {error && <p role="alert" className="error">{/[㐀-鿿]/.test(error) ? error : "咦，小龍迷路了。再試一次？"}</p>}
      {card && (
        <article className="panel keepsake-card stack">
          {backpackNote && <p className="notice" role="status">小背包背好了。</p>}
          <p className="keepsake-emoji" aria-hidden>{card.emoji}</p>
          <p>{joinWords("從", card.placeName || "鎮上")}撿到的{card.object}</p>
          <p>{card.warmLine}</p>
          <button type="button" className="btn primary" disabled={accepting} aria-busy={accepting} onClick={() => void accept(card)}>
            {accepting ? "記下來…" : "我也去摸摸看"}
          </button>
          <button type="button" className="btn ghost" disabled={accepting} onClick={() => { setShelved(true); setPhase("home"); setFound(null); }}>收進櫃裡</button>
        </article>
      )}
      </div>

      {letterOpen && (
        <Dialog title="小龍的信" onClose={() => setLetterOpen(false)}>
          <p>📮</p>
          <p>小龍寫了一封歪歪扭扭的信：「我想交一個會說話的朋友，幫我去打聽消息。你有認識的嗎？」</p>
          <Link to="/connect" className="btn primary">會說話的朋友</Link>
          <button type="button" className="btn ghost" onClick={() => setLetterOpen(false)}>先收起來</button>
        </Dialog>
      )}
      {mailOpen && (
        <Dialog title="郵筒" onClose={() => setMailOpen(false)}>
          <p>📮</p>
          <p>還沒有信。小龍說有信會塞進來。</p>
          <button type="button" className="btn primary" onClick={() => setMailOpen(false)}>好</button>
        </Dialog>
      )}
    </div>
  );
}
