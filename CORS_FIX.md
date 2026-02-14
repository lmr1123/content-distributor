# CORS 错误修复说明

## 问题描述

在获取微信公众号文章时遇到 CORS（跨域资源共享）错误：
```
A cross-origin resource sharing (CORS) request was blocked
```

## 原因分析

CORS 错误通常发生在：
1. 从一个域名的页面请求另一个域名的资源
2. 服务器没有设置正确的 CORS 响应头
3. 浏览器安全策略阻止跨域请求

微信公众号服务器设置了严格的 CORS 策略，不允许从其他域直接访问。

## 解决方案

### Chrome 扩展特权

Chrome 扩展可以使用特权 API 绕过 CORS 限制：

1. **host_permissions**：在 manifest.json 中声明访问权限
2. **chrome.tabs + scripting**：在目标页面注入脚本执行
3. **background script**：在后台页面执行请求

### 实现方式

本项目使用的方法：

```javascript
// 1. 创建隐藏标签页加载微信文章
const tab = await chrome.tabs.create({ url, active: false });

// 2. 等待页面加载完成
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') {
    // 3. 注入脚本提取内容
    chrome.scripting.executeScript({
      target: { tabId },
      func: extractWechatContent
    });
  }
});

// 4. 关闭标签页
chrome.tabs.remove(tab.id);
```

### 更新内容

已优化 `background.js` 的 `fetchWechatArticle` 函数：

**改进点**：
- ✅ 等待页面完全加载（status === 'complete'）
- ✅ 额外等待 1.5 秒确保内容渲染
- ✅ 添加 30 秒超时处理
- ✅ 错误处理更完善

## 验证修复

### 测试步骤

1. **重新加载扩展**
   ```
   chrome://extensions/ → 点击刷新按钮
   ```

2. **打开扩展页面**
   - 点击扩展图标

3. **测试文章获取**
   - 输入微信文章链接
   - 点击"获取内容"
   - 观察是否成功提取

### 预期结果

- ✅ 无 CORS 错误
- ✅ 成功提取标题
- ✅ 成功提取正文
- ✅ 隐藏标签页短暂出现后关闭

## 替代方案

如果上述方法仍有问题，可以考虑：

### 方案1：使用代理服务器

```javascript
// 需要自建代理服务器
const proxyUrl = 'https://your-proxy.com/fetch?url=';
const response = await fetch(proxyUrl + encodeURIComponent(wechatUrl));
```

**缺点**：需要额外的服务器，增加成本和维护

### 方案2：用户手动复制粘贴

提供"手动粘贴内容"选项作为备选方案：

```html
<button id="manualPaste">手动粘贴内容</button>
```

**优点**：简单可靠
**缺点**：用户体验较差

### 方案3：使用 RSS/API（如果有）

如果微信提供官方 API，可以直接调用。

**目前**：微信公众号没有公开 API

## 权限说明

需要在 manifest.json 中声明：

```json
{
  "permissions": [
    "tabs",
    "scripting",
    "activeTab"
  ],
  "host_permissions": [
    "https://mp.weixin.qq.com/*"
  ]
}
```

## 调试技巧

### 查看后台脚本日志

1. 打开 `chrome://extensions/`
2. 找到扩展，点击"Service Worker"链接
3. 查看 Console 输出

### 检查网络请求

1. 打开 DevTools (F12)
2. 切换到 Network 标签
3. 过滤查看请求详情

### 测试脚本注入

```javascript
// 在 background.js 中添加日志
console.log('Tab created:', tab.id);
console.log('Page loaded, extracting content...');
console.log('Extraction result:', results);
```

## 常见错误

### 错误1: "Cannot access contents of the page"

**原因**：没有 host_permissions
**解决**：在 manifest.json 添加微信域名权限

### 错误2: "Script execution failed"

**原因**：页面未完全加载或脚本错误
**解决**：增加等待时间，检查脚本语法

### 错误3: "Tab removed before extraction"

**原因**：用户手动关闭或超时
**解决**：添加错误处理和用户提示

---

**修复日期**: 2025-02-12
**状态**: ✅ 已优化
**测试**: 需要使用真实微信文章链接测试
