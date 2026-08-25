/**
 * dsh-github-sync — host plugin.
 *
 * Provides a process-global `githubSync` Typert Remote service whose methods
 * are the "one-click sync to GitHub" backend:
 *   - `getStatus()`  — whether the plugin is configured (repo/branch/repoDir)
 *                      plus the last sync time / last error.
 *   - `save(cfg)`    — persist repo, branch, repoDir (and plugin list) to a
 *                      LOCAL, non-synced config file. The token is saved via
 *                      `setToken`, never returned by any read method.
 *   - `setToken(t)`  — save the GitHub PAT to the same local config file.
 *   - `syncToGithub()` — back up the current plugins/config/settings into the
 *                      repo folder, then push every file to GitHub via the
 *                      Contents API (api.github.com), which works even when
 *                      git-over-github.com is blocked from the network.
 *
 * Security: the token and this config file live OUTSIDE the repo folder, so a
 * sync never uploads the token or machine-specific paths to the public repo.
 *
 * @module dsh-github-sync
 */
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { promises as fsp, existsSync as fsExists } from "node:fs";
import path from "node:path";

const DEFAULT_REPO = "lxlde1988/DSH-chajian";
const DEFAULT_BRANCH = "main";
const DEFAULT_PLUGINS = ["dsh-usage-stats", "dsh-worktable"];

function applyRemoteMarkers(Class, instance, specs) {
  for (const [method, exportName] of specs) {
    Remote(exportName)(Class.prototype[method], {
      name: method,
      private: false,
      static: false,
      addInitializer(fn) {
        fn.call(instance);
      },
    });
  }
}

function home() {
  return process.env.USERPROFILE || process.env.HOME || ".";
}

/** Path of the NON-synced local config (repo/branch/repoDir/token). */
function localConfigPath(override) {
  return override || path.join(home(), ".dsh", "profiles", "web", "dsh-github-sync.local.json");
}

/** Recursively list files under `dir` as POSIX-style relative paths (skips .git). */
async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === ".git") continue;
      for (const sub of await walk(abs)) out.push(e.name + "/" + sub);
    } else if (e.isFile()) {
      out.push(e.name);
    }
  }
  return out;
}

function shouldSkip(rel) {
  const base = (rel.split("/").pop() || rel).toLowerCase();
  if (base.startsWith(".push-token")) return true; // token files never uploaded
  if (base.endsWith(".local.json")) return true; // local settings never uploaded
  return false;
}

export class GithubSyncService extends TypertRemoteService {
  static inject = [];

  constructor(ctx, config = {}) {
    super(ctx, "githubSync");
    applyRemoteMarkers(GithubSyncService, this, [
      ["getStatus", "getStatus"],
      ["save", "save"],
      ["setToken", "setToken"],
      ["syncToGithub", "syncToGithub"],
    ]);

    this.configPath = localConfigPath(config.configFile);
    this.lastSync = null;
    this.lastError = null;
    this.syncing = null;
  }

