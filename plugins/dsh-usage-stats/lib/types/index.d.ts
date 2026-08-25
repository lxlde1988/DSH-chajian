import type { Context } from '@deepseek-ai/cordis';

export interface UsageBucket {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface BalanceInfo {
  currency: string;
  totalBalance: string;
  grantedBalance: string;
  toppedUpBalance: string;
}

export interface Balance {
  isAvailable: boolean;
  infos: BalanceInfo[];
}

export interface PricingRate {
  cacheHit?: number;
  cacheMiss?: number;
  output?: number;
}

export interface PricingModel {
  model: string;
  peak?: PricingRate | null;
  offPeak?: PricingRate | null;
  cacheHit?: number | null;
  cacheMiss?: number | null;
  output?: number | null;
}

export interface PeakHourRange {
  from: number;
  to: number;
}

export interface PricingState {
  mode: 'synced' | 'manual' | 'none';
  source: string | null;
  syncedAt: number | null;
  error: { code: string; message: string } | null;
  models: PricingModel[];
  peakHours: PeakHourRange[] | null;
  currency: string | null;
}

export interface LastRoundCost {
  currency: string;
  usdAmount: number;
  cnyAmount: number;
}

export interface LastRound {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  at: number;
  cost: LastRoundCost | null;
}

export interface UsageStatsSnapshot {
  balance: Balance | null;
  usage: UsageBucket & { totalTokens: number; cacheHitRate: number | null };
  cost: { currency: string; amount: number } | null;
  lastRound: LastRound | null;
  pricing: PricingState;
  lastRefresh: number | null;
  error: { code: string; message: string } | null;
  topUpUrl: string;
}

export interface UsageStatsConfig {
  /** Credential reference for the DeepSeek API key (default `DEEPSEEK_API_KEY`). */
  apiKeyEnv?: string;
  /** Base URL of the DeepSeek API (default `https://api.deepseek.com`). */
  baseUrl?: string;
  /** Top-up page opened by the client (default `https://platform.deepseek.com/top_up`). */
  topUpUrl?: string;
  /** Balance polling interval in ms (default 60000). */
  refreshIntervalMs?: number;
  /** Official pricing page URL to fetch and parse; null disables auto-sync. */
  pricingSource?: string | null;
  /** Model whose synced price is used for the flat estimate (default `deepseek-v4-pro`). */
  estimateModel?: string;
  /** Optional static price table (per 1M tokens) used when auto-sync is unavailable. */
  pricing?: {
    currency?: string;
    input: number;
    output: number;
    cacheRead?: number;
    cacheWrite?: number;
  } | null;
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    usageStats: UsageStatsService;
  }
}

export declare class UsageStatsService {
  static inject: string[];
  constructor(ctx: Context, config?: UsageStatsConfig);
  getSnapshot(): UsageStatsSnapshot;
  refresh(): Promise<UsageStatsSnapshot>;
  restart(): Promise<{ scheduled: boolean; scheduledAt?: number; error?: string }>;
}

export default UsageStatsService;
