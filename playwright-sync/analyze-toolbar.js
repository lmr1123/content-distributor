/**
 * 深度分析小红书"写长文"编辑器 - 等待页面完全加载
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

  console.log('当前页面:', page.url());

  // 如果当前在发布页面，检查是否已在编辑器
  if (!page.url().includes('/edit')) {
    // 导航到发布页面
    await page.goto('https://creator.xiaohongshu.com/publish/publish?target=article', {
      waitUntil: 'networkidle'
    });
    await page.waitForTimeout(3000);

    // 点击"写长文"标签
    console.log('\n点击"写长文"标签...');
    const tabs = await page.$$('.creator-tab');
    for (let i = 0; i < tabs.length; i++) {
      const text = await tabs[i].textContent();
      if (text?.includes('写长文')) {
        await tabs[i].evaluate(el => el.click());
        await page.waitForTimeout(3000);
        console.log('✓ 已切换到写长文模式');
        break;
      }
    }

    // 点击"新的创作"按钮
    console.log('点击"新的创作"...');
    const createBtn = await page.locator('button:has-text("新的创作")').first();
    if (await createBtn.count() > 0) {
      await createBtn.click({ force: true });
      await page.waitForTimeout(5000);  // 等待更长时间
      console.log('✓ 已进入编辑页面');
    }
  }

  console.log('当前URL:', page.url());

  // 截图
  await page.screenshot({ path: '/tmp/xhs-editor-full.png', fullPage: true });
  console.log('\n截图: /tmp/xhs-editor-full.png');

  console.log('\n========================================');
  console.log('分析编辑器区域');
  console.log('========================================');

  // 获取页面主要内容区域的 HTML 结构
  const mainContent = await page.evaluate(() => {
    // 查找编辑器容器
    const editors = document.querySelectorAll('[contenteditable="true"], .ProseMirror, .tiptap, [class*="editor"]');
    const results = [];

    editors.forEach((ed, i) => {
      const parent = ed.parentElement;
      const grandParent = parent?.parentElement;

      results.push({
        index: i,
        tag: ed.tagName,
        className: ed.className?.substring(0, 60),
        parentClass: parent?.className?.substring(0, 60),
        grandParentClass: grandParent?.className?.substring(0, 60),
        siblingCount: parent?.children?.length || 0
      });
    });

    return results;
  });

  console.log('\n编辑器元素:');
  mainContent.forEach((ed, i) => {
    console.log(`  ${i + 1}. <${ed.tag}> class="${ed.className}"`);
    console.log(`     parent: "${ed.parentClass}"`);
    console.log(`     grandParent: "${ed.grandParentClass}"`);
    console.log(`     siblings: ${ed.siblingCount}`);
  });

  // 查找工具栏（通常在编辑器的兄弟元素中）
  const toolbarInfo = await page.evaluate(() => {
    const editor = document.querySelector('[contenteditable="true"], .ProseMirror');
    if (!editor) return null;

    const parent = editor.parentElement;
    const siblings = parent ? Array.from(parent.children) : [];

    // 工具栏通常在编辑器前面
    const toolbar = siblings.find((sib, idx) => {
      const classList = sib.className || '';
      return classList.includes('toolbar') ||
             classList.includes('menu') ||
             classList.includes('bar') ||
             (sib.querySelector('button') && !sib.querySelector('[contenteditable]'));
    });

    if (toolbar) {
      const buttons = toolbar.querySelectorAll('button, [role="button"]');
      return {
        className: toolbar.className,
        buttonCount: buttons.length,
        buttons: Array.from(buttons).slice(0, 10).map(btn => ({
          className: btn.className?.substring(0, 40),
          innerHTML: btn.innerHTML.substring(0, 80)
        }))
      };
    }
    return null;
  });

  if (toolbarInfo) {
    console.log('\n找到工具栏:');
    console.log(`  class: ${toolbarInfo.className}`);
    console.log(`  按钮数量: ${toolbarInfo.buttonCount}`);
    console.log('  按钮:');
    toolbarInfo.buttons.forEach((btn, i) => {
      console.log(`    ${i + 1}. class="${btn.className}"`);
      console.log(`       html: ${btn.innerHTML.substring(0, 60)}...`);
    });
  } else {
    console.log('\n未找到工具栏');
  }

  // 查找所有 SVG 图标，看看有没有图片相关的
  const svgIcons = await page.evaluate(() => {
    const svgs = document.querySelectorAll('svg');
    const iconContainers = document.querySelectorAll('[class*="icon"]');

    // 检查每个 icon 容器
    return Array.from(iconContainers).slice(0, 20).map(container => {
      const parent = container.parentElement;
      const isClickable = parent?.tagName === 'BUTTON' ||
                         parent?.getAttribute('role') === 'button' ||
                         parent?.onclick !== null;
      return {
        className: container.className?.substring(0, 40),
        parentTag: parent?.tagName,
        isClickable,
        parentClass: parent?.className?.substring(0, 40)
      };
    });
  });

  console.log('\n图标元素:');
  svgIcons.forEach((icon, i) => {
    if (icon.isClickable) {
      console.log(`  ${i + 1}. class="${icon.className}" parent=<${icon.parentTag}> clickable`);
    }
  });

  await browser.close();
}

analyze().catch(console.error);