  // ---------------------------------------------------------- local config --
  loadConfig() {
    try {
      const raw = readFileSync(this.configPath, "utf8");
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  saveConfig(cfg) {
    mkdirSync(path.dirname(this.configPath), { recursive: true });
    writeFileSync(this.configPath, JSON.stringify(cfg, null, 2), "utf8");
  }

  // ------------------------------------------------------------- lifecycle --
  getStatus() {
    const cfg = this.loadConfig();
    const repoDir = cfg.repoDir || "";
    return {
      repo: cfg.repo || null,
      branch: cfg.branch || null,
      repoDir: repoDir || null,
      repoDirExists: repoDir ? fsExists(repoDir) : false,
      plugins: cfg.plugins && cfg.plugins.length ? cfg.plugins : DEFAULT_PLUGINS,
      hasToken: !!(cfg.token && String(cfg.token).trim()),
      lastSync: this.lastSync,
      lastError: this.lastError,
      syncing: !!this.syncing,
    };
  }

  save(cfg = {}) {
    const cur = this.loadConfig();
    const next = {
      ...cur,
      repo: cfg.repo != null ? String(cfg.repo).trim() : cur.repo,
      branch: cfg.branch != null ? String(cfg.branch).trim() : cur.branch,
      repoDir: cfg.repoDir != null ? String(cfg.repoDir).trim() : cur.repoDir,
      plugins: Array.isArray(cfg.plugins) && cfg.plugins.length ? cfg.plugins : cur.plugins,
    };
    this.saveConfig(next);
    return this.getStatus();
  }

  setToken(token) {
    const cur = this.loadConfig();
    cur.token = typeof token === "string" ? token.trim() : "";
    this.saveConfig(cur);
    return { ok: true };
  }

  // ---------------------------------------------------------------- backup --
  async backupToRepo(repoDir) {
    const cfg = this.loadConfig();
    let plugins = cfg.plugins && cfg.plugins.length ? cfg.plugins : DEFAULT_PLUGINS;
    /* 自动补齐：枚举本机已装的全部 dsh-* 插件（新增插件无需改配置） */
    try {
      const nm = path.join(home(), ".dsh", "profiles", "node_modules");
      const all = (await fsp.readdir(nm, { withFileTypes: true }))
        .filter((e) => e.isDirectory() && e.name.startsWith("dsh-"))
        .map((e) => e.name);
      plugins = Array.from(new Set([...plugins, ...all]));
    } catch {
      /* ignore enumeration failure */
    }
    const nodeModules = path.join(home(), ".dsh", "profiles", "node_modules");
    const webConfig = path.join(home(), ".dsh", "profiles", "web");
    const settingsSrc = path.join(home(), ".dsh", "settings.yaml");
    const copied = [];

    const ensure = (p) => fsp.mkdir(p, { recursive: true });

    for (const pl of plugins) {
      const src = path.join(nodeModules, pl);
      const dst = path.join(repoDir, "plugins", pl);
      if (fsExists(src)) {
        await ensure(path.dirname(dst));
        await fsp.cp(src, dst, { recursive: true, force: true });
        copied.push(`plugins/${pl}`);
      }
    }

    const webFiles = ["cordis.patch.yml", "cordis.yml", "package.json", "pnpm-workspace.yaml"];
    await ensure(path.join(repoDir, "config", "web"));
    for (const f of webFiles) {
      const src = path.join(webConfig, f);
      if (fsExists(src)) {
        await fsp.copyFile(src, path.join(repoDir, "config", "web", f));
        copied.push(`config/web/${f}`);
      }
    }

    if (fsExists(settingsSrc)) {
      await ensure(path.join(repoDir, "settings"));
      await fsp.copyFile(settingsSrc, path.join(repoDir, "settings", "settings.yaml"));
      copied.push("settings/settings.yaml");
    }

    const launcher = await this.findLauncher();
    if (launcher) {
      try {
        await fsp.copyFile(launcher, path.join(repoDir, "启动DSH.bat"));
        copied.push("启动DSH.bat");
      } catch {
        /* ignore launcher copy failure */
      }
    }

    return copied;
  }

  async findLauncher() {
    const candidates = [
      path.join(process.cwd(), "启动DSH.bat"),
      path.join(home(), "Desktop", "启动DSH.bat"),
      path.join("D:\\deepseek harness", "启动DSH.bat"),
    ];
    for (const c of candidates) {
      try {
        if (fsExists(c)) return c;
      } catch {
        /* ignore */
      }
    }
    return null;
  }

  // ------------------------------------------------------- push to github --
  async pushToGithub(repo, branch, repoDir, token) {
    const parts = String(repo).split("/");
    const owner = (parts[0] || "").trim();
    const name = (parts[1] || "").trim();
    if (!owner || !name) return { fileCount: 0, errors: [{ path: null, message: "repo 格式应为 owner/repo" }] };

    const api = `https://api.github.com/repos/${owner}/${name}`;
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "dsh-github-sync",
      "Content-Type": "application/json",
    };

    const files = await walk(repoDir);
    const toPush = files.filter((f) => !shouldSkip(f));
    const errors = [];
    let ok = 0;

    for (const rel of toPush) {
      const abs = path.join(repoDir, rel);
      let b64;
      try {
        b64 = Buffer.from(readFileSync(abs)).toString("base64");
      } catch (err) {
        errors.push({ path: rel, message: `读取失败: ${err.message}` });
        continue;
      }
      const url = `${api}/contents/${rel}`;
      const body = { message: `DSH同步: ${rel}`, content: b64, branch };
      try {
        const r = await fetch(url, { method: "PUT", headers, body: JSON.stringify(body) });
        if (r.ok) {
          ok++;
          continue;
        }
        throw new Error(`HTTP ${r.status}`);
      } catch {
        try {
          const cur = await fetch(`${url}?ref=${branch}`, { headers });
          const curJson = await cur.json();
          body.sha = curJson.sha;
          const r2 = await fetch(url, { method: "PUT", headers, body: JSON.stringify(body) });
          if (r2.ok) {
            ok++;
          } else {
            errors.push({ path: rel, message: await r2.text() });
          }
        } catch (err2) {
          errors.push({ path: rel, message: err2.message });
        }
      }
    }

    return { fileCount: ok, errors };
  }

  // ----------------------------------------------------------------- sync --
  async syncToGithub() {
    if (this.syncing) return this.syncing;
    this.syncing = this.doSync().finally(() => {
      this.syncing = null;
    });
    return this.syncing;
  }

  async doSync() {
    const cfg = this.loadConfig();
    const repo = cfg.repo || "";
    const branch = cfg.branch || DEFAULT_BRANCH;
    const repoDir = cfg.repoDir || "";
    const token = cfg.token || "";

    if (!repo) return { ok: false, error: "未配置仓库（owner/repo）" };
    if (!token) return { ok: false, error: "未配置 GitHub 令牌" };
    if (!repoDir) return { ok: false, error: "未配置本地仓库路径 repoDir" };

    if (!fsExists(repoDir)) return { ok: false, error: `repoDir 不存在: ${repoDir}` };

    try {
      const copied = await this.backupToRepo(repoDir);
      const pushed = await this.pushToGithub(repo, branch, repoDir, token);
      this.lastSync = Date.now();
      if (pushed.errors.length === 0) this.lastError = null;
      else this.lastError = pushed.errors[0].message;
      return {
        ok: pushed.errors.length === 0,
        copiedCount: copied.length,
        copied: copied.slice(0, 200),
        fileCount: pushed.fileCount,
        errors: pushed.errors,
        lastSync: this.lastSync,
      };
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      return { ok: false, error: this.lastError };
    }
  }
}

export default GithubSyncService;
