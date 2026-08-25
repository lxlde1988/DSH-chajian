# DSH-chajian

DeepSeek Harness · 个人习惯与插件备份

把你在 DSH 里安装的**自定义插件**、**个人配置**和**使用习惯**（默认模型、主题等）备份到这里，
这样换电脑/回家后，只需 `git clone` / `git pull` 再跑一个脚本就能还原整套使用方式。

> 本仓库**不含任何 API 密钥**。你的 `DEEPSEEK_API_KEY` 等敏感信息只在各自电脑的
> `%USERPROFILE%\.dsh\.credentials.yaml` 里（已用 `.gitignore` 排除）。

---

## 目录结构

```
DSH-chajian/
├── plugins/                  # 自定义插件（源码/已构建，install/backup 自动枚举全部）
│   ├── dsh-usage-stats/      # 用量/余额/一键充值/重启插件（本仓库自研）
│   ├── dsh-worktable/        # 第三方面板插件（来自 Aisland-SJL/dsh-worktable，**已打补丁**，见下）
│   └── dsh-github-sync/      # GitHub 备份同步插件（自动把本机状态推到本仓库）
├── config/
│   └── web/
│       ├── cordis.patch.yml  # 决定加载哪些插件（自动枚举出的全部插件）
│       ├── cordis.yml
│       ├── package.json
│       └── pnpm-workspace.yaml
├── settings/
│   └── settings.yaml         # 使用习惯：默认模型、reasoningEffort、模型列表等
├── scripts/
│   ├── install.ps1           # 在家/新电脑：把仓库内容装到本机 .dsh（自动枚举 plugins\*）
│   ├── backup.ps1            # 在常用电脑：把本机最新状态收集回仓库（自动枚举 dsh-*）
│   ├── push-via-api.ps1      # github.com 被阻断时的 API 推送包装
│   └── push-via-api.mjs      # 走 api.github.com 的推送实现
├── 启动DSH.bat                # 一键启动 DSH
├── .credentials.example.yaml # 密钥模板（不含真实密钥，仅在 .credentials.yaml 里）
└── .gitignore
```

### 本仓库的 dsh-worktable 补丁说明

仓库里的 dsh-worktable 在官方发布包基础上打了这些补丁（`install.ps1` 装上即带）：

1. **服务端新增常驻搜索端点**（`lib/index.js`）：
   - `GET /api/worktable/searchrelay?kw=&domain=` — 360/Bing 站内搜索兜底
   - `GET /api/worktable/xhssearch?kw=` — 调用本机已登录的 `xhs` CLI（小红书官方数据）
   - `GET /api/worktable/twittersearch?kw=` — 调用本机已登录的 `twitter` CLI（X 官方数据，凭据经 `_tools/twitter_auth.json` 或环境变量）
   - CLI 路径自动探测（Python310–313），跨机器可用
2. **分屏稳定性修复**（`lib/client.js`）：
   - `yieldObserver` 边距被外层 React 重渲染冲掉时**自愈写回**而不是误关分屏（修「打字/拖分隔条就跳回控制室」）
   - 输入框内按 Esc 不再关闭分屏（含输入法合成态保护）
   - 会话切换不再自动关闭分屏；停用 `.ta_split` 全局观察器误关
   - `close()` 加诊断日志（控制台 `[worktable] split close triggered` + 调用栈）

> 搜索台页面（窗口1/窗口2）与中继在另一个仓库 **X-Cli**（多平台搜索台），两者配合使用；
> X-Cli 的 `setup/` 里也留了一份插件补丁作为兜底。

---

## 在家/新电脑：第一次同步（还原）

前提：电脑已装好 Node.js（`node -v` 可运行）。

```powershell
# 1) 拉下仓库
git clone https://github.com/lxlde1988/DSH-chajian.git
cd DSH-chajian

# 2) 首次建议先让 DSH 生成 profile（如果没跑过）
npx -y @deepseek-ai/dsh web

# 3) 一键安装：复制插件、写入 cordis.patch.yml、同步 settings.yaml、生成密钥模板
.\scripts\install.ps1
```

之后：
1. 打开 `%USERPROFILE%\.dsh\.credentials.yaml`，填入你的 `DEEPSEEK_API_KEY`（模板已生成）。
2. 运行桌面上的 `启动DSH.bat`（或 `npx -y @deepseek-ai/dsh web`）。

> DSH 核心本体不在此仓库；请用 `npx -y @deepseek-ai/dsh web` 安装/升级最新版，本仓库只同步**插件 + 配置 + 习惯**。
> DSH 版本更新如遇问题，仍可用 `npx -y @deepseek-ai/dsh@latest web`。

---

## 日常备份到 GitHub（在常用的那台电脑）

每次调好插件/习惯后，把最新状态推上去：

```powershell
cd D:\deepseek harness\DSH-chajian
.\scripts\backup.ps1      # 把本机状态收集进仓库
git add .
git commit -m "更新插件与习惯"
git push
```

> 如果 `git push` 因 `github.com` 连不上而失败（**中国大陆网络常见**：`github.com` 被阻断/超时，
> 但 `api.github.com` 通常可用），请改用 API 推送：
> ```powershell
> $env:GH_PUSH_TOKEN = "github_pat_xxx"   # 你的令牌
> .\scripts\push-via-api.ps1              # 走 api.github.com，无需连 github.com
> ```
> 该脚本会把仓库全部文件打包成一个提交写入 `main`（可重复运行，追加新提交）。

---

## 日常从 GitHub 同步新内容

在有更新的电脑上：

```powershell
cd D:\deepseek harness\DSH-chajian
git pull
.\scripts\install.ps1     # 重新应用（install 是幂等的，会覆盖插件/配置/设置到 .dsh）
```

---

## 关于密钥（重要）

- 真实密钥只存放在 **本机** `%USERPROFILE%\.dsh\.credentials.yaml`。
- 该文件已被 `.gitignore` 排除，**不会**被提交。
- 新电脑首次 `install.ps1` 会生成 `.credentials.yaml` 模板，请手动填入密钥。
- 如果你把 `.credentials.yaml` 或任何 `sk-...` 误提交了，请立即到 GitHub 仓库 Settings → Security 里**吊销并重新生成密钥**。

---

## 关于插件

- **dsh-usage-stats**（本仓库自研）：在侧边栏显示余额/费用（本轮扣费）、弹出详情、一键充值、一键重启。
  定价表从 DeepSeek 官方价目页自动同步。
- **dsh-worktable**（第三方）：来自 <https://github.com/Aisland-SJL/dsh-worktable>（发布包）。
  **注意：本仓库版本已打补丁**（常驻搜索端点 + 分屏稳定性修复，见上方「补丁说明」）。
  若从原仓库升级，会**丢掉补丁**——升级后请重跑 X-Cli 仓库的 `setup\patch-plugin.ps1`。
- **dsh-github-sync**（自研）：自动把本机 DSH 状态同步/备份到 GitHub（生成「DSH同步: …」提交）。
