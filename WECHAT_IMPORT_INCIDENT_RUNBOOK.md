# 微信公众号导入问题复盘与交接手册

## 背景
- 目标功能：输入公众号链接后，自动提取标题、封面、正文（保留格式）和图片，展示在右侧富文本编辑器，再分发到目标平台。
- 本次故障：出现“提示获取成功但正文空白/无格式/无图片”的连续问题。
- 复盘日期：2026-02-12

---

## 1. 现象与根因对照

### 现象A：提示获取成功，但正文编辑区是空的
- 根因1：公众号页面正文节点渲染较慢，过早抓取到空壳 DOM。
- 根因2：抓到的 HTML 结构可见内容不足，`content` 实际为空。
- 根因3：注入页函数异常时没有可靠兜底文本。

### 现象B：提取到了文字，但全部挤成一行、无段落
- 根因1：使用 `textContent` 导致换行信息丢失。
- 根因2：直接写 `innerHTML` 到 Quill，部分结构被压平。
- 根因3：导入后缺少统一排版清洗。

### 现象C：图片无法显示/完全不见
- 根因1：微信图片防盗链，直接引用 `mmbiz.qpic.cn` 常失败。
- 根因2：图片属性解析只覆盖部分写法（单双引号、无引号、懒加载属性不完整）。
- 根因3：CSS 把 `<img>` 当占位容器样式处理，影响可见性。

### 现象D：报错 `buildRichHtmlFromBlocks is not defined`
- 根因：`chrome.scripting.executeScript` 注入函数运行在目标页面上下文，不能依赖 service worker 外部 helper。

---

## 2. 已落地修复（代码级）

## 2.1 提取链路（`/Users/liminrong/content-distributor/js/background.js`）
- 增加正文渲染等待与多选择器兜底。
- `extractWechatContent` 改为自包含（不依赖外部函数）。
- 文本提取从 `textContent` 升级为 `innerText || textContent`，保留换行。
- 增加块级结构重建（`h/p/li/...`）和纯文本段落兜底。
- 图片提取兼容 `data-src/data-original/src/currentSrc`，并补抓 HTML 中的 `qpic` 链接。
- 后台尝试将微信图转换为 `data:` URL，提升编辑区可见率。
- 出错时返回页面纯文本兜底，避免编辑区空白。

## 2.2 展示链路（`/Users/liminrong/content-distributor/js/distributor.js`）
- 使用 `quill.clipboard.dangerouslyPasteHTML` 导入内容。
- 兼容单双引号/无引号的图片属性解析，缺失 `src` 时自动回填。
- 若正文无 `<img>` 但提取到了 `imageUrls`，自动补图块。
- 图片加载失败显示“打开原图链接”，不再静默消失。
- 新增自动排版：空行压缩、段落标准化、清洗冲突内联样式。

## 2.3 样式链路（`/Users/liminrong/content-distributor/css/distributor.css`）
- 调整编辑器默认排版：字号、行高、段距、标题层级、列表、引用、链接。
- 修正 `.wechat-image` 样式，避免图片被错误处理为占位块。

## 2.4 权限（`/Users/liminrong/content-distributor/manifest.json`）
- 新增微信图片域权限：
  - `https://mmbiz.qpic.cn/*`
  - `https://*.qpic.cn/*`

---

## 3. 快速排查流程（交接同事直接照做）

1. 刷新扩展：`chrome://extensions/` → Reload。
2. 在扩展页导入链接后，看控制台日志（F12）：
   - `展示文章数据: { contentLength, textLength, imageCount, imagePreview }`
3. 按日志判断：
   - `textLength=0`：提取阶段失败，查 `background.js` 提取函数。
   - `textLength>0 且 contentLength≈0`：HTML 构建失败，走段落兜底分支。
   - `imageCount=0`：图片 URL 未提到，查懒加载属性与 HTML 补抓逻辑。
   - `imageCount>0 但不显示`：查 `src` 回填、样式、图片 onerror 回退。
4. 打开 Service Worker Console 查看后台日志：
   - 重点看：页面加载、脚本执行结果、图片转换失败原因。

---

## 4. 高频问题与处理模板

### Q1：提示成功，但编辑器空白
- 检查 `displayArticle` 日志里 `contentLength/textLength`。
- 若 `textLength` 有值，强制走 `toParagraphHtml` + `setEditorHtml`。

### Q2：图片都没显示
- 先看 `imageCount` 是否 > 0。
- 若 > 0：检查图片是否有 `src`，是否触发 onerror 替换链接。
- 若 = 0：检查 DOM 懒加载属性和 HTML 正则补抓是否命中。

### Q3：又出现 `is not defined`
- 先检查是否把 helper 写在 `extractWechatContent` 外。
- 原则：注入函数内部要自包含，不引用外部作用域函数。

---

## 5. 回归测试清单（每次改提取逻辑都要跑）

- 用至少 3 篇公开公众号文章测试：
  - 图文混排（多图）
  - 长文（多段）
  - 列表/引用较多
- 验证项：
  - 标题/作者/字数正常。
  - 正文有段落和空行。
  - 图片可见或至少有可点击原图链接。
  - “格式优化”按钮执行后不破坏内容。
  - 同步到平台前后内容不丢失。

---

## 6. 后续建议（防复发）

- 在扩展 UI 增加“诊断模式”开关，直接展示：
  - 最终 `contentLength/textLength/imageCount`
  - 前 3 张图片 URL 与加载状态
- 增加离线测试样本（保存几篇公众号 HTML 快照）做自动化回归。
- 将注入函数与后台函数分层：明确“页面上下文函数必须自包含”的开发规范。

---

## 7. 交接说明

- 关键文件：
  - `/Users/liminrong/content-distributor/js/background.js`
  - `/Users/liminrong/content-distributor/js/distributor.js`
  - `/Users/liminrong/content-distributor/css/distributor.css`
  - `/Users/liminrong/content-distributor/manifest.json`
- 关键日志入口：
  - 扩展页面 Console
  - Service Worker Console（`chrome://extensions/`）
- 若后续公众号 DOM 再次变更，优先调整：
  - `extractWechatContent` 的选择器与块级构建逻辑
  - 图片属性提取和 URL 归一化逻辑
