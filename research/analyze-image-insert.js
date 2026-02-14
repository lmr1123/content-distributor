/**
 * 分析小红书写长文编辑器 - 先输入文字再测试图片按钮
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

  page.on('dialog', async dialog => {
    try { await dialog.dismiss(); } catch (e) {}
  });

  console.log('当前页面:', page.url());

  // 导航到写长文编辑器
  await page.goto('https://creator.xiaohongshu.com/publish/publish?target=article', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const tabs = await page.$$('.creator-tab');
  for (const tab of tabs) {
    const text = await tab.textContent();
    if (text?.includes('写长文')) {
      await tab.evaluate(el => el.click());
      await page.waitForTimeout(2000);
      break;
    }
  }

  const createBtn = await page.locator('button:has-text("新的创作")').first();
  if (await createBtn.count() > 0) {
    await createBtn.click({ force: true });
    await page.waitForTimeout(4000);
  }

  // 先在标题输入框输入内容
  console.log('\n输入标题...');
  const titleInput = await page.$('textarea[placeholder*="标题"], textarea.d-text');
  if (titleInput) {
    await titleInput.fill('测试标题');
    console.log('✓ 标题已输入');
  }

  // 点击编辑器并输入文字
  console.log('\n输入正文...');
  const editor = await page.$('.ProseMirror');
  if (editor) {
    await editor.click();
    await page.waitForTimeout(500);
    await page.keyboard.type('这是测试正文内容。');
    console.log('✓ 正文已输入');
  }

  await page.waitForTimeout(1000);

  // 截图当前状态
  await page.screenshot({ path: '/tmp/xhs-editor-with-content.png', fullPage: false });
  console.log('截图: /tmp/xhs-editor-with-content.png');

  console.log('\n========================================');
  console.log('查找图片相关的按钮');
  console.log('========================================');

  // 根据截图，图片图标应该是菜单项之一
  // 让我尝试获取所有按钮的 title 或 aria-label
  const buttons = await page.$$('.header .mid button');
  console.log(`按钮数量: ${buttons.length}`);

  for (let i = 0; i < buttons.length; i++) {
    const btn = buttons[i];
    const title = await btn.getAttribute('title');
    const ariaLabel = await btn.getAttribute('aria-label');
    const className = await btn.getAttribute('class');

    console.log(`按钮 ${i + 1}: title="${title}" aria-label="${ariaLabel}" class="${className?.substring(0, 30)}"`);
  }

  // 尝试找图片按钮 - 通常有 title 或 aria-label
  const imageBtn = await page.$('button[title*="图"], button[aria-label*="图"]');
  if (imageBtn) {
    console.log('\n找到图片按钮！');
    await imageBtn.click();
    await page.waitForTimeout(2000);

    const fileInputs = await page.$$('input[type="file"]');
    console.log(`点击后 file input: ${fileInputs.length}`);
  }

  // 尝试使用键盘快捷方式
  console.log('\n尝试键盘快捷方式...');
  await editor?.click();
  await page.waitForTimeout(300);

  // 一些编辑器支持 Ctrl+V 粘贴图片
  // 或者 Ctrl+Shift+I 插入图片
  await page.keyboard.down('Meta');
  await page.keyboard.press('i');
  await page.keyboard.up('Meta');
  await page.waitForTimeout(1500);

  const fileInputs2 = await page.$$('input[type="file"]');
  console.log(`快捷键后 file input: ${fileInputs2.length}`);

  await browser.close();
}

analyze().catch(console.error);
