// 在微信文章页面的控制台中运行此脚本来测试提取逻辑
// 使用方法：
// 1. 在浏览器中打开微信文章
// 2. 按 F12 打开开发者工具
// 3. 在 Console 中粘贴并运行此代码

console.log('========================================');
console.log('微信文章提取测试');
console.log('========================================');
console.log('');

// 测试各种选择器
const tests = {
  '标题选择器': {
    '#activity-name': document.querySelector('#activity-name'),
    '.rich_media_title': document.querySelector('.rich_media_title'),
    'h1.rich_media_title': document.querySelector('h1.rich_media_title'),
    'h1': document.querySelector('h1')
  },
  '内容选择器': {
    '#js_content': document.querySelector('#js_content'),
    '.rich_media_content': document.querySelector('.rich_media_content')
  },
  '作者选择器': {
    '#js_name': document.querySelector('#js_name'),
    '.rich_media_meta_nickname': document.querySelector('.rich_media_meta_nickname'),
    '.rich_media_meta_text': document.querySelector('.rich_media_meta_text')
  },
  '封面选择器': {
    '.rich_media_thumb': document.querySelector('.rich_media_thumb'),
    'meta[property="og:image"]': document.querySelector('meta[property="og:image"]')
  }
};

// 输出测试结果
for (const [category, selectors] of Object.entries(tests)) {
  console.log(`\n【${category}】`);
  for (const [selector, element] of Object.entries(selectors)) {
    if (element) {
      const text = element.textContent?.trim() || element.src || element.content || '';
      console.log(`  ✅ ${selector}: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
    } else {
      console.log(`  ❌ ${selector}: 未找到`);
    }
  }
}

// 测试内容区域
console.log('\n\n【内容区域详情】');
const contentEl = document.querySelector('#js_content') || document.querySelector('.rich_media_content');
if (contentEl) {
  console.log('  内容元素: 找到');
  console.log('  纯文本长度:', contentEl.textContent.trim().length, '字符');

  const images = contentEl.querySelectorAll('img');
  console.log('  图片数量:', images.length);

  if (images.length > 0) {
    console.log('  第一张图片信息:');
    const firstImg = images[0];
    console.log('    - data-src:', firstImg.dataset.src || '无');
    console.log('    - src:', firstImg.src || '无');
  }

  const videos = contentEl.querySelectorAll('video');
  console.log('  视频数量:', videos.length);

  // 显示内容前100个字符
  const preview = contentEl.textContent.trim().substring(0, 100);
  console.log('  内容预览:', preview + '...');
} else {
  console.log('  ❌ 内容元素: 未找到');
}

// 页面基本信息
console.log('\n\n【页面信息】');
console.log('  URL:', window.location.href);
console.log('  标题:', document.title);
console.log('  页面状态:', document.readyState);

// 检查是否有反爬虫
console.log('\n\n【反爬虫检查】');
console.log('  是否有 __init 登录检查:', typeof window.__init !== 'undefined');
console.log('  是否需要登录:', document.body.innerText.includes('请先登录'));

console.log('\n========================================');
console.log('测试完成！');
console.log('========================================');
