# CSP 修复说明

## 问题描述

Chrome 扩展的内容安全策略（CSP）不允许从外部 CDN 加载脚本。

### 错误信息
```
Loading the script 'https://cdn.quilljs.com/1.3.7/quill.min.js'
violates the following Content Security Policy directive: "script-src 'self'"
```

## 解决方案

已将 Quill.js 从 CDN 改为本地文件：

### 修改内容

1. **下载文件到本地**
   - `js/lib/quill.min.js` - Quill.js 核心库 (211KB)
   - `css/quill.snow.css` - Quill 样式文件 (24KB)

2. **更新 HTML 引用**
   ```html
   <!-- 修改前 -->
   <link href="https://cdn.quilljs.com/1.3.7/quill.snow.css" rel="stylesheet">
   <script src="https://cdn.quilljs.com/1.3.7/quill.min.js"></script>

   <!-- 修改后 -->
   <link rel="stylesheet" href="../css/quill.snow.css">
   <script src="../js/lib/quill.min.js"></script>
   ```

## 验证修复

1. 在 Chrome 扩展页面重新加载扩展
2. 点击扩展图标打开页面
3. 检查控制台无 CSP 错误
4. 验证富文本编辑器正常显示

## Chrome 扩展 CSP 说明

Chrome 扩展 Manifest V3 的默认 CSP：
```
script-src 'self';
object-src 'self';
```

这意味着：
- ✅ 允许：加载扩展内部的脚本
- ❌ 禁止：加载外部 CDN 脚本
- ❌ 禁止：内联脚本（除非特别配置）

## 最佳实践

对于 Chrome 扩展开发：
1. 始终将第三方库下载到本地
2. 避免使用外部 CDN
3. 如需内联脚本，在 manifest.json 中配置 CSP
4. 定期更新本地库文件

## 更新 Quill.js

如需更新到新版本：

```bash
# 下载最新版本
curl -o js/lib/quill.min.js https://cdn.quilljs.com/[VERSION]/quill.min.js
curl -o css/quill.snow.css https://cdn.quilljs.com/[VERSION]/quill.snow.css

# 或访问官网下载
# https://quilljs.com/download/
```

---

**修复日期**: 2025-02-12
**状态**: ✅ 已解决
