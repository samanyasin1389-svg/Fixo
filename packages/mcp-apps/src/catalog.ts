import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DEFAULT_SHOP_APPS } from "./aliases.js";

export type InstallSourceKind = "play" | "local_apk" | "github" | "url";

export type CatalogApp = {
  id: string;
  label: string;
  packageId: string;
  /** Preferred order for cascade after the user picks a starting source */
  sources: {
    play?: boolean;
    localApkPath?: string;
    githubRepo?: string; // owner/repo
    apkUrl?: string;
  };
  pinned?: boolean;
};

export type AppsCatalog = {
  version: 1;
  apps: CatalogApp[];
};

function catalogPath() {
  return (
    process.env.FIXO_APPS_CATALOG ||
    path.join(os.homedir(), ".config", "fixo", "apps-catalog.json")
  );
}

function defaultCatalog(): AppsCatalog {
  return {
    version: 1,
    apps: DEFAULT_SHOP_APPS.map((app) => ({
      id: app.id,
      label: app.label,
      packageId: app.packageId,
      sources: { play: true },
      pinned: true,
    })),
  };
}

export async function loadAppsCatalog(): Promise<AppsCatalog> {
  const file = catalogPath();
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw) as AppsCatalog;
    if (!parsed?.apps || !Array.isArray(parsed.apps)) return defaultCatalog();
    // Ensure defaults stay available even if file is sparse
    const byId = new Map(parsed.apps.map((a) => [a.id, a]));
    for (const def of defaultCatalog().apps) {
      if (!byId.has(def.id)) byId.set(def.id, def);
    }
    return { version: 1, apps: [...byId.values()] };
  } catch {
    const catalog = defaultCatalog();
    await saveAppsCatalog(catalog);
    return catalog;
  }
}

export async function saveAppsCatalog(catalog: AppsCatalog): Promise<AppsCatalog> {
  const file = catalogPath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  const next: AppsCatalog = { version: 1, apps: catalog.apps };
  await fs.writeFile(file, JSON.stringify(next, null, 2), "utf8");
  return next;
}

export async function listCatalogApps(): Promise<CatalogApp[]> {
  const catalog = await loadAppsCatalog();
  return catalog.apps;
}

export async function findCatalogApp(
  packageIdOrId: string,
): Promise<CatalogApp | undefined> {
  const apps = await listCatalogApps();
  const key = packageIdOrId.trim().toLowerCase();
  return apps.find(
    (a) =>
      a.id.toLowerCase() === key ||
      a.packageId.toLowerCase() === key ||
      a.label === packageIdOrId,
  );
}

export async function upsertCatalogApp(
  input: Omit<CatalogApp, "sources"> & { sources?: CatalogApp["sources"] },
): Promise<CatalogApp> {
  const catalog = await loadAppsCatalog();
  const id =
    input.id?.trim() ||
    input.packageId.replace(/[^a-zA-Z0-9._-]+/g, "_").toLowerCase();
  const nextApp: CatalogApp = {
    id,
    label: input.label.trim() || input.packageId,
    packageId: input.packageId.trim(),
    sources: {
      play: input.sources?.play ?? true,
      ...(input.sources?.localApkPath
        ? { localApkPath: input.sources.localApkPath }
        : {}),
      ...(input.sources?.githubRepo ? { githubRepo: input.sources.githubRepo } : {}),
      ...(input.sources?.apkUrl ? { apkUrl: input.sources.apkUrl } : {}),
    },
    pinned: input.pinned ?? false,
  };
  const idx = catalog.apps.findIndex((a) => a.id === id || a.packageId === nextApp.packageId);
  if (idx >= 0) catalog.apps[idx] = { ...catalog.apps[idx]!, ...nextApp, sources: { ...catalog.apps[idx]!.sources, ...nextApp.sources } };
  else catalog.apps.push(nextApp);
  await saveAppsCatalog(catalog);
  return nextApp;
}

export function catalogFilePath() {
  return catalogPath();
}
