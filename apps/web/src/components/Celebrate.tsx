import { STICKERS, growthLine, growthStage, nextGrowthAt, starLine, type Sticker } from "@lj/core";
import { useState } from "react";
import { Dialog } from "./Dialog";

export function Celebrate({ fromStars, error, busy, onClaim, onDismiss }: { fromStars: number; error: string; busy?: boolean; onClaim: (sticker?: Sticker) => void; onDismiss: () => void }) {
  const [sticker, setSticker] = useState<Sticker | undefined>();
  const stars = fromStars + 1;
  const goal = nextGrowthAt(stars) ?? stars;
  const stage = growthStage(stars);
  const grew = stage > growthStage(fromStars);
  return (
    <Dialog title="做到了" busy={busy} onClose={onDismiss}>
      <div className="confetti" aria-hidden><span>★</span><span>★</span><span>★</span><span>★</span></div>
      <p className="star-pop">★ +1</p>
      <p>{starLine(stars)}</p>
      <p className="stat" aria-label="星星進度">★ {stars}/{goal}</p>
      {grew && <p className="notice grow-note">{growthLine(stage)}</p>}
      <p>當時的表情是？</p>
      <div className="stickers" role="group" aria-label="當時的表情是">
        {STICKERS.map((s) => (
          <button type="button" key={s} className="sticker" aria-pressed={sticker === s} disabled={busy} onClick={() => setSticker((cur) => (cur === s ? undefined : s))}>{s}</button>
        ))}
      </div>
      {error && <p role="alert" className="error">{error}</p>}
      <button type="button" className="btn primary" disabled={busy} onClick={() => onClaim(sticker)}>{busy ? "收下中…" : "收下星星"}</button>
      <button type="button" className="btn ghost" disabled={busy} onClick={onDismiss}>先不要</button>
    </Dialog>
  );
}
