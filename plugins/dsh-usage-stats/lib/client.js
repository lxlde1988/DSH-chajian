/**
 * dsh-usage-stats — web client bundle (lazy-CJS factory format).
 *
 * Registers two additive UI surfaces and mounts the hand-written strict Typert
 * remote contribution for the host `usageStats` service:
 *   - `sidebar.footer.action`: a compact balance pill (icon-only in the rail);
 *     clicking it opens the top-up page in a new tab.
 *   - `settings.section`: a full "用量与余额" panel with balance, token usage,
 *     estimated cost and a top-up button.
 */
window.__ModuleLoader__.load({
  id: "dsh-usage-stats",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    let React = require("react");
    let ReactDOM = require("react-dom");

    // ------------------------------------------------------------------ css --
    const CSS = `
.usage-stats-root{display:contents}
.usage-stats-pill{display:flex;align-items:center;gap:8px;cursor:pointer;box-sizing:border-box;
  border:none;background:transparent;border-radius:12px;font-family:inherit;color:var(--dsw-alias-label-primary,#333)}
.usage-stats-pill:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06))}
.usage-stats-pill.usage-stats-rail{border-radius:50%;justify-content:center;width:36px;height:36px;padding:0}
.usage-stats-coin{font-weight:600;line-height:1}
.usage-stats-label{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:13px;line-height:20px}
.usage-stats-lines{display:flex;flex-direction:column;min-width:0}
.usage-stats-sublabel{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary,#888)}
.usage-stats-section{display:flex;flex-direction:column;gap:16px;width:100%}
.usage-stats-row{display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:10px 0;border-bottom:1px solid var(--dsw-alias-border,rgba(0,0,0,.08))}
.usage-stats-row:last-child{border-bottom:none}
.usage-stats-k{color:var(--dsw-alias-label-secondary,#666);font-size:13px}
.usage-stats-v{font-variant-numeric:tabular-nums;font-size:13px}
.usage-stats-card{border:1px solid var(--dsw-alias-border,rgba(0,0,0,.08));border-radius:14px;padding:14px 16px}
.usage-stats-balance{font-size:22px;font-weight:600;font-variant-numeric:tabular-nums}
.usage-stats-buttons{display:flex;gap:10px;margin-top:12px}
.usage-stats-btn{box-sizing:border-box;cursor:pointer;border:1px solid var(--dsw-alias-border,rgba(0,0,0,.15));
  background:transparent;color:var(--dsw-alias-label-primary,#333);border-radius:10px;padding:7px 14px;
  font-family:inherit;font-size:13px;line-height:20px}
.usage-stats-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06))}
.usage-stats-btn.usage-stats-primary{background:var(--dsw-alias-interactive-bg-active,#eef2ff)}
.usage-stats-error{color:var(--dsw-alias-state-error-primary,#d64545);font-size:13px;margin-top:8px}
.usage-stats-model{border-bottom:1px solid var(--dsw-alias-border,rgba(0,0,0,.08));padding-bottom:8px;margin-bottom:8px}
.usage-stats-model:last-child{border-bottom:none;margin-bottom:0}
.usage-stats-model .usage-stats-row{border-bottom:none;padding:4px 0}
.usage-stats-root{position:relative;display:flex}
.usage-stats-popover{z-index:1200;width:264px;box-sizing:border-box;
  background:var(--dsw-alias-bg-layer-2,#fff);border:1px solid var(--dsw-alias-border,rgba(0,0,0,.1));
  border-radius:14px;box-shadow:0 10px 32px rgba(0,0,0,.18);padding:14px;display:flex;flex-direction:column;gap:8px}
.usage-stats-pop-title{font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary,#333)}
.usage-stats-pop-balance{font-size:20px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary,#333)}
.usage-stats-pop-row{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:12px}
.usage-stats-pop-divider{border-top:1px solid var(--dsw-alias-border,rgba(0,0,0,.08));margin:2px 0}
/* 侧边栏底部操作区：展宽模式下纵向堆叠，余额胶囊置顶，其它项（worktable、cordis）依次排下 */
.hHd-Xa_root:not(.hHd-Xa_collapsed) .hHd-Xa_footerActions{flex-direction:column;align-items:stretch;gap:4px}
.hHd-Xa_root:not(.hHd-Xa_collapsed) .hHd-Xa_footerActions>*{width:100%}
`;
    const tagId = "dsh-usage-stats/styles.css";
    if (typeof document !== "undefined" && document.querySelector('style[data-plugin-css="' + tagId + '"]') === null) {
      const tag = document.createElement("style");
      tag.dataset.plugin = "dsh-usage-stats";
      tag.dataset.pluginCss = tagId;
      tag.textContent = CSS;
      document.head.appendChild(tag);
    }

    // ---------------------------------------------------- remote contribution --
    const passthrough = { parse: (value) => value };
    const TYPERT_REMOTE = {
      package: "dsh-usage-stats",
      descriptors: [
        {
          id: "dsh-usage-stats#usageStats/getSnapshot",
          service: "usageStats",
          namespace: "usageStats",
          method: "getSnapshot",
          invocation: { kind: "direct" },
          parameters: [],
          result: {
            mode: "strict",
            typeSymbol: "dsh-usage-stats/types#UsageStatsSnapshot",
            schema: passthrough,
          },
          sourceLocation: { file: "dsh-usage-stats/src/index.ts", line: 1, column: 1 },
        },
        {
          id: "dsh-usage-stats#usageStats/refresh",
          service: "usageStats",
          namespace: "usageStats",
          method: "refresh",
          invocation: { kind: "direct" },
          parameters: [],
          result: {
            mode: "strict",
            typeSymbol: "dsh-usage-stats/types#UsageStatsSnapshot",
            schema: passthrough,
          },
          sourceLocation: { file: "dsh-usage-stats/src/index.ts", line: 2, column: 1 },
        },
        {
          id: "dsh-usage-stats#usageStats/restart",
          service: "usageStats",
          namespace: "usageStats",
          method: "restart",
          invocation: { kind: "direct" },
          parameters: [],
          result: {
            mode: "strict",
            typeSymbol: "dsh-usage-stats/types#RestartResult",
            schema: passthrough,
          },
          sourceLocation: { file: "dsh-usage-stats/src/index.ts", line: 3, column: 1 },
        },
      ],
    };

    const DEFAULT_TOP_UP_URL = "https://platform.deepseek.com/top_up";

    // -------------------------------------------------------------- helpers --
    function balanceText(snapshot) {
      const infos = snapshot && snapshot.balance && snapshot.balance.infos;
      if (!infos || infos.length === 0) return null;
      return infos
        .map((info) => `${info.currency} ${info.totalBalance || "0.00"}`)
        .join(" / ");
    }

    function topUpUrlOf(snapshot) {
      return (snapshot && snapshot.topUpUrl) || DEFAULT_TOP_UP_URL;
    }

    function formatTokens(n) {
      return typeof n === "number" ? n.toLocaleString() : "0";
    }

    function formatRate(rate) {
      return rate != null ? (rate * 100).toFixed(1) + "%" : "—";
    }

    function timeText(ts) {
      if (!ts) return "—";
      const d = new Date(ts);
      if (Number.isNaN(d.getTime())) return "—";
      return d.toLocaleString();
    }

    // ------------------------------------------------------- footer widget --
    // ------------------------------------------------------- footer widget --
    function UsageStatsPopover(props) {
      const { snapshot, pos, onEnter, onLeave, onRestart, restarting } = props;
      if (!snapshot || !pos) return null;
      const usage = snapshot.usage;
      const cost = snapshot.cost;
      const lastRound = snapshot.lastRound;
      const pricing = snapshot.pricing;
      const balance = balanceText(snapshot);
      const topUpUrl = topUpUrlOf(snapshot);
      return ReactDOM.createPortal(
        React.createElement(
          "div",
          {
            className: "usage-stats-popover",
            style: {
              position: "fixed",
              left: pos.left,
              bottom: pos.bottom,
              maxHeight: pos.maxHeight ?? window.innerHeight - 16,
              overflowY: "auto",
            },
            onMouseEnter: onEnter,
            onMouseLeave: onLeave,
          },
          React.createElement("div", { className: "usage-stats-pop-title" }, "用量与余额"),
        React.createElement(
          "div",
          { className: "usage-stats-pop-balance" },
          balance != null ? balance : "获取中…",
        ),
        snapshot.balance && snapshot.balance.infos
          ? snapshot.balance.infos.map((info) =>
              React.createElement(
                "div",
                { key: info.currency, className: "usage-stats-pop-row" },
                React.createElement(
                  "span",
                  { className: "usage-stats-k" },
                  `${info.currency} 充值 / 赠送`,
                ),
                React.createElement(
                  "span",
                  { className: "usage-stats-v" },
                  `${info.toppedUpBalance || "0.00"} / ${info.grantedBalance || "0.00"}`,
                ),
              ),
            )
          : null,
        React.createElement("div", { className: "usage-stats-pop-divider" }),
        usage
          ? [
              ["输入 tokens", formatTokens(usage.inputTokens)],
              ["输出 tokens", formatTokens(usage.outputTokens)],
              ["缓存读 tokens", formatTokens(usage.cacheReadTokens)],
              ["缓存写 tokens", formatTokens(usage.cacheWriteTokens)],
              ["合计 tokens", formatTokens(usage.totalTokens)],
              ["缓存命中率", formatRate(usage.cacheHitRate)],
            ].map(([k, v]) =>
              React.createElement(
                "div",
                { key: k, className: "usage-stats-pop-row" },
                React.createElement("span", { className: "usage-stats-k" }, k),
                React.createElement("span", { className: "usage-stats-v" }, v),
              ),
            )
          : null,
        React.createElement("div", { className: "usage-stats-pop-divider" }),
        React.createElement(
          "div",
          { className: "usage-stats-pop-row" },
          React.createElement("span", { className: "usage-stats-k" }, "预估费用"),
          React.createElement(
            "span",
            { className: "usage-stats-v" },
            cost ? `${cost.currency} ${cost.amount.toFixed(2)}` : "—",
          ),
        ),
        lastRound && lastRound.cost
          ? React.createElement(
              "div",
              { className: "usage-stats-pop-row" },
              React.createElement("span", { className: "usage-stats-k" }, "上一轮"),
              React.createElement(
                "span",
                { className: "usage-stats-v" },
                `¥${lastRound.cost.cnyAmount.toFixed(2)}`,
              ),
            )
          : null,
        React.createElement(
          "div",
          { className: "usage-stats-pop-row" },
          React.createElement("span", { className: "usage-stats-k" }, "定价同步"),
          React.createElement(
            "span",
            { className: "usage-stats-v" },
            pricing
              ? pricing.mode === "synced"
                ? "已同步"
                : pricing.mode === "manual"
                  ? "手动"
                  : "未启用"
              : "—",
          ),
        ),
        snapshot.error
          ? React.createElement(
              "div",
              { className: "usage-stats-error" },
              snapshot.error.message,
            )
          : null,
        React.createElement(
          "button",
          {
            type: "button",
            className: "usage-stats-btn usage-stats-primary",
            onClick: () => {
              try {
                window.open(topUpUrl, "_blank", "noopener");
              } catch (err) {
                /* ignore */
              }
            },
          },
          "去充值",
        ),
        React.createElement(
          "button",
          {
            type: "button",
            className: "usage-stats-btn",
            disabled: restarting,
            onClick: onRestart,
          },
          restarting ? "重启中…" : "重启",
        ),
        ),
        document.body,
      );
    }

    function BalanceFooterAction(props) {
      const { wide, refresh, restart } = props;
      const pillRef = React.useRef(null);
      const hideTimer = React.useRef(null);
      const [snapshot, setSnapshot] = React.useState(null);
      const [failed, setFailed] = React.useState(false);
      const [errMsg, setErrMsg] = React.useState("");
      const [pop, setPop] = React.useState(null);
      const [restarting, setRestarting] = React.useState(false);

      React.useEffect(() => {
        let alive = true;
        const load = async () => {
          try {
            const result = await refresh();
            if (!alive) return;
            if (result && result.ok) {
              setSnapshot(result.value);
              setFailed(!!(result.value && result.value.error));
              setErrMsg(result.value && result.value.error ? result.value.error.message : "");
            } else {
              setFailed(true);
              setErrMsg(result && result.error ? result.error.message : "未知错误");
            }
          } catch (err) {
            if (alive) {
              setFailed(true);
              setErrMsg(err instanceof Error ? err.message : String(err));
            }
          }
        };
        load();
        const timer = setInterval(load, 30000);
        return () => {
          alive = false;
          clearInterval(timer);
        };
      }, [refresh]);

      const text = balanceText(snapshot);
      const label = text != null ? text : failed ? (errMsg || "获取失败") : "加载中…";
      const lastRound = snapshot ? snapshot.lastRound : null;
      const lastCostSuffix =
        lastRound && lastRound.cost
          ? `（-¥${lastRound.cost.cnyAmount.toFixed(2)}）`
          : "";

      const showPop = () => {
        if (hideTimer.current) {
          clearTimeout(hideTimer.current);
          hideTimer.current = null;
        }
        const el = pillRef.current;
        if (el) {
          const rect = el.getBoundingClientRect();
          // 弹窗从胶囊上方弹出：水平居中（贴边则夹回视口内），底部对齐胶囊顶部上方 6px。
          setPop({
            left: Math.max(8, rect.left + rect.width / 2 - 132),
            bottom: window.innerHeight - rect.top + 6,
            maxHeight: Math.max(120, rect.top - 8),
          });
        }
      };
      const hidePop = () => {
        if (hideTimer.current) clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => setPop(null), 120);
      };
      const onRestart = async () => {
        setRestarting(true);
        try {
          await restart();
        } catch (err) {
          /* ignore */
        }
      };

      return React.createElement(
        "div",
        {
          className: "usage-stats-root",
          onMouseEnter: showPop,
          onMouseLeave: hidePop,
        },
        React.createElement(
          "button",
          {
            ref: pillRef,
            type: "button",
            className: "usage-stats-pill" + (wide ? "" : " usage-stats-rail"),
            "aria-label": text ? `余额 ${text}` : "用量与余额",
            onClick: () => {
              try {
                window.open(topUpUrlOf(snapshot), "_blank", "noopener");
              } catch (err) {
                /* ignore */
              }
            },
          },
          React.createElement("span", { className: "usage-stats-coin" }, "¥"),
          wide
            ? React.createElement(
                "span",
                { className: "usage-stats-label" },
                label,
                lastCostSuffix
                  ? React.createElement("span", { className: "usage-stats-sublabel" }, lastCostSuffix)
                  : null,
              )
            : null,
        ),
        pop
          ? React.createElement(UsageStatsPopover, {
              snapshot,
              pos: pop,
              onEnter: showPop,
              onLeave: hidePop,
              onRestart,
              restarting,
            })
          : null,
      );
    }

    // -------------------------------------------------------- settings panel --
    function UsageStatsSection(props) {
      const { refresh, restart } = props;
      const [snapshot, setSnapshot] = React.useState(null);
      const [busy, setBusy] = React.useState(false);
      const [restarting, setRestarting] = React.useState(false);

      const load = React.useCallback(async () => {
        try {
          const result = await refresh();
          if (result && result.ok) setSnapshot(result.value);
        } catch (err) {
          /* ignore */
        }
      }, [refresh]);

      React.useEffect(() => {
        load();
        const timer = setInterval(load, 30000);
        return () => clearInterval(timer);
      }, [load]);

      const onRefresh = async () => {
        setBusy(true);
        try {
          await refresh();
        } catch (err) {
          /* ignore */
        } finally {
          setBusy(false);
          await load();
        }
      };

      const onRestart = async () => {
        setRestarting(true);
        try {
          await restart();
        } catch (err) {
          /* ignore */
        }
        // 服务器会在约 4 秒后被重启脚本杀掉并重新拉起，浏览器随后自动重连
      };

      const usage = snapshot ? snapshot.usage : null;
      const cost = snapshot ? snapshot.cost : null;
      const pricing = snapshot ? snapshot.pricing : null;
      const balance = balanceText(snapshot);

      const rows = [
        ["输入 tokens", usage ? formatTokens(usage.inputTokens) : "—"],
        ["输出 tokens", usage ? formatTokens(usage.outputTokens) : "—"],
        ["缓存读 tokens", usage ? formatTokens(usage.cacheReadTokens) : "—"],
        ["缓存写 tokens", usage ? formatTokens(usage.cacheWriteTokens) : "—"],
        ["合计 tokens", usage ? formatTokens(usage.totalTokens) : "—"],
        ["缓存命中率", usage ? formatRate(usage.cacheHitRate) : "—"],
        [
          "预估费用",
          cost ? `${cost.currency} ${cost.amount.toFixed(2)}` : "（未配置价格表）",
        ],
        ["最后刷新", timeText(snapshot && snapshot.lastRefresh)],
      ];

      return React.createElement(
        "div",
        { className: "usage-stats-section" },
        React.createElement(
          "div",
          { className: "usage-stats-card" },
          React.createElement(
            "div",
            { className: "usage-stats-k" },
            "账户余额",
          ),
          React.createElement(
            "div",
            { className: "usage-stats-balance" },
            balance != null ? balance : "—",
          ),
          snapshot && snapshot.balance && snapshot.balance.infos
            ? snapshot.balance.infos.map((info) =>
                React.createElement(
                  "div",
                  { key: info.currency, className: "usage-stats-row" },
                  React.createElement(
                    "span",
                    { className: "usage-stats-k" },
                    `${info.currency}（充值 / 赠送）`,
                  ),
                  React.createElement(
                    "span",
                    { className: "usage-stats-v" },
                    `${info.toppedUpBalance || "0.00"} / ${info.grantedBalance || "0.00"}`,
                  ),
                ),
              )
            : null,
          snapshot && snapshot.error
            ? React.createElement(
                "div",
                { className: "usage-stats-error" },
                `${snapshot.error.message}`,
              )
            : null,
          React.createElement(
            "div",
            { className: "usage-stats-buttons" },
            React.createElement(
              "button",
              {
                type: "button",
                className: "usage-stats-btn usage-stats-primary",
                onClick: () => {
                  try {
                    window.open(topUpUrlOf(snapshot), "_blank", "noopener");
                  } catch (err) {
                    /* ignore */
                  }
                },
              },
              "去充值",
            ),
            React.createElement(
              "button",
              { type: "button", className: "usage-stats-btn", disabled: busy, onClick: onRefresh },
              busy ? "刷新中…" : "刷新",
            ),
            React.createElement(
              "button",
              {
                type: "button",
                className: "usage-stats-btn",
                disabled: restarting,
                onClick: onRestart,
                title: "重启 dsh web（约 5 秒后生效）",
              },
              restarting ? "重启中…" : "重启",
            ),
          ),
        ),
        React.createElement(
          "div",
          { className: "usage-stats-card" },
          rows.map(([k, v]) =>
            React.createElement(
              "div",
              { key: k, className: "usage-stats-row" },
              React.createElement("span", { className: "usage-stats-k" }, k),
              React.createElement("span", { className: "usage-stats-v" }, v),
            ),
          ),
        ),
        pricing
          ? React.createElement(
              "div",
              { className: "usage-stats-card" },
              React.createElement(
                "div",
                { className: "usage-stats-k" },
                "官网定价同步",
              ),
              React.createElement(
                "div",
                { className: "usage-stats-row" },
                React.createElement("span", { className: "usage-stats-k" }, "状态"),
                React.createElement(
                  "span",
                  { className: "usage-stats-v" },
                  pricing.mode === "synced"
                    ? "已同步"
                    : pricing.mode === "manual"
                      ? "手动配置"
                      : "未启用",
                ),
              ),
              pricing.syncedAt
                ? React.createElement(
                    "div",
                    { className: "usage-stats-row" },
                    React.createElement("span", { className: "usage-stats-k" }, "同步时间"),
                    React.createElement(
                      "span",
                      { className: "usage-stats-v" },
                      timeText(pricing.syncedAt),
                    ),
                  )
                : null,
              pricing.error
                ? React.createElement(
                    "div",
                    { className: "usage-stats-error" },
                    pricing.error.message,
                  )
                : null,
              pricing.models && pricing.models.length
                ? pricing.models.map((m) =>
                    React.createElement(
                      "div",
                      { key: m.model, className: "usage-stats-model" },
                      React.createElement(
                        "div",
                        { className: "usage-stats-row" },
                        React.createElement("span", { className: "usage-stats-k" }, m.model),
                        null,
                      ),
                      m.peak && m.offPeak
                        ? [
                            React.createElement(
                              "div",
                              { key: "off", className: "usage-stats-row" },
                              React.createElement("span", { className: "usage-stats-k" }, "  谷价（off-peak）"),
                              React.createElement(
                                "span",
                                { className: "usage-stats-v" },
                                `命中 $${m.offPeak.cacheHit} · 未命中 $${m.offPeak.cacheMiss} · 输出 $${m.offPeak.output}`,
                              ),
                            ),
                            React.createElement(
                              "div",
                              { key: "peak", className: "usage-stats-row" },
                              React.createElement("span", { className: "usage-stats-k" }, "  峰价（peak）"),
                              React.createElement(
                                "span",
                                { className: "usage-stats-v" },
                                `命中 $${m.peak.cacheHit} · 未命中 $${m.peak.cacheMiss} · 输出 $${m.peak.output}`,
                              ),
                            ),
                          ]
                        : React.createElement(
                            "div",
                            { className: "usage-stats-row" },
                            React.createElement("span", { className: "usage-stats-k" }, "  单价"),
                            React.createElement(
                              "span",
                              { className: "usage-stats-v" },
                              `命中 $${m.cacheHit != null ? m.cacheHit : "—"} · 未命中 $${m.cacheMiss != null ? m.cacheMiss : "—"} · 输出 $${m.output != null ? m.output : "—"}`,
                            ),
                          ),
                    ),
                  )
                : null,
              pricing.peakHours && pricing.peakHours.length
                ? React.createElement(
                    "div",
                    { className: "usage-stats-row" },
                    React.createElement("span", { className: "usage-stats-k" }, "峰值时段（UTC）"),
                    React.createElement(
                      "span",
                      { className: "usage-stats-v" },
                      pricing.peakHours
                        .map((r) => `${String(r.from).padStart(2, "0")}:00–${String(r.to).padStart(2, "0")}:00`)
                        .join("，"),
                    ),
                  )
                : null,
            )
          : null,
      );
    }

    // -------------------------------------------------------------- wiring --
    const inject = ["slots", "remote"];

    function apply(ctx) {
      const mountPromise = ctx.remote.$mount(TYPERT_REMOTE);
      ctx.effect(() => mountPromise, "dsh-usage-stats: remote mount");

      const call = async (method) => {
        try {
          await mountPromise;
          const ns = ctx.get("remote.usageStats");
          if (ns === undefined) {
            return {
              ok: false,
              error: {
                code: "NO_NAMESPACE",
                message: "remote.usageStats namespace unavailable",
              },
            };
          }
          return await ns[method]();
        } catch (err) {
          return {
            ok: false,
            error: {
              code: "MOUNT_ERROR",
              message: err instanceof Error ? err.message : String(err),
            },
          };
        }
      };

      const api = {
        getSnapshot: () => call("getSnapshot"),
        refresh: () => call("refresh"),
        restart: () => call("restart"),
      };

      ctx.slots.inject("sidebar.footer.action", () =>
        ctx.slots.register(
          { name: "sidebar.footer.action", id: "usage-stats", order: -100, inject: () => api },
          BalanceFooterAction,
        ),
      );

      ctx.slots.inject("settings.section", () =>
        ctx.slots.register(
          {
            name: "settings.section",
            id: "usage-stats",
            order: 100,
            label: () => "用量与余额",
            inject: () => api,
          },
          UsageStatsSection,
        ),
      );
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
