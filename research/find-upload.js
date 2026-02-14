/**
 * 深度分析小红书发布页面 - 找到正确的图文发布入口
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
  await page.waitForTimeout(2000);

  // 先关闭可能存在的弹窗
  try {
    const closeBtn = await page.$('[class*="close"], .close-btn, [aria-label*="关闭"]');
    if (closeBtn) {
      console.log('关闭弹窗...');
      await closeBtn.click();
      await page.waitForTimeout(1000);
    }
  } catch (e) {}

  // 分析页面上所有的可点击区域
  console.log('\n========================================');
  console.log('分析页面可点击区域');
  console.log('========================================');

  // 获取所有包含"上传图文"的区域
  const uploadAreas = await page.evaluate(() => {
    const results = [];

    // 查找所有 creator-tab
    const tabs = document.querySelectorAll('.creator-tab');
    tabs.forEach((tab, i) => {
      results.push({
        type: 'tab',
        index: i,
        text: tab.textContent?.trim(),
        className: tab.className,
        rect: tab.getBoundingClientRect ? {
          x: tab.getBoundingClientRect().x,
          y: tab.getBoundingClientRect().y,
          width: tab.getBoundingClientRect().width,
          height: tab.getBoundingClientRect().height
        } : null
      });
    });

    // 查找上传区域
    const uploadContents = document.querySelectorAll('.upload-content, [class*="upload-content"]');
    uploadContents.forEach((el, i) => {
      results.push({
        type: 'upload-content',
        index: i,
        text: el.textContent?.trim().substring(0, 50),
        className: el.className,
        rect: el.getBoundingClientRect ? {
          x: el.getBoundingClientRect().x,
          y: el.getBoundingClientRect().y,
          width: el.getBoundingClientRect().width,
          height: el.getBoundingClientRect().height
        } : null
      });
    });

    return results;
  });

  console.log('\n找到的可点击区域:');
  uploadAreas.forEach((area, i) => {
    console.log(`  ${i + 1}. [${area.type}] "${area.text?.substring(0, 30)}" at (${area.rect?.x?.toFixed(0)}, ${area.rect?.y?.toFixed(0)}) class="${area.className?.substring(0, 40)}"`);
  });

  // 找到"上传图文"标签并点击
  console.log('\n查找并点击"上传图文"...');
  const uploadImageTabs = await page.$$('.creator-tab');
  console.log(`找到 ${uploadImageTabs.length} 个标签`);

  for (let i = 0; i < uploadImageTabs.length; i++) {
    const tab = uploadImageTabs[i];
    const text = await tab.textContent();
    console.log(`  标签 ${i}: "${text?.trim()}"`);

    if (text?.includes('上传图文')) {
      console.log(`  -> 找到"上传图文"，准备点击...`);

      // 滚动到可见位置
      await tab.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);

      // 使用 JavaScript 点击
      await tab.evaluate(el => el.click());
      await page.waitForTimeout(3000);

      console.log('  -> 点击完成');
      break;
    }
  }

  // 截图
  await page.screenshot({ path: '/tmp/xhs-after-tab-click.png', fullPage: true });
  console.log('\n截图: /tmp/xhs-after-tab-click.png');

  // 分析点击后的页面
  console.log('\n========================================');
  console.log('点击后页面分析');
  console.log('========================================');

  const inputs = await page.evaluate(() => {
    const allInputs = document.querySelectorAll('input');
    return Array.from(allInputs).map(input => ({
      type: input.type,
      accept: input.accept,
      className: input.className?.substring(0, 50),
      hidden: input.offsetParent === null
    }));
  });
  console.log(`\ninput 元素: ${inputs.length} 个`);
  inputs.forEach((inp, i) => {
    console.log(`  ${i + 1}. type="${inp.type}" accept="${inp.accept}" hidden=${inp.hidden} class="${inp.className}"`);
  });

  const uploadEls = await page.evaluate(() => {
    const els = document.querySelectorAll('[class*="upload" i], [class*="drag" i], [class*="drop" i]');
    return Array.from(els).slice(0, 10).map(el => ({
      tag: el.tagName,
      className: el.className?.substring(0, 60),
      text: el.textContent?.trim().substring(0, 30)
    }));
  });
  console.log(`\n上传相关元素: ${uploadEls.length} 个`);
  uploadEls.forEach((el, i) => {
    console.log(`  ${i + 1}. <${el.tag}> class="${el.className}" text="${el.text}"`);
  });

  await browser.close();
}

analyze().catch(console.error);
