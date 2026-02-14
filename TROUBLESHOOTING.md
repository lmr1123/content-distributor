# 🔧 故障排查完全指南

> 微信公众号导入相关的完整复盘、根因与交接流程，请优先查看：  
> [WECHAT_IMPORT_INCIDENT_RUNBOOK.md](WECHAT_IMPORT_INCIDENT_RUNBOOK.md)

## 快速诊断

### 第一步：重新加载扩展

最常见的问题可以通过重新加载扩展解决：

1. 打开 `chrome://extensions/`
2. 找到"全平台内容分发助手"
3. 点击刷新按钮 🔄
4. 重新打开扩展页面

### 第二步：检查控制台错误

1. 打开扩展页面
2. 按 F12 打开开发者工具
3. 查看 Console 标签
4. 寻找红色错误信息

---

## 常见问题

### ❌ 问题1: CSP 错误

**错误信息**:
```
Loading the script violates Content Security Policy directive
```

**原因**: 尝试从 CDN 加载外部脚本

**解决方法**:
```bash
# 验证本地文件
./verify-csp-fix.sh

# 应该看到
✅ Quill.js 库文件存在 (211K)
✅ Quill 样式文件存在 (24K)
```

如果文件缺失，运行：
```bash
curl -o js/lib/quill.min.js https://cdn.quilljs.com/1.3.7/quill.min.js
curl -o css/quill.snow.css https://cdn.quilljs.com/1.3.7/quill.snow.css
```

详见: [CSP_FIX.md](CSP_FIX.md)

---

### ❌ 问题2: CORS 错误

**错误信息**:
```
CORS request was blocked
```

**原因**: 浏览器安全策略阻止跨域请求

**解决方法**:

1. **确认已重新加载扩展**
   - 扩展使用特权 API 绑过 CORS
   - 必须重新加载才能生效

2. **检查权限**
   ```json
   // manifest.json 应包含
   "host_permissions": [
     "https://mp.weixin.qq.com/*"
   ]
   ```

3. **查看后台脚本日志**
   - 打开 `chrome://extensions/`
   - 点击"Service Worker"链接
   - 查看 Console 输出

4. **测试文章链接**
   - 使用公开的微信文章
   - 确保链接格式正确

详见: [CORS_FIX.md](CORS_FIX.md)

---

### ❌ 问题3: 编辑器不显示

**症状**: 页面打开但编辑器区域空白

**排查步骤**:

1. **检查文件是否存在**
   ```bash
   ls -l js/lib/quill.min.js
   ls -l css/quill.snow.css
   ```

2. **检查浏览器控制台**
   - F12 → Console
   - 查找 JavaScript 错误

3. **检查网络请求**
   - F12 → Network
   - 过滤 JS 和 CSS 文件
   - 确认 200 状态码

**解决方法**:
- 如果文件缺失，参考 CSP 修复
- 如果有 JS 错误，检查 Quill 版本兼容性

---

### ❌ 问题4: 无法获取文章内容

**症状**: 点击"获取内容"后无响应或失败

**可能原因**:

1. **链接格式错误**
   - 确保是 `mp.weixin.qq.com` 域名
   - 检查链接是否完整

2. **文章需要登录**
   - 微信某些文章需要登录才能查看
   - 尝试其他公开文章

3. **网络问题**
   - 检查网络连接
   - 尝试在浏览器中直接打开文章

4. **扩展权限不足**
   - 检查 host_permissions
   - 重新加载扩展

**调试方法**:

打开后台脚本控制台：
```
chrome://extensions/ → 找到扩展 → Service Worker
```

查看详细日志，应该看到：
```
Tab created: 123
Page loaded, extracting content...
Extraction result: {...}
```

---

### ❌ 问题5: 自动填充不工作

**症状**: 打开平台发布页面但内容未自动填充

**可能原因**:

1. **页面结构变化**
   - 平台更新了页面结构
   - 需要更新 content script

2. **未登录平台**
   - 需要先登录目标平台
   - 检查账号状态

3. **页面未完全加载**
   - 等待几秒后刷新
   - 检查网络速度

4. **浏览器阻止脚本**
   - 检查内容脚本是否注入
   - 查看控制台错误

**验证方法**:

1. 打开平台发布页面
2. F12 → Console
3. 应该看到类似日志：
   ```
   小红书内容填充脚本已加载
   收到填充内容请求
   ```

---

### ❌ 问题6: 内容丢失

**症状**: 编辑的内容刷新后消失

**原因**: 本地存储失败

**排查**:

1. **检查存储**
   ```javascript
   // 在控制台执行
   chrome.storage.local.get(['savedContent'], (result) => {
     console.log(result);
   });
   ```

2. **检查权限**
   ```json
   // manifest.json 应包含
   "permissions": ["storage"]
   ```

3. **检查存储空间**
   - Chrome 扩展有 5MB 存储限制
   - 大量图片可能超限

---

## 调试技巧

### 1. 查看后台脚本日志

最直接的调试方法：

1. 打开 `chrome://extensions/`
2. 找到扩展，点击"Service Worker"
3. 查看所有后台日志

### 2. 添加自定义日志

在代码中添加调试信息：

```javascript
// background.js
console.log('Fetching article:', url);
console.log('Tab created:', tab.id);
console.log('Extraction result:', results);
```

```javascript
// distributor.js
console.log('Sending message to background');
console.log('Response:', response);
```

### 3. 使用断点调试

1. 打开开发者工具
2. Sources 标签
3. 找到对应文件
4. 点击行号添加断点
5. 触发功能，代码会暂停

### 4. 检查网络请求

1. F12 → Network 标签
2. 清空记录（禁止图标）
3. 执行操作
4. 查看请求详情

### 5. 测试工具

使用提供的测试工具：

```bash
# CSP 验证
./verify-csp-fix.sh

# 功能测试
打开 cors-test.html（需要在扩展上下文中）
```

---

## 重置扩展

如果所有方法都无效，尝试完全重置：

### 步骤1: 完全删除

1. 打开 `chrome://extensions/`
2. 点击"移除"
3. 确认删除

### 步骤2: 清理数据

1. 打开 `chrome://settings/content/all`
2. 搜索"全平台内容分发助手"
3. 删除所有数据

### 步骤3: 重新安装

1. 点击"加载已解压的扩展程序"
2. 选择 `content-distributor` 文件夹
3. 检查是否正常工作

---

## 获取帮助

### 收集诊断信息

在请求帮助前，收集以下信息：

```markdown
## 环境信息
- Chrome 版本: [在 chrome://settings/help 查看]
- 操作系统: [Windows/Mac/Linux]
- 扩展版本: 1.0.0

## 问题描述
[详细描述遇到的问题]

## 错误信息
[控制台的完整错误信息]

## 复现步骤
1. [第一步]
2. [第二步]
3. [问题出现]

## 已尝试的解决方法
- [ ] 重新加载扩展
- [ ] 检查控制台错误
- [ ] 运行测试工具

## 截图
[如有必要，附上截图]
```

### 相关文档

- [README.md](README.md) - 功能说明
- [INSTALL.md](INSTALL.md) - 安装指南
- [CSP_FIX.md](CSP_FIX.md) - CSP 错误修复
- [CORS_FIX.md](CORS_FIX.md) - CORS 错误修复
- [TESTING_GUIDE.md](TESTING_GUIDE.md) - 测试指南

---

**最后更新**: 2025-02-12
**适用版本**: 1.0.0+
