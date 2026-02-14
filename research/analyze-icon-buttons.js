/**
 * 分析小红书写长文编辑器的图片图标
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

  // 确保在写长文编辑器
  console.log('\n导航到写长文编辑器...');
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
  console.log('分析编辑器图标');
  console.log('========================================');

  // 查找 header 区域（工具栏通常在这里）
  const headerStructure = await page.evaluate(() => {
    const header = document.querySelector('.header');
    if (!header) return { found: false };

    return {
      found: true,
      className: header.className,
      html: header.innerHTML.substring(0, 2000),
      children: Array.from(header.children).map(child => ({
        tag: child.tagName,
        className: child.className?.substring(0, 60),
        html: child.innerHTML.substring(0, 200)
      }))
    };
  });

  console.log('\nheader 区域:');
  headerStructure.children?.forEach((child, i) => {
    console.log(`  ${i + 1}. <${child.tag}> class="${child.className}"`);
    console.log(`     html: ${child.html?.substring(0, 100)}...`);
  });

  // 查找所有 icon 相关元素
  const iconElements = await page.evaluate(() => {
    const icons = document.querySelectorAll('[class*="icon"], [class*="Icon"], svg, img');
    return Array.from(icons).slice(0, 30).map(icon => {
      const parent = icon.parentElement;
      const grandParent = parent?.parentElement;
      return {
        tag: icon.tagName,
        className: icon.className?.substring(0, 50),
        parentTag: parent?.tagName,
        parentClass: parent?.className?.substring(0, 50),
        grandParentClass: grandParent?.className?.substring(0, 50),
        isClickable: parent?.tagName === 'BUTTON' || parent?.getAttribute('role') === 'button'
      };
    });
  });

  console.log('\n图标元素:');
  iconElements.forEach((icon, i) => {
    if (icon.isClickable || icon.parentTag === 'BUTTON' || icon.className?.includes('tool')) {
      console.log(`  ${i + 1}. <${icon.tag}> class="${icon.className}"`);
      console.log(`     parent: <${icon.parentTag}> class="${icon.parentClass}"`);
      console.log(`     grandParent: "${icon.grandParentClass}"`);
    }
  });

  // 查找工具栏按钮（根据截图，应该在 header 区域）
  const toolButtons = await page.evaluate(() => {
    // 查找 header 内的按钮或可点击元素
    const header = document.querySelector('.header');
    if (!header) return [];

    const buttons = header.querySelectorAll('button, [role="button"], [class*="btn"]');
    return Array.from(buttons).map(btn => ({
      className: btn.className?.substring(0, 50),
      innerHTML: btn.innerHTML.substring(0, 100),
      title: btn.getAttribute('title') || btn.getAttribute('aria-label') || ''
    }));
  });

  console.log('\nheader 内的按钮:');
  toolButtons.forEach((btn, i) => {
    console.log(`  ${i + 1}. class="${btn.className}" title="${btn.title}"`);
    console.log(`     html: ${btn.innerHTML?.substring(0, 60)}...`);
  });

  // 尝试点击图片图标
  console.log('\n尝试找并点击图片图标...');

  // 根据截图，图片图标可能在 header 右侧
  const imageIconSelectors = [
    '.header button:nth-child(1)',
    '.header button:first-child',
    '.header [class*="image"]',
    '.header [class*="picture"]',
    '.header svg',
    'button svg'
  ];

  for (const selector of imageIconSelectors) {
    const el = await page.$(selector);
    if (el) {
      console.log(`找到: ${selector}`);
      await el.click();
      await page.waitForTimeout(1500);

      // 检查 file input
      const fileInputs = await page.$$('input[type="file"]');
      if (fileInputs.length > 0) {
        console.log(`✓ 点击后出现 file input: ${fileInputs.length} 个`);
        const accept = await fileInputs[0].getAttribute('accept');
        console.log(`  accept: ${accept}`);

        await page.screenshot({ path: '/tmp/xhs-image-icon-clicked.png', fullPage: false });
        console.log('截图: /tmp/xhs-image-icon-clicked.png');
        break;
      }
    }
  }

  await browser.close();
}

analyze().catch(console.error);
