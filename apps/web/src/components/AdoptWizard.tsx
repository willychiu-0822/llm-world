import { ACCESSORIES, ACCESSORY_LABELS, BODY_LABELS, BODY_SHAPES, PALETTE, type Appearance } from "@lj/core";
import { useState } from "react";
import { Avatar } from "./Avatar";

export function AdoptWizard({ initial, onSave }: { initial: { name: string; appearance: Appearance }; onSave: (value: { name: string; appearance: Appearance }) => Promise<void> }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initial.name);
  const [appearance, setAppearance] = useState<Appearance>(initial.appearance);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Appearance>) => setAppearance((a) => ({ ...a, ...patch }));

  const next = async () => {
    if (step < 2) {
      setStep(step + 1);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSave({ name: name.trim(), appearance });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="stack adopt">
      <div className="adopt-preview">
        <Avatar appearance={appearance} name={name || "小龍"} size={step === 1 ? 84 : 148} />
      </div>
      {step === 0 && (
        <section className="stack">
          <h1>圓圓的，還是高高的？</h1>
          <div className="pick" role="group" aria-label="體型">
            {BODY_SHAPES.map((b) => (
              <button type="button" key={b} aria-pressed={appearance.body === b} onClick={() => set({ body: b })}>
                <Avatar appearance={{ ...appearance, body: b, accessory: "none" }} name={BODY_LABELS[b]} size={44} />
                {BODY_LABELS[b]}
              </button>
            ))}
          </div>
        </section>
      )}
      {step === 1 && (
        <section className="stack">
          <h1>頭上要長什麼？</h1>
          <p>角？葉子？還是一頂貝雷帽？</p>
          <div className="pick" role="group" aria-label="配件">
            {ACCESSORIES.map((a) => (
              <button type="button" key={a} aria-pressed={appearance.accessory === a} onClick={() => set({ accessory: a })}>
                <Avatar appearance={{ ...appearance, accessory: a }} name={ACCESSORY_LABELS[a]} size={44} />
                {ACCESSORY_LABELS[a]}
              </button>
            ))}
          </div>
          <div className="field">
            <span>身體的顏色</span>
            <div className="swatches">
              {PALETTE.map((c) => <button type="button" key={c} className="swatch" style={{ background: c }} aria-label={`身體顏色 ${c}`} aria-pressed={appearance.main === c} onClick={() => set({ main: c })} />)}
            </div>
          </div>
          <div className="field">
            <span>頭上的顏色</span>
            <div className="swatches">
              {PALETTE.map((c) => <button type="button" key={`a-${c}`} className="swatch" style={{ background: c }} aria-label={`頭上顏色 ${c}`} aria-pressed={appearance.accent === c} onClick={() => set({ accent: c })} />)}
            </div>
          </div>
        </section>
      )}
      {step === 2 && (
        <section className="stack">
          <h1>叫什麼名字？</h1>
          <label className="field">
            <span>名字</span>
            <input aria-label="角色名字" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} required placeholder="小龍" />
          </label>
        </section>
      )}
      {error && <p role="alert" className="error">{error}</p>}
      <button className="btn primary" type="button" disabled={busy || (step === 2 && !name.trim())} onClick={() => void next()}>下一步</button>
    </div>
  );
}
