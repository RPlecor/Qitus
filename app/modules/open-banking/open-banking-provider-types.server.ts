export type ProviderBankAccount = {
  providerAccountId: string;
  name: string;
  ibanMasked?: string;
  currency: string;
  balance: number;
  status?: string;
};

export type ProviderBankTransaction = {
  providerTransactionId: string;
  providerAccountId: string;
  date: string;
  label: string;
  counterparty?: string;
  amount: number;
  currency: string;
};

export type ProviderSyncPayload = {
  providerConnectionId: string;
  consentExpiresAt: string;
  accounts: ProviderBankAccount[];
  transactions: ProviderBankTransaction[];
};

export type OpenBankingProviderInfo = {
  providerLabel: string;
  selectionMode: "institution_select" | "provider_webview";
};

export type ConsentResult = {
  provider: string;
  consentUrl: string;
  providerConnectionId?: string;
  consentExpiresAt?: string;
  metadata?: Record<string, unknown>;
};

export type CallbackResult = {
  providerConnectionId: string;
  consentExpiresAt: string;
  metadata?: Record<string, unknown>;
};

export interface OpenBankingProviderAdapter {
  getInfo(): OpenBankingProviderInfo;
  listInstitutions?(input: { country: string }): Promise<Array<{ id: string; name: string; countries?: string[]; logo?: string | null }>>;
  createConsent(input: { state: string; redirectUri: string; institutionId?: string | null; country?: string | null }): Promise<ConsentResult>;
  exchangeCallback(input: { code?: string | null; state?: string | null; requisitionId?: string | null }): Promise<CallbackResult>;
  sync(input: { providerConnectionId: string }): Promise<ProviderSyncPayload>;
  disconnect(input: { providerConnectionId: string }): Promise<void>;
  verifyWebhook(rawBody: string, signature: string | null): Promise<boolean>;
}
