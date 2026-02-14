/**
 * 小红书图文发布页面分析 - 完整流程
 */

const { chromium } = require('playwright');

async function analyze() {
  console.log('连接到 Chrome...');

  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const defaultContext = browser.contexts()[0];
  const contextPages = defaultContext.pages();

  let page = null;
  for (const p of contextPages) {
    if (p.url().includes('xiaohongshu')) {
      page = p;
      break;
    }
  }

  if (!page) {
    console.log('未找到小红书页面');
    await browser.close();
    return;
  }

  console.log('找到页面:', page.url());

  // 刷新页面到发布页面
  console.log('\n刷新页面...');
  await page.goto('https://creator.xiaohongshu.com/publish/publish?target=article', {
    waitUntil: 'networkidle'
  });
  await page.waitForTimeout(5000);

  // 截图查看初始状态
  await page.screenshot({ path: '/tmp/xhs-initial.png', fullPage: false });
  console.log('初始截图: /tmp/xhs-initial.png');

  // 分析页面结构
  console.log('\n========================================');
  console.log('页面结构分析');
  console.log('========================================');

  // 获取所有标签
  const pageStructure = await page.evaluate(() => {
    const result = {
      tabs: [],
      buttons: [],
      uploadAreas: [],
      inputs: []
    };

    // 标签
    document.querySelectorAll('.creator-tab, [class*="tab"]').forEach((el, i) => {
      result.tabs.push({
        index: i,
        text: el.textContent?.trim().substring(0, 20),
        className: String(el.className || '').substring(0, 40)
      });
    });

    // 按钮
    document.querySelectorAll('button, [role="button"]').forEach((el, i) => {
      const text = el.textContent?.trim().substring(0, 20);
      if (text) {
        result.buttons.push({
          index: i,
          text: text,
          className: String(el.className || '').substring(0, 40)
        });
      }
    });

    // 上传区域
    document.querySelectorAll('[class*="upload" i], [class*="drag" i]').forEach((el, i) => {
      result.uploadAreas.push({
        index: i,
        tag: el.tagName,
        text: el.textContent?.trim().substring(0, 30),
        className: String(el.className || '').substring(0, 50)
      });
    });

    // input
    document.querySelectorAll('input').forEach((el, i) => {
      result.inputs.push({
        index: i,
        type: el.type,
        accept: el.accept,
        className: String(el.className || '').substring(0, 40)
      });
    });

    return result;
  });

  console.log('\n标签:');
  pageStructure.tabs.forEach(t => console.log(`  ${t.index}. "${t.text}" class="${t.className}"`));

  console.log('\n按钮:');
  pageStructure.buttons.forEach(b => console.log(`  ${b.index}. "${b.text}" class="${b.className}"`));

  console.log('\n上传区域:');
  pageStructure.uploadAreas.forEach(u => console.log(`  ${u.index}. <${u.tag}> "${u.text}" class="${u.className}"`));

  console.log('\nInput 元素:');
  pageStructure.inputs.forEach(inp => console.log(`  ${inp.index}. type="${inp.type}" accept="${inp.accept}" class="${inp.className}"`));

  await browser.close();
}

analyze().catch(console.error);
