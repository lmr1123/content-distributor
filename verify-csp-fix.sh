#!/bin/bash

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║          🔧 CSP 修复验证 - 全平台内容分发助手                 ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# 检查必需的本地文件
echo "📦 检查本地库文件..."
echo ""

files_ok=true

if [ -f "js/lib/quill.min.js" ]; then
    size=$(ls -lh js/lib/quill.min.js | awk '{print $5}')
    echo "  ✅ Quill.js 库文件存在 ($size)"
else
    echo "  ❌ Quill.js 库文件缺失"
    files_ok=false
fi

if [ -f "css/quill.snow.css" ]; then
    size=$(ls -lh css/quill.snow.css | awk '{print $5}')
    echo "  ✅ Quill 样式文件存在 ($size)"
else
    echo "  ❌ Quill 样式文件缺失"
    files_ok=false
fi

echo ""

# 检查 HTML 引用
echo "🔍 检查 HTML 引用..."
echo ""

if grep -q "js/lib/quill.min.js" pages/distributor.html; then
    echo "  ✅ HTML 正确引用本地 Quill.js"
else
    echo "  ❌ HTML 未正确引用 Quill.js"
    files_ok=false
fi

if grep -q "css/quill.snow.css" pages/distributor.html; then
    echo "  ✅ HTML 正确引用本地样式"
else
    echo "  ❌ HTML 未正确引用样式"
    files_ok=false
fi

# 检查是否还有 CDN 引用
if grep -q "cdn.quilljs.com" pages/distributor.html; then
    echo "  ⚠️  HTML 中仍有 CDN 引用，建议移除"
    files_ok=false
fi

echo ""

if [ "$files_ok" = true ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ CSP 修复验证通过！"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📱 下一步操作："
    echo "  1. 在 chrome://extensions/ 重新加载扩展"
    echo "  2. 点击扩展图标打开页面"
    echo "  3. 检查富文本编辑器是否正常显示"
    echo "  4. 验证控制台无 CSP 错误"
    echo ""
    echo "✨ 修复完成！现在可以正常使用了。"
else
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "❌ 验证失败，请检查上述错误"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "修复方法："
    echo "  运行以下命令下载文件："
    echo "  curl -o js/lib/quill.min.js https://cdn.quilljs.com/1.3.7/quill.min.js"
    echo "  curl -o css/quill.snow.css https://cdn.quilljs.com/1.3.7/quill.snow.css"
fi

echo ""
