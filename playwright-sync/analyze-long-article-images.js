/**
 * 分析小红书"写长文"模式的图片上传
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

  // 刷新到发布页面
  console.log('\n导航到发布页面...');
  await page.goto('https://creator.xiaohongshu.com/publish/publish?target=article', {
    waitUntil: 'networkidle'
  });
  await page.waitForTimeout(3000);

  // 点击"写长文"标签
  console.log('\n[1] 点击"写长文"标签...');
  const tabs = await page.$$('.creator-tab');
  for (let i = 0; i < tabs.length; i++) {
    const text = await tabs[i].textContent();
    if (text?.includes('写长文')) {
      await tabs[i].evaluate(el => el.click());
      await page.waitForTimeout(2000);
      console.log('✓ 已切换到写长文模式');
      break;
    }
  }

  // 点击"新的创作"按钮
  console.log('\n[2] 点击"新的创作"...');
  const createBtn = await page.locator('button:has-text("新的创作")').first();
  if (await createBtn.count() > 0) {
    await createBtn.click({ force: true });
    await page.waitForTimeout(3000);
    console.log('✓ 已进入编辑页面');
  }

  // 截图
  await page.screenshot({ path: '/tmp/xhs-long-article-editor2.png', fullPage: false });
  console.log('\n截图: /tmp/xhs-long-article-editor2.png');

  // 分析图片上传相关元素
  console.log('\n========================================');
  console.log('分析图片上传功能');
  console.log('========================================');

  // 查找工具栏中的图片按钮
  const toolbarButtons = await page.evaluate(() => {
    const buttons = document.querySelectorAll('[class*="toolbar"] button, [class*="menu"] button, button[title], button[aria-label]');
    return Array.from(buttons).map(btn => ({
      title: btn.getAttribute('title') || btn.getAttribute('aria-label') || '',
      text: btn.textContent?.trim().substring(0, 20),
      className: btn.className?.substring(0, 40)
    })).filter(btn => btn.title || btn.text);
  });
  console.log('\n工具栏按钮:');
  toolbarButtons.forEach((btn, i) => {
    console.log(`  ${i + 1}. title="${btn.title}" text="${btn.text}" class="${btn.className}"`);
  });

  // 查找 file input
  const fileInputs = await page.$$('input[type="file"]');
  console.log(`\nfile input 数量: ${fileInputs.length}`);
  for (let i = 0; i < fileInputs.length; i++) {
    const accept = await fileInputs[i].getAttribute('accept');
    const className = await fileInputs[i].getAttribute('class');
    console.log(`  ${i + 1}. accept="${accept}" class="${className}"`);
  }

  // 查找包含"图"或"图片"的元素
  const imageElements = await page.evaluate(() => {
    const allElements = document.querySelectorAll('*');
    const results = [];
    allElements.forEach(el => {
      const text = el.textContent?.trim();
      const title = el.getAttribute('title') || el.getAttribute('aria-label') || '';
      if ((text?.includes('图') || title?.includes('图')) && text?.length < 20) {
        results.push({
          tag: el.tagName,
          text: text?.substring(0, 20),
          title: title,
          className: el.className?.substring(0, 40)
        });
      }
    });
    return results.slice(0, 15);
  });
  console.log('\n包含"图"的元素:');
  imageElements.forEach((el, i) => {
    console.log(`  ${i + 1}. <${el.tag}> text="${el.text}" title="${el.title}" class="${el.className}"`);
  });

  await browser.close();
}

analyze().catch(console.error);
