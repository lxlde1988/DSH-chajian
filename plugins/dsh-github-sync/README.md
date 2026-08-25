# dsh-github-sync

DeepSeek Harness 插件：**一键把插件、配置、使用习惯备份到 GitHub**。

在 DSH 设置面板的「GitHub 同步」卡片里点一下「同步到 GitHub」，它会：

1. 把当前安装的插件（`dsh-usage-stats`、`dsh-worktable`）、`~/.dsh/profiles/web` 配置、`~/.dsh/settings.yaml`、启动脚本收集进本地仓库文件夹；
2. 通过 GitHub **Contents API（api.github.com）** 把仓库里所有文件推送到 GitHub——即使 `github.com`（git 端口）在这个网络被阻断也能成功；
3. 在面板里显示结果（已备份几项、推送几个文件、是否有失败）。

## 安全

- **令牌只存在本机** `%USERPROFILE%\.dsh\profiles\web\dsh-github-sync.local.json`，**绝不进入公开仓库**（该路径不在仓库文件夹内，且会被 `push` 逻辑跳过）。
- 你的仓库是公开的，所以这个插件不会把任何 API 密钥或令牌上传。

## 配置与使用

打开 DSH → 设置（⚙）→「GitHub 同步」：

1. 填 `仓库（owner/repo）`＝`lxlde1988/DSH-chajian`、`分支`＝`main`、`本地仓库路径`＝本地仓库文件夹；
2. 在 `令牌` 框粘贴你的 GitHub Fine-grained token（Contents → Read and write，仅限该仓库）；
3. 点「保存配置」；
4. 点「同步到 GitHub」即可。

首次使用前 `repoDir` 要存在（可用 `git clone` 或手动建目录）。`repoDir` 内文件的提交信息会带 `DSH同步: <path>`。

> 依赖：本机已安装 Git（可 `git clone` 或用 `push-via-api`）。本项目不改 DSH 核心；在任意电脑 `git clone` 本仓库后运行 `.\scripts\install.ps1` 即可一键还原。
