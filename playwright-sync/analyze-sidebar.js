/**
 * 分析小红书写长文编辑器侧边栏
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

  console.log('\n========================================');
  console.log('分析侧边栏');
  console.log('========================================');

  // 查找侧边栏
  const sidebarInfo = await page.evaluate(() => {
    const sidebars = document.querySelectorAll('[class*="sidebar"], [class*="side-bar"], [class*="panel"], .side');

    return Array.from(sidebars).map((sb, i) => ({
      index: i,
      className: sb.className?.substring(0, 60),
      childCount: sb.children?.length,
      text: sb.textContent?.substring(0, 100)
    }));
  });

  console.log('\n侧边栏元素:');
  sidebarInfo.forEach((sb, i) => {
    console.log(`  ${i + 1}. class="${sb.className}" children=${sb.childCount}`);
    console.log(`     text: ${sb.text?.substring(0, 60)}...`);
  });

  // 查找包含"图片"文字的元素
  const imageButtons = await page.evaluate(() => {
    const allElements = document.querySelectorAll('*');
    const results = [];

    allElements.forEach(el => {
      // 检查直接文本内容（不包括子元素）
      const directText = Array.from(el.childNodes)
        .filter(node => node.nodeType === Node.TEXT_NODE)
        .map(node => node.textContent)
        .join('');

      if (directText.includes('图片') || el.textContent?.trim() === '图片') {
        results.push({
          tag: el.tagName,
          className: el.className?.substring(0, 50),
          parentClass: el.parentElement?.className?.substring(0, 50),
          isButton: el.tagName === 'BUTTON' || el.onclick !== null ||
                    el.getAttribute('role') === 'button'
        });
      }
    });

    return results.slice(0, 10);
  });

  console.log('\n包含"图片"的元素:');
  imageButtons.forEach((el, i) => {
    console.log(`  ${i + 1}. <${el.tag}> class="${el.className}" isButton=${el.isButton}`);
    console.log(`     parent: "${el.parentClass}"`);
  });

  // 尝试点击图片按钮
  console.log('\n尝试点击图片按钮...');
  try {
    const imageBtn = await page.locator('text=图片').first();
    if (await imageBtn.count() > 0) {
      console.log('找到图片按钮，点击...');
      await imageBtn.click();
      await page.waitForTimeout(2000);

      // 检查是否出现了 file input
      const fileInputs = await page.$$('input[type="file"]');
      console.log(`点击后 file input 数量: ${fileInputs.length}`);

      if (fileInputs.length > 0) {
        for (let i = 0; i < fileInputs.length; i++) {
          const accept = await fileInputs[i].getAttribute('accept');
          console.log(`  ${i + 1}. accept="${accept}"`);
        }
      }

      // 截图
      await page.screenshot({ path: '/tmp/xhs-after-image-click.png', fullPage: false });
      console.log('截图: /tmp/xhs-after-image-click.png');
    }
  } catch (e) {
    console.log('点击失败:', e.message);
  }

  await browser.close();
}

analyze().catch(console.error);
