# 全平台内容分发 Chrome 扩展：完整需求与技术说明（可复刻版）

> 目标读者：产品经理、项目负责人、前端/扩展工程师、测试同学  
> 文档定位：一份文档同时满足「非技术快速理解」和「技术可复刻实现」

---

## 1. 一句话说明（给非技术）

这是一个 Chrome 扩展。用户输入一篇微信公众号文章链接后，系统自动抓取标题、正文和图片，放到一个可编辑页面里；用户勾选要发布的平台（小红书/知乎等），点击同步后，扩展自动打开各平台发布页并预填内容，减少重复搬运工作。

---

## 2. 业务目标与价值

## 2.1 业务目标
- 把“从公众号复制到多平台”从手工操作改为半自动流程。
- 缩短分发耗时（目标：从 20-40 分钟降到 5-10 分钟）。
- 降低错漏率（漏段落、漏图片、标题不一致）。

## 2.2 用户价值
- 内容运营：一次导入，多端复用。
- 产品经理：可视化编辑，发布前可快速调整。
- 团队协作：统一流程、易交接、可追溯问题。

---

## 3. 产品需求（PRD）

## 3.1 用户角色
- 内容运营（核心用户）
- 产品经理（审核内容）
- 渠道负责人（发布执行）

## 3.2 核心流程
1. 点击扩展图标，打开独立分发页面（不是小 popup）。
2. 输入公众号链接，点击“获取内容”。
3. 系统展示标题、作者、字数、正文（富文本）、图片。
4. 用户在编辑器内调整格式与文案。
5. 选择目标平台（小红书、知乎、简书、头条、B站）。
6. 点击“开始同步分发”。
7. 系统逐个打开平台发布页并自动填充内容。

## 3.3 功能清单

### A. 导入功能
- 输入：公众号文章 URL（`mp.weixin.qq.com`）。
- 输出：
  - 标题
  - 作者（如可获取）
  - 发布时间（如可获取）
  - 正文 HTML + 文本
  - 图片列表
- 规则：
  - 保留基本段落结构（段落/标题/列表/引用）。
  - 图片尽量自动显示；失败时保留“原图链接”。

### B. 编辑功能
- 使用 Quill 富文本编辑器。
- 支持：
  - 标题级别、粗体、斜体、列表、引用、链接、图片。
- 自动排版：
  - 清洗异常内联样式
  - 统一段间距和行高
  - 压缩多余空行

### C. 分发功能
- 支持平台：小红书、知乎、简书、今日头条、哔哩哔哩。
- 操作方式：
  - 自动打开对应发布页面
  - 通过 content script 自动写入标题与正文

### D. 数据与状态
- 本地自动保存当前编辑内容（`chrome.storage.local`）。
- 下次打开可恢复未发布草稿。

## 3.4 非功能要求
- 性能：单篇文章导入体验应在可接受范围（通常 3-15 秒，取决于文章与图片数量）。
- 稳定性：导入失败时必须给出可读错误，不允许“无提示空白”。
- 可维护性：关键链路有日志，能定位在提取、渲染还是同步阶段失败。
- 安全：不上传用户内容到第三方服务（本项目本地处理）。

---

## 4. 通俗解释（给非技术产品）

可以把系统理解成三个步骤：

1. **搬内容**：先把公众号文章搬进来（标题、正文、图片）。  
2. **修内容**：在右边编辑器里改文案和排版。  
3. **发内容**：勾选平台，一键打开发布页并填好内容。

为什么有时图片会有问题？  
因为微信公众号图片有防盗链机制，像“只让自己站内看，不让外部直接盗用”。所以系统会尽量转换图片为可用形式；如果还失败，至少给出“可打开原图链接”，确保不会丢图位置信息。

---

## 5. 技术方案（TDD）

## 5.1 技术栈
- Chrome Extension Manifest V3
- JavaScript（原生）
- Quill 富文本编辑器（本地资源）
- Chrome APIs：`tabs`、`scripting`、`storage`、`runtime`

## 5.2 目录结构（关键）

```text
content-distributor/
├── manifest.json
├── pages/distributor.html
├── js/background.js
├── js/distributor.js
├── js/content-scripts/
│   ├── xiaohongshu.js
│   ├── zhihu.js
│   └── universal.js
├── css/distributor.css
├── js/lib/quill.min.js
└── css/quill.snow.css
```

## 5.3 架构说明

### 1) UI 层（`pages/distributor.html` + `js/distributor.js`）
- 负责输入链接、展示内容、编辑和点击同步。
- 通过 `chrome.runtime.sendMessage` 请求后台抓取内容。

### 2) 后台层（`js/background.js`）
- 接收 `fetchWechatArticle` 消息。
- 创建隐藏标签页加载公众号文章。
- 注入 `extractWechatContent` 到公众号页面提取内容。
- 尝试处理微信图片（转可用地址/data URL）。
- 返回结构化文章对象给 UI。

### 3) 平台填充层（`js/content-scripts/*.js`）
- 在目标平台发布页监听待填充内容。
- 自动填入标题和正文。

## 5.4 关键消息协议（建议遵循）

