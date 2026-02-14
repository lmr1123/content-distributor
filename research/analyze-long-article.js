/**
 * 分析小红书"写长文"模式 - 完整流程
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

  // 找到"写长文"标签并点击
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
  console.log('\n[2] 点击"新的创作"按钮...');
  try {
    const createBtn = await page.locator('button:has-text("新的创作")').first();
    if (await createBtn.count() > 0) {
      await createBtn.click({ force: true });
      await page.waitForTimeout(3000);
      console.log('✓ 已点击新的创作');
    }
  } catch (e) {
    console.log('点击失败:', e.message);
  }

  // 截图
  await page.screenshot({ path: '/tmp/xhs-long-article-editor.png', fullPage: false });
  console.log('\n截图: /tmp/xhs-long-article-editor.png');

  // 分析页面元素
  console.log('\n========================================');
  console.log('页面分析');
  console.log('========================================');

  // 查找所有 input 和 contenteditable
  const allInputs = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input, textarea, [contenteditable="true"]');
    return Array.from(inputs).map(el => ({
      tag: el.tagName,
      type: el.type || 'contenteditable',
      placeholder: el.getAttribute('placeholder') || '',
      className: String(el.className || '').substring(0, 50),
      role: el.getAttribute('role') || ''
    }));
  });
  console.log('\n所有输入元素:');
  allInputs.forEach((inp, i) => {
    console.log(`  ${i + 1}. <${inp.tag}> type="${inp.type}" placeholder="${inp.placeholder}" class="${inp.className}"`);
  });

  // 查找封面上传
  const fileInputs = await page.$$('input[type="file"]');
  console.log(`\nfile input 数量: ${fileInputs.length}`);

  if (fileInputs.length > 0) {
    for (let i = 0; i < fileInputs.length; i++) {
      const accept = await fileInputs[i].getAttribute('accept');
      console.log(`  ${i + 1}. accept="${accept}"`);
    }
  }

  await browser.close();
}

analyze().catch(console.error);
