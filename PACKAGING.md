# 打包和分发指南

## 📦 项目打包

### 方法一：压缩包分发

```bash
# 在 content-distributor 的父目录执行
cd /Users/liminrong
zip -r content-distributor-v1.0.0.zip content-distributor \
  -x "content-distributor/node_modules/*" \
  -x "content-distributor/package*.json" \
  -x "content-distributor/*.log"

# 查看压缩包大小
ls -lh content-distributor-v1.0.0.zip
```

### 方法二：创建 .crx 文件

1. 打开 `chrome://extensions/`
2. 点击"打包扩展程序"
3. 扩展程序根目录：选择 `content-distributor` 文件夹
4. 私有密钥：首次留空（会自动生成 .pem 文件）
5. 点击"打包扩展程序"
6. 会生成 `.crx` 和 `.pem` 文件

**注意**：保管好 .pem 文件，用于后续更新！

## 📤 分发方式

### 内部分发
- 直接发送 zip 压缩包
- 通过公司内部网盘分享
- 使用 Git 仓库管理

### 公开发布
由于 Chrome Web Store 需要注册开发者账号（$5 美元），内部分发更简单：

1. **企业内部使用**：
   - 开发者模式加载
   - 或通过企业策略部署

2. **团队共享**：
   - 共享压缩包
   - 提供安装文档

3. **Chrome Web Store**（可选）：
   - 注册开发者账号
   - 上传打包的扩展
   - 通过审核后公开发布

## 🔄 版本更新

### 更新流程

1. **修改代码**
   ```bash
   # 修改文件后
   vim js/distributor.js
   ```

2. **更新版本号**
   ```json
   // manifest.json
   {
     "version": "1.0.1"  // 从 1.0.0 升级
   }
   ```

3. **重新打包**
   ```bash
   # 创建新版本压缩包
   zip -r content-distributor-v1.0.1.zip content-distributor \
     -x "content-distributor/node_modules/*"
   ```

4. **使用相同的 .pem 文件重新打包**（如果有）

### 用户更新

**开发者模式安装的用户**：
1. 删除旧版本扩展
2. 加载新版本文件夹
3. 或直接替换文件后重新加载

**Chrome Web Store 发布**：
- 自动更新到最新版本

## 📋 发布检查清单

发布前确认：

- [ ] 版本号已更新（manifest.json）
- [ ] 所有测试通过（test-extension.html）
- [ ] README.md 已更新
- [ ] CHANGELOG 已更新（如果有）
- [ ] 截图和演示是最新的
- [ ] 无 console.error 或调试代码
- [ ] 压缩包不包含 node_modules
- [ ] 在多个平台测试过功能

## 🏷️ 版本命名规范

推荐使用语义化版本：`MAJOR.MINOR.PATCH`

- **MAJOR**: 重大功能变更或破坏性更新
- **MINOR**: 新增功能，向后兼容
- **PATCH**: Bug 修复，向后兼容

示例：
- `1.0.0` → `1.0.1`: 修复 Bug
- `1.0.1` → `1.1.0`: 新增平台支持
- `1.1.0` → `2.0.0`: 重构架构

## 📊 文件大小优化

当前项目大小（不含 node_modules）：
```bash
du -sh content-distributor
# 约 50-100KB
```

优化建议：
- ✅ 已优化：使用 CDN 加载 Quill.js
- ✅ 已优化：图标已压缩
- ✅ 已优化：代码已精简

## 🔐 安全考虑

分发前确认：
- [ ] 不包含敏感信息（API keys、密码等）
- [ ] 不包含个人信息
- [ ] host_permissions 最小化
- [ ] 代码已审查，无安全漏洞

## 📝 发布说明模板

```markdown
# 版本 1.0.0 (2025-02-12)

## 🎉 首次发布

### 功能
- 微信公众号文章提取
- 富文本编辑器
- 5 个平台自动分发
- 自动填充功能
- 本地存储

### 支持
- 小红书
- 知乎
- 简书
- 今日头条
- 哔哩哔哩

### 安装
参见 INSTALL.md
```

---

**最后更新**: 2025
**适用版本**: 1.0.0+
