const TZ = "Asia/Taipei";

export function formatDateTime(v: string | Date | null | undefined): string {
  if (!v) return "";
  return new Intl.DateTimeFormat("zh-TW", { timeZone: TZ, month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(v));
}

export function formatDate(v: string | Date | null | undefined): string {
  if (!v) return "";
  return new Intl.DateTimeFormat("zh-TW", { timeZone: TZ, year: "numeric", month: "numeric", day: "numeric" }).format(new Date(v));
}

export function timeAgo(v: string | Date, now = new Date()): string {
  const s = Math.max(0, (now.getTime() - new Date(v).getTime()) / 1000);
  if (s < 60) return "剛剛";
  if (s < 3600) return `${Math.floor(s / 60)} 分鐘前`;
  if (s < 86400) return `${Math.floor(s / 3600)} 小時前`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} 天前`;
  return formatDate(v);
}
