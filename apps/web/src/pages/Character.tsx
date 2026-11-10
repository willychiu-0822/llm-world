import { DEFAULT_APPEARANCE, type Appearance } from "@lj/core";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdoptWizard } from "../components/AdoptWizard";
import { Avatar } from "../components/Avatar";
import { api } from "../lib/api";
import { useSession } from "../lib/session";

const HATCH_KEY = "lj-hatch";

function readHatch(): { name: string; appearance: Appearance } | null {
  try {
    const raw = sessionStorage.getItem(HATCH_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as { name?: string; appearance?: Appearance };
    if (!value.name || !value.appearance) return null;
    return { name: value.name, appearance: value.appearance };
  } catch {
    return null;
  }
}

export function CharacterPage() {
  const { me, reload } = useSession();
  const nav = useNavigate();
  const [hatch, setHatch] = useState<{ name: string; appearance: Appearance } | null>(readHatch);
  const [hatchStill] = useState(() => sessionStorage.getItem("lj-hatch-played") === "1");
  useEffect(() => {
    if (hatch) sessionStorage.setItem("lj-hatch-played", "1");
  }, [hatch]);
  if (!me) return null;
  const first = !me.character;
  if (hatch) {
    return (
      <div className="hatch" role="status" aria-live="polite">
        <div className={hatchStill ? "hatch-baby is-still" : "hatch-baby"}><Avatar appearance={hatch.appearance} name={hatch.name} size={180} /></div>
        <p>嗨！我是{hatch.name}。</p>
        <button type="button" className="btn primary" onClick={() => { sessionStorage.removeItem(HATCH_KEY); nav("/"); }}>去找牠</button>
      </div>
    );
  }
  const appearance = (me.character?.appearance as Appearance | undefined) ?? DEFAULT_APPEARANCE;
  return (
    <AdoptWizard
      initial={{ name: me.character?.name ?? "", appearance }}
      draftKey={first ? "lj-adopt" : undefined}
      finishLabel={first ? "帶牠回家" : "存好了"}
      onSave={async (value) => {
        await api("/api/me/character", {
          method: "PUT",
          body: {
            name: value.name,
            appearance: { ...value.appearance, description: me.character?.appearance.description ?? "" },
            personality: me.character?.personality ?? "",
            sharing: { allowAiQuotes: me.character?.sharing.allowAiQuotes ?? true },
          },
        });
        await reload();
        sessionStorage.removeItem("lj-adopt");
        if (!first) {
          nav("/me");
          return;
        }
        sessionStorage.setItem(HATCH_KEY, JSON.stringify(value));
        setHatch(value);
      }}
    />
  );
}
