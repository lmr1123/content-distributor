/**
 * 调试小红书发布页面结构 - 使用特定页面
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
    console.log('Chrome 调试端口未启动');
    return;
  }

  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CONFIG.chrome.debugPort}`);

  // 获取所有上下文和页面
  const contexts = browser.contexts();
  console.log(`找到 ${contexts.length} 个浏览器上下文`);

  for (let i = 0; i < contexts.length; i++) {
    const ctx = contexts[i];
    const pages = ctx.pages();
    console.log(`上下文 ${i}: ${pages.length} 个页面`);

    for (let j = 0; j < pages.length; j++) {
      const p = pages[j];
      const url = p.url();
      console.log(`  页面 ${j}: ${url.substring(0, 80)}...`);

      // 找到小红书发布页面
      if (url.includes('creator.xiaohongshu.com/publish')) {
        console.log('\n✓ 找到小红书发布页面！');
        await analyzePage(p);
        await browser.close().catch(() => {});
        return;
      }
    }
  }

  console.log('未找到小红书发布页面');
  await browser.close().catch(() => {});
}

async function analyzePage(page) {
  console.log('\n========================================');
  console.log('页面分析');
  console.log('========================================');

  // 等待页面加载
  await page.waitForTimeout(3000);

  // 1. 检查所有 input 元素
  const allInputs = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input');
    return Array.from(inputs).map(input => ({
      type: input.type,
      accept: input.accept,
      className: input.className,
      id: input.id,
      name: input.name,
      hidden: input.hidden || input.type === 'hidden' || input.style.display === 'none' || input.offsetParent === null
    }));
  });
  console.log(`\n[1] 所有 input 元素: ${allInputs.length} 个`);
  allInputs.forEach((input, i) => {
    console.log(`  ${i + 1}. type="${input.type}" accept="${input.accept}" hidden=${input.hidden} class="${input.className?.substring(0, 40)}"`);
  });

  // 2. 检查文件上传相关元素
  const uploadElements = await page.evaluate(() => {
    const elements = document.querySelectorAll('[class*="upload" i], [class*="image" i], [class*="cover" i], [class*="poster" i], [class*="pic" i]');
    return Array.from(elements).slice(0, 20).map(el => ({
      tag: el.tagName,
      className: el.className,
      id: el.id
    }));
  });
  console.log(`\n[2] 上传相关元素: ${uploadElements.length} 个`);
  uploadElements.forEach((el, i) => {
    console.log(`  ${i + 1}. <${el.tag}> class="${el.className?.substring(0, 60)}" id="${el.id}"`);
  });

  // 3. 检查可拖拽区域
  const dragAreas = await page.evaluate(() => {
    const elements = document.querySelectorAll('[class*="drop" i], [class*="drag" i], [draggable="true"]');
    return Array.from(elements).map(el => ({
      tag: el.tagName,
      className: String(el.className || '')
    }));
  });
  console.log(`\n[3] 拖拽区域: ${dragAreas.length} 个`);
  dragAreas.forEach((el, i) => {
    console.log(`  ${i + 1}. <${el.tag}> class="${el.className?.substring(0, 60)}"`);
  });

  // 4. 检查 iframe
  const iframes = await page.$$('iframe');
  console.log(`\n[4] iframe 元素: ${iframes.length} 个`);

  // 5. 检查 Shadow DOM
  const shadowHosts = await page.evaluate(() => {
    const allElements = document.querySelectorAll('*');
    const hosts = [];
    allElements.forEach(el => {
      if (el.shadowRoot) {
        hosts.push({
          tag: el.tagName,
          className: el.className,
          id: el.id
        });
      }
    });
    return hosts;
  });
  console.log(`\n[5] Shadow DOM hosts: ${shadowHosts.length} 个`);
  shadowHosts.forEach((el, i) => {
    console.log(`  ${i + 1}. <${el.tag}> class="${el.className?.substring(0, 40)}" id="${el.id}"`);
  });

  // 6. 截图
  const screenshotPath = '/tmp/xhs-debug-screenshot2.png';
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`\n[6] 页面截图已保存: ${screenshotPath}`);

  // 7. 获取页面完整 HTML 结构（用于分析）
  const htmlStructure = await page.evaluate(() => {
    // 获取主要的表单/编辑区域
    const mainContent = document.querySelector('main, [role="main"], .main, #main, .content, .editor');
    if (mainContent) {
      return mainContent.innerHTML.substring(0, 5000);
    }
    return document.body.innerHTML.substring(0, 5000);
  });
  console.log(`\n[7] 页面 HTML 片段 (前500字符):`);
  console.log(htmlStructure.substring(0, 500));

  console.log('\n========================================');
  console.log('调试完成');
}

debugPage().catch(console.error);
