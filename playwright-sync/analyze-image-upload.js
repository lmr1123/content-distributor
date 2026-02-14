/**
 * 重新进入写长文编辑器并分析
 */

const { chromium } = require('playwright');

async function analyze() {
  console.log('连接到 Chrome...');
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find(p => p.url().includes('xiaohongshu')) || ctx.pages()[0];

  if (!page) {
    console.log('未找到页面');
    await browser.close();
    return;
  }

  console.log('当前页面:', page.url());

  // 强制刷新页面
  console.log('\n强制刷新页面...');
  await page.goto('https://creator.xiaohongshu.com/publish/publish?target=article', {
    waitUntil: 'networkidle',
    timeout: 60000
  });
  await page.waitForTimeout(5000);

  // 截图查看状态
  await page.screenshot({ path: '/tmp/xhs-refresh-state.png', fullPage: false });
  console.log('刷新后截图: /tmp/xhs-refresh-state.png');

  // 点击写长文
  console.log('\n点击写长文标签...');
  const tabs = await page.$$('.creator-tab');
  console.log(`找到 ${tabs.length} 个标签`);
  for (const tab of tabs) {
    const text = await tab.textContent();
    console.log(`  - ${text?.trim()}`);
    if (text?.includes('写长文')) {
      await tab.evaluate(el => el.click());
      await page.waitForTimeout(3000);
      console.log('✓ 已点击');
      break;
    }
  }

  // 点击新的创作
  console.log('\n点击新的创作...');
  const createBtn = await page.locator('button:has-text("新的创作")').first();
  if (await createBtn.count() > 0) {
    await createBtn.click({ force: true });
    await page.waitForTimeout(5000);
    console.log('✓ 已点击');
  }

  console.log('\n当前URL:', page.url());

  // 截图
  await page.screenshot({ path: '/tmp/xhs-editor-final.png', fullPage: true });
  console.log('编辑器截图: /tmp/xhs-editor-final.png');

  // 分析所有可点击元素
  console.log('\n========================================');
  console.log('分析所有按钮和可点击元素');
  console.log('========================================');

  const clickableElements = await page.evaluate(() => {
    const elements = [];

    // 按钮
    document.querySelectorAll('button').forEach(btn => {
      elements.push({
        type: 'button',
        text: btn.textContent?.trim().substring(0, 30),
        className: btn.className?.substring(0, 40)
      });
    });

    // 可点击的 div
    document.querySelectorAll('div[role="button"], div[onclick], div[style*="cursor: pointer"]').forEach(div => {
      elements.push({
        type: 'clickable-div',
        text: div.textContent?.trim().substring(0, 30),
        className: div.className?.substring(0, 40)
      });
    });

    // label
    document.querySelectorAll('label').forEach(label => {
      elements.push({
        type: 'label',
        text: label.textContent?.trim().substring(0, 30),
        className: label.className?.substring(0, 40)
      });
    });

    return elements.filter(el => el.text && el.text.length < 30);
  });

  console.log('\n可点击元素:');
  clickableElements.forEach((el, i) => {
    console.log(`  ${i + 1}. [${el.type}] "${el.text}" class="${el.className}"`);
  });

  // 查找图片相关
  const imageRelated = clickableElements.filter(el =>
    el.text?.includes('图') || el.text?.includes('封面') || el.text?.includes('上传')
  );
  console.log('\n图片相关:');
  imageRelated.forEach((el, i) => {
    console.log(`  ${i + 1}. [${el.type}] "${el.text}"`);
  });

  // 查找 file input
  const fileInputs = await page.$$('input[type="file"]');
  console.log(`\nfile input 数量: ${fileInputs.length}`);

  await browser.close();
}

analyze().catch(console.error);
