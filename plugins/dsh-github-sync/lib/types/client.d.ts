import type { GithubSyncStatus, GithubConfig, SetTokenResult, SyncResult } from "./index";

/** Web client contract: the host `githubSync` remote service. */
export interface GithubSyncRemote {
  getStatus(): Promise<GithubSyncStatus>;
  save(cfg: GithubConfig): Promise<GithubSyncStatus>;
  setToken(token: string): Promise<SetTokenResult>;
  syncToGithub(): Promise<SyncResult>;
}
