#!/bin/bash

echo "================================"
echo "全平台内容分发助手 - 快速启动"
echo "================================"
echo ""

# 检查是否在正确的目录
if [ ! -f "manifest.json" ]; then
  echo "❌ 错误：请在 content-distributor 目录下运行此脚本"
  exit 1
fi

echo "✅ 找到项目文件"
echo ""

# 检查必需文件
echo "🔍 检查必需文件..."
required_files=(
  "manifest.json"
  "js/background.js"
  "js/distributor.js"
  "css/distributor.css"
  "pages/distributor.html"
  "icons/icon16.png"
  "icons/icon48.png"
  "icons/icon128.png"
)

all_files_exist=true
for file in "${required_files[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✅ $file"
  else
    echo "  ❌ $file - 缺失"
    all_files_exist=false
  fi
done

if [ "$all_files_exist" = false ]; then
  echo ""
  echo "❌ 缺少必需文件，请检查项目完整性"
  exit 1
fi

echo ""
echo "✅ 所有必需文件检查通过"
echo ""

# 显示安装说明
echo "📋 安装步骤："
echo ""
echo "1. 打开 Chrome 浏览器"
echo "2. 在地址栏输入：chrome://extensions/"
echo "3. 在右上角启用【开发者模式】开关"
echo "4. 点击左上角【加载已解压的扩展程序】按钮"
echo "5. 选择此文件夹："
echo "   $(pwd)"
echo ""
echo "6. 安装成功后，浏览器工具栏会显示扩展图标"
echo ""
echo "================================"
echo ""

# 提供额外选项
echo "📚 其他操作："
echo ""
echo "• 查看完整文档："
echo "  open README.md"
echo ""
echo "• 查看安装指南："
echo "  open INSTALL.md"
echo ""
echo "• 运行测试页面："
echo "  open test-extension.html"
echo ""
echo "• 查看项目结构："
echo "  ls -R . | grep -v node_modules"
echo ""
echo "================================"
echo "🎉 准备就绪！现在可以安装到 Chrome 浏览器了"
echo "================================"
