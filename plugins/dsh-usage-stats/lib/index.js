/**
 * dsh-usage-stats — host plugin.
 *
 * Registers a process-global `usageStats` service (a Typert Remote service)
 * that:
 *   - accumulates provider-reported token usage per UTC hour (so peak /
 *     off-peak pricing can be applied per bucket) and as flat totals;
 *   - polls the DeepSeek `/user/balance` endpoint (the authoritative
 *     remaining balance — no pricing table required);
 *   - periodically fetches and parses the official pricing page (models +
 *     peak/off-peak rates + peak hours) so the "token → money" estimate
 *     tracks the published price list automatically;
 *   - exposes `getSnapshot()` / `refresh()` to the web client over the API
 *     gateway.
 *
 * @module dsh-usage-stats
 */
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { credentialRef } from "@deepseek-ai/dsh-credentials";
import { readFileSync } from "node:fs";
import path from "node:path";

const DEFAULTS = {
  apiKeyEnv: "DEEPSEEK_API_KEY",
  baseUrl: "https://api.deepseek.com",
  topUpUrl: "https://platform.deepseek.com/top_up",
  refreshIntervalMs: 60000,
  // Official pricing page. There is no JSON pricing API, so we fetch the
  // published docs page and parse its table. Set to null to disable auto-sync
  // and rely on the static `pricing` fallback only.
  pricingSource: "https://api-docs.deepseek.com/quick_start/pricing/",
  // Model whose price is used for the flat estimate (tokens are aggregated
  // across models, so the estimate is best-effort by design).
  estimateModel: "deepseek-v4-pro",
  // USD→CNY rate used to convert the USD price-table estimate into the CNY
  // figure shown beside the (CNY) balance.
  usdToCnyRate: 7.2,
  // Static fallback price table (per 1M tokens) used when auto-sync is
  // disabled or the page cannot be parsed.
  pricing: null,
  // Z.ai（智谱）Coding Plan：订阅制没有按量余额，改查服务端配额窗口
  // （5 小时 token 窗口 / 周配额 / 工具搜索额度），Bearer 同一个 API key。
  zaiApiKeyEnv: "ZAI_API_KEY",
  zaiQuotaUrl: "https://api.z.ai/api/monitor/usage/quota/limit",
};

/**
 * Apply the Typert `@Remote("name")` method markers to a service class.
 */
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

