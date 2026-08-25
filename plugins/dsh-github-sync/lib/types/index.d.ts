/** dsh-github-sync — host service data types. */

export interface GithubSyncStatus {
  repo: string | null;
  branch: string | null;
  repoDir: string | null;
  repoDirExists: boolean;
  plugins: string[];
  hasToken: boolean;
  lastSync: number | null;
  lastError: { code: string; message: string } | null;
  syncing: boolean;
}

export interface GithubConfig {
  repo?: string;
  branch?: string;
  repoDir?: string;
  plugins?: string[];
}

export interface SetTokenResult {
  ok: boolean;
}

export interface SyncResult {
  ok: boolean;
  error?: string;
  copiedCount?: number;
  copied?: string[];
  fileCount?: number;
  errors?: { path: string | null; message: string }[];
  lastSync?: number | null;
}
