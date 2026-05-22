import { ExpectedRouteError } from "../route-errors.server";
import { getRuntimeConfig, type RuntimeConfig } from "../runtime-config.server";

export type StripeBalanceTransaction = {
  id: string;
  type: string;
  created: number;
  amount: number;
  fee: number;
  net: number;
  currency: string;
  description?: string | null;
  status?: string;
  payout?: string | null;
  source?: string | null;
};

export type StripePayoutPayload = {
  id: string;
  amount: number;
  currency: string;
  arrival_date: number;
  status: string;
  description?: string | null;
};

type StripeList<T> = {
  data: T[];
  has_more: boolean;
};

export class StripeConnectorAdapter {
  constructor(
    private readonly config: RuntimeConfig = getRuntimeConfig(),
    private readonly fetcher: typeof fetch = fetch
  ) {}

  async sync(input: { fiscalYearStart: Date; fiscalYearEnd: Date }) {
    this.assertConfigured();
    const created = {
      gte: Math.floor(input.fiscalYearStart.getTime() / 1000),
      lte: Math.floor(input.fiscalYearEnd.getTime() / 1000),
    };
    const [balanceTransactions, payouts] = await Promise.all([
      this.listAll<StripeBalanceTransaction>("/balance_transactions", { created }),
      this.listAll<StripePayoutPayload>("/payouts", { created }),
    ]);
    return { balanceTransactions, payouts };
  }

  private async listAll<T>(path: string, input: { created: { gte: number; lte: number } }) {
    const data: T[] = [];
    let startingAfter: string | undefined;
    let hasMore = true;
    while (hasMore) {
      const params = new URLSearchParams({
        limit: "100",
        "created[gte]": String(input.created.gte),
        "created[lte]": String(input.created.lte),
      });
      if (startingAfter) params.set("starting_after", startingAfter);
      const page = await this.request<StripeList<T>>(`${path}?${params.toString()}`);
      data.push(...page.data);
      hasMore = page.has_more;
      const last = page.data[page.data.length - 1] as { id?: string } | undefined;
      startingAfter = last?.id;
      if (hasMore && !startingAfter) break;
    }
    return data;
  }

  private async request<T>(path: string) {
    const response = await this.fetcher(`${STRIPE_API_BASE}${path}`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.config.stripeConnectorSecret}:`).toString("base64")}`,
      },
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new ExpectedRouteError(`Stripe a répondu ${response.status} : ${redact(body || response.statusText)}`, response.status >= 500 ? 502 : response.status);
    }
    return response.json() as Promise<T>;
  }

  private assertConfigured() {
    if (!this.config.stripeConnectorSecret) {
      throw new ExpectedRouteError("Connecteur Stripe live incomplet : STRIPE_SECRET est requis.", 500);
    }
  }
}

const STRIPE_API_BASE = "https://api.stripe.com/v1";

function redact(value: string) {
  return value.replace(/(sk_(live|test)_[a-zA-Z0-9]+)/g, "[redacted-stripe-secret]");
}
