import type { Context } from '@deepseek-ai/cordis';
import type { UsageStatsSnapshot } from './index.ts';

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteMap {
    'usageStats/getSnapshot': () => Promise<
      | { ok: true; value: UsageStatsSnapshot }
      | { ok: false; error: { code: string; message: string; details: object } }
    >;
    'usageStats/refresh': () => Promise<
      | { ok: true; value: UsageStatsSnapshot }
      | { ok: false; error: { code: string; message: string; details: object } }
    >;
    'usageStats/restart': () => Promise<
      | { ok: true; value: { scheduled: boolean; scheduledAt?: number } }
      | { ok: false; error: { code: string; message: string; details: object } }
    >;
  }
  interface TypertRemoteNamespaceMap {
    usageStats: {
      getSnapshot: TypertRemoteMap['usageStats/getSnapshot'];
      refresh: TypertRemoteMap['usageStats/refresh'];
      restart: TypertRemoteMap['usageStats/restart'];
    };
  }
}

export declare const inject: string[];
export declare function apply(ctx: Context): void;
