import {
  activityPageSchema,
  apiErrorSchema,
  authResponseSchema,
  authUserSchema,
  balancesViewSchema,
  categoryListSchema,
  categoryResponseSchema,
  createdInvitationSchema,
  currentHouseholdSchema,
  expenseResponseSchema,
  householdResponseSchema,
  invitationListSchema,
  invitationPreviewSchema,
  settlementResponseSchema,
  type ActivityPage,
  type AuthResponse,
  type AuthUser,
  type BalancesView,
  type CategoryView,
  type CreateCategoryInput,
  type CreatedInvitation,
  type CurrentHousehold,
  type ErrorCode,
  type ExpenseInput,
  type ExpenseView,
  type HouseholdView,
  type InvitableRole,
  type InvitationPreview,
  type InvitationView,
  type Role,
  type SettlementInput,
  type SettlementView,
  type UpdateCategoryInput,
  type UpdateCategorySplitInput,
  type UpdateExpenseInput,
  type UpdateSettlementInput,
  type UpdateSplitRequest,
} from "@hogar/shared";
import type { z } from "zod";

/** A failed request, with a code the UI can translate (`errors:<code>`). */
export class ApiRequestError extends Error {
  constructor(
    readonly code: ErrorCode | "network",
    readonly status: number,
  ) {
    super(code);
    this.name = "ApiRequestError";
  }
}

interface RequestOptions<T> {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  schema?: z.ZodType<T>;
  /** Send the access token and, on 401, refresh it once and retry. */
  authenticated?: boolean;
}

/**
 * Talks to the Hogar API.
 * The access token lives only in memory; the refresh token is an httpOnly cookie the browser
 * sends to /api/auth on its own. Concurrent refreshes share a single request, because the API
 * rotates the refresh token on every use.
 */
export class ApiClient {
  private accessToken: string | null = null;
  private refreshing: Promise<AuthResponse> | null = null;

  private readonly sessionExpiredListeners = new Set<() => void>();

  constructor(
    private readonly baseUrl = "/api",
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
  ) {}

  /** Runs `listener` when the session can't be recovered, so the app can return to the login page. */
  onSessionExpired(listener: () => void): () => void {
    this.sessionExpiredListeners.add(listener);
    return () => this.sessionExpiredListeners.delete(listener);
  }

  get hasAccessToken() {
    return this.accessToken !== null;
  }

  async loginWithGoogle(credential: string): Promise<AuthResponse> {
    const session = await this.request("/auth/google", {
      method: "POST",
      body: { credential },
      schema: authResponseSchema,
      authenticated: false,
    });
    this.accessToken = session.accessToken;
    return session;
  }

  /** Restores or extends the session with the refresh cookie. */
  refresh(): Promise<AuthResponse> {
    this.refreshing ??= this.request("/auth/refresh", {
      method: "POST",
      schema: authResponseSchema,
      authenticated: false,
    })
      .then((session) => {
        this.accessToken = session.accessToken;
        return session;
      })
      .catch((error: unknown) => {
        this.accessToken = null;
        throw error;
      })
      .finally(() => {
        this.refreshing = null;
      });
    return this.refreshing;
  }

  async logout(): Promise<void> {
    try {
      await this.request("/auth/logout", { method: "POST", authenticated: false });
    } finally {
      this.accessToken = null;
    }
  }

  me(): Promise<AuthUser> {
    return this.request("/me", { schema: authUserSchema });
  }

  // --- Household -----------------------------------------------------------

  getHousehold(): Promise<CurrentHousehold> {
    return this.request("/household", { schema: currentHouseholdSchema });
  }

  async createHousehold(name: string): Promise<HouseholdView> {
    return (await this.request("/household", { method: "POST", body: { name }, schema: householdResponseSchema }))
      .household;
  }

  async renameHousehold(name: string): Promise<HouseholdView> {
    return (await this.request("/household", { method: "PATCH", body: { name }, schema: householdResponseSchema }))
      .household;
  }

  leaveHousehold(): Promise<void> {
    return this.request("/household/leave", { method: "POST" });
  }

  async changeRole(membershipId: string, role: Role): Promise<HouseholdView> {
    const path = `/household/members/${encodeURIComponent(membershipId)}`;
    return (await this.request(path, { method: "PATCH", body: { role }, schema: householdResponseSchema })).household;
  }

  async removeMember(membershipId: string): Promise<HouseholdView> {
    const path = `/household/members/${encodeURIComponent(membershipId)}`;
    return (await this.request(path, { method: "DELETE", schema: householdResponseSchema })).household;
  }

  async updateSplit(weights: UpdateSplitRequest["weights"]): Promise<HouseholdView> {
    return (
      await this.request("/household/split", { method: "PUT", body: { weights }, schema: householdResponseSchema })
    ).household;
  }

  dismissRemovalNotice(): Promise<void> {
    return this.request("/me/removal-notice", { method: "DELETE" });
  }

  // --- Categories ----------------------------------------------------------

  async getCategories(): Promise<CategoryView[]> {
    return (await this.request("/household/categories", { schema: categoryListSchema })).categories;
  }

  async createCategory(input: CreateCategoryInput): Promise<CategoryView> {
    return (
      await this.request("/household/categories", { method: "POST", body: input, schema: categoryResponseSchema })
    ).category;
  }

  /** Renames a category or changes its emoji, from the version the person saw. */
  async updateCategory(id: string, input: UpdateCategoryInput): Promise<CategoryView> {
    const path = `/household/categories/${encodeURIComponent(id)}`;
    return (await this.request(path, { method: "PATCH", body: input, schema: categoryResponseSchema })).category;
  }

