# 小红书图片重复插入问题

## 问题描述

使用 ClipboardEvent 粘贴图片到小红书 ProseMirror 编辑器时，同一张图片在编辑器中出现 **2 次**。

## DOM 特征

```html
<img data-dom-type="img" src="https://ros-preview.xhscdn.com/spectrum/AAA..." style="width: 410px; min-height: 287.38px;">
<img data-dom-type="img" src="https://ros-preview.xhscdn.com/spectrum/BBB..." style="width: 410px; min-height: 287.38px;">
```

- 两个 src URL 不同（小红书服务器生成）
- 两个 style 完全相同
- 都没有 `[data-dom-type="image"]` 包装块

## 根本原因

小红书编辑器对 **Paste 事件** 进行了特殊处理：

1. 用户触发 paste 事件
2. 第一次：响应 paste 事件处理粘贴
3. **第二次**：小红书内部自动触发图片上传逻辑（生成预览和最终版本）

**关键点**：二次上传是由小红书内部代码触发的，无法通过简单的锁机制阻止。

## 相关文件

```
playwright-sync/
├── xiaohongshu-sync.js    # 核心同步逻辑
└── XIAOHONGSHU_IMAGE_DEDUP.md  # 本文档
```

### 关键函数位置

| 函数 | 行号 | 描述 |
|------|------|------|
| `pasteImageToEditor` | 283-336 | ClipboardEvent 粘贴图片 |
| `uploadImageViaNativeInput` | 737-829 | 上传逻辑（多方案尝试） |
| `injectImageDedupInterceptor` | 430-524 | DOM 去重拦截器 |
| `interceptXhsUpload` | 341-424 | XHR/Fetch 请求拦截 |
| `cleanupXhsImageDomArtifacts` | 985-1121 | 清理重复图片 |
| `insertImageDirect` | 530-587 | 直接 DOM 插入 |

## 已尝试的解决方案

### 方案 1：粘贴锁机制
```javascript
window[lockKey] = now + 3000; // 设置 3 秒锁
```
**结果**：❌ 失败 - 无法阻止小红书内部的二次触发

### 方案 2：基于 URL 去重
```javascript
const sig = img.getAttribute('src');
if (seenSignatures.has(sig)) { /* 删除 */ }
```
**结果**：❌ 失败 - 两次上传生成不同 URL

### 方案 3：相邻相同样式去重
```javascript
if (currentStyle === prevStyle) { /* 删除后一个 */ }
```
**结果**：❌ 失败 - DOM 异步渲染，时机难以把握

### 方案 4：MutationObserver 监听
```javascript
const observer = new MutationObserver(() => {
  dedupImages(); // 监听变化时去重
});
observer.observe(editor, { childList: true, subtree: true });
```
**结果**：❌ 失败 - 小红书写入太快/太频繁

### 方案 5：DragEvent 替代 ClipboardEvent
```javascript
const dropEvent = new DragEvent('drop', { dataTransfer });
editor.dispatchEvent(dropEvent);
```
**结果**：❌ 失败 - 同样触发二次上传

### 方案 6：XHR/Fetch 拦截
```javascript
window.XMLHttpRequest = function() {
  // 拦截并阻止重复请求
};
```
**结果**：❌ 失败 - 小红书使用内部模块，拦截不完整

### 方案 7：ProseMirror 直接操作
```javascript
editorView.dispatch(tr.insert(0, imgNode));
```
**结果**：❌ 失败 - 难以找到正确的编辑器实例

### 方案 8：直接 DOM 插入（当前方案）
```javascript
editor.innerHTML += `<img src="data:image/...">`;
```
**结果**：⏳ 待验证 - 代码已实现，需要测试验证

## 后续解决方向

### 方向 A：找到小红书官方的上传入口

查找小红书编辑器工具栏的"图片"按钮，使用原生的 `input[type="file"]` 上传。

**相关选择器**：
```javascript
uploadSelectors: [
  'input[type="file"][accept*="image"]',
  '[class*="upload"] input[type="file"]',
  // ...
]
```

### 方向 B：验证直接 DOM 插入

当前代码已有 `insertImageDirect` 函数，直接插入 base64 图片：

```javascript
const imgUrl = `data:image/jpeg;base64,${base64Image}`;
editor.innerHTML += `<img src="${imgUrl}">`;
```

需要验证：
1. 图片是否能正确显示
2. 小红书是否会后续清理非官方格式的图片

### 方向 C：注入代码调用内部 API

在页面上下文中注入代码，直接调用小红书的内部方法。

### 方向 D：分析小红书内部模块

使用 Chrome DevTools 分析：
1. 打开小红书编辑器
2. 监听网络请求
3. 找到 `infraUploader` 模块的调用方式
4. 直接调用其暴露的 API

## 诊断方法

### 启用详细日志

在运行同步时观察控制台输出：

```bash
node playwright-sync/xiaohongshu-sync.js
```

关注以下日志前缀：
- `[去重]` - 去重拦截器日志
- `[拦截]` - XHR 拦截日志
- `[PM插入]` - ProseMirror 插入日志
- `[直接插入]` - 直接 DOM 插入日志

### Chrome DevTools 诊断

1. 打开小红书编辑器页面
2. 打开 DevTools (F12)
3. 粘贴图片，观察：
   - Network 面板触发的请求
   - Sources 面板的调用栈
   - Elements 面板的 DOM 变化

## 时间线

| 日期 | 操作 | 结果 |
|------|------|------|
| 2025-02-12 | 粘贴锁机制 | 失败 |
| 2025-02-12 | URL 去重 | 失败 |
| 2025-02-12 | 相同样式去重 | 失败 |
| 2025-02-12 | MutationObserver | 失败 |
| 2025-02-12 | DragEvent | 失败 |
| 2025-02-12 | XHR 拦截 | 失败 |
| 2025-02-12 | ProseMirror 直接操作 | 失败 |
| 2025-02-13 | 直接 DOM 插入 | 待验证 |

## 贡献者

- 2025-02-12: 初步调查和多种方案尝试
- 2025-02-13: 实现多层防护和直接插入方案

## 外部参考

- [小红书创作者中心](https://creator.xiaohongshu.com/)
- [ProseMirror 文档](https://prosemirror.net/)
- [Tiptap 编辑器](https://tiptap.dev/)
