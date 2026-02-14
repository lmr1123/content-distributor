/**
 * 分析小红书写长文编辑器右侧工具面板
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

  // 分析右侧面板
  console.log('\n========================================');
  console.log('分析右侧工具面板');
  console.log('========================================');

  // 获取 edit-page 的结构（包含标题、内容区域）
  const editPageStructure = await page.evaluate(() => {
    const editPage = document.querySelector('.edit-page, [class*="edit-page"]');
    if (!editPage) return { found: false };

    return {
      className: editPage.className,
      childCount: editPage.children?.length,
      children: Array.from(editPage.children).map(child => ({
        tag: child.tagName,
        className: child.className?.substring(0, 60),
        childCount: child.children?.length
      }))
    };
  });

  console.log('\nedit-page 结构:');
  console.log(`  class: ${editPageStructure.className}`);
  editPageStructure.children?.forEach((child, i) => {
    console.log(`  ${i + 1}. <${child.tag}> class="${child.className}" children=${child.childCount}`);
  });

  // 获取 content 区域的兄弟元素（工具面板可能在旁边）
  const contentSiblings = await page.evaluate(() => {
    const content = document.querySelector('.content, [class*="content"]');
    if (!content) return [];

    const parent = content.parentElement;
    return Array.from(parent?.children || []).map(child => ({
      tag: child.tagName,
      className: child.className?.substring(0, 60),
      text: child.textContent?.substring(0, 50),
      hasButtons: child.querySelectorAll('button').length
    }));
  });

  console.log('\ncontent 的兄弟元素:');
  contentSiblings.forEach((sib, i) => {
    console.log(`  ${i + 1}. <${sib.tag}> class="${sib.className}" buttons=${sib.hasButtons}`);
    console.log(`     text: ${sib.text}...`);
  });

  // 查找包含"图片"的区域
  const imageAreas = await page.evaluate(() => {
    const allDivs = document.querySelectorAll('div');
    const results = [];

    allDivs.forEach(div => {
      // 只检查直接子文本
      const childNodes = Array.from(div.childNodes);
      const textNodes = childNodes.filter(n => n.nodeType === Node.TEXT_NODE);
      const directText = textNodes.map(n => n.textContent).join('').trim();

      if (directText === '图片' || directText.includes('图片')) {
        results.push({
          className: div.className?.substring(0, 50),
          parentClass: div.parentElement?.className?.substring(0, 50),
          html: div.innerHTML.substring(0, 100)
        });
      }
    });

    return results;
  });

  console.log('\n包含"图片"的区域:');
  imageAreas.forEach((area, i) => {
    console.log(`  ${i + 1}. class="${area.className}"`);
    console.log(`     parent: "${area.parentClass}"`);
    console.log(`     html: ${area.html}`);
  });

  // 尝试点击图片区域
  if (imageAreas.length > 0) {
    console.log('\n尝试点击图片区域...');
    const imageDiv = await page.locator('div').filter({ hasText: /^图片$/ }).first();
    if (await imageDiv.count() > 0) {
      await imageDiv.click();
      await page.waitForTimeout(2000);

      // 检查 file input
      const fileInputs = await page.$$('input[type="file"]');
      console.log(`点击后 file input: ${fileInputs.length}`);

      if (fileInputs.length > 0) {
        const accept = await fileInputs[0].getAttribute('accept');
        console.log(`  accept: ${accept}`);
      }

      await page.screenshot({ path: '/tmp/xhs-after-click-image.png', fullPage: false });
      console.log('截图: /tmp/xhs-after-click-image.png');
    }
  }

  await browser.close();
}

analyze().catch(console.error);
