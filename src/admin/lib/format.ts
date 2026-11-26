import { WILAYAS } from "@/lib/wilayas";

const money = new Intl.NumberFormat("fr-DZ", { style: "currency", currency: "DZD", maximumFractionDigits: 0, numberingSystem: "latn" });
const compactMoney = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });
const int = new Intl.NumberFormat("fr-FR");

/** 12 500 DA */
export const dzd = (v: number | null | undefined) => (v === null || v === undefined ? "—" : money.format(v));
/** 12,5 k DA (axes de graphiques, KPI compacts) */
export const dzdCompact = (v: number) => `${compactMoney.format(v)} DA`;
export const num = (v: number | null | undefined) => (v === null || v === undefined ? "—" : int.format(v));
export const pct = (v: number, digits = 1) => `${(v * 100).toFixed(digits).replace(".", ",")} %`;

const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const fullFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });
const dayFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });

const toDate = (v: string | Date) => (v instanceof Date ? v : new Date(v));
export const fmtDate = (v: string | Date | null | undefined) => (v ? dateFmt.format(toDate(v)) : "—");
export const fmtDateTime = (v: string | Date | null | undefined) => (v ? dateTimeFmt.format(toDate(v)) : "—");
export const fmtFull = (v: string | Date | null | undefined) => (v ? fullFmt.format(toDate(v)) : "—");
/** "2026-11-24" → "24 nov." (series keys are already local calendar days) */
export const fmtDay = (isoDay: string) => dayFmt.format(new Date(`${isoDay}T00:00:00Z`));

const rtf = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });
/** "il y a 3 minutes", "hier", puis une date au-delà d’une semaine */
export function ago(v: string | Date | null | undefined, now = Date.now()): string {
  if (!v) return "—";
  const diff = (toDate(v).getTime() - now) / 1000;
  const abs = Math.abs(diff);
  if (abs < 45) return "à l’instant";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 7 * 86400) return rtf.format(Math.round(diff / 86400), "day");
  return fmtDate(v);
}

export const wilayaName = (code: string | null | undefined) => {
  if (!code) return "—";
  const w = WILAYAS.find((x) => x.code === code);
  return w ? `${code} · ${w.fr}` : code;
};

export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";

export function downloadUrl(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function slugify(s: string) {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}