function parseBalance(body) {
  const infos = Array.isArray(body && body.balance_infos) ? body.balance_infos : [];
  return {
    isAvailable: body && body.is_available === true,
    infos: infos.map((info) => ({
      currency: typeof info.currency === "string" ? info.currency : "",
      totalBalance: typeof info.total_balance === "string" ? info.total_balance : "",
      grantedBalance: typeof info.granted_balance === "string" ? info.granted_balance : "",
      toppedUpBalance: typeof info.topped_up_balance === "string" ? info.topped_up_balance : "",
    })),
  };
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function stripTags(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(td|th|tr|p|div|h[1-6]|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

/** Extract the first number in a cell's text. */
function firstNumber(cell) {
  const m = String(cell).match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

/**
 * Extract peak-hour ranges from the note text, e.g.
 * "Peak hours are 01:00 - 04:00 and 06:00 - 10:00 UTC".
 * @returns {Array<{from:number,to:number}>} UTC hours, `to` exclusive, or null.
 */
function parsePeakHours(text) {
  const m = String(text).match(
    /peak hours are\s+(\d{1,2}):\d{2}\s*[-–—]\s*(\d{1,2}):\d{2}\s+and\s+(\d{1,2}):\d{2}\s*[-–—]\s*(\d{1,2}):\d{2}\s+UTC/i,
  );
  if (!m) return null;
  const hour = (s) => Number(s);
  return [
    { from: hour(m[1]), to: hour(m[2]) },
    { from: hour(m[3]), to: hour(m[4]) },
  ];
}

function isPeakHour(hour, peakHours) {
  if (!peakHours) return false;
  return peakHours.some((range) => hour >= range.from && hour < range.to);
}

/** Extract every `<table>` block from an HTML document. */
function extractHtmlTables(text) {
  const tables = [];
  const tableRe = /<table[\s>][\s\S]*?<\/table>/gi;
  let m;
  while ((m = tableRe.exec(text)) !== null) tables.push(m[0]);
  return tables;
}

/**
 * Turn one `<table>` block into rows of `{ text, rowspan }` cells, expanding
 * `rowspan`/`colspan` so downstream code sees aligned grids. Model cells use
 * `rowspan`, so this matters for the peak/off-peak table.
 */
function tableToGrid(tableHtml) {
  const rows = [];
  const trRe = /<tr[\s>][\s\S]*?<\/tr>/gi;
  const cellRe = /<t[dh](\s[^>]*)?>([\s\S]*?)<\/t[dh]>/gi;
  let tr;
  // carried[k] = { text, remaining } for cells still spanning down into this row
  let carried = [];
  while ((tr = trRe.exec(tableHtml)) !== null) {
    const cells = [];
    const rowspans = [];
    let col = 0;
    let m;
    cellRe.lastIndex = 0;
    const raw = [];
    while ((m = cellRe.exec(tr[0])) !== null) raw.push(m);
    for (const cell of raw) {
      const attrs = cell[1] || "";
      const rowspan = /rowspan\s*=\s*["']?(\d+)/i.exec(attrs);
      const colspan = /colspan\s*=\s*["']?(\d+)/i.exec(attrs);
      const text = stripTags(cell[2]).trim();
      // skip carried columns
      while (carried[col] && carried[col].remaining > 0) {
        cells.push({ text: carried[col].text, rowspan: 0 });
        carried[col].remaining -= 1;
        if (carried[col].remaining === 0) carried[col] = undefined;
        col += 1;
      }
      cells.push({ text, rowspan: rowspan ? Number(rowspan[1]) : 1 });
      if (rowspan && Number(rowspan[1]) > 1) {
        rowspans[col] = { text, remaining: Number(rowspan[1]) - 1 };
      }
      const span = colspan ? Number(colspan[1]) : 1;
      col += span;
    }
    // flush trailing carried cells
    while (col < carried.length) {
      if (carried[col] && carried[col].remaining > 0) {
        cells.push({ text: carried[col].text, rowspan: 0 });
        carried[col].remaining -= 1;
        if (carried[col].remaining === 0) carried[col] = undefined;
      }
      col += 1;
    }
    for (const [idx, carry] of Object.entries(rowspans)) {
      carried[idx] = carry;
    }
    if (cells.length > 0) rows.push(cells);
  }
  return rows;
}

/** Map a header cell to a pricing role, or null. */
function cellRole(text) {
  const s = String(text).toLowerCase();
  if (/cache[- ]?hit|缓存命中/.test(s)) return "cacheHit";
  if (/cache[- ]?miss|输入|input/.test(s)) return "cacheMiss";
  if (/output|输出/.test(s)) return "output";
  if (/model|模型/.test(s)) return "model";
  return null;
}

/**
 * Parse the peak/off-peak pricing table.
 *
 * Current page shape: model names sit in the table HEADER
 * (`MODEL | deepseek-v4-flash | deepseek-v4-pro`), and pricing rows look like
 * `[PRICING | 1M INPUT TOKENS (CACHE HIT) | OFF-PEAK | $flash | $pro]`.
 * Older page shape: models were ROW heads (rowspan=2) with OFF-PEAK/PEAK
 * sub-rows. Both shapes are handled here.
 */
function parsePeakOffPeakTable(rows) {
  // ---- shape A: models in the header row ----
  let modelNames = null;
  for (const row of rows) {
    const names = row
      .map((c) => {
        const m = c.text.match(/deepseek[-_][a-z0-9._-]+/i);
        return m ? m[0].toLowerCase() : null;
      })
      .filter((n) => n != null);
    if (names.length >= 2) {
      modelNames = names;
      break;
    }
  }
  if (modelNames) {
    const byModel = modelNames.map((model) => ({ model }));
    let currentRole = null;
    for (const row of rows) {
      const texts = row.map((c) => c.text.trim());
      if (texts.length < 3) continue;
      let role = null;
      for (const t of texts) {
        if (/1M INPUT TOKENS \(CACHE HIT\)|缓存命中/i.test(t)) role = "cacheHit";
        else if (/1M INPUT TOKENS \(CACHE MISS\)|CACHE MISS|缓存未命中/i.test(t)) role = "cacheMiss";
        else if (/1M OUTPUT TOKENS|OUTPUT/i.test(t)) role = "output";
        if (role) break;
      }
      if (role) currentRole = role;
      const peakFlag = texts.find((t) => /^\s*(off\s*[-–—]?\s*peak|peak)\s*$/i.test(t));
      if (!peakFlag || !currentRole) continue;
      const isPeak = !/off/i.test(peakFlag);
      const prices = texts.slice(3).map((t) => firstNumber(t));
      byModel.forEach((m, i) => {
        const v = prices[i];
        if (v == null) return;
        const rate = m[isPeak ? "peak" : "offPeak"] || (m[isPeak ? "peak" : "offPeak"] = {});
        rate[currentRole] = v;
      });
    }
    const models = byModel.filter((m) => m.peak && m.offPeak);
    if (models.length > 0) return { models };
  }

  // ---- shape B: models as row heads (legacy) ----
  let priceOrder = null;
  let headerIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    const joined = rows[i].map((c) => c.text).join(" ").toLowerCase();
    if (/cache hit/.test(joined) && /cache miss/.test(joined) && /output/.test(joined)) {
      headerIndex = i;
      priceOrder = rows[i].map((c) => cellRole(c.text)).filter((r) => r === "cacheHit" || r === "cacheMiss" || r === "output");
      break;
    }
  }
  if (priceOrder === null || priceOrder.length < 3) return null;

  const byModel = new Map();
  let carry = null;
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const texts = rows[i].map((c) => c.text.trim());
    if (texts.length === 0) continue;

    let model = texts.find((t) => /deepseek[-_][a-z0-9._-]+/i.test(t));
    if (model) {
      model = model.match(/deepseek[-_][a-z0-9._-]+/i)[0].toLowerCase();
      carry = model;
    } else {
      model = carry;
    }
    if (!model) continue;

    const peakFlag = texts.find((t) => /^\s*(off\s*[-–—]?\s*peak|peak)\s*$/i.test(t));
    if (!peakFlag) continue;
    const isPeak = !/off/i.test(peakFlag);

    const prices = texts
      .filter((t) => t !== model && t !== peakFlag)
      .map((t) => firstNumber(t))
      .filter((n) => n != null);
    if (prices.length < 3) continue;

    const rate = {};
    priceOrder.forEach((role, idx) => {
      rate[role] = prices[idx];
    });

    let entry = byModel.get(model) || { model };
    if (isPeak) entry.peak = rate;
    else entry.offPeak = rate;
    byModel.set(model, entry);
  }

  const models = [...byModel.values()].filter((m) => m.peak && m.offPeak);
  return models.length > 0 ? { models } : null;
}

/**
 * Generic fallback for a flat markdown/HTML table (model per row, numeric
 * columns). Used when the peak/off-peak table is not found.
 */
function parseFlatTable(text) {
  const isMarkdown = /^\s*\|/m.test(text) && !/<\/table>/i.test(text);
  let rows = [];
  if (isMarkdown) {
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("|")) continue;
      const cells = trimmed.slice(1, trimmed.endsWith("|") ? -1 : undefined).split("|").map((c) => c.trim());
      if (cells.length >= 2) rows.push(cells.map((c) => ({ text: c, rowspan: 1 })));
    }
  } else {
    for (const table of extractHtmlTables(text)) {
      for (const row of tableToGrid(table)) rows.push(row);
    }
  }

  let colRole = null;
  for (const row of rows) {
    const joined = row.map((c) => c.text).join(" ").toLowerCase();
    if (/model|模型/.test(joined) && /cache|input|output|输入|输出/.test(joined)) {
      colRole = row.map((c) => cellRole(c.text));
      break;
    }
  }

  const models = [];
  for (const row of rows) {
    const modelCell = row.find((c) => /deepseek[-_][a-z0-9._-]+/i.test(c.text));
    if (!modelCell) continue;
    const model = modelCell.text.match(/deepseek[-_][a-z0-9._-]+/i)[0].toLowerCase();
    const entry = { model };
    if (colRole) {
      for (let i = 0; i < Math.min(colRole.length, row.length); i++) {
        const role = colRole[i];
        if (!role || role === "model") continue;
        const n = firstNumber(row[i].text);
        if (n != null) entry[role] = n;
      }
    } else {
      const prices = row.map((c) => firstNumber(c.text)).filter((n) => n != null && n > 0);
      if (prices.length >= 2) {
        entry.cacheMiss = prices[prices.length - 2];
        entry.output = prices[prices.length - 1];
        if (prices.length >= 3) entry.cacheHit = prices[prices.length - 3];
      }
    }
    if (entry.cacheMiss != null || entry.output != null) models.push(entry);
  }
  return models.length > 0 ? { models } : null;
}

/**
 * Parse the official pricing page into a normalized structure:
 *   { models, peakHours, flat }
 * `models` items carry either `{ peak, offPeak }` (peak/off-peak billing) or
 * flat `{ cacheHit, cacheMiss, output }` rates (per 1M tokens, USD).
 */
function parsePricingPage(text) {
  if (!text) return null;
  const peakHours = parsePeakHours(text);
  for (const table of extractHtmlTables(text)) {
    const grid = tableToGrid(table);
    const peak = parsePeakOffPeakTable(grid);
    if (peak) return { models: peak.models, peakHours, flat: false };
  }
  const flat = parseFlatTable(text);
  if (flat) return { models: flat.models, peakHours, flat: true };
  return null;
}

export class UsageStatsService extends TypertRemoteService {
  static inject = ["credentials", "timer"];

  constructor(ctx, config = {}) {
    super(ctx, "usageStats");
    applyRemoteMarkers(UsageStatsService, this, [
      ["getSnapshot", "getSnapshot"],
      ["refresh", "refresh"],
      ["restart", "restart"],
    ]);

    this.apiKeyEnv = config.apiKeyEnv ?? DEFAULTS.apiKeyEnv;
    this.baseUrl = String(config.baseUrl ?? DEFAULTS.baseUrl).replace(/\/+$/, "");
    this.topUpUrl = config.topUpUrl ?? DEFAULTS.topUpUrl;
    this.refreshIntervalMs = config.refreshIntervalMs ?? DEFAULTS.refreshIntervalMs;
    this.pricingSource = config.pricingSource ?? DEFAULTS.pricingSource;
    this.estimateModel = config.estimateModel ?? DEFAULTS.estimateModel;
    this.usdToCnyRate = config.usdToCnyRate ?? DEFAULTS.usdToCnyRate;
    this.pricing = config.pricing ?? null;
    this.zaiApiKeyEnv = config.zaiApiKeyEnv ?? DEFAULTS.zaiApiKeyEnv;
    this.zaiQuotaUrl = config.zaiQuotaUrl ?? DEFAULTS.zaiQuotaUrl;

    this.usage = {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    };
    this.usageByHour = {};
    // 按服务商拆账：只有 DeepSeek 系调用计入“按量费用”（GLM 走套餐、不按量计费）。
    this.dsUsage = {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    };
    this.dsUsageByHour = {};
    this.lastRound = null; // 最近一轮：user/message 重置，后续 assistant/message 累计
    this.lastRoundDs = null; // 本轮中 DeepSeek 系调用的部分（用于本轮费用）
    this.balance = null;
    this.lastRefresh = null;
    this.lastError = null;
    this.refreshing = null;

    this.syncedPricing = null; // { source, syncedAt, models, peakHours, flat }
    this.pricingSyncError = null;
    this.pricingSyncing = null;

    this.zaiQuota = null; // { level, fiveHour, weekly, tools, fetchedAt }
    this.zaiQuotaError = null;
    this.sessionModel = null; // 最近一次实际调用的 { provider, model, at }

    ctx.on("session/event", (session, event) => this.foldEvent(event));

    ctx.interval(() => {
      this.refresh().catch(() => {});
      this.syncPricing().catch(() => {});
      this.fetchZaiQuota().catch(() => {});
    }, this.refreshIntervalMs);

    this.refresh().catch(() => {});
    this.syncPricing().catch(() => {});
    this.fetchZaiQuota().catch(() => {});
  }

  foldEvent(event) {
    if (!event) return;
    // 新一轮开始：重置本轮累计。turn/start 每轮都由 agent-loop 实时发射；
    // user/message 在会话从持久化恢复时作为 seed 静默回放、不触发 session/event，
    // 故叠加 turn/start 兜底，保证「本轮」真的对本轮而不是累计成总数。
    if (event.type === "user/message" || event.type === "turn/start") {
      this.lastRound = {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        at: typeof event.time === "number" ? event.time : Date.now(),
      };
      this.lastRoundDs = {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        at: this.lastRound.at,
      };
      return;
    }
    if (event.type !== "assistant/message") return;
    // 记录本会话最近一次实际调用的模型（assistant/message 带 message.source），
    // 作为 settings.yaml 缺失/未切换时的兜底信号。
    const src = event.data && event.data.message && event.data.message.source;
    if (src && (src.provider || src.model)) {
      this.sessionModel = {
        provider: src.provider || null,
        model: src.model || null,
        at: typeof event.time === "number" ? event.time : Date.now(),
      };
    }
    const usage = event.data && event.data.usage;
    if (!usage) return;
    const input = usage.inputTokens ?? 0;
    const output = usage.outputTokens ?? 0;
    const cacheRead = usage.cacheReadTokens ?? 0;
    const cacheWrite = usage.cacheWriteTokens ?? 0;

    this.usage.inputTokens += input;
    this.usage.outputTokens += output;
    this.usage.cacheReadTokens += cacheRead;
    this.usage.cacheWriteTokens += cacheWrite;

    const hour = typeof event.time === "number" ? new Date(event.time).getUTCHours() : new Date().getUTCHours();
    const bucket = this.usageByHour[hour] || (this.usageByHour[hour] = {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    });
    bucket.inputTokens += input;
    bucket.outputTokens += output;
    bucket.cacheReadTokens += cacheRead;
    bucket.cacheWriteTokens += cacheWrite;

    // 把本条回答的用量累进当前轮（若无 user/message 起点则就地开一轮）。
    const round = this.lastRound || (this.lastRound = {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      at: Date.now(),
    });
    round.inputTokens += input;
    round.outputTokens += output;
    round.cacheReadTokens += cacheRead;
    round.cacheWriteTokens += cacheWrite;
    round.at = typeof event.time === "number" ? event.time : Date.now();

    // 服务商分类：zai/glm/bigmodel → 套餐；deepseek* → 按量计费（拆账累计）。
    const prov = String((src && src.provider) || "").toLowerCase();
    const isDeepseek = prov.includes("deepseek");
    if (isDeepseek) {
      this.dsUsage.inputTokens += input;
      this.dsUsage.outputTokens += output;
      this.dsUsage.cacheReadTokens += cacheRead;
      this.dsUsage.cacheWriteTokens += cacheWrite;

      const dsHour = this.dsUsageByHour[hour] || (this.dsUsageByHour[hour] = {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      });
      dsHour.inputTokens += input;
      dsHour.outputTokens += output;
      dsHour.cacheReadTokens += cacheRead;
      dsHour.cacheWriteTokens += cacheWrite;

      const ds = this.lastRoundDs || (this.lastRoundDs = {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        at: round.at,
      });
      ds.inputTokens += input;
      ds.outputTokens += output;
      ds.cacheReadTokens += cacheRead;
      ds.cacheWriteTokens += cacheWrite;
      ds.at = round.at;
    }
  }

  /** The synced price entry used for the estimate, or null. */
  syncedEstimateEntry() {
    const models = this.syncedPricing && this.syncedPricing.models;
    if (!models || models.length === 0) return null;
    return models.find((m) => m.model === this.estimateModel) || models[0];
  }

  estimateCost() {
    const synced = this.syncedEstimateEntry();
    if (synced) {
      let amount = 0;
      for (const [hourStr, bucket] of Object.entries(this.dsUsageByHour)) {
        const hour = Number(hourStr);
        const rate = this.rateForHour(synced, hour);
        amount +=
          ((bucket.inputTokens + bucket.cacheWriteTokens) / 1e6) * (rate.cacheMiss ?? 0) +
          (bucket.cacheReadTokens / 1e6) * (rate.cacheHit ?? rate.cacheMiss ?? 0) +
          (bucket.outputTokens / 1e6) * (rate.output ?? 0);
      }
      return { currency: "USD", amount: round2(amount) };
    }
    const p = this.pricing;
    if (!p) return null;
    const amount =
      (this.dsUsage.inputTokens / 1e6) * (p.input ?? 0) +
      (this.dsUsage.outputTokens / 1e6) * (p.output ?? 0) +
      (this.dsUsage.cacheReadTokens / 1e6) * (p.cacheRead ?? 0) +
      (this.dsUsage.cacheWriteTokens / 1e6) * (p.cacheWrite ?? 0);
    return { currency: p.currency ?? "CNY", amount: round2(amount) };
  }

  rateForHour(entry, hour) {
    if (entry.peak && entry.offPeak) {
      const peak = isPeakHour(hour, this.syncedPricing && this.syncedPricing.peakHours);
      return peak ? entry.peak : entry.offPeak;
    }
    return entry;
  }

  pricingState() {
    if (this.pricingSource == null) {
      return {
        mode: this.pricing ? "manual" : "none",
        source: null,
        syncedAt: null,
        error: null,
        models: [],
        peakHours: null,
        currency: this.pricing ? this.pricing.currency ?? "CNY" : null,
      };
    }
    const models = (this.syncedPricing && this.syncedPricing.models) || [];
    return {
      mode: this.syncedPricing ? "synced" : "manual",
      source: this.pricingSource,
      syncedAt: this.syncedPricing ? this.syncedPricing.syncedAt : null,
      error: this.pricingSyncError,
      models: models.map((m) => ({
        model: m.model,
        peak: m.peak || null,
        offPeak: m.offPeak || null,
        cacheHit: m.cacheHit != null ? m.cacheHit : null,
        cacheMiss: m.cacheMiss != null ? m.cacheMiss : null,
        output: m.output != null ? m.output : null,
      })),
      peakHours: this.syncedPricing ? this.syncedPricing.peakHours : null,
      currency: "USD",
    };
  }

  cacheHitRate() {
    const hit = this.usage.cacheReadTokens;
    const miss = this.usage.inputTokens;
    const total = hit + miss;
    return total > 0 ? hit / total : null;
  }

  lastRoundCost() {
    const round = this.lastRound;
    if (!round) return null;
    const entry = this.syncedEstimateEntry();
    if (!entry) return null;
    // 只按本轮 DeepSeek 系调用计费（GLM 套餐内调用不产生按量费用）。
    const ds = this.lastRoundDs || {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    };
    const hour = new Date(round.at).getUTCHours();
    const rate = this.rateForHour(entry, hour);
    const usd =
      ((ds.inputTokens + ds.cacheWriteTokens) / 1e6) * (rate.cacheMiss ?? 0) +
      (ds.cacheReadTokens / 1e6) * (rate.cacheHit ?? rate.cacheMiss ?? 0) +
      (ds.outputTokens / 1e6) * (rate.output ?? 0);
    return {
      currency: "USD",
      usdAmount: round2(usd),
      cnyAmount: round2(usd * this.usdToCnyRate),
      dsTokens:
        ds.inputTokens + ds.outputTokens + ds.cacheReadTokens + ds.cacheWriteTokens,
    };
  }

  /** 当前 agent 默认模型（读 ~/.dsh/settings.yaml，用于判断按套餐还是按量展示）。 */
  agentModel() {
    try {
      const raw = readFileSync(
        path.join(process.env.USERPROFILE || process.env.HOME || ".", ".dsh", "settings.yaml"),
        "utf8",
      );
      const provider = (raw.match(/^\s*provider:\s*(\S+)/m) || [])[1] || null;
      const model = (raw.match(/^\s*model:\s*(\S+)/m) || [])[1] || null;
      if (provider || model) return { provider, model, source: "settings" };
    } catch {
      /* settings 不可读时落到会话兜底 */
    }
    if (this.sessionModel) return { ...this.sessionModel, source: "session" };
    return { provider: null, model: null, source: null };
  }

  /**
   * 拉取 Z.ai（智谱）Coding Plan 服务端配额：
   * TOKENS_LIMIT unit=3 → 5 小时 token 窗口；unit=6 → 周配额；
   * TIME_LIMIT unit=5 → 工具/搜索额度（月度）。均为 percentage + nextResetTime。
   */
  async fetchZaiQuota() {
    try {
      const resolved = await this.ctx.credentials.resolve(credentialRef(this.zaiApiKeyEnv));
      if (!resolved) {
        this.zaiQuotaError = { code: "NO_CREDENTIAL", message: `未配置凭据 ${this.zaiApiKeyEnv}` };
        return;
      }
      const response = await fetch(this.zaiQuotaUrl, {
        headers: { Authorization: `Bearer ${resolved.value}`, Accept: "application/json" },
      });
      if (!response.ok) {
        this.zaiQuotaError = { code: "HTTP_ERROR", message: `配额接口返回 HTTP ${response.status}` };
        return;
      }
      const body = await response.json();
      const data = body && body.data;
      const limits = data && Array.isArray(data.limits) ? data.limits : [];
      let fiveHour = null;
      let weekly = null;
      let tools = null;
      for (const lim of limits) {
        const pct = Number(lim.percentage) || 0;
        const resetAt = typeof lim.nextResetTime === "number" ? lim.nextResetTime : null;
        if (lim.type === "TOKENS_LIMIT" && lim.unit === 3 && !fiveHour) {
          fiveHour = { percentage: pct, resetAt };
        } else if (lim.type === "TOKENS_LIMIT" && lim.unit === 6 && !weekly) {
          weekly = { percentage: pct, resetAt };
        } else if (lim.type === "TIME_LIMIT" && lim.unit === 5 && !tools) {
          tools = { percentage: pct, remaining: typeof lim.remaining === "number" ? lim.remaining : null, resetAt };
        }
      }
      this.zaiQuota = {
        level: (data && data.level) || null,
        fiveHour,
        weekly,
        tools,
        fetchedAt: Date.now(),
      };
      this.zaiQuotaError = null;
    } catch (error) {
      this.zaiQuotaError = {
        code: "FETCH_ERROR",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  snapshot() {
    return {
      balance: this.balance,
      usage: {
        inputTokens: this.usage.inputTokens,
        outputTokens: this.usage.outputTokens,
        cacheReadTokens: this.usage.cacheReadTokens,
        cacheWriteTokens: this.usage.cacheWriteTokens,
        totalTokens:
          this.usage.inputTokens +
          this.usage.outputTokens +
          this.usage.cacheReadTokens +
          this.usage.cacheWriteTokens,
        cacheHitRate: this.cacheHitRate(),
      },
      cost: this.estimateCost(),
      lastRound: this.lastRound
        ? {
            inputTokens: this.lastRound.inputTokens,
            outputTokens: this.lastRound.outputTokens,
            cacheReadTokens: this.lastRound.cacheReadTokens,
            cacheWriteTokens: this.lastRound.cacheWriteTokens,
            at: this.lastRound.at,
            cost: this.lastRoundCost(),
          }
        : null,
      pricing: this.pricingState(),
      zaiQuota: this.zaiQuota,
      zaiQuotaError: this.zaiQuotaError,
      agent: this.agentModel(),
      lastRefresh: this.lastRefresh,
      error: this.lastError,
      topUpUrl: this.topUpUrl,
    };
  }

  async refresh() {
    if (this.refreshing) return this.refreshing;
    this.refreshing = this.doRefresh();
    try {
      return await this.refreshing;
    } finally {
      this.refreshing = null;
    }
  }

  async doRefresh() {
    try {
      const resolved = await this.ctx.credentials.resolve(credentialRef(this.apiKeyEnv));
      if (!resolved) {
        this.lastError = { code: "NO_CREDENTIAL", message: `未配置凭据 ${this.apiKeyEnv}` };
        this.lastRefresh = Date.now();
        return this.snapshot();
      }
      const url = `${this.baseUrl}/user/balance`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${resolved.value}`, Accept: "application/json" },
      });
      if (!response.ok) {
        this.lastError = { code: "HTTP_ERROR", message: `余额接口返回 HTTP ${response.status}` };
        this.lastRefresh = Date.now();
        return this.snapshot();
      }
      const body = await response.json();
      this.balance = parseBalance(body);
      this.lastError = null;
      this.lastRefresh = Date.now();
    } catch (error) {
      this.lastError = {
        code: "FETCH_ERROR",
        message: error instanceof Error ? error.message : String(error),
      };
      this.lastRefresh = Date.now();
    }
    return this.snapshot();
  }

  async syncPricing() {
    if (this.pricingSource == null) return;
    if (this.pricingSyncing) return this.pricingSyncing;
    this.pricingSyncing = this.doSyncPricing();
    try {
      await this.pricingSyncing;
    } finally {
      this.pricingSyncing = null;
    }
  }

  async doSyncPricing() {
    try {
      const response = await fetch(this.pricingSource, {
        headers: { Accept: "text/html,text/plain,*/*", "User-Agent": "dsh-usage-stats/0.1" },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        this.pricingSyncError = { code: "HTTP_ERROR", message: `价目页返回 HTTP ${response.status}` };
        return;
      }
      const text = await response.text();
      const parsed = parsePricingPage(text);
      if (!parsed) {
        this.pricingSyncError = { code: "PARSE_ERROR", message: "无法从价目页解析出价格表" };
        return;
      }
      this.syncedPricing = {
        source: this.pricingSource,
        syncedAt: Date.now(),
        models: parsed.models,
        peakHours: parsed.peakHours,
        flat: parsed.flat,
      };
      this.pricingSyncError = null;
    } catch (error) {
      this.pricingSyncError = {
        code: "FETCH_ERROR",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  getSnapshot() {
    return this.snapshot();
  }

  /**
   * Schedule a restart of the whole `dsh web` process: write a detached
   * PowerShell script that kills every `@deepseek-ai` node process (this
   * server + its npx wrapper) after a short delay, then starts a fresh
   * `node <bin.js> web` from the same working directory. The script runs
   * independently, so it survives this process being killed.
   * @returns `{ scheduled: true }` or `{ scheduled: false, error }`.
   */
  async restart() {
    try {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const os = await import("node:os");
      const { spawn } = await import("node:child_process");

      const binJs = path.resolve(process.argv[1] || "");
      const nodeExe = process.execPath;
      const cwd = process.cwd();
      const psExe = path.join(
        process.env.SystemRoot || "C:\\Windows",
        "System32",
        "WindowsPowerShell",
        "v1.0",
        "powershell.exe",
      );
      const stamp = `${Date.now()}-${process.pid}`;
      const scriptPath = path.join(os.tmpdir(), `dsh-restart-${stamp}.ps1`);
      const outLog = path.join(os.tmpdir(), `dsh-web-${stamp}-out.log`);
      const errLog = path.join(os.tmpdir(), `dsh-web-${stamp}-err.log`);

      const script = [
        "$ErrorActionPreference = 'SilentlyContinue'",
        "Start-Sleep -Seconds 4",
        "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -match '@deepseek-ai' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }",
        "Start-Sleep -Seconds 2",
        `Start-Process -FilePath '${nodeExe}' -ArgumentList @('${binJs}', 'web') -WorkingDirectory '${cwd}' -RedirectStandardOutput '${outLog}' -RedirectStandardError '${errLog}'`,
        "Remove-Item $MyInvocation.MyCommand.Path -Force -ErrorAction SilentlyContinue",
      ].join("\r\n");

      fs.writeFileSync(scriptPath, script, "utf8");
      spawn(psExe, ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath], {
        detached: true,
        stdio: "ignore",
      }).unref();

      return { scheduled: true, scheduledAt: Date.now() };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.lastError = { code: "RESTART_ERROR", message };
      return { scheduled: false, error: message };
    }
  }
}

export default UsageStatsService;
