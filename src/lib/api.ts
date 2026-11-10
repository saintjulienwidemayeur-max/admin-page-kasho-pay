// Client for the Kasho Pay backend (kasho-pay-backend). Every call sends the Supabase access token; the backend
// verifies it, checks the `admins` table, and refuses requests that do not come from this site.
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

/** Error from the Kasho backend. `code` is the machine-readable reason (PASSWORD_INVALID, PASSWORD_REQUIRED...). */
export class ApiError extends Error {
  code: string | undefined;
  status: number;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}
export const errorCode = (e: unknown): string | undefined => (e as { code?: string } | null)?.code;

const hostOf = (u: string) => { try { return new URL(u).host; } catch { return u; } };

function apiUrl(): string {
  const env = import.meta.env.VITE_API_URL;
  return (env ?? "http://localhost:4000").replace(/\/+$/, "");
}

// The gate registers here to tell the login screen why the session ended.
let onSessionEnded: ((message: string) => void) | null = null;
export const setSessionEndedHandler = (fn: ((message: string) => void) | null) => { onSessionEnded = fn; };

/**
 * The backend answered 401 ("session expired"). The administrator is only signed out if Supabase refuses the session too:
 * a hiccup between the backend and Supabase must not end a working session in the middle of an operation.
 */
async function endSessionIfInvalid(message: string | undefined) {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (data.user && !error) return; // still valid: keep it, the call just fails with its message
    if (error && isAuthRetryableFetchError(error)) return; // Supabase could not be reached: cannot tell, keep it
  } catch {
    return;
  }
  onSessionEnded?.(message ?? "Your session ended. Please sign in again.");
  await supabase.auth.signOut();
}