  /** Ticks (with weights) or unticks a category's "use its own split" box. */
  async updateCategorySplit(id: string, input: UpdateCategorySplitInput): Promise<CategoryView> {
    const path = `/household/categories/${encodeURIComponent(id)}/split`;
    return (await this.request(path, { method: "PUT", body: input, schema: categoryResponseSchema })).category;
  }

  deleteCategory(id: string, version: number): Promise<void> {
    return this.request(`/household/categories/${encodeURIComponent(id)}?version=${version}`, { method: "DELETE" });
  }

  // --- Invitations ---------------------------------------------------------

  async listInvitations(): Promise<InvitationView[]> {
    return (await this.request("/household/invitations", { schema: invitationListSchema })).invitations;
  }

  createInvitation(role: InvitableRole): Promise<CreatedInvitation> {
    return this.request("/household/invitations", { method: "POST", body: { role }, schema: createdInvitationSchema });
  }

  renewInvitation(id: string): Promise<CreatedInvitation> {
    const path = `/household/invitations/${encodeURIComponent(id)}/renew`;
    return this.request(path, { method: "POST", schema: createdInvitationSchema });
  }

  revokeInvitation(id: string): Promise<void> {
    return this.request(`/household/invitations/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  /** The token travels in the body, never in the URL, so it stays out of logs. */
  lookupInvitation(token: string): Promise<InvitationPreview> {
    return this.request("/invitations/lookup", { method: "POST", body: { token }, schema: invitationPreviewSchema });
  }

  async acceptInvitation(token: string): Promise<HouseholdView> {
    return (
      await this.request("/invitations/accept", { method: "POST", body: { token }, schema: householdResponseSchema })
    ).household;
  }

  // --- Expenses and history ---------------------------------------------------

  /**
   * One page of expenses and payments, newest first; pass the previous page's `nextCursor` for the
   * next. With `category` (an id, or `none`), only the expenses in it, without payments.
   */
  getActivity(cursor?: string, category?: string): Promise<ActivityPage> {
    const params = new URLSearchParams();
    if (cursor) params.set("cursor", cursor);
    if (category) params.set("category", category);
    const query = params.size > 0 ? `?${params.toString()}` : "";
    return this.request(`/household/activity${query}`, { schema: activityPageSchema });
  }

  /** Everyone's balance and the payments that would settle them, computed by the API from the history. */
  getBalances(): Promise<BalancesView> {
    return this.request("/household/balances", { schema: balancesViewSchema });
  }

  async getExpense(id: string): Promise<ExpenseView> {
    const path = `/household/expenses/${encodeURIComponent(id)}`;
    return (await this.request(path, { schema: expenseResponseSchema })).expense;
  }

  async createExpense(input: ExpenseInput): Promise<ExpenseView> {
    return (await this.request("/household/expenses", { method: "POST", body: input, schema: expenseResponseSchema }))
      .expense;
  }

  /** Saves a change made from `input.version`; a newer version on the server answers 409 `expense.changed`. */
  async updateExpense(id: string, input: UpdateExpenseInput): Promise<ExpenseView> {
    const path = `/household/expenses/${encodeURIComponent(id)}`;
    return (await this.request(path, { method: "PUT", body: input, schema: expenseResponseSchema })).expense;
  }

  /** Deletes the version the person saw; it stays in the history as "deleted by". */
  deleteExpense(id: string, version: number): Promise<void> {
    return this.request(`/household/expenses/${encodeURIComponent(id)}?version=${version}`, { method: "DELETE" });
  }

  async updateSettlement(id: string, input: UpdateSettlementInput): Promise<SettlementView> {
    const path = `/household/settlements/${encodeURIComponent(id)}`;
    return (await this.request(path, { method: "PUT", body: input, schema: settlementResponseSchema })).settlement;
  }

  deleteSettlement(id: string, version: number): Promise<void> {
    return this.request(`/household/settlements/${encodeURIComponent(id)}?version=${version}`, { method: "DELETE" });
  }

  async getSettlement(id: string): Promise<SettlementView> {
    const path = `/household/settlements/${encodeURIComponent(id)}`;
    return (await this.request(path, { schema: settlementResponseSchema })).settlement;
  }

  async createSettlement(input: SettlementInput): Promise<SettlementView> {
    return (
      await this.request("/household/settlements", { method: "POST", body: input, schema: settlementResponseSchema })
    ).settlement;
  }

  async request<T = void>(path: string, options: RequestOptions<T> = {}, isRetry = false): Promise<T> {
    const { method = "GET", body, schema, authenticated = true } = options;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (authenticated && this.accessToken) headers["Authorization"] = `Bearer ${this.accessToken}`;

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers,
        credentials: "same-origin",
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new ApiRequestError("network", 0);
    }

    if (response.status === 401 && authenticated && !isRetry) {
      try {
        await this.refresh();
      } catch (error) {
        this.sessionExpiredListeners.forEach((listener) => listener());
        throw error;
      }
      return this.request(path, options, true);
    }

    if (!response.ok) throw await toError(response);
    if (!schema || response.status === 204) return undefined as T;
    const parsed = schema.safeParse(await response.json());
    if (!parsed.success) throw new ApiRequestError("server.unexpected", response.status);
    return parsed.data;
  }
}

async function toError(response: Response): Promise<ApiRequestError> {
  try {
    const parsed = apiErrorSchema.safeParse(await response.json());
    if (parsed.success) return new ApiRequestError(parsed.data.error.code, response.status);
  } catch {
    // Not JSON (a proxy error page, for example).
  }
  return new ApiRequestError(response.status >= 500 ? "server.unexpected" : "request.invalid", response.status);
}

/** Translation key for any error thrown by the client. */
export function errorKey(error: unknown) {
  const code = error instanceof ApiRequestError ? error.code : "server.unexpected";
  return `errors:${code}` as const;
}
