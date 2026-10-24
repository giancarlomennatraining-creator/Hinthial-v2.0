import { AUDIT_ENTITY_TYPE_LABEL } from "@/domain/audit/labels";
import type { AuditEntityType } from "@/lib/audit/log-event";

export const LOGIN_METHOD_LABEL: Record<string, string> = {
  password: "Password",
  totp: "App authenticator (TOTP)",
  backup_code: "Codice di backup",
};

export const FIELD_CLASS =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50";
export const LABEL_CLASS = "text-xs font-medium text-zinc-600 dark:text-zinc-400";
export const SECONDARY_BUTTON_CLASS =
  "rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900";

export const ENTITY_TYPES = Object.keys(AUDIT_ENTITY_TYPE_LABEL) as AuditEntityType[];

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDay(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function periodLabel(from: string, to: string): string {
  if (from && to) return `Dal ${formatDay(from)} al ${formatDay(to)}`;
  return from ? `Dal ${formatDay(from)}` : `Fino al ${formatDay(to)}`;
}
