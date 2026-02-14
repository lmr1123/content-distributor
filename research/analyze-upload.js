/**
 * 分析小红书图文发布页面 - 通过点击"新的创作"
 */

const { chromium } = require('playwright');
const fs = require('fs');

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

  // 点击"新的创作"按钮
  console.log('\n点击"新的创作"按钮...');
  try {
    // 先找到并点击 add-icon-large（加号图标）
    const addIcon = await page.$('.add-icon-large');
    if (addIcon) {
      console.log('找到 add-icon-large，点击...');
      // 使用 force click 绕过可见性检查
      await addIcon.click({ force: true });
      await page.waitForTimeout(2000);
    } else {
      // 尝试点击"新的创作"按钮
      const createBtn = await page.locator('button:has-text("新的创作")').first();
      if (await createBtn.count() > 0) {
        console.log('找到"新的创作"按钮，点击...');
        await createBtn.click({ force: true });
        await page.waitForTimeout(2000);
      }
    }
  } catch (e) {
    console.log('点击失败:', e.message);
  }

  // 截图查看当前状态
  await page.screenshot({ path: '/tmp/xhs-after-create-click.png', fullPage: false });
  console.log('截图: /tmp/xhs-after-create-click.png');

  // 分析页面元素
  console.log('\n========================================');
  console.log('页面分析（点击创作按钮后）');
  console.log('========================================');

  // 获取所有 input 元素
  const inputs = await page.evaluate(() => {
    const allInputs = document.querySelectorAll('input');
    return Array.from(allInputs).map(input => ({
      type: input.type,
      accept: input.accept,
      className: input.className?.substring(0, 50),
      id: input.id,
      name: input.name,
      hidden: input.offsetParent === null
    }));
  });
  console.log(`\n[1] input 元素: ${inputs.length} 个`);
  inputs.forEach((inp, i) => {
    console.log(`  ${i + 1}. type="${inp.type}" accept="${inp.accept}" hidden=${inp.hidden} class="${inp.className}"`);
  });

  // 获取所有包含"图片"、"上传"文字的元素
  const uploadTexts = await page.evaluate(() => {
    const allElements = document.querySelectorAll('*');
    const results = [];
    allElements.forEach(el => {
      const text = el.textContent?.trim();
      if (text && (text.includes('图片') || text.includes('上传') || text.includes('本地'))) {
        if (text.length < 30) {
          results.push({
            tag: el.tagName,
            text: text,
            className: el.className?.substring(0, 40)
          });
        }
      }
    });
    return results.slice(0, 20);
  });
  console.log(`\n[2] 包含"图片/上传/本地"的元素:`);
  uploadTexts.forEach((el, i) => {
    console.log(`  ${i + 1}. <${el.tag}> "${el.text}" class="${el.className}"`);
  });

  // 获取弹窗/对话框
  const modals = await page.evaluate(() => {
    const modals = document.querySelectorAll('[role="dialog"], .modal, .dialog, [class*="modal"], [class*="dialog"], [class*="popup"], [class*="popover"]');
    return Array.from(modals).map(m => ({
      className: m.className?.substring(0, 60),
      visible: m.offsetParent !== null
    }));
  });
  console.log(`\n[3] 弹窗/对话框: ${modals.length} 个`);
  modals.forEach((m, i) => {
    console.log(`  ${i + 1}. class="${m.className}" visible=${m.visible}`);
  });

  await browser.close();
}

analyze().catch(console.error);
