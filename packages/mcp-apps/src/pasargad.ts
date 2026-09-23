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
    // disabled / unknown: recreate when quota exhausted or expire past
    if (user.data_limit && user.used_traffic >= user.data_limit) return true;
    if (user.expire) {
      const exp = Date.parse(user.expire);
      if (Number.isFinite(exp) && exp <= Date.now()) return true;
    }
    return s === "disabled";
  }

  async function provision(input: {
    username: string;
    days: number;
    gigabytes: number;
  }): Promise<ProvisionResult> {
    const username = input.username.trim();
    const days = Number(input.days);
    const gigabytes = Number(input.gigabytes);
    if (!username || !Number.isFinite(days) || days <= 0 || !Number.isFinite(gigabytes) || gigabytes <= 0) {
      throw new PasargadError("username، مدت (روز) و حجم (گیگ) همگی لازمند");
    }

    const existing = await lookupUser(username);
    let action: ProvisionAction;
    let user: PasargadUser;

    if (!existing) {
      user = await createUser({ username, days, gigabytes });
      action = "created";
    } else if (needsRecreation(existing)) {
      await deleteUser(existing.username);
      user = await createUser({ username, days, gigabytes });
      action = "recreated";
    } else {
      user = existing;
      action = "reused";
    }

    const subscriptionUrl = subscriptionUrlFor(user);
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
    };
  }

  return {
    baseUrl,
    hasCredentials: Boolean(apiKey || (adminUser && adminPass)),
    lookupUser,
    createUser,
    deleteUser,
    provision,
    subscriptionUrlFor,
  };
}

export type PasargadClient = ReturnType<typeof createPasargadClient>;
