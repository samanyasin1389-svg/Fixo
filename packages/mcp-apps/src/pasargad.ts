export type PasargadUserStatus =
  | "active"
  | "disabled"
  | "limited"
  | "expired"
  | "on_hold"
  | string;

export type PasargadUser = {
  id: number;
  username: string;
  status: PasargadUserStatus;
  expire: string | null;
  data_limit: number | null;
  used_traffic: number;
  subscription_url: string;
  group_ids?: number[];
  note?: string | null;
};

export type ProvisionAction = "created" | "recreated" | "reused";

export type AccountSummary = {
  username: string;
  status: PasargadUserStatus;
  expire: string | null;
  dataLimitBytes: number | null;
  usedTraffic: number;
  remainingBytes: number | null;
  remainingGb: number | null;
  usedGb: number | null;
  totalGb: number | null;
  remainingDays: number | null;
  expired: boolean;
  subscriptionUrl: string;
  phone: string | null;
  shopId: string | null;
};

export type ProvisionResult = {
  ok: boolean;
  action: ProvisionAction;
  username: string;
  status: PasargadUserStatus;
  days: number;
  gigabytes: number;
  expire: string | null;
  dataLimitBytes: number;
  usedTraffic: number;
  subscriptionUrl: string;
  message: string;
  summary?: AccountSummary;
};

export type LookupResult = {
  ok: boolean;
  found: boolean;
  query: string;
  matches: AccountSummary[];
  primary: AccountSummary | null;
  message: string;
};

export class PasargadError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = "PasargadError";
  }
}

export type PasargadClientOptions = {
  baseUrl?: string;
  apiKey?: string;
  username?: string;
  password?: string;
  defaultGroupId?: number;
};

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

/** PasarGuard keys are `pg_key_…`; tolerate mistyped `PB_key_…`. */
export function normalizePasargadApiKey(raw: string): string {
  const key = raw.trim();
  if (/^PB_key_/i.test(key)) return `pg_key_${key.slice(7)}`;
  return key;
}

function gbToBytes(gigabytes: number): number {
  return Math.round(gigabytes * 1024 * 1024 * 1024);
}

function bytesToGb(bytes: number | null | undefined): number | null {
  if (bytes == null || !Number.isFinite(bytes)) return null;
  return Math.round((bytes / (1024 * 1024 * 1024)) * 100) / 100;
}

