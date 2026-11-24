export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const KNOWN: Record<string, string> = {
  "already booked": "你已經報名這個場次了",
  "session is full": "這個場次已經額滿",
  "already applied": "你已經申請過了",
  "login required": "請先登入，才能繼續。",
  "trial not available": "這個試用機會目前無法使用",
  "cannot reference your own deed": "不能參考自己做過的事",
  "source deed not available": "這件參考已經看不到了",
  "step must be confirmed and not done": "這一步已經完成，或還沒確認",
  "AI steps are completed by your AI": "AI 步驟要由你的 AI 角色完成",
  "this step has no planned time": "這一步沒有設定時間",
  "step is not a draft": "這一步已經確認過了",
  "approved provider required": "需要先成為核准的提供者",
  "connection not found": "找不到這個連接",
};

/** Shared, novice-safe error copy: studio tone, and each line has a next step. */
export const FRIENDLY_BY_CODE: Record<string, string> = {
  unauthorized: "請先登入，才能繼續。",
  forbidden: "這裡還打不開。先回家陪小龍吧。",
  not_found: "找不到這份內容了。回地圖再找找看？",
  invalid_input: "這裡有個地方沒填對。改一下再送一次？",
  conflict: "剛剛有人同時改了同一件事。重新整理再試一次就好。",
  rate_limited: "一下子按太多次了。歇一口氣再試一次。",
  moderation_blocked: "這段話小龍唸不出來，換一個寫法試試？",
  step_already_done: "這一步已經做完了。看看下一步吧。",
};

export const FRIENDLY_FALLBACK = "剛剛沒連上。再試一次看看。";

/** AdoptWizard uses this when a proposed name is blocked. */
export const NAME_MODERATION_HINT = "這個名字小龍唸不出來，換一個試試？";

const hasCjk = (s: string) => /[㐀-鿿]/.test(s);

export async function api<T = unknown>(
  path: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<T> {
  const method = opts.method ?? "GET";
  // 讀取最多等 20 秒；等不到就報錯，畫面會出現「再試一次」，不會一直轉圈。寫入不設時限，免得重複送出。
  const res = await fetch(path, {
    signal: method === "GET" ? AbortSignal.timeout(20_000) : undefined,
    method,
    credentials: "same-origin",
    headers: opts.body !== undefined ? { "content-type": "application/json" } : {},
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  }).catch((e: unknown) => {
    if (e instanceof DOMException && (e.name === "TimeoutError" || e.name === "AbortError"))
      throw new ApiError(0, "timeout", "連線有點慢，再試一次看看");
    throw e;
  });
  if (res.status === 204) return null as T;
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json() : await res.text();
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string } })?.error ?? {};
    const code = err.code ?? "internal";
    const raw = err.message ?? "";
    const message = KNOWN[raw] ?? FRIENDLY_BY_CODE[code] ?? (hasCjk(raw) ? raw : FRIENDLY_FALLBACK);
    throw new ApiError(res.status, code, message);
  }
  return data as T;
}
