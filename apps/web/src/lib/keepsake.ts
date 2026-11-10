import { api } from "./api";
import type { KeepsakeItem } from "./types";

export async function acceptKeepsake(item: KeepsakeItem) {
  const text = (item.title || item.object || "去摸摸看").trim().slice(0, 200);
  await api("/api/first-steps", { method: "POST", body: { executor: "self", text, sourceDeedIds: [item.deedId] } });
}
