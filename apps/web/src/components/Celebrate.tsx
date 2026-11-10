import { STICKERS, growthLine, growthStage, nextGrowthAt, starLine, type Sticker } from "@lj/core";
import { useState } from "react";
import { Dialog } from "./Dialog";

/** The star is already saved. Closing — button, X, or Esc — only leaves the party. */
export function Celebrate({ fromStars, onClose }: { fromStars: number; onClose: (sticker?: Sticker) => void }) {
  const [sticker, setSticker] = useState<Sticker | undefined>();
  const stars = fromStars + 1;
  const goal = nextGrowthAt(stars) ?? stars;
  const stage = growthStage(stars);
  const grew = stage > growthStage(fromStars);
  const close = () => onClose(sticker);
  const lines = starLine(stars).split("。").map((s) => s.trim()).filter(Boolean);
  return (
    <Dialog title="做到了" onClose={close}>
      <div className="confetti" aria-hidden><span>★</span><span>★</span><span>★</span><span>★</span></div>
      <p className="star-pop">★ +1</p>
      {lines.map((line) => <p key={line}>{/[！!]$/.test(line) ? line : `${line}。`}</p>)}
      <p className="stat" aria-label="星星進度">★ {stars}/{goal}</p>
      {grew && <p className="notice grow-note">{growthLine(stage)}</p>}
      <p>當時的表情是？</p>
      <div className="stickers" role="group" aria-label="當時的表情是">
        {STICKERS.map((s) => (
          <button type="button" key={s} className="sticker" aria-pressed={sticker === s} onClick={() => setSticker((cur) => (cur === s ? undefined : s))}>{s}</button>
        ))}
      </div>
      <button type="button" className="btn primary" onClick={close}>收下星星</button>
    </Dialog>
  );
}
