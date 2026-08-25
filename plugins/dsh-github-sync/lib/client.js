/**
 * dsh-github-sync — web client bundle (lazy-CJS factory format).
 * Registers a settings panel with a one-click "同步到 GitHub" button backed by
 * the host `githubSync` service (backup + Contents-API push).
 */
window.__ModuleLoader__.load({
  id: "dsh-github-sync",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    let React = require("react");

    // ------------------------------------------------------------------ css --
    const CSS = `
.dgs-root{display:flex;flex-direction:column;gap:14px;width:100%}
.dgs-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 0;font-size:13px}
.dgs-k{color:var(--dsw-alias-label-secondary,#666)}
.dgs-v{font-variant-numeric:tabular-nums}
.dgs-input{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border,rgba(0,0,0,.12));background:transparent;
  color:var(--dsw-alias-label-primary,#333);border-radius:8px;padding:6px 10px;font-family:inherit;font-size:13px;line-height:20px}
.dgs-input:focus{outline:2px solid var(--dsw-alias-interactive-bg-active,#eef2ff)}
.dgs-card{border:1px solid var(--dsw-alias-border,rgba(0,0,0,.08));border-radius:14px;padding:14px 16px}
.dgs-title{font-size:14px;font-weight:600;margin-bottom:10px}
.dgs-buttons{display:flex;gap:10px;margin-top:12px;flex-wrap:wrap}
.dgs-btn{box-sizing:border-box;cursor:pointer;border:1px solid var(--dsw-alias-border,rgba(0,0,0,.15));background:transparent;
  color:var(--dsw-alias-label-primary,#333);border-radius:10px;padding:7px 14px;font-family:inherit;font-size:13px;line-height:20px}
.dgs-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06))}
.dgs-btn.dgs-primary{background:var(--dsw-alias-interactive-bg-active,#eef2ff)}
.dgs-btn:disabled{opacity:.55;cursor:default}
.dgs-hint{font-size:12px;color:var(--dsw-alias-label-secondary,#888);line-height:18px}
.dgs-ok{color:var(--dsw-alias-state-success,#2e7d32)}
.dgs-err{color:var(--dsw-alias-state-error-primary,#d64545);font-size:13px;margin-top:6px;white-space:pre-wrap;word-break:break-all}
`;
    const tagId = "dsh-github-sync/styles.css";
    if (typeof document !== "undefined" && document.querySelector('style[data-plugin-css="' + tagId + '"]') === null) {
      const tag = document.createElement("style");
      tag.dataset.plugin = "dsh-github-sync";
      tag.dataset.pluginCss = tagId;
      tag.textContent = CSS;
      document.head.appendChild(tag);
    }

    // ---------------------------------------------------- remote contribution --
    const passthrough = { parse: (value) => value };
    const TYPERT_REMOTE = {
      package: "dsh-github-sync",
      descriptors: [
        {
          id: "dsh-github-sync#githubSync/getStatus",
          service: "githubSync",
          namespace: "githubSync",
          method: "getStatus",
          invocation: { kind: "direct" },
          parameters: [],
          result: { mode: "strict", typeSymbol: "dsh-github-sync/types#GithubSyncStatus", schema: passthrough },
          sourceLocation: { file: "dsh-github-sync/src/index.ts", line: 1, column: 1 },
        },
        {
          id: "dsh-github-sync#githubSync/save",
          service: "githubSync",
          namespace: "githubSync",
          method: "save",
          invocation: { kind: "direct" },
          parameters: [{ name: "cfg", codec: { mode: "strict", typeSymbol: "dsh-github-sync/types#GithubConfig", schema: passthrough } }],
          result: { mode: "strict", typeSymbol: "dsh-github-sync/types#GithubSyncStatus", schema: passthrough },
          sourceLocation: { file: "dsh-github-sync/src/index.ts", line: 2, column: 1 },
        },
        {
          id: "dsh-github-sync#githubSync/setToken",
          service: "githubSync",
          namespace: "githubSync",
          method: "setToken",
          invocation: { kind: "direct" },
          parameters: [{ name: "token", codec: { mode: "strict", typeSymbol: "string", schema: passthrough } }],
          result: { mode: "strict", typeSymbol: "dsh-github-sync/types#SetTokenResult", schema: passthrough },
          sourceLocation: { file: "dsh-github-sync/src/index.ts", line: 3, column: 1 },
        },
        {
          id: "dsh-github-sync#githubSync/syncToGithub",
          service: "githubSync",
          namespace: "githubSync",
          method: "syncToGithub",
          invocation: { kind: "direct" },
          parameters: [],
          result: { mode: "strict", typeSymbol: "dsh-github-sync/types#SyncResult", schema: passthrough },
          sourceLocation: { file: "dsh-github-sync/src/index.ts", line: 4, column: 1 },
        },
      ],
    };

    // -------------------------------------------------------------- helpers --
    function fmtTime(ts) {
      if (!ts) return "—";
      const d = new Date(ts);
      return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
    }

    // -------------------------------------------------------- settings panel --
    function GithubSyncSection(props) {
      const { getStatus, save, setToken, syncToGithub } = props;
      const [status, setStatus] = React.useState(null);
      const [repo, setRepo] = React.useState("");
      const [branch, setBranch] = React.useState("");
      const [repoDir, setRepoDir] = React.useState("");
      const [token, setTokenVal] = React.useState("");
      const [busy, setBusy] = React.useState(false);
      const [syncing, setSyncing] = React.useState(false);
      const [msg, setMsg] = React.useState(null); // {kind:'ok'|'err', text}

      const load = React.useCallback(async () => {
        try {
          const r = await getStatus();
          if (r && r.ok) {
            const s = r.value;
            setStatus(s);
            setRepo(s.repo || "");
            setBranch(s.branch || "");
            setRepoDir(s.repoDir || "");
          } else if (r && r.error) {
            setMsg({ kind: "err", text: r.error.message });
          }
        } catch (err) {
          setMsg({ kind: "err", text: err instanceof Error ? err.message : String(err) });
        }
      }, [getStatus]);

      React.useEffect(() => {
        load();
      }, [load]);

      const onSave = async () => {
        setBusy(true);
        setMsg(null);
        try {
          const r1 = await save({ repo, branch, repoDir });
          if (token && token.trim()) await setToken(token);
          await load();
          setMsg({ kind: "ok", text: "配置已保存" });
          setTokenVal("");
        } catch (err) {
          setMsg({ kind: "err", text: err instanceof Error ? err.message : String(err) });
        } finally {
          setBusy(false);
        }
      };

      const onSync = async () => {
        setSyncing(true);
        setMsg(null);
        try {
          const r = await syncToGithub();
          if (r && r.ok) {
            const v = r.value;
            const errText =
              v && v.errors && v.errors.length ? "\n失败项:\n" + v.errors.map((e) => `${e.path}: ${e.message}`).join("\n") : "";
            setMsg({
              kind: v.ok ? "ok" : "err",
              text: (v.ok ? "同步成功！" : "同步完成但部分文件失败。") +
                (v ? ` 已备份 ${v.copiedCount ?? 0} 项，推送 ${v.fileCount ?? 0} 个文件。` : "") + errText,
            });
          } else if (r && r.error) {
            setMsg({ kind: "err", text: r.error.message });
          }
        } catch (err) {
          setMsg({ kind: "err", text: err instanceof Error ? err.message : String(err) });
        } finally {
          setSyncing(false);
          load();
        }
      };

      const statusRows = status
        ? [
            ["仓库", status.repo || "—"],
            ["分支", status.branch || "—"],
            ["本地仓库路径", status.repoDir || "—"],
            ["路径存在", status.repoDirExists ? "是" : "否 / 未录入"],
            ["GitHub 令牌", status.hasToken ? "已设置" : "未设置"],
            ["上次同步", fmtTime(status.lastSync)],
          ]
        : [];

      return React.createElement(
        "div",
        { className: "dgs-root" },
        React.createElement(
          "div",
          { className: "dgs-card" },
          React.createElement("div", { className: "dgs-title" }, "GitHub 一键同步"),
          React.createElement("div", { className: "dgs-hint" },
            "把当前插件、配置、使用习惯备份到 GitHub（走 api.github.com，无需连 github.com）。令牌只存在本机，不会上传到仓库。"),
          React.createElement("label", { className: "dgs-k" }, "仓库（owner/repo）"),
          React.createElement("input", { className: "dgs-input", value: repo, placeholder: "lxlde1988/DSH-chajian", onChange: (e) => setRepo(e.target.value) }),
          React.createElement("label", { className: "dgs-k" }, "分支"),
          React.createElement("input", { className: "dgs-input", value: branch, placeholder: "main", onChange: (e) => setBranch(e.target.value) }),
          React.createElement("label", { className: "dgs-k" }, "本地仓库路径 repoDir"),
          React.createElement("input", { className: "dgs-input", value: repoDir, placeholder: "D:\\deepseek harness\\DSH-chajian", onChange: (e) => setRepoDir(e.target.value) }),
          React.createElement("label", { className: "dgs-k" }, "令牌（留空=不修改）"),
          React.createElement("input", { className: "dgs-input", type: "password", value: token, placeholder: status && status.hasToken ? "已设置" : "github_pat_...", onChange: (e) => setTokenVal(e.target.value) }),
          React.createElement(
            "div",
            { className: "dgs-buttons" },
            React.createElement("button", { type: "button", className: "dgs-btn", disabled: busy, onClick: onSave }, busy ? "保存中…" : "保存配置"),
            React.createElement("button", { type: "button", className: "dgs-btn dgs-primary", disabled: syncing, onClick: onSync }, syncing ? "同步中…" : "同步到 GitHub"),
          ),
          msg
            ? React.createElement("div", { className: msg.kind === "ok" ? "dgs-ok" : "dgs-err" }, msg.text)
            : null,
        ),
        statusRows.length
          ? React.createElement(
              "div",
              { className: "dgs-card" },
              React.createElement("div", { className: "dgs-title" }, "当前状态"),
              statusRows.map(([k, v]) =>
                React.createElement(
                  "div",
                  { key: k, className: "dgs-row" },
                  React.createElement("span", { className: "dgs-k" }, k),
                  React.createElement("span", { className: "dgs-v" }, v),
                ),
              ),
            )
          : null,
      );
    }

    // -------------------------------------------------------------- wiring --
    const inject = ["slots", "remote"];

    function apply(ctx) {
      const mountPromise = ctx.remote.$mount(TYPERT_REMOTE);
      ctx.effect(() => mountPromise, "dsh-github-sync: remote mount");

      const call = async (method, ...args) => {
        try {
          await mountPromise;
          const ns = ctx.get("remote.githubSync");
          if (ns === undefined) {
            return { ok: false, error: { code: "NO_NAMESPACE", message: "remote.githubSync namespace unavailable" } };
          }
          return await ns[method](...args);
        } catch (err) {
          return { ok: false, error: { code: "MOUNT_ERROR", message: err instanceof Error ? err.message : String(err) } };
        }
      };

      const api = {
        getStatus: () => call("getStatus"),
        save: (cfg) => call("save", cfg),
        setToken: (token) => call("setToken", token),
        syncToGithub: () => call("syncToGithub"),
      };

      ctx.slots.inject("settings.section", () =>
        ctx.slots.register(
          {
            name: "settings.section",
            id: "dsh-github-sync",
            order: 90,
            label: () => "GitHub 同步",
            inject: () => api,
          },
          GithubSyncSection,
        ),
      );
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
