/**
 * 深度分析小红书发布页面 - 使用 API 获取页面
 */

const { chromium } = require('playwright');
const http = require('http');

async function analyze() {
  console.log('连接到 Chrome...');

  // 先获取页面列表
  const pages = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json/list', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });

  console.log('找到的页面:');
  const xhsPage = pages.find(p => p.url && p.url.includes('xiaohongshu.com/publish'));
  if (!xhsPage) {
    console.log('未找到小红书发布页面');
    return;
  }
  console.log('  -', xhsPage.url);
  console.log('  -', xhsPage.title);

  // 连接到浏览器
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');

  // 获取默认上下文
  const contexts = browser.contexts();
  console.log(`\n浏览器有 ${contexts.length} 个上下文`);

  // 尝试获取默认浏览器上下文的页面
  const defaultContext = browser.contexts()[0];
  if (defaultContext) {
    const contextPages = defaultContext.pages();
    console.log(`默认上下文有 ${contextPages.length} 个页面`);

    // 找到小红书页面
    let page = null;
    for (const p of contextPages) {
      try {
        const url = p.url();
        console.log('  检查:', url.substring(0, 60));
        if (url.includes('xiaohongshu')) {
          page = p;
          break;
        }
      } catch (e) {
        // 忽略
      }
    }

    if (page) {
      console.log('\n找到页面:', page.url());
      await doAnalyze(page);
    } else {
      console.log('\n无法找到小红书页面');
    }
  }

  await browser.close();
}

async function doAnalyze(page) {
  await page.waitForTimeout(2000);

  // 获取所有包含"图文"或"笔记"的元素
  const textElements = await page.evaluate(() => {
    const allElements = document.querySelectorAll('*');
    const results = [];

    allElements.forEach(el => {
      const text = el.textContent?.trim();
      if (text && (text.includes('图文') || text.includes('笔记') || text.includes('文章') || text.includes('视频'))) {
        if (text.length < 20) {
          results.push({
            tag: el.tagName,
            text: text,
            className: String(el.className || '').substring(0, 40)
          });
        }
      }
    });
    return results;
  });

  console.log('\n包含"图文/笔记/文章/视频"的元素:');
  textElements.forEach((el, i) => {
    console.log(`  ${i + 1}. <${el.tag}> "${el.text}" class="${el.className}"`);
  });

  // 查找发布图文的入口
  console.log('\n查找"发布图文"入口...');
  try {
    // 尝试多种选择器
    const selectors = [
      'text=发布图文',
      'text=图文',
      '[class*="article"]',
      '[class*="post"]:not([class*="video"])'
    ];

    for (const selector of selectors) {
      try {
        const el = page.locator(selector).first();
        if (await el.count() > 0) {
          const text = await el.textContent();
          console.log(`找到: "${text}" (${selector})`);

          // 如果是图文相关，点击它
          if (text?.includes('图文') || text?.includes('笔记')) {
            console.log('点击进入图文发布...');
            await el.click();
            await page.waitForTimeout(3000);

            // 分析新页面
            const inputs = await page.$$('input[type="file"]');
            console.log(`页面现在有 ${inputs.length} 个 file input`);

            const uploadEls = await page.$$('[class*="upload" i]');
            console.log(`页面现在有 ${uploadEls.length} 个 upload 相关元素`);

            await page.screenshot({ path: '/tmp/xhs-post-page.png' });
            console.log('截图: /tmp/xhs-post-page.png');

            break;
          }
        }
      } catch (e) {
        // 继续
      }
    }
  } catch (e) {
    console.log('错误:', e.message);
  }
}

analyze().catch(console.error);
