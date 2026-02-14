/**
 * 分析小红书写长文编辑器的 SVG 图标内容
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

  // 处理对话框
  page.on('dialog', async dialog => {
    console.log(`出现对话框: ${dialog.message()}`);
    try {
      await dialog.dismiss();
    } catch (e) {}
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

  console.log('\n========================================');
  console.log('分析 SVG 图标路径');
  console.log('========================================');

  // 获取每个按钮的 SVG 内容
  const buttons = await page.$$('.header .mid button');
  console.log(`找到 ${buttons.length} 个按钮`);

  for (let i = 0; i < buttons.length; i++) {
    const btn = buttons[i];
    const className = await btn.getAttribute('class');

    // 获取 SVG 的 path d 属性（可以用来识别图标）
    const svgInfo = await btn.evaluate(el => {
      const svg = el.querySelector('svg');
      if (!svg) return null;

      const paths = svg.querySelectorAll('path');
      const pathDs = Array.from(paths).map(p => p.getAttribute('d')?.substring(0, 50));

      return {
        viewBox: svg.getAttribute('viewBox'),
        pathCount: paths.length,
        pathDs
      };
    });

    console.log(`\n按钮 ${i + 1}: class="${className}"`);
    console.log(`  viewBox: ${svgInfo?.viewBox}`);
    console.log(`  path数量: ${svgInfo?.pathCount}`);
    svgInfo?.pathDs?.forEach((d, j) => {
      console.log(`  path ${j + 1}: d="${d}..."`);
    });
  }

  // 根据截图，图片图标应该是第一个或第二个（左边）
  // 尝试点击按钮 3 和 4（可用的按钮）
  console.log('\n========================================');
  console.log('尝试点击可用的按钮');
  console.log('========================================');

  for (let i = 0; i < buttons.length; i++) {
    const btn = buttons[i];
    const className = await btn.getAttribute('class');

    if (!className?.includes('disabled')) {
      console.log(`\n点击按钮 ${i + 1}...`);

      // 先获取点击前的 file input 数量
      const beforeCount = (await page.$$('input[type="file"]')).length;

      await btn.click({ force: true });
      await page.waitForTimeout(2000);

      const afterCount = (await page.$$('input[type="file"]')).length;

      if (afterCount > beforeCount) {
        console.log(`✓ 点击后出现 file input! (从 ${beforeCount} 变为 ${afterCount})`);

        const fileInput = (await page.$$('input[type="file"]'))[0];
        const accept = await fileInput.getAttribute('accept');
        console.log(`  accept: ${accept}`);

        await page.screenshot({ path: `/tmp/xhs-image-upload-found.png`, fullPage: false });
        console.log('截图: /tmp/xhs-image-upload-found.png');
        break;
      } else {
        console.log(`点击后没有新的 file input (保持 ${afterCount} 个)`);

        // 检查是否有其他变化（比如弹窗）
        const popup = await page.$('[class*="popup"], [class*="modal"], [class*="dialog"]');
        if (popup) {
          const popupClass = await popup.getAttribute('class');
          console.log(`  检测到弹窗: ${popupClass}`);
        }
      }
    }
  }

  await browser.close();
}

analyze().catch(console.error);
