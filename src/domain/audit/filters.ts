import type { AuditEntityType, AuditEventType } from "@/lib/audit/log-event";
import {
  AUDIT_ENTITY_TYPE_LABEL,
  AUDIT_EVENT_CATEGORIES,
  AUDIT_EVENT_TYPE_LABEL,
  auditEventTypesOf,
  type AuditEventCategory,
} from "@/domain/audit/labels";
import type { AuditEventQuery } from "@/domain/audit/types";

export const AUDIT_PAGE_SIZES = [20, 50, 100] as const;
export type AuditPageSize = (typeof AUDIT_PAGE_SIZES)[number];

/** I filtri di Impostazioni > Attività: gli stessi che vivono nell'URL (v. parseAuditFilters/auditFiltersToParams). */
export interface AuditFilters {
  /** yyyy-mm-dd o "". */
  from: string;
  /** yyyy-mm-dd o "". */
  to: string;
  area: AuditEventCategory | null;
  /** Se presenti prevalgono sull'area. */
  types: AuditEventType[];
  entity: { type: AuditEntityType; id: string } | null;
  pageSize: AuditPageSize;
  /** 1-based. */
  page: number;
}

export const EMPTY_AUDIT_FILTERS: AuditFilters = {
  from: "",
  to: "",
  area: null,
  types: [],
  entity: null,
  pageSize: 20,
  page: 1,
};

/** I parametri dell'URL come arrivano da `searchParams` (valori già estratti, mai un array). */
export type AuditFilterParams = Partial<Record<"from" | "to" | "area" | "types" | "entity" | "size" | "page", string>>;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validDate(value: string | undefined): string {
  return value && ISO_DATE.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime()) ? value : "";
}

/** Un URL manomesso o vecchio non rompe la pagina: ogni parametro non valido torna al suo valore di partenza. */
export function parseAuditFilters(rawParams: AuditFilterParams): AuditFilters {
  // Un parametro ripetuto (?from=a&from=b) arriva da Next come array: lo si tratta come assente.
  const params: AuditFilterParams = Object.fromEntries(
    Object.entries(rawParams).filter(([, value]) => typeof value === "string"),
  );
  const area = AUDIT_EVENT_CATEGORIES.find((candidate) => candidate === params.area) ?? null;

  const types = (params.types ?? "")
    .split(",")
    .filter((type): type is AuditEventType => Object.hasOwn(AUDIT_EVENT_TYPE_LABEL, type));

  let entity: AuditFilters["entity"] = null;
  const [entityType, entityId] = (params.entity ?? "").split(":");
  if (entityType && entityId && Object.hasOwn(AUDIT_ENTITY_TYPE_LABEL, entityType) && UUID.test(entityId)) {
    entity = { type: entityType as AuditEntityType, id: entityId };
  }

  const pageSize = AUDIT_PAGE_SIZES.find((size) => String(size) === params.size) ?? EMPTY_AUDIT_FILTERS.pageSize;
  const page = Number.parseInt(params.page ?? "", 10);

  return {
    from: validDate(params.from),
    to: validDate(params.to),
    area,
    types: [...new Set(types)],
    entity,
    pageSize,
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

/** Solo ciò che differisce dai valori di partenza: l'URL di un elenco senza filtri resta pulito. */
export function auditFiltersToParams(filters: AuditFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.area) params.set("area", filters.area);
  if (filters.types.length > 0) params.set("types", filters.types.join(","));
  if (filters.entity) params.set("entity", `${filters.entity.type}:${filters.entity.id}`);
  if (filters.pageSize !== EMPTY_AUDIT_FILTERS.pageSize) params.set("size", String(filters.pageSize));
  if (filters.page > 1) params.set("page", String(filters.page));
  return params;
}

/** I tipi da cercare: quelli scelti a mano, altrimenti tutti quelli dell'area, altrimenti nessun vincolo. */
export function effectiveAuditTypes(filters: Pick<AuditFilters, "area" | "types">): AuditEventType[] {
  if (filters.types.length > 0) return filters.types;
  return filters.area ? auditEventTypesOf(filters.area) : [];
}

export function auditFiltersToQuery(filters: AuditFilters): AuditEventQuery {
  return {
    startDate: filters.from || null,
    endDate: filters.to || null,
    types: effectiveAuditTypes(filters),
    entity: filters.entity,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

/** Quanti criteri sono attivi (periodo = 1, a prescindere da quanti estremi): serve a mostrare "Azzera filtri". Righe per pagina e pagina non contano. */
export function countActiveAuditFilters(filters: AuditFilters): number {
  return (
    (filters.from || filters.to ? 1 : 0) + (filters.area ? 1 : 0) + filters.types.length + (filters.entity ? 1 : 0)
  );
}

function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Gli ultimi `days` giorni, oggi incluso: "ultimi 7 giorni" = da 6 giorni fa a oggi. */
export function lastDaysRange(days: number, today: Date = new Date()): { from: string; to: string } {
  const start = new Date(today);
  start.setDate(start.getDate() - (days - 1));
  return { from: toIsoDate(start), to: toIsoDate(today) };
}

/** Cambiando area, i tipi scelti che non le appartengono non hanno più senso e cadono. */
export function typesWithinArea(types: AuditEventType[], area: AuditEventCategory | null): AuditEventType[] {
  if (!area) return types;
  const allowed = new Set(auditEventTypesOf(area));
  return types.filter((type) => allowed.has(type));
}
