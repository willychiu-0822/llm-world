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
  "login required": "請先登入",
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

const BY_CODE: Record<string, string> = {
  unauthorized: "請先登入",
  forbidden: "沒有權限",
  not_found: "找不到這個內容",
  invalid_input: "輸入的內容有誤",
  conflict: "操作衝突，請重新整理再試",
  rate_limited: "太頻繁了，請稍後再試",
  moderation_blocked: "內容不符合社群規範",
  step_already_done: "這一步已經完成了",
};

const hasCjk = (s: string) => /[㐀-鿿]/.test(s);

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: opts.method ?? "GET",
    credentials: "same-origin",
    headers: opts.body !== undefined ? { "content-type": "application/json" } : {},
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 204) return null as T;
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json() : await res.text();
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string } })?.error ?? {};
    const code = err.code ?? "internal";
    const raw = err.message ?? "";
    const message = KNOWN[raw] ?? (hasCjk(raw) ? raw : (BY_CODE[code] ?? "發生了一點問題，請稍後再試"));
    throw new ApiError(res.status, code, message);
  }
  return data as T;
}
