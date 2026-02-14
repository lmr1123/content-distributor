// 生成图标脚本
// 使用方法：在浏览器中打开此文件或使用Node.js运行

const fs = require('fs');
const path = require('path');

// SVG图标模板
const createSVGIcon = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1"/>
      <stop offset="100%" style="stop-color:#8b5cf6"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.15}" fill="url(#gradient)"/>
  <g fill="white">
    <!-- 分发图标：多层箭头 -->
    <path d="M${size * 0.5} ${size * 0.25}
             L${size * 0.65} ${size * 0.4}
             L${size * 0.55} ${size * 0.4}
             L${size * 0.55} ${size * 0.55}
             L${size * 0.45} ${size * 0.55}
             L${size * 0.45} ${size * 0.4}
             L${size * 0.35} ${size * 0.4}
             Z" opacity="0.9"/>
    <rect x="${size * 0.25}" y="${size * 0.6}" width="${size * 0.5}" height="${size * 0.08}" rx="${size * 0.02}"/>
    <rect x="${size * 0.25}" y="${size * 0.72}" width="${size * 0.35}" height="${size * 0.08}" rx="${size * 0.02}"/>
    <circle cx="${size * 0.7}" cy="${size * 0.76}" r="${size * 0.08}" fill="white"/>
  </g>
</svg>
`;

// 生成不同尺寸的SVG图标
const sizes = [16, 48, 128];
const iconsDir = path.join(__dirname, 'icons');

// 确保icons目录存在
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

sizes.forEach(size => {
  const svgContent = createSVGIcon(size);
  const fileName = `icon${size}.svg`;
  fs.writeFileSync(path.join(iconsDir, fileName), svgContent.trim());
  console.log(`已生成: ${fileName}`);
});

console.log('\n图标生成完成！');
console.log('注意：Chrome扩展需要PNG格式的图标。');
console.log('请使用在线工具（如https://svgtopng.com/）或图像编辑软件将SVG转换为PNG。');
