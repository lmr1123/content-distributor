/**
 * 分析小红书写长文编辑器 - 找工具栏和图片按钮
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

  // 确保在编辑器页面
  if (!page.url().includes('edit') && !page.url().includes('publish')) {
    await page.goto('https://creator.xiaohongshu.com/publish/publish?target=article', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // 进入写长文模式
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
  }

  console.log('\n========================================');
  console.log('分析 rich-editor-content 区域');
  console.log('========================================');

  // 获取 rich-editor-content 的详细结构
  const editorStructure = await page.evaluate(() => {
    const content = document.querySelector('.rich-editor-content');
    if (!content) return { found: false };

    // 获取所有子元素
    const children = Array.from(content.children).map(child => ({
      tag: child.tagName,
      className: child.className?.substring(0, 60),
      childCount: child.children?.length
    }));

    // 查找可能的工具栏
    const toolbar = content.querySelector('[class*="toolbar"], [class*="menu"], [class*="bubble"]');
    const toolbarInfo = toolbar ? {
      className: toolbar.className,
      html: toolbar.innerHTML.substring(0, 500),
      buttons: Array.from(toolbar.querySelectorAll('button')).map(b => b.className?.substring(0, 30))
    } : null;

    return {
      found: true,
      className: content.className,
      children,
      toolbarInfo
    };
  });

  console.log('\nrich-editor-content 子元素:');
  editorStructure.children?.forEach((child, i) => {
    console.log(`  ${i + 1}. <${child.tag}> class="${child.className}" children=${child.childCount}`);
  });

  if (editorStructure.toolbarInfo) {
    console.log('\n找到工具栏:');
    console.log(`  class: ${editorStructure.toolbarInfo.className}`);
    console.log(`  按钮: ${editorStructure.toolbarInfo.buttons.join(', ')}`);
  }

  // 查找 tiptap 相关的元素（包括 bubble menu）
  const tiptapInfo = await page.evaluate(() => {
    const tiptap = document.querySelector('.tiptap');
    const proseMirror = document.querySelector('.ProseMirror');

    // tiptap 通常有 bubble menu（选中文字后出现的菜单）
    const bubbleMenus = document.querySelectorAll('[class*="bubble"], [class*="floating"], [class*="popup"]');

    return {
      tiptapClass: tiptap?.className,
      proseMirrorClass: proseMirror?.className,
      bubbleMenuCount: bubbleMenus.length,
      bubbleMenus: Array.from(bubbleMenus).map(m => ({
        className: m.className?.substring(0, 50),
        visible: m.offsetParent !== null
      }))
    };
  });

  console.log('\ntiptap 信息:');
  console.log(`  tiptap: ${tiptapInfo.tiptapClass}`);
  console.log(`  ProseMirror: ${tiptapInfo.proseMirrorClass}`);
  console.log(`  bubble menus: ${tiptapInfo.bubbleMenuCount}`);
  tiptapInfo.bubbleMenus.forEach((m, i) => {
    console.log(`    ${i + 1}. class="${m.className}" visible=${m.visible}`);
  });

  // 点击编辑器激活工具栏
  console.log('\n点击编辑器激活工具栏...');
  const editor = await page.$('.ProseMirror');
  if (editor) {
    await editor.click();
    await page.waitForTimeout(1000);

    // 再次检查 bubble menu
    const afterClick = await page.evaluate(() => {
      const bubbleMenus = document.querySelectorAll('[class*="bubble"], [class*="floating"]');
      return Array.from(bubbleMenus).map(m => ({
        className: m.className?.substring(0, 50),
        visible: m.offsetParent !== null
      }));
    });

    console.log('点击后 bubble menus:');
    afterClick.forEach((m, i) => {
      console.log(`  ${i + 1}. class="${m.className}" visible=${m.visible}`);
    });

    // 输入一些文字再检查
    await page.keyboard.type('测试');
    await page.waitForTimeout(500);

    // 选中文字
    await page.keyboard.down('Meta');
    await page.press('.ProseMirror', 'a');
    await page.keyboard.up('Meta');
    await page.waitForTimeout(1000);

    const afterSelect = await page.evaluate(() => {
      const bubbleMenus = document.querySelectorAll('[class*="bubble"], [class*="floating"]');
      return Array.from(bubbleMenus).map(m => ({
        className: m.className?.substring(0, 50),
        visible: m.offsetParent !== null,
        html: m.innerHTML.substring(0, 200)
      }));
    });

    console.log('\n选中文字后 bubble menus:');
    afterSelect.forEach((m, i) => {
      console.log(`  ${i + 1}. class="${m.className}" visible=${m.visible}`);
      if (m.visible) {
        console.log(`      html: ${m.html.substring(0, 100)}...`);
      }
    });
  }

  // 截图
  await page.screenshot({ path: '/tmp/xhs-editor-with-toolbar.png', fullPage: false });
  console.log('\n截图: /tmp/xhs-editor-with-toolbar.png');

  await browser.close();
}

analyze().catch(console.error);
