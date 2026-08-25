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
├── plugins/                  # 自定义插件（源码/已构建）
│   ├── dsh-usage-stats/      # 用量/余额/一键充值/重启插件（本仓库自研）
│   └── dsh-worktable/        # 第三方面板插件（来自 Aisland-SJL/dsh-worktable）
├── config/
│   └── web/
│       ├── cordis.patch.yml  # 决定加载哪些插件（usage-stats / dsh-worktable）
│       ├── cordis.yml
│       ├── package.json
│       └── pnpm-workspace.yaml
├── settings/
│   └── settings.yaml         # 使用习惯：默认模型、reasoningEffort、模型列表等
├── scripts/
│   ├── install.ps1           # 在家/新电脑：把仓库内容装到本机 .dsh
│   └── backup.ps1            # 在常用电脑：把本机最新状态收集回仓库
├── 启动DSH.bat                # 一键启动 DSH
├── .credentials.example.yaml # 密钥模板（不含真实密钥，仅在 .credentials.yaml 里）
└── .gitignore
```

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
- **dsh-worktable**（第三方）：来自 <https://github.com/Aisland-SJL/dsh-worktable>（发布包）。升级可去原仓库。
