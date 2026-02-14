# Playwright 自动化同步使用指南

## 概述

本方案通过 Playwright 实现真正的图片上传功能，解决 Chrome Content Script 无法上传文件的问题。

## 架构

```
┌─────────────────┐      HTTP API      ┌─────────────────┐
│  Chrome 扩展     │ ──────────────────▶ │  Playwright 服务  │
│  (distributor)  │                    │  (Node.js)       │
└─────────────────┘                    └─────────────────┘
                                              │
                                              ▼
                                       ┌─────────────────┐
                                       │  Chrome 浏览器   │
                                       │  (自动化操作)    │
                                       └─────────────────┘
```

## 使用步骤

### 1. 启动 Playwright 服务

```bash
cd /Users/liminrong/content-distributor
npm run playwright-server
```

服务启动后会显示：
```
========================================
  Playwright 同步服务已启动
========================================
  地址: http://127.0.0.1:3456
  健康检查: http://127.0.0.1:3456/health
  同步接口: POST http://127.0.0.1:3456/sync
```

### 2. 使用 Chrome 扩展

1. 刷新 Chrome 扩展页面 (`chrome://extensions/`)
2. 点击扩展图标打开分发页面
3. 导入微信公众号文章
4. 编辑内容后，勾选「小红书」平台
5. **勾选「使用 Playwright 自动上传图片」选项**
6. 点击「开始同步分发」

### 3. 自动化过程

Playwright 会自动：
1. 下载微信图片到本地临时目录
2. 打开 Chrome 浏览器（复用登录状态）
3. 导航到小红书发布页面
4. 填充标题和正文
5. 上传本地图片文件
6. 等待用户确认后发布

## 文件结构

```
content-distributor/
├── playwright-sync/
│   ├── server.js              # HTTP 服务入口
│   ├── xiaohongshu-sync.js    # 小红书自动化脚本
│   └── image-utils.js         # 图片下载工具
├── js/
│   ├── background.js          # 添加了 Playwright API 调用
│   └── distributor.js         # 添加了 Playwright 选项
└── package.json               # 添加了运行脚本
```

## API 接口

### 健康检查
```
GET http://127.0.0.1:3456/health
```

响应：
```json
{
  "status": "ok",
  "service": "playwright-sync",
  "version": "1.0.0"
}
```

### 同步接口
```
POST http://127.0.0.1:3456/sync
Content-Type: application/json

{
  "platform": "xiaohongshu",
  "content": {
    "title": "文章标题",
    "text": "纯文本内容",
    "body": "HTML 内容",
    "imageUrls": ["图片URL1", "图片URL2"]
  }
}
```

## 注意事项

1. **需要先登录**：首次使用需要在打开的浏览器中登录小红书账号
2. **Chrome 路径**：默认使用 macOS 的 Chrome 路径，其他系统需修改 `xiaohongshu-sync.js`
3. **图片下载**：微信图片可能有防盗链，部分图片可能下载失败
4. **服务需要保持运行**：同步期间不要关闭终端窗口

## 故障排除

### 服务未启动
错误提示：`Playwright 服务未启动`

解决方法：
```bash
npm run playwright-server
```

### Chrome 未找到
错误提示：`未找到 Chrome 浏览器`

解决方法：检查 `playwright-sync/xiaohongshu-sync.js` 中的 `CONFIG.chrome.executablePath`

### 图片下载失败
可能原因：
- 微信防盗链
- 网络问题

解决方法：手动下载图片后上传

## 与传统方式的区别

| 特性 | 传统 Content Script | Playwright 方案 |
|------|-------------------|----------------|
| 填充文字 | ✅ | ✅ |
| 上传图片 | ❌ 仅链接 | ✅ 真实上传 |
| 需要后台服务 | ❌ | ✅ |
| 复用登录状态 | ❌ 需重新登录 | ✅ |
| 适用平台 | 所有 | 小红书（目前） |
