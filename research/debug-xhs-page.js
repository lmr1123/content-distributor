/**
 * 调试小红书发布页面结构
 */

const { chromium } = require('playwright');
const http = require('http');

const CONFIG = {
  chrome: {
    debugPort: 9222
  }
};

async function checkDebugPort() {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: CONFIG.chrome.debugPort,
      path: '/json/version',
      method: 'GET',
      timeout: 2000
    }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

async function debugPage() {
  console.log('连接到 Chrome...');

  if (!await checkDebugPort()) {
    console.log('Chrome 调试端口未启动，请先启动 Chrome:');
    console.log('open -a "Google Chrome" --args --remote-debugging-port=9222');
    return;
  }

  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CONFIG.chrome.debugPort}`);
  const contexts = browser.contexts();
  const context = contexts[0];
  const pages = context.pages();

  // 找到小红书页面或创建新页面
  let page = pages.find(p => p.url().includes('xiaohongshu')) || pages[0];

  if (!page) {
    page = await context.newPage();
  }

  // 打开发布页面
  console.log('打开发布页面...');
  await page.goto('https://creator.xiaohongshu.com/publish/publish?from=tab_switch&target=article', {
    waitUntil: 'networkidle',
    timeout: 60000
  });

  await page.waitForTimeout(8000);

  // 检查是否需要登录
  const url = page.url();
  if (url.includes('login') || !url.includes('creator.xiaohongshu.com')) {
    console.log('\n⚠ 需要登录！请在 Chrome 中登录小红书，然后重新运行此脚本。');
    console.log('当前 URL:', url);
    await browser.close().catch(() => {});
    return;
  }

  console.log('\n========================================');
  console.log('页面分析');
  console.log('========================================');

  // 1. 检查所有 input 元素
  const allInputs = await page.$$('input');
  console.log(`\n[1] 所有 input 元素: ${allInputs.length} 个`);
  for (let i = 0; i < Math.min(allInputs.length, 10); i++) {
    const input = allInputs[i];
    const type = await input.getAttribute('type');
    const accept = await input.getAttribute('accept');
    const className = await input.getAttribute('class');
    const id = await input.getAttribute('id');
    console.log(`  ${i + 1}. type="${type}" accept="${accept}" class="${className?.substring(0, 50)}" id="${id}"`);
  }

  // 2. 检查文件上传相关元素
  const uploadElements = await page.$$('[class*="upload" i], [class*="image" i], [class*="cover" i], [class*="poster" i]');
  console.log(`\n[2] 上传相关元素: ${uploadElements.length} 个`);
  for (let i = 0; i < Math.min(uploadElements.length, 15); i++) {
    const el = uploadElements[i];
    const tagName = await el.evaluate(e => e.tagName);
    const className = await el.getAttribute('class');
    console.log(`  ${i + 1}. <${tagName}> class="${className?.substring(0, 80)}"`);
  }

  // 3. 检查按钮元素
  const buttons = await page.$$('button, [role="button"]');
  console.log(`\n[3] 按钮元素: ${buttons.length} 个`);
  for (let i = 0; i < Math.min(buttons.length, 10); i++) {
    const btn = buttons[i];
    const text = await btn.textContent();
    const className = await btn.getAttribute('class');
    console.log(`  ${i + 1}. text="${text?.trim().substring(0, 30)}" class="${className?.substring(0, 50)}"`);
  }

  // 4. 检查可点击的上传区域
  const clickables = await page.$$('[class*="click" i], [class*="add" i], [class*="plus" i]');
  console.log(`\n[4] 可点击区域: ${clickables.length} 个`);
  for (let i = 0; i < Math.min(clickables.length, 10); i++) {
    const el = clickables[i];
    const tagName = await el.evaluate(e => e.tagName);
    const className = await el.getAttribute('class');
    console.log(`  ${i + 1}. <${tagName}> class="${className?.substring(0, 80)}"`);
  }

  // 5. 检查页面 DOM 结构中的隐藏 input
  const hiddenInputs = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input');
    return Array.from(inputs).map(input => ({
      type: input.type,
      accept: input.accept,
      className: input.className,
      id: input.id,
      name: input.name,
      hidden: input.hidden || input.type === 'hidden' || input.style.display === 'none'
    }));
  });
  console.log(`\n[5] 详细 input 信息:`);
  hiddenInputs.forEach((input, i) => {
    console.log(`  ${i + 1}. type="${input.type}" accept="${input.accept}" hidden=${input.hidden} class="${input.className?.substring(0, 30)}"`);
  });

  // 6. 截图
  const screenshotPath = '/tmp/xhs-debug-screenshot.png';
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`\n[6] 页面截图已保存: ${screenshotPath}`);

  console.log('\n========================================');
  console.log('调试完成');

  await browser.close().catch(() => {});
}

debugPage().catch(console.error);
