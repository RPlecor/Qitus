import type { TransactionDirection, TransactionExplorerQuery } from "./transaction-explorer.server";

export type TransactionStatusFilter = "all" | "review" | "categorized" | "confirmed" | "corrected" | "has_rule";

export type TransactionFilterState = {
  page: number;
  pageSize: 25 | 50 | 100;
  status: TransactionStatusFilter;
  search: string;
  dateFrom: string;
  dateTo: string;
  account: string;
  direction: TransactionDirection;
};

export type ActiveTransactionFilterLabel = {
  key: keyof TransactionFilterState;
  label: string;
};

const defaultState: TransactionFilterState = {
  page: 1,
  pageSize: 25,
  status: "all",
  search: "",
  dateFrom: "",
  dateTo: "",
  account: "",
  direction: "all",
};

const statuses = new Set<TransactionStatusFilter>(["all", "review", "categorized", "confirmed", "corrected", "has_rule"]);
const directions = new Set<TransactionDirection>(["all", "debit", "credit"]);
const pageSizes = new Set([25, 50, 100]);

export class TransactionFilterStateCenter {
  getDefaultState() {
    return { ...defaultState };
  }

  parseFromUrl(url: URL) {
    return this.normalize({
      page: url.searchParams.get("page"),
      pageSize: url.searchParams.get("pageSize"),
      status: url.searchParams.get("status"),
      search: url.searchParams.get("search"),
      dateFrom: url.searchParams.get("dateFrom"),
      dateTo: url.searchParams.get("dateTo"),
      account: url.searchParams.get("account"),
      direction: url.searchParams.get("direction"),
    });
  }

  normalize(input: Partial<Record<keyof TransactionFilterState, unknown>> = {}): TransactionFilterState {
    const page = clampInt(input.page, 1, 9999, defaultState.page);
    const requestedPageSize = clampInt(input.pageSize, 25, 100, defaultState.pageSize);
    const pageSize = pageSizes.has(requestedPageSize) ? requestedPageSize as TransactionFilterState["pageSize"] : defaultState.pageSize;
    const status = stringInSet(input.status, statuses, defaultState.status);
    const direction = stringInSet(input.direction, directions, defaultState.direction);
    return {
      page,
      pageSize,
      status,
      search: normalizeText(input.search),
      dateFrom: normalizeDate(input.dateFrom),
      dateTo: normalizeDate(input.dateTo),
      account: normalizeText(input.account),
      direction,
    };
  }

  toUrlParams(state: TransactionFilterState, overrides: Partial<TransactionFilterState> = {}) {
    const normalized = this.normalize({ ...state, ...overrides });
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(normalized)) {
      if (key === "page" && value === defaultState.page) continue;
      if (key === "pageSize" && value === defaultState.pageSize) continue;
      if (key === "status" && value === defaultState.status) continue;
      if (key === "direction" && value === defaultState.direction) continue;
      if (value === "") continue;
      params.set(key, String(value));
    }
    return params;
  }

  toExplorerQuery(state: TransactionFilterState): TransactionExplorerQuery {
    return {
      page: state.page,
      pageSize: state.pageSize,
      status: state.status,
      search: state.search || null,
      dateFrom: state.dateFrom || null,
      dateTo: state.dateTo || null,
      account: state.account || null,
      direction: state.direction,
    };
  }

  describeActiveFilters(state: TransactionFilterState): ActiveTransactionFilterLabel[] {
    const labels: ActiveTransactionFilterLabel[] = [];
    if (state.status !== "all") labels.push({ key: "status", label: statusLabel(state.status) });
    if (state.search) labels.push({ key: "search", label: `Recherche: ${state.search}` });
    if (state.dateFrom) labels.push({ key: "dateFrom", label: `Depuis ${formatDateLabel(state.dateFrom)}` });
    if (state.dateTo) labels.push({ key: "dateTo", label: `Jusqu'au ${formatDateLabel(state.dateTo)}` });
    if (state.account) labels.push({ key: "account", label: `Compte ${state.account}` });
    if (state.direction !== "all") labels.push({ key: "direction", label: state.direction === "debit" ? "Décaissements" : "Encaissements" });
    if (state.pageSize !== defaultState.pageSize) labels.push({ key: "pageSize", label: `${state.pageSize} par page` });
    return labels;
  }
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeDate(value: unknown) {
  const text = normalizeText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function stringInSet<T extends string>(value: unknown, allowed: Set<T>, fallback: T): T {
  return typeof value === "string" && allowed.has(value as T) ? value as T : fallback;
}

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function statusLabel(status: TransactionStatusFilter) {
  const labels: Record<TransactionStatusFilter, string> = {
    all: "Toutes",
    review: "À vérifier",
    categorized: "Catégorisées",
    confirmed: "Confirmées",
    corrected: "Corrigées",
    has_rule: "Avec règle",
  };
  return labels[status];
}

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}
