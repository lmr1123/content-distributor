/**
 * 图片下载工具模块
 * 用于下载微信图片到本地
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

/**
 * 下载单张图片
 */
function downloadImage(url, outputPath) {
  return new Promise((resolve, reject) => {
    // 处理 data URL
    if (url.startsWith('data:')) {
      try {
        const matches = url.match(/^data:image\/(\w+);base64,(.+)$/);
        if (matches) {
          const buffer = Buffer.from(matches[2], 'base64');
          fs.writeFileSync(outputPath, buffer);
          resolve({ success: true, path: outputPath });
          return;
        }
        reject(new Error('Invalid data URL format'));
        return;
      } catch (e) {
        reject(e);
        return;
      }
    }

    // 处理 HTTP/HTTPS URL
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(outputPath);

    const request = (urlStr, redirectCount = 0) => {
      if (redirectCount > 5) {
        reject(new Error('Too many redirects'));
        return;
      }

      protocol.get(urlStr, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Referer': 'https://mp.weixin.qq.com/',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
        }
      }, (response) => {
        // 处理重定向
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          file.close();
          fs.unlinkSync(outputPath);
          request(redirectUrl, redirectCount + 1);
          return;
        }

        if (response.statusCode !== 200) {
          file.close();
          fs.unlinkSync(outputPath);
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve({ success: true, path: outputPath, size: fs.statSync(outputPath).size });
        });
      }).on('error', (err) => {
        file.close();
        fs.unlink(outputPath, () => {});
        reject(err);
      });
    };

    request(url);
  });
}

/**
 * 批量下载图片
 */
async function downloadImages(imageUrls, outputDir, options = {}) {
  const { concurrency = 3, onProgress } = options;
  const results = [];

  // 确保输出目录存在
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 使用并发控制
  for (let i = 0; i < imageUrls.length; i += concurrency) {
    const batch = imageUrls.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map(async (url, batchIndex) => {
        const index = i + batchIndex;
        const ext = guessExtension(url);
        const filename = `image_${String(index + 1).padStart(3, '0')}.${ext}`;
        const outputPath = path.join(outputDir, filename);

        try {
          const result = await downloadImage(url, outputPath);
          if (onProgress) {
            onProgress({ index: index + 1, total: imageUrls.length, success: true, path: outputPath });
          }
          return result;
        } catch (error) {
          if (onProgress) {
            onProgress({ index: index + 1, total: imageUrls.length, success: false, error: error.message });
          }
          return { success: false, url, error: error.message };
        }
      })
    );

    results.push(...batchResults.map(r => r.value || r.reason));
  }

  return results;
}

/**
 * 根据 URL 猜测图片扩展名
 */
function guessExtension(url) {
  const lower = url.toLowerCase();
  if (lower.includes('.png')) return 'png';
  if (lower.includes('.gif')) return 'gif';
  if (lower.includes('.webp')) return 'webp';
  if (lower.includes('.svg')) return 'svg';
  return 'jpg';
}

/**
 * 获取图片 MIME 类型
 */
function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml'
  };
  return mimeTypes[ext] || 'image/jpeg';
}

/**
 * 清理临时目录
 */
function cleanupTempDir(dir) {
  try {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      return true;
    }
  } catch (e) {
    console.error('清理临时目录失败:', e.message);
  }
  return false;
}

/**
 * 获取默认临时目录
 */
function getDefaultTempDir() {
  return path.join(process.env.HOME, '.content-distributor', 'temp-images');
}

module.exports = {
  downloadImage,
  downloadImages,
  guessExtension,
  getMimeType,
  cleanupTempDir,
  getDefaultTempDir
};