function expireIsoFromDays(days: number): string {
  const ms = Date.now() + days * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function absoluteUrl(baseUrl: string, pathOrUrl: string): string {
  if (!pathOrUrl) return "";
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const base = baseUrl.replace(/\/+$/, "");
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${base}${path}`;
}

/** Digits-only normalize for Iranian phone / id matching. */
export function normalizeDigits(raw: string): string {
  return String(raw ?? "")
    .trim()
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/\D+/g, "");
}

/** Extract shop sequential id from `12` or `0912...(12)`. */
export function extractShopId(username: string): string | null {
  const u = String(username ?? "").trim();
  const paren = u.match(/\((\d{1,6})\)\s*$/);
  if (paren?.[1]) return paren[1];
  if (/^\d{1,6}$/.test(u)) return u;
  return null;
}

/** Extract phone prefix from `09121234567(12)`. */
export function extractPhone(username: string): string | null {
  const u = String(username ?? "").trim();
  const m = u.match(/^(\d{8,15})\(\d{1,6}\)$/);
  if (m?.[1]) return m[1];
  if (/^\d{8,15}$/.test(u)) return u;
  return null;
}

/** Format username: `0912...(12)` when phone given, else `12`. */
export function formatVpnUsername(phone: string | undefined | null, shopId: string | number): string {
  const id = String(shopId).trim();
  const digits = normalizeDigits(phone ?? "");
  if (digits.length >= 8) return `${digits}(${id})`;
  return id;
}

/**
 * Next sequential shop id from existing usernames.
 * Counts pure numeric ids (1–6 digits) and ids inside trailing `(N)`.
 */
export function nextNumericUsernameFrom(usernames: Iterable<string>): string {
  let max = 0;
  for (const name of usernames) {
    const id = extractShopId(String(name ?? ""));
    if (!id) continue;
    const n = Number(id);
    if (Number.isSafeInteger(n) && n > max) max = n;
  }
  return String(max + 1);
}

export function userMatchesQuery(username: string, query: string): boolean {
  const u = String(username ?? "").trim();
  const q = String(query ?? "").trim();
  if (!u || !q) return false;
  if (u === q) return true;

  const uDigits = normalizeDigits(u);
  const qDigits = normalizeDigits(q);
  const shopId = extractShopId(u);
  const phone = extractPhone(u);

  // Exact shop id search: "12" or "(12)"
  if (/^\(?\d{1,6}\)?$/.test(q.replace(/\s/g, ""))) {
    const qId = qDigits;
    if (shopId && shopId === qId) return true;
    if (/^\d{1,6}$/.test(u) && u === qId) return true;
  }

  // Phone search (8+ digits)
  if (qDigits.length >= 8) {
    if (phone && (phone === qDigits || phone.endsWith(qDigits) || qDigits.endsWith(phone))) {
      return true;
    }
    if (uDigits.includes(qDigits) || qDigits.includes(uDigits)) return true;
  }

  // Substring on raw username
  if (u.toLowerCase().includes(q.toLowerCase())) return true;
  return false;
}

export function buildAccountSummary(
  user: PasargadUser,
  baseUrl: string,
): AccountSummary {
  const dataLimit = user.data_limit ?? null;
  const used = user.used_traffic ?? 0;
  const remainingBytes =
    dataLimit != null ? Math.max(0, dataLimit - used) : null;
  let remainingDays: number | null = null;
  let expired = false;
  if (user.expire) {
    const exp = Date.parse(user.expire);
    if (Number.isFinite(exp)) {
      const diff = exp - Date.now();
      expired = diff <= 0;
      remainingDays = expired ? 0 : Math.ceil(diff / (24 * 60 * 60 * 1000));
    }
  }
  const status = String(user.status || "").toLowerCase();
  if (status === "expired" || status === "limited") expired = true;

  return {
    username: user.username,
    status: user.status,
    expire: user.expire,
    dataLimitBytes: dataLimit,
    usedTraffic: used,
    remainingBytes,
    remainingGb: bytesToGb(remainingBytes),
    usedGb: bytesToGb(used),
    totalGb: bytesToGb(dataLimit),
    remainingDays,
    expired,
    subscriptionUrl: absoluteUrl(baseUrl, user.subscription_url ?? ""),
    phone: extractPhone(user.username),
    shopId: extractShopId(user.username),
  };
}

function isUsernameConflict(err: unknown): boolean {
  if (!(err instanceof PasargadError)) return false;
  if (err.statusCode === 409 || err.statusCode === 400) return true;
  const hay = `${err.message} ${typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail ?? "")}`;
  return /exist|already|duplicate|تکرار|موجود|invalid|username/i.test(hay);
}

export function createPasargadClient(options: PasargadClientOptions = {}) {
  const baseUrl = (
    options.baseUrl ??
    env("PASARGAD_BASE_URL") ??
    "https://mil.awwwmasss.ir:8443"
  ).replace(/\/+$/, "");

  const rawKey = options.apiKey ?? env("PASARGAD_API_KEY");
  const apiKey = rawKey ? normalizePasargadApiKey(rawKey) : undefined;
  const adminUser = options.username ?? env("PASARGAD_USERNAME");
  const adminPass = options.password ?? env("PASARGAD_PASSWORD");
  const defaultGroupId = options.defaultGroupId ?? Number(env("PASARGAD_GROUP_ID") ?? 1);

  let bearerToken: string | null = null;

  async function ensureBearer(): Promise<string | null> {
    if (bearerToken) return bearerToken;
    if (!adminUser || !adminPass) return null;
    const body = new URLSearchParams({
      username: adminUser,
      password: adminPass,
    });
    const res = await fetch(`${baseUrl}/api/admin/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      detail?: unknown;
    };
    if (!res.ok || !data.access_token) {
      throw new PasargadError(
        "ورود به پنل پاسارگاد ناموفق بود (نام‌کاربری/رمز).",
        res.status,
        data.detail,
      );
    }
    bearerToken = data.access_token;
    return bearerToken;
  }

  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<{ status: number; data: T }> {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";

    if (apiKey) {
      headers["X-API-Key"] = apiKey;
      headers.Authorization = `apikey ${apiKey}`;
    } else {
      const token = await ensureBearer();
      if (!token) {
        throw new PasargadError(
          "PASARGAD_API_KEY (یا PASARGAD_USERNAME/PASSWORD) در .env ست نشده است.",
        );
      }
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const raw = await res.text();
    let data: unknown = null;
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = raw;
      }
    }

    if (!res.ok) {
      const detail =
        typeof data === "object" && data && "detail" in data
          ? (data as { detail: unknown }).detail
          : data;
      const msg =
        typeof detail === "string"
          ? detail
          : res.status === 401
            ? "احراز هویت پنل پاسارگاد ناموفق بود."
            : res.status === 404
              ? "یافت نشد"
              : `خطای پنل پاسارگاد (${res.status})`;
      throw new PasargadError(msg, res.status, detail);
    }

    return { status: res.status, data: data as T };
  }

  async function lookupUser(username: string): Promise<PasargadUser | null> {
    const u = username.trim();
    if (!u) throw new PasargadError("username لازم است");
    try {
      const { data } = await request<PasargadUser>(
        "GET",
        `/api/user/by-username/${encodeURIComponent(u)}`,
      );
      return data;
    } catch (err) {
      if (err instanceof PasargadError && err.statusCode === 404) return null;
      throw err;
    }
  }

  async function listUsers(): Promise<PasargadUser[]> {
    const all: PasargadUser[] = [];
    let offset = 0;
    const limit = 100;
    for (let page = 0; page < 100; page++) {
      const { data } = await request<{
        users?: PasargadUser[];
        total?: number;
      }>("GET", `/api/users?offset=${offset}&limit=${limit}`);
      const users = Array.isArray(data?.users) ? data.users : [];
      all.push(...users);
      offset += limit;
      const total = typeof data?.total === "number" ? data.total : undefined;
      if (users.length < limit) break;
      if (total !== undefined && offset >= total) break;
    }
    return all;
  }

  async function listUsernames(): Promise<string[]> {
    const users = await listUsers();
    return users.map((u) => u.username).filter(Boolean);
  }

  async function allocateNumericId(): Promise<string> {
    const names = await listUsernames();
    return nextNumericUsernameFrom(names);
  }

  async function allocateNumericUsername(): Promise<string> {
    return allocateNumericId();
  }

  async function searchUsers(query: string): Promise<LookupResult> {
    const q = String(query ?? "").trim();
    if (!q) {
      return {
        ok: false,
        found: false,
        query: q,
        matches: [],
        primary: null,
        message: "شماره تلفن یا شناسه را وارد کن",
      };
    }

    // Fast path: exact username
    const exact = await lookupUser(q).catch(() => null);
    if (exact) {
      const summary = buildAccountSummary(exact, baseUrl);
      return {
        ok: true,
        found: true,
        query: q,
        matches: [summary],
        primary: summary,
        message: `اکانت ${exact.username} پیدا شد`,
      };
    }

    const users = await listUsers();
    const matches = users
      .filter((u) => userMatchesQuery(u.username, q))
      .map((u) => buildAccountSummary(u, baseUrl));

    if (matches.length === 0) {
      return {
        ok: true,
        found: false,
        query: q,
        matches: [],
        primary: null,
        message: `اکانتی برای «${q}» پیدا نشد — می‌توانی بسازی`,
      };
    }

    return {
      ok: true,
      found: true,
      query: q,
      matches,
      primary: matches[0]!,
      message:
        matches.length === 1
          ? `اکانت ${matches[0]!.username} پیدا شد`
          : `${matches.length} اکانت پیدا شد`,
    };
  }

  async function deleteUser(username: string): Promise<void> {
    const u = username.trim();
    await request("DELETE", `/api/user/${encodeURIComponent(u)}`);
  }

  async function createUser(input: {
    username: string;
    days: number;
    gigabytes: number;
    groupId?: number;
  }): Promise<PasargadUser> {
    const username = input.username.trim();
    const days = Number(input.days);
    const gigabytes = Number(input.gigabytes);
    if (!username) throw new PasargadError("username لازم است");
    if (!Number.isFinite(days) || days <= 0) {
      throw new PasargadError("مدت (روز) باید عدد مثبت باشد");
    }
    if (!Number.isFinite(gigabytes) || gigabytes <= 0) {
      throw new PasargadError("حجم (گیگ) باید عدد مثبت باشد");
    }

    const payload = {
      username,
      status: "active",
      expire: expireIsoFromDays(days),
      data_limit: gbToBytes(gigabytes),
      data_limit_reset_strategy: "no_reset",
      group_ids: [input.groupId ?? defaultGroupId],
    };

    const { data } = await request<PasargadUser>("POST", "/api/user", payload);
    return data;
  }

  function subscriptionUrlFor(user: PasargadUser): string {
    return absoluteUrl(baseUrl, user.subscription_url ?? "");
  }

  function needsRecreation(user: PasargadUser): boolean {
    const s = String(user.status || "").toLowerCase();
    if (s === "expired" || s === "limited") return true;
    if (s === "active" || s === "on_hold") return false;
    if (user.data_limit && user.used_traffic >= user.data_limit) return true;
    if (user.expire) {
      const exp = Date.parse(user.expire);
      if (Number.isFinite(exp) && exp <= Date.now()) return true;
    }
    return s === "disabled";
  }

  async function createWithAllocatedUsername(input: {
    phone?: string;
    days: number;
    gigabytes: number;
  }): Promise<{ user: PasargadUser; username: string }> {
    let shopId = await allocateNumericId();
    const phoneDigits = normalizeDigits(input.phone ?? "");
    const preferParen = phoneDigits.length >= 8;

    for (let attempt = 0; attempt < 30; attempt++) {
      const candidates = preferParen
        ? [
            formatVpnUsername(phoneDigits, shopId),
            // Fallback if panel rejects parentheses
            `${phoneDigits}_${shopId}`,
            shopId,
          ]
        : [shopId];

      for (const username of candidates) {
        try {
          const user = await createUser({
            username,
            days: input.days,
            gigabytes: input.gigabytes,
          });
          return { user, username: user.username || username };
        } catch (err) {
          if (!isUsernameConflict(err)) {
            // Invalid username charset — try next candidate
            if (
              err instanceof PasargadError &&
              (err.statusCode === 422 || /invalid|username|character/i.test(err.message))
            ) {
              continue;
            }
            throw err;
          }
        }
      }
      shopId = String(Number(shopId) + 1);
    }
    throw new PasargadError("نتوانستیم نام‌کاربری آزاد پیدا کنیم");
  }

  async function provision(input: {
    /** Explicit username (full). Prefer phone for new shop format. */
    username?: string;
    /** Optional phone — used to build `0912...(id)` and for lookup. */
    phone?: string;
    /** Search query (phone or shop id) to renew existing account. */
    query?: string;
    days: number;
    gigabytes: number;
  }): Promise<ProvisionResult> {
    const days = Number(input.days);
    const gigabytes = Number(input.gigabytes);
    if (!Number.isFinite(days) || days <= 0 || !Number.isFinite(gigabytes) || gigabytes <= 0) {
      throw new PasargadError("مدت (روز) و حجم (گیگ) لازمند");
    }

    const requested = (input.username ?? "").trim();
    const phone = (input.phone ?? "").trim() || undefined;
    const query = (input.query ?? phone ?? "").trim() || undefined;

    let action: ProvisionAction;
    let user: PasargadUser;
    let username: string;

    // Renew path: find by query/phone/username first
    let existing: PasargadUser | null = null;
    if (requested) {
      existing = await lookupUser(requested);
    } else if (query) {
      const found = await searchUsers(query);
      if (found.primary) {
        existing = await lookupUser(found.primary.username);
      }
    }

    if (existing) {
      username = existing.username;
      if (needsRecreation(existing)) {
        await deleteUser(existing.username);
        user = await createUser({ username, days, gigabytes });
        action = "recreated";
      } else {
        user = existing;
        action = "reused";
      }
    } else if (requested) {
      username = requested;
      user = await createUser({ username, days, gigabytes });
      action = "created";
    } else {
      const created = await createWithAllocatedUsername({ phone, days, gigabytes });
      user = created.user;
      username = created.username;
      action = "created";
    }

    const subscriptionUrl = subscriptionUrlFor(user);
    const summary = buildAccountSummary(user, baseUrl);
    const messages: Record<ProvisionAction, string> = {
      created: `اکانت ${username} ساخته شد`,
      recreated: `اکانت ${username} تمدید/بازسازی شد`,
      reused: `اکانت ${username} فعال است — همان کانفیگ استفاده می‌شود`,
    };

    return {
      ok: true,
      action,
      username: user.username,
      status: user.status,
      days,
      gigabytes,
      expire: user.expire,
      dataLimitBytes: user.data_limit ?? gbToBytes(gigabytes),
      usedTraffic: user.used_traffic ?? 0,
      subscriptionUrl,
      message: messages[action],
      summary,
    };
  }

  return {
    baseUrl,
    hasCredentials: Boolean(apiKey || (adminUser && adminPass)),
    lookupUser,
    listUsers,
    listUsernames,
    searchUsers,
    allocateNumericId,
    allocateNumericUsername,
    createUser,
    deleteUser,
    provision,
    subscriptionUrlFor,
    accountSummary: (user: PasargadUser) => buildAccountSummary(user, baseUrl),
  };
}

export type PasargadClient = ReturnType<typeof createPasargadClient>;
