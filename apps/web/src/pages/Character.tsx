import { DEFAULT_APPEARANCE, type Appearance } from "@lj/core";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdoptWizard } from "../components/AdoptWizard";
import { Avatar } from "../components/Avatar";
import { api } from "../lib/api";
import { useSession } from "../lib/session";

export function CharacterPage() {
  const { me, reload } = useSession();
  const nav = useNavigate();
  const [hatch, setHatch] = useState<{ name: string; appearance: Appearance } | null>(null);
  if (!me) return null;
  const first = !me.character;
  if (hatch) {
    return (
      <div className="hatch" role="status" aria-live="assertive">
        <div className="hatch-baby"><Avatar appearance={hatch.appearance} name={hatch.name} size={180} /></div>
        <p>嗨！我是{hatch.name}。</p>
      </div>
    );
  }
  const appearance = (me.character?.appearance as Appearance | undefined) ?? DEFAULT_APPEARANCE;
  return (
    <AdoptWizard
      initial={{ name: me.character?.name ?? "", appearance }}
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
        if (!first) {
          nav("/me");
          return;
        }
        setHatch(value);
        window.setTimeout(() => nav("/"), 1500);
      }}
    />
  );
}
