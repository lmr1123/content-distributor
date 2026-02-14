# 全平台内容分发助手 Chrome 扩展

一键将微信公众号文章同步分发到小红书、知乎、简书、今日头条、哔哩哔哩等多个平台。

## 功能特性

- ✅ **一键导入**：输入微信公众号链接，自动提取标题、封面和正文内容
- ✅ **富文本编辑**：右侧大尺寸富文本编辑器，支持格式保留和实时编辑
- ✅ **多平台分发**：支持小红书、知乎、简书、今日头条、哔哩哔哩等平台
- ✅ **自动填充**：打开目标平台发布页面时自动填充内容
- ✅ **本地存储**：自动保存编辑内容，防止意外丢失

## 📘 项目主文档（推荐）

- 完整需求+技术复刻说明（产品/技术都可读）：
  [FULL_REQUIREMENTS_TECH_SPEC.md](FULL_REQUIREMENTS_TECH_SPEC.md)
- 微信导入问题复盘与交接：
  [WECHAT_IMPORT_INCIDENT_RUNBOOK.md](WECHAT_IMPORT_INCIDENT_RUNBOOK.md)
- 小红书图片重复插入问题（未解决）：
  [playwright-sync/XIAOHONGSHU_IMAGE_DEDUP.md](playwright-sync/XIAOHONGSHU_IMAGE_DEDUP.md)

## 安装方法

### 方法一：开发者模式加载（推荐）

1. 下载或克隆本项目到本地
2. 打开 Chrome 浏览器，访问 `chrome://extensions/`
3. 打开右上角的「开发者模式」开关
4. 点击「加载已解压的扩展程序」
5. 选择 `content-distributor` 文件夹
6. 安装完成！

### 方法二：打包安装

1. 在 `chrome://extensions/` 页面点击「打包扩展程序」
2. 选择 `content-distributor` 文件夹
3. 生成 `.crx` 文件后拖拽到扩展页面安装

## 使用说明

### 1. 导入文章

1. 点击浏览器工具栏中的扩展图标
2. 在左侧输入框粘贴微信公众号文章链接
3. 点击「获取内容」按钮
4. 等待内容提取完成

### 2. 编辑内容

- 右侧富文本编辑器支持：
  - 标题格式（H1-H6）
  - 文字样式（粗体、斜体、下划线、删除线）
  - 列表（有序/无序）
  - 对齐方式
  - 链接和图片
  - 引用块和代码块

### 3. 选择平台

在底部勾选要发布的平台：
- **小红书**：字数限制 1000 字
- **知乎**：无字数限制
- **简书**：无字数限制
- **今日头条**：推荐 5000 字以内
- **哔哩哔哩**：专栏文章

### 4. 同步分发

1. 点击「开始同步分发」按钮
2. 系统会依次打开所选平台的发布页面
3. 内容会自动填充到编辑器中
4. 检查无误后即可发布

## 项目结构

```
content-distributor/
├── manifest.json              # 扩展配置文件
├── icons/                     # 扩展图标
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── pages/
│   └── distributor.html       # 主页面
├── css/
│   └── distributor.css        # 样式文件
├── js/
│   ├── background.js          # 后台脚本
│   ├── distributor.js         # 主逻辑
│   └── content-scripts/
│       ├── xiaohongshu.js     # 小红书自动填充
│       ├── zhihu.js           # 知乎自动填充
│       └── universal.js       # 通用平台填充
└── README.md
```

## 技术栈

- **前端框架**：原生 JavaScript
- **富文本编辑器**：Quill.js
- **UI 设计**：CSS3 + Flexbox
- **Chrome API**：
  - Manifest V3
  - Storage API
  - Tabs API
  - Scripting API

## 注意事项

### 微信公众号文章提取

- 仅支持公开的微信公众号文章
- 部分文章可能有防盗链保护
- 图片会保留原始链接，部分平台可能需要重新上传
- 若遇到“获取成功但正文/图片异常”，优先查看专项复盘手册：
  [WECHAT_IMPORT_INCIDENT_RUNBOOK.md](WECHAT_IMPORT_INCIDENT_RUNBOOK.md)

### 平台兼容性

- **小红书**：对格式要求严格，建议检查纯文本格式
- **知乎**：支持富文本，但部分样式可能需要调整
- **其他平台**：通常支持基本的富文本格式

### 隐私说明

- 所有内容处理均在本地完成
- 不上传任何用户数据到第三方服务器
- 内容仅存储在浏览器本地 storage 中

## 常见问题

### Q: 为什么无法提取微信文章？

A: 请确保：
1. 文章链接格式正确（包含 mp.weixin.qq.com）
2. 文章是公开可访问的
3. 检查浏览器控制台是否有错误信息
4. 按专项手册执行排查：
   [WECHAT_IMPORT_INCIDENT_RUNBOOK.md](WECHAT_IMPORT_INCIDENT_RUNBOOK.md)

### Q: 自动填充不生效怎么办？

A: 可能的原因：
1. 平台页面结构发生变化
2. 需要等待页面完全加载
3. 部分平台需要先登录

解决方法：
- 刷新目标平台页面重试
- 手动复制粘贴内容

### Q: 如何添加更多平台？

A: 可以在 `js/content-scripts/` 目录下添加新的平台脚本，
并在 `manifest.json` 的 `content_scripts` 中注册。

## 开发计划

- [ ] 支持更多内容平台（微博、百家号等）
- [ ] 添加图片本地化功能
- [ ] 支持批量导入多篇文章
- [ ] 添加内容模板功能
- [ ] 支持定时发布

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

---

**开发者**: Content Distributor Team
**版本**: 1.0.0
**最后更新**: 2025-02-13

---

## 🔧 最新更新 (2025-02-12)

### ✅ 已修复 CSP 错误

**问题**: Chrome 扩展不允许从 CDN 加载外部脚本

**解决方案**: 已将 Quill.js 改为本地文件
- `js/lib/quill.min.js` - 编辑器核心库
- `css/quill.snow.css` - 编辑器样式

**验证**: 运行 `./verify-csp-fix.sh` 检查修复状态

详见: [CSP_FIX.md](CSP_FIX.md)

---
