/**
 * 分析小红书写长文编辑器 header 区域的按钮
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

  // 处理可能出现的对话框
  page.on('dialog', async dialog => {
    console.log(`出现对话框: ${dialog.message()}`);
    await dialog.dismiss();
  });

  // 确保在写长文编辑器
  await page.goto('https://creator.xiaohongshu.com/publish/publish?target=article', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // 点击写长文
  const tabs = await page.$$('.creator-tab');
  for (const tab of tabs) {
    const text = await tab.textContent();
    if (text?.includes('写长文')) {
      await tab.evaluate(el => el.click());
      await page.waitForTimeout(2000);
      break;
    }
  }

  // 点击新的创作
  const createBtn = await page.locator('button:has-text("新的创作")').first();
  if (await createBtn.count() > 0) {
    await createBtn.click({ force: true });
    await page.waitForTimeout(4000);
  }

  console.log('\n========================================');
  console.log('分析 header 区域');
  console.log('========================================');

  // 分析 header 的三个区域
  const headerInfo = await page.evaluate(() => {
    const header = document.querySelector('.header');
    if (!header) return { found: false };

    const result = { found: true, sections: {} };

    ['left', 'mid', 'right'].forEach(section => {
      const el = header.querySelector(`.${section}`);
      if (el) {
        const buttons = el.querySelectorAll('button');
        result.sections[section] = {
          className: el.className,
          buttonCount: buttons.length,
          buttons: Array.from(buttons).map(btn => ({
            className: btn.className?.substring(0, 40),
            disabled: btn.disabled,
            innerHTML: btn.innerHTML.substring(0, 80)
          })),
          html: el.innerHTML.substring(0, 500)
        };
      }
    });

    return result;
  });

  console.log('\nheader 区域分析:');
  ['left', 'mid', 'right'].forEach(section => {
    const info = headerInfo.sections?.[section];
    if (info) {
      console.log(`\n[${section}] 按钮数: ${info.buttonCount}`);
      info.buttons?.forEach((btn, i) => {
        console.log(`  ${i + 1}. class="${btn.className}" disabled=${btn.disabled}`);
        console.log(`     html: ${btn.innerHTML?.substring(0, 60)}...`);
      });
    }
  });

  // 特别分析 mid 区域（根据截图，图标在中间区域）
  console.log('\n========================================');
  console.log('分析 mid 区域的按钮');
  console.log('========================================');

  const midButtons = await page.$$('.header .mid button');
  console.log(`mid 区域按钮数量: ${midButtons.length}`);

  for (let i = 0; i < midButtons.length; i++) {
    const btn = midButtons[i];
    const className = await btn.getAttribute('class');
    const innerHTML = await btn.innerHTML();
    console.log(`\n按钮 ${i + 1}: class="${className?.substring(0, 40)}"`);
    console.log(`  html: ${innerHTML.substring(0, 100)}`);

    // 点击测试
    console.log('  尝试点击...');
    try {
      await btn.click({ force: true });
      await page.waitForTimeout(1500);

      const fileInputs = await page.$$('input[type="file"]');
      if (fileInputs.length > 0) {
        console.log(`  ✓ 点击后出现 ${fileInputs.length} 个 file input!`);
        const accept = await fileInputs[0].getAttribute('accept');
        console.log(`  accept: ${accept}`);

        await page.screenshot({ path: `/tmp/xhs-btn-${i}-clicked.png`, fullPage: false });
        console.log(`  截图: /tmp/xhs-btn-${i}-clicked.png`);
      } else {
        console.log('  点击后没有 file input');
      }
    } catch (e) {
      console.log(`  点击失败: ${e.message}`);
    }
  }

  await browser.close();
}

analyze().catch(console.error);
