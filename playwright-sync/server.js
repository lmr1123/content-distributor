/**
 * Playwright 同步 HTTP 服务
 *
 * 提供本地 HTTP API，供 Chrome 扩展调用
 * 实现 Playwright 自动化同步
 */

const http = require('http');
const path = require('path');
const { syncToXiaohongshu } = require('./xiaohongshu-sync');

const PORT = 3456;

// 创建 HTTP 服务器
const server = http.createServer(async (req, res) => {
  // 设置 CORS 头，允许 Chrome 扩展访问
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 处理预检请求
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 健康检查
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'playwright-sync',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // 同步接口
  if (req.url === '/sync' && req.method === 'POST') {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const { platform, content } = JSON.parse(body);

        console.log('\n========================================');
        console.log(`收到同步请求: ${platform}`);
        console.log(`时间: ${new Date().toLocaleString()}`);
        console.log('========================================');

        if (!platform || !content) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Missing platform or content' }));
          return;
        }

        // 根据平台选择同步函数
        let result;
        if (platform === 'xiaohongshu') {
          // 立即返回"开始同步"，然后异步执行
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            message: '浏览器已启动，请在打开的窗口中完成操作',
            async: true
          }));

          // 异步执行同步（不阻塞响应）
          syncToXiaohongshu(content).then(result => {
            console.log('\n同步完成:', result);
          }).catch(error => {
            console.error('\n同步失败:', error);
          });

        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: `Unsupported platform: ${platform}` }));
        }

      } catch (error) {
        console.error('处理同步请求失败:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
      }
    });

    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// 启动服务器
server.listen(PORT, () => {
  console.log('========================================');
  console.log('  Playwright 同步服务已启动');
  console.log('========================================');
  console.log(`  地址: http://127.0.0.1:${PORT}`);
  console.log(`  健康检查: http://127.0.0.1:${PORT}/health`);
  console.log(`  同步接口: POST http://127.0.0.1:${PORT}/sync`);
  console.log('');
  console.log('  按 Ctrl+C 停止服务');
  console.log('========================================');
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n正在关闭服务...');
  server.close(() => {
    console.log('服务已停止');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  server.close(() => {
    process.exit(0);
  });
});
