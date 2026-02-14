const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

function createIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // 绘制渐变背景
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#6366f1');
  gradient.addColorStop(1, '#8b5cf6');

  // 圆角矩形
  const radius = size * 0.15;
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(size - radius, 0);
  ctx.quadraticCurveTo(size, 0, size, radius);
  ctx.lineTo(size, size - radius);
  ctx.quadraticCurveTo(size, size, size - radius, size);
  ctx.lineTo(radius, size);
  ctx.quadraticCurveTo(0, size, 0, size - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  // 绘制分发图标
  ctx.fillStyle = 'white';

  // 向上箭头
  ctx.beginPath();
  ctx.moveTo(size * 0.5, size * 0.22);
  ctx.lineTo(size * 0.68, size * 0.42);
  ctx.lineTo(size * 0.56, size * 0.42);
  ctx.lineTo(size * 0.56, size * 0.58);
  ctx.lineTo(size * 0.44, size * 0.58);
  ctx.lineTo(size * 0.44, size * 0.42);
  ctx.lineTo(size * 0.32, size * 0.42);
  ctx.closePath();
  ctx.fill();

  // 横条
  ctx.fillRect(size * 0.22, size * 0.62, size * 0.56, size * 0.09);

  // 下横条
  ctx.fillRect(size * 0.22, size * 0.75, size * 0.38, size * 0.09);

  // 小圆点
  ctx.beginPath();
  ctx.arc(size * 0.72, size * 0.79, size * 0.07, 0, Math.PI * 2);
  ctx.fill();

  return canvas.toBuffer('image/png');
}

// 生成图标
const sizes = [16, 48, 128];
const iconsDir = path.join(__dirname, 'icons');

// 确保icons目录存在
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

sizes.forEach(size => {
  const buffer = createIcon(size);
  const fileName = `icon${size}.png`;
  fs.writeFileSync(path.join(iconsDir, fileName), buffer);
  console.log(`已生成: ${fileName} (${buffer.length} bytes)`);
});

console.log('\n✓ 所有图标已生成！');
