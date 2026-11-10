import { api } from "./api";

export async function acceptKeepsake(item: { deedId: string; title?: string; object?: string }) {
  const text = (item.title || item.object || "去摸摸看").trim().slice(0, 200);
  await api("/api/first-steps", { method: "POST", body: { executor: "self", text, sourceDeedIds: [item.deedId] } });
}