async function call<T>(name: string, body: unknown = {}): Promise<T> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  let res: Response;
  // Never wait forever: a sleeping or unreachable server must end in a clear error, not an endless spinner.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45_000);
  try {
    res = await fetch(`${apiUrl()}/api/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body ?? {}),
      signal: ctrl.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error("The Kasho server took too long to answer. Please try again in a moment.");
    }
    // The browser gives no reason for a blocked request: name the address, and the usual cause (the backend not allowing this site's origin).
    throw new Error(`Cannot reach the Kasho server at ${hostOf(apiUrl())}. Check your connection, then check that the backend allows this site: ADMIN_ORIGINS must contain ${window.location.origin}`);
  } finally {
    clearTimeout(timer);
  }
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* empty or non-JSON body */
  }
  if (!res.ok) {
    const code: string | undefined = typeof json?.error?.code === "string" ? json.error.code : undefined;
    if (res.status === 401) await endSessionIfInvalid(json?.error?.message);
    // A backend that was not updated yet does not know the admin endpoints.
    if (res.status === 404 && json?.error?.message === "Unknown endpoint.") {
      throw new ApiError("The backend does not have the admin tools yet. Deploy its latest version (the admin API), then try again.", 404, "UNKNOWN_ENDPOINT");
    }
    throw new ApiError(json?.error?.message ?? (json ? "Something went wrong. Please try again." : `The server did not answer correctly (HTTP ${res.status}). Please try again in a moment.`), res.status, code);
  }
  return json.data as T;
}

type Arg<T> = { data: T };

/** One line of the customer fee schedule (same shape as the backend fee_rules table). */
export type FeeRule = {
  operation: "card_creation" | "wallet_deposit" | "wallet_withdrawal" | "card_fund" | "card_withdraw" | "transfer";
  feeType: "flat" | "percent";
  minAmount: number | null;
  maxAmount: number | null;
  feeValue: number;
};

// Needs the current password.
export const changePassword = (a: Arg<{ currentPassword: string; newPassword: string }>) => call<{ ok: boolean }>("changePassword", a.data);

// ---------------------------------------------------------------- admin site (see backend src/admin.ts)
export type AdminRole = "super" | "admin";
export type AdminStatus = { isAdmin: boolean; role: AdminRole | null; hasTotp: boolean; mfaOk: boolean; email: string };
export const adminStatus = () => call<AdminStatus>("adminStatus", {});

export type MasterWallet = { balance: number; guarantee: number; spendable: number; low: boolean; reservedOnCards: number; activeCards: number; mode: "live" | "sandbox" | null };
export type FredaSnapshot = {
  configured: boolean; mode: "live" | "sandbox" | null; ok: boolean; message?: string; fetchedAt: string;
  master: MasterWallet | null; gateway: { htg: number | null; usd: number | null } | null;
};
export type AdminOverview = {
  period: { from: string; to: string; days: number };
  freda: FredaSnapshot;
  stats: {
    usersTotal: number; usersNew: number; usersVerified: number; usersKycPending: number; walletsTotal: number; walletsFunded: number;
    cardsTotal: number; cardsActive: number; cardsBalance: number; txPending: number; txPendingOld: number; txFailed: number;
    adjustCredits: number; adjustDebits: number; cardPurchases: number;
  };
  funds: { owedToUsers: number; heldAtFreda: number | null; coverage: number | null; rate: number };
};
export const adminOverview = (a: Arg<{ days: number }>) => call<AdminOverview>("adminOverview", a.data);
export const adminFredaFunds = () => call<FredaSnapshot>("adminFredaFunds", {});

export type AdminFeeRule = FeeRule & { id: string; label: string; active: boolean };
export type FeeOperation = FeeRule["operation"];
export const adminListFees = () => call<{ operations: FeeOperation[]; tiered: FeeOperation[]; rules: AdminFeeRule[] }>("adminListFees", {});
export type AdminFeeInput = {
  id?: string | undefined; operation: FeeOperation; label: string; feeType: "flat" | "percent"; minAmount: number | null; maxAmount: number | null;
  feeValue: number; active: boolean; confirmPassword: string;
};
export const adminSaveFee = (a: Arg<AdminFeeInput>) => call<AdminFeeRule>("adminSaveFee", a.data);
export const adminDeleteFee = (a: Arg<{ id: string; confirmPassword: string }>) => call<{ ok: true }>("adminDeleteFee", a.data);

export type AdminUserRow = {
  id: string; email: string; name: string; username: string; kashoId: string | null; phone: string; kycStatus: string; balance: number; cards: number;
  createdAt: string; lastSignInAt: string | null; banned: boolean; adminRole: AdminRole | null;
};
export const adminListUsers = (a: Arg<{ q?: string | undefined; page: number; pageSize?: number | undefined }>) =>
  call<{ total: number; page: number; pageSize: number; users: AdminUserRow[] }>("adminListUsers", a.data);
export type AdminTx = { id: string; reference: string; kind: string; title: string; category: string; method: string; amount: number; fee: number; status: string; createdAt: string; note: string | null };
export type AdminUserDetail = {
  id: string; email: string; createdAt: string; lastSignInAt: string | null; banned: boolean; adminRole: AdminRole | null;
  profile: { name: string; username: string; kashoId: string | null; firstName: string; lastName: string; phone: string; country: string; kycStatus: string };
  balance: number;
  cards: { id: string; label: string; brand: string; last4: string; status: string; balance: number; createdAt: string }[];
  transactions: AdminTx[];
};
export const adminGetUser = (a: Arg<{ userId: string }>) => call<AdminUserDetail>("adminGetUser", a.data);
export const adminAdjustBalance = (a: Arg<{ userId: string; direction: "credit" | "debit"; amountUsd: number; note: string; confirmPassword: string }>) =>
  call<{ reference: string; balanceBefore: number; balanceAfter: number }>("adminAdjustBalance", a.data);
export const adminSetUserBlocked = (a: Arg<{ userId: string; blocked: boolean; confirmPassword: string }>) => call<{ blocked: boolean }>("adminSetUserBlocked", a.data);

// The state of a card in the database: "disabled" is a frozen card.
export type CardStatus = "pending" | "active" | "disabled" | "failed" | "terminated";
export type AdminCardRow = {
  id: string; label: string; brand: string; status: string; last4: string; expiry: string; balance: number; hidden: boolean; createdAt: string;
  userId: string; customer: string; kashoId: string | null;
};
export type AdminCardsSummary = { total: number; active: number; frozen: number; pending: number; failed: number; terminated: number; balance: number };
export const adminListCards = (a: Arg<{ q?: string | undefined; status?: CardStatus | undefined; brand?: "VISA" | "MASTERCARD" | undefined; page: number; pageSize?: number | undefined }>) =>
  call<{ total: number; page: number; pageSize: number; summary: AdminCardsSummary; truncated: boolean; items: AdminCardRow[] }>("adminListCards", a.data);
export type AdminCardDetail = {
  id: string; label: string; brand: string; color: string; status: string; last4: string; expiry: string; balance: number; hidden: boolean;
  createdAt: string; updatedAt: string; reference: string; fredaCardId: string | null;
  owner: { id: string; name: string; username: string; kashoId: string | null; kycStatus: string; email: string };
  transactions: { id: string; reference: string; kind: string; title: string; amount: number; fee: number; status: string; createdAt: string; note: string | null }[];
  purchases: { id: string; type: string; amount: number; createdAt: string }[];
};
export const adminGetCard = (a: Arg<{ cardId: string }>) => call<AdminCardDetail>("adminGetCard", a.data);

export type AdminTxRow = AdminTx & { userId: string; customer: string; kashoId: string | null; providerRef: string | null };
export const adminListTransactions = (a: Arg<{ q?: string | undefined; kind?: string | undefined; status?: "pending" | "completed" | "failed" | undefined; userId?: string | undefined; page: number; pageSize?: number | undefined }>) =>
  call<{ total: number; page: number; pageSize: number; items: AdminTxRow[] }>("adminListTransactions", a.data);
export type AdminDispute = { id: string; user_id: string; transaction_ref: string; title: string; amount: number; reason: string; note: string; reference: string; created_at: string; customer: string; reply?: string | null; replied_at?: string | null };
export type AdminSupportMessage = { id: string; user_id: string; email: string | null; message: string; created_at: string; customer: string; reply?: string | null; replied_at?: string | null };
export const adminListSupport = () => call<{ disputes: AdminDispute[]; messages: AdminSupportMessage[] }>("adminListSupport", {});
/** Answers a help message or a dispute: the reply is saved and the customer is notified in the app. */
export const adminReplySupport = (a: Arg<{ kind: "message" | "dispute"; id: string; reply: string }>) => call<{ ok: true; repliedAt: string }>("adminReplySupport", a.data);
export type AdminAuditRow = { id: string; admin_email: string | null; action: string; target_user: string | null; target: string | null; details: Record<string, unknown>; ip: string | null; created_at: string };
export const adminListAudit = (a: Arg<{ page: number; pageSize?: number | undefined }>) => call<{ total: number; page: number; pageSize: number; items: AdminAuditRow[] }>("adminListAudit", a.data);

// ---------------------------------------------------------------- exchange rate and administrators (super administrator, see backend src/admin.ts)
export type AdminRate = { rate: number; source: "admin" | "environment"; envRate: number; min: number; max: number; updatedAt: string | null; updatedBy: string | null };
export const adminGetRate = () => call<AdminRate>("adminGetRate", {});
export const adminSetRate = (a: Arg<{ rate: number; confirmPassword: string }>) => call<AdminRate>("adminSetRate", a.data);

export type AdminMember = { userId: string; email: string; name: string; role: AdminRole; createdAt: string; lastSignInAt: string | null; you: boolean };
export const adminListAdmins = () => call<{ items: AdminMember[] }>("adminListAdmins", {});
export const adminCreateAdmin = (a: Arg<{ email: string; password: string; role: AdminRole; firstName?: string | undefined; lastName?: string | undefined; confirmPassword: string }>) =>
  call<{ userId: string; email: string; role: AdminRole }>("adminCreateAdmin", a.data);
