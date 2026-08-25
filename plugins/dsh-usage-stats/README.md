# dsh-usage-stats

DeepSeek Harness 用量统计插件：实时显示账户余额、统计 token 用量，并支持一键跳转到 DeepSeek 充值页。

## 功能

- **实时余额**：通过 DeepSeek 官方 `/user/balance` 接口拉取账户余额（含总余额、充值余额、赠送余额），按配置的间隔自动轮询，也可手动刷新。
- **用量统计**：累计所有会话的 provider 上报 token 用量（输入 / 输出 / 缓存读 / 缓存写 / 合计）。只累加每个 step 的最终 `assistant/message` 用量，流式过程中的 chunk 采样不会重复计数。
- **官网定价自动同步**：定时抓取并解析官网价目页（`api-docs.deepseek.com/quick_start/pricing/`），把各模型的**峰价 / 谷价 / 峰值时段**同步到设置面板；用量按 UTC 小时分桶、逐桶套用峰谷价来估算费用；抓取失败自动回退到静态 `pricing` 配置。
- **一键充值**：侧边栏底部的余额胶囊与设置面板里的「去充值」按钮，点击后在新标签页打开充值页（默认 `https://platform.deepseek.com/top_up`）。
- **两处入口**：
  - `sidebar.footer.action` —— 侧边栏底部设置按钮旁的紧凑余额胶囊（窄栏只显示 `¥` 图标）。
  - `settings.section` —— 设置面板里新增「用量与余额」分区，展示完整统计。

## 目录结构

```
dsh-usage-stats/
├── package.json            # 双面（host + web client）插件声明
├── install.patch.example.yml
└── lib/
    ├── index.js            # host 插件：usageStats 服务（余额拉取 + 用量累计 + Remote 方法）
    ├── client.js           # web 客户端插件：余额胶囊 + 设置分区 + Remote 挂载
    └── types/              # TypeScript 声明
```

## 工作原理

- **host** 侧注册一个进程级 Cordis 服务 `usageStats`（继承自 `TypertRemoteService`）：
  - 监听 `session/event`，折叠 `assistant/message` 的 `data.usage`，累计 token 用量；
  - 通过 `ctx.credentials.resolve(credentialRef('DEEPSEEK_API_KEY'))` 按次解析 API Key（从不缓存、不落盘），用全局 `fetch` 调 `GET {baseUrl}/user/balance`；
  - 通过 `@Remote` 标记暴露 `getSnapshot()` / `refresh()` 两个远程方法，由 API Gateway 分发。
- **client** 侧把手工构造的严格模式 Typert Remote contribution 用 `ctx.remote.$mount()` 挂载，再通过 `ctx.remote.usageStats.*` 调用；UI 通过 `ctx.slots.register()` 注入到上述两个 slot。

## 安装

前置条件：已初始化 web profile（`dsh web` 启动过一次），且已在设置 → Models 中配置好 `DEEPSEEK_API_KEY`（或 `$DSH_HOME/.credentials.yaml` 里存在该凭据）。

```sh
# 1. 把本包安装进 web profile 的依赖
dsh plugin --profile web add "D:/deepseek harness/dsh-usage-stats"
#    等价于在 profile 目录里执行 pnpm add file:<本包路径>
```

```sh
# 2. 编辑 $DSH_HOME/profiles/web/cordis.patch.yml（Windows 下为
#    C:\Users\<你>\.dsh\profiles\web\cordis.patch.yml），
#    把 install.patch.example.yml 里的 insert 列表合并进去。
```

```sh
# 3. 重启 dsh web
dsh web
```

## 配置

行配置位于 `cordis.patch.yml` 的 `usage-stats` 行 `config` 下：

| 键 | 默认值 | 说明 |
|---|---|---|
| `apiKeyEnv` | `DEEPSEEK_API_KEY` | 凭据引用（环境变量名 / `.credentials.yaml` 键） |
| `baseUrl` | `https://api.deepseek.com` | 余额接口 base URL |
| `topUpUrl` | `https://platform.deepseek.com/top_up` | 充值页地址 |
| `refreshIntervalMs` | `60000` | 余额与定价的轮询间隔（毫秒） |
| `pricingSource` | `https://api-docs.deepseek.com/quick_start/pricing/` | 官网价目页地址；`null` 关闭自动同步 |
| `estimateModel` | `deepseek-v4-pro` | 用于费用估算的模型（token 跨模型聚合，估算本身为近似） |
| `pricing` | `null` | 静态回退单价表（每百万 token，CNY），仅在自动同步关闭或解析失败时使用 |

`pricing` 结构（单位：CNY / 1M tokens）：

```yaml
pricing:
  currency: CNY
  input: 0.27        # 未缓存输入
  output: 1.10       # 输出
  cacheRead: 0.07    # 缓存命中读
  cacheWrite: 0.27   # 缓存写
```

## 注意事项

- 余额以 DeepSeek 官方接口返回为准，是权威值，且**本身就是实时自动同步的**（轮询刷新，含峰谷、任何模型与促销的真实扣费）；token 用量来自 provider 上报的 `usage`，为进程内累计（重启后从零重新累计）。
- 「官网定价同步」通过抓取并解析价目页实现：**官方没有 JSON 单价接口**，价目是网页文本，页面改版可能导致解析失败（此时自动回退到 `pricing`，并在设置面板显示错误）。
- 官网价目与「预估费用」单位为 **USD**（价目页原始单位）；余额接口返回的是账户实际币种（如 CNY）。两者币种不同属正常。
- 「token → 费用」仍是**估算**：① token 跨模型聚合，按 `estimateModel` 的单价折算；② 峰谷价按 UTC 小时分桶套用，但跨小时的 step 用量只能按最终事件时间入桶、且峰值时段的边界分钟级误差无法消除。精确到分的真实费用以余额为准。
- 余额轮询与每次「刷新」都会调用 DeepSeek 接口；接口返回 401/网络错误时会在设置面板里显示错误信息，侧边栏胶囊静默降级。
- 本插件为进程级、内存态统计，未引入额外持久化，重启 DSH 后用量计数归零（余额与已同步单价不受影响，下次启动会重新拉取）。

## 手动构建（可选）

本包已经带预编译产物（`lib/*.js`），无需构建即可安装。若你把它放进 monorepo 用 `tsdown` 重新打包，保持 `src/index.ts`（host 入口，`@Remote` 装饰器）与 `src/client/index.ts`（浏览器入口）的结构即可；`dsh.client.inject` 与 `exports["./client"]` 无需改动。
