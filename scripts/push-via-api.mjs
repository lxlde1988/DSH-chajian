// push-via-api.mjs — push this repo's files to GitHub via the Contents API (api.github.com).
// Token source: env GH_PUSH_TOKEN, else ./.push-token.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoDir = path.resolve(here, "..");
const repoDefault = "lxlde1988/DSH-chajian";
const token = (process.env.GH_PUSH_TOKEN || (fs.existsSync(path.join(repoDir, ".push-token")) ? fs.readFileSync(path.join(repoDir, ".push-token"), "utf8").trim() : ""));
if (!token) { console.error("未找到令牌：设置 GH_PUSH_TOKEN 或创建 .push-token"); process.exit(1); }

const arg = process.argv[2]; // optional "owner/repo"
const repo = arg || repoDefault;
const branch = process.argv[3] || "main";
const api = `https://api.github.com/repos/${repo}`;
const headers = { "User-Agent": "dsh-github-sync", "Accept": "application/vnd.github+json", "Authorization": "Bearer " + token, "Content-Type": "application/json" };

async function walk(dir, base = dir) {
  const out = [];
  for (const e of await fs.promises.readdir(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name === ".git") continue; out.push(...(await walk(abs, base))); }
    else out.push(path.relative(base, abs).replace(/\\/g, "/"));
  }
  return out;
}
const skip = (rel) => {
  const b = (rel.split("/").pop() || rel).toLowerCase();
  return b.startsWith(".push-token") || b.endsWith(".local.json");
};

let ok = 0; const errors = [];
for (const rel of (await walk(repoDir)).filter((f) => !skip(f))) {
  const url = `${api}/contents/${rel}`;
  const body = { message: `DSH同步: ${rel}`, content: Buffer.from(fs.readFileSync(path.join(repoDir, rel))).toString("base64"), branch };
  try {
    const r = await fetch(url, { method: "PUT", headers, body: JSON.stringify(body) });
    if (r.ok) { ok++; continue; }
    const cur = await (await fetch(`${url}?ref=${branch}`, { headers })).json();
    body.sha = cur.sha;
    const r2 = await fetch(url, { method: "PUT", headers, body: JSON.stringify(body) });
    if (r2.ok) { ok++; } else { errors.push(`${rel}: ${(await r2.text()).slice(0, 140)}`); }
  } catch (e) { errors.push(`${rel}: ${e.message}`); }
}
console.log(`pushed=${ok} errors=${errors.length}`);
errors.forEach((e) => console.log("  ! " + e));