### UI -> Background
- `action: "fetchWechatArticle"`
  - `url: string`
- `action: "openPublishPage"`
  - `platform: string`
  - `content: { title, body, text, cover }`

### Background -> UI
- `{ success: true, data: Article }`
- `{ success: false, error: string }`

### Article 建议结构
```json
{
  "title": "string",
  "author": "string",
  "publishTime": "string",
  "cover": "string",
  "content": "html string",
  "textContent": "string",
  "imageUrls": ["string"],
  "imageCount": 0,
  "unresolvedImageUrls": ["string"]
}
```

---

## 6. 公众号提取实现要点（复刻重点）

## 6.1 为什么不用直接 `fetch` 抓公众号 HTML
- 公众号跨域限制严格，普通页面直接抓取容易被 CORS 拦截。
- 推荐做法：后台创建 tab + 注入脚本，在目标页面上下文读取 DOM。

## 6.2 提取步骤
1. 后台打开公众号 URL（可不激活）。
2. 等待页面 `complete`，再额外等待渲染时间。
3. 注入提取函数读取：
   - 标题：`#activity-name` / `.rich_media_title` / `h1`
   - 正文：`#js_content` / `.rich_media_content` / `article`
   - 图片：`data-src` / `data-original` / `src` / `currentSrc`
4. 清理无用节点（script/style/隐藏节点）。
5. 构建 HTML + 文本兜底。
6. 返回数据并关闭临时标签页。

## 6.3 必须注意的坑
- 注入函数必须“自包含”，不能调用外部作用域函数。
- `textContent` 会丢换行，优先 `innerText`。
- 图片属性要兼容单双引号和无引号写法。
- 失败时一定给兜底文本，不要让编辑器空白。

---

## 7. 排版策略（复刻重点）

## 7.1 自动排版目标
- 保持可读性而不是追求完全还原公众号像素级样式。
- 避免导入后“一整段”或“空行过多”。

## 7.2 规则建议
- 清理冲突内联样式（字号、行高、margin/padding）。
- 保留结构元素（`p/h1-h3/ul/ol/li/blockquote/img`）。
- 多个空段落压缩为一个。
- 编辑器统一：
  - 正文字号 `16px`
  - 行高 `1.8~1.9`
  - 合理段间距

---

## 8. 图片处理策略（复刻重点）

## 8.1 现状
- 微信图片有防盗链，直接放外部页面可能加载失败。

## 8.2 实施策略
1. 尝试在后台拉取图片并转为可显示地址（如 `data:`）。
2. 若正文无图片节点但有 URL，自动补图块。
3. 加载失败时显示“打开原图链接”占位，不静默丢失。

## 8.3 权限要求（manifest）
- `https://mp.weixin.qq.com/*`
- `https://mmbiz.qpic.cn/*`
- `https://*.qpic.cn/*`

---

## 9. 安装与复刻步骤（给新同学）

1. 拉取项目代码。
2. 打开 Chrome：`chrome://extensions/`。
3. 开启开发者模式。
4. 加载已解压扩展，选择项目根目录。
5. 点击扩展图标，进入分发页面。
6. 用公开公众号链接做端到端测试。

---

## 10. 测试与验收标准（UAT）

## 10.1 功能验收
- 能导入标题、正文、图片。
- 编辑器中有段落和空行，非一整段。
- 点击同步可打开目标平台并填入内容。

## 10.2 异常验收
- 链接非法时给明确提示。
- 抓取失败时给明确错误，不出现无反馈。
- 图片失败时至少给可点击原图链接。

## 10.3 回归建议
- 至少准备 3 篇样例（长文、多图、列表/引用）。
- 每次改提取逻辑都执行一次完整回归。

---

## 11. 运维与排障（简版）

1. 先刷新扩展（很多问题来自缓存旧版本）。
2. 看扩展页面控制台日志（提取/渲染状态）。
3. 看 Service Worker 日志（后台抓取状态）。
4. 按专项手册排查：
   - `/Users/liminrong/content-distributor/WECHAT_IMPORT_INCIDENT_RUNBOOK.md`

---

## 12. 产品可直接使用的版本说明模板

可用于每次迭代发布：

```markdown
版本号：vX.Y.Z
发布时间：YYYY-MM-DD

本次新增：
- [功能1]
- [功能2]

本次修复：
- [问题1：现象 -> 修复方式]
- [问题2：现象 -> 修复方式]

已知限制：
- [限制1]
- [限制2]
```

---

## 13. 后续可扩展方向

- 新平台扩展（微博、百家号、公众号草稿箱等）。
- 图片本地化上传（图床/API）。
- 多文章批量导入。
- 内容模板与风格预设。
- 发布前合规检查（字数、敏感词、图片缺失）。

---

## 14. 相关文档导航

- 安装使用：`/Users/liminrong/content-distributor/INSTALL.md`
- 故障总览：`/Users/liminrong/content-distributor/TROUBLESHOOTING.md`
- 微信导入专项复盘：`/Users/liminrong/content-distributor/WECHAT_IMPORT_INCIDENT_RUNBOOK.md`
- 项目索引：`/Users/liminrong/content-distributor/INDEX.md`

