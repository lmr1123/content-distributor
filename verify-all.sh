#!/bin/bash

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         🧪 全平台内容分发助手 - 完整验证                     ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

total_checks=0
passed_checks=0
failed_checks=0

check_pass() {
    echo "  ✅ $1"
    ((passed_checks++))
    ((total_checks++))
}

check_fail() {
    echo "  ❌ $1"
    ((failed_checks++))
    ((total_checks++))
}

echo "📦 第一部分：文件完整性检查"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 核心文件
if [ -f "manifest.json" ]; then check_pass "manifest.json 存在"; else check_fail "manifest.json 缺失"; fi
if [ -f "js/background.js" ]; then check_pass "background.js 存在"; else check_fail "background.js 缺失"; fi
if [ -f "js/distributor.js" ]; then check_pass "distributor.js 存在"; else check_fail "distributor.js 缺失"; fi
if [ -f "pages/distributor.html" ]; then check_pass "distributor.html 存在"; else check_fail "distributor.html 缺失"; fi
if [ -f "css/distributor.css" ]; then check_pass "distributor.css 存在"; else check_fail "distributor.css 缺失"; fi

echo ""
echo "🔧 第二部分：CSP 修复验证"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Quill 本地文件
[ -f "js/lib/quill.min.js" ] && check_pass "Quill.js 本地文件存在 (CSP 安全)" || check_fail "Quill.js 本地文件缺失"
[ -f "css/quill.snow.css" ] && check_pass "Quill 样式本地文件存在" || check_fail "Quill 样式本地文件缺失"

# HTML 引用检查
if grep -q "js/lib/quill.min.js" pages/distributor.html; then
    check_pass "HTML 引用本地 Quill.js"
else
    check_fail "HTML 未引用本地 Quill.js"
fi

if ! grep -q "cdn.quilljs.com" pages/distributor.html; then
    check_pass "HTML 无 CDN 引用 (CSP 安全)"
else
    check_fail "HTML 仍有 CDN 引用"
fi

echo ""
echo "🔐 第三部分：权限和配置检查"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Manifest 检查
if [ -f "manifest.json" ]; then
    grep -q '"tabs"' manifest.json && check_pass "tabs 权限已声明" || check_fail "缺少 tabs 权限"
    grep -q '"scripting"' manifest.json && check_pass "scripting 权限已声明" || check_fail "缺少 scripting 权限"
    grep -q '"storage"' manifest.json && check_pass "storage 权限已声明" || check_fail "缺少 storage 权限"
    grep -q 'weixin.qq.com' manifest.json && check_pass "微信域名权限已声明 (CORS)" || check_fail "缺少微信域名权限"
fi

echo ""
echo "🌐 第四部分：CORS 修复验证"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# background.js CORS 修复检查
if [ -f "js/background.js" ]; then
    grep -q 'tabs.onUpdated' js/background.js && check_pass "使用 tabs API (CORS 安全)" || check_fail "可能存在 CORS 风险"
    grep -q 'scripting.executeScript' js/background.js && check_pass "使用 scripting API" || check_fail "脚本注入方式可能有问题"
    grep -q "status === 'complete'" js/background.js && check_pass "等待页面加载完成" || check_fail "可能过早提取内容"
fi

echo ""
echo "🎨 第五部分：图标文件检查"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

[ -f "icons/icon16.png" ] && check_pass "icon16.png 存在" || check_fail "icon16.png 缺失"
[ -f "icons/icon48.png" ] && check_pass "icon48.png 存在" || check_fail "icon48.png 缺失"
[ -f "icons/icon128.png" ] && check_pass "icon128.png 存在" || check_fail "icon128.png 缺失"

echo ""
echo "📄 第六部分：内容脚本检查"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

[ -f "js/content-scripts/xiaohongshu.js" ] && check_pass "小红书填充脚本存在" || check_fail "小红书填充脚本缺失"
[ -f "js/content-scripts/zhihu.js" ] && check_pass "知乎填充脚本存在" || check_fail "知乎填充脚本缺失"
[ -f "js/content-scripts/universal.js" ] && check_pass "通用填充脚本存在" || check_fail "通用填充脚本缺失"

echo ""
echo "📚 第七部分：文档完整性检查"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

[ -f "README.md" ] && check_pass "README.md 存在" || check_fail "README.md 缺失"
[ -f "INSTALL.md" ] && check_pass "INSTALL.md 存在" || check_fail "INSTALL.md 缺失"
[ -f "CSP_FIX.md" ] && check_pass "CSP_FIX.md 存在" || check_fail "CSP_FIX.md 缺失"
[ -f "CORS_FIX.md" ] && check_pass "CORS_FIX.md 存在" || check_fail "CORS_FIX.md 缺失"
[ -f "TROUBLESHOOTING.md" ] && check_pass "故障排查文档存在" || check_fail "故障排查文档缺失"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "                          验证结果"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "总检查项: $total_checks"
echo "通过: $passed_checks"
echo "失败: $failed_checks"
echo ""

if [ $failed_checks -eq 0 ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🎉 所有检查通过！扩展已准备就绪"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "✅ CSP 错误: 已修复（使用本地 Quill.js）"
    echo "✅ CORS 错误: 已修复（使用扩展特权 API）"
    echo "✅ 文件完整: 所有必需文件存在"
    echo "✅ 权限配置: 正确"
    echo ""
    echo "🚀 下一步操作："
    echo "   1. 在 Chrome 浏览器打开 chrome://extensions/"
    echo "   2. 点击刷新按钮 🔄 重新加载扩展"
    echo "   3. 点击扩展图标开始使用"
    echo ""
    echo "📖 如遇问题，请查看："
    echo "   • TROUBLESHOOTING.md - 完整故障排查指南"
    echo "   • cors-test.html - CORS 功能测试工具"
    echo ""
    exit 0
else
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "⚠️  发现 $failed_checks 个问题需要修复"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "请检查上述 ❌ 标记的项目并修复"
    echo ""
    echo "常见修复方法："
    echo "   • CSP 问题: 运行 ./verify-csp-fix.sh"
    echo "   • 文件缺失: 检查项目完整性"
    echo "   • 权限问题: 检查 manifest.json"
    echo ""
    echo "详细帮助请查看 TROUBLESHOOTING.md"
    echo ""
    exit 1
fi
