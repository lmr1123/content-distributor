// 全平台内容分发助手 - 主逻辑

let quillEditor = null;
let currentArticle = null;
let isSyncing = false;
let playwrightAvailable = false; // Playwright 服务状态

function extractImageAttr(attrs) {
  if (!attrs) return '';
  const attrPattern = /(?:data-original-src|data-src|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i;
  const match = attrs.match(attrPattern);
  return (match && (match[1] || match[2] || match[3])) ? (match[1] || match[2] || match[3]) : '';
}

function normalizeTextForParagraphs(text) {
  const raw = String(text || '').trim();
  if (!raw) return '';
  if (raw.includes('\n')) return raw;
  return raw
    .replace(/([。！？!?])(?=[^\n])/g, '$1\n')
    .replace(/(👇|👆|👉|亮点：|总结：|安装|实战|步骤)/g, '\n$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function buildTextWithImagePlaceholders() {
  if (!quillEditor) return '';

  const ops = quillEditor.getContents()?.ops || [];
  const parts = [];
  const seenImageUrls = new Map(); // 用于记录已见过的图片 URL 及其索引
  let imageIndex = 0;

  for (const op of ops) {
    if (typeof op.insert === 'string') {
      parts.push(op.insert);
      continue;
    }

    if (op.insert && typeof op.insert === 'object' && op.insert.image) {
      const imageUrl = op.insert.image;

      // 检查是否已见过这张图片（基于 URL 去重）
      if (seenImageUrls.has(imageUrl)) {
        // 使用已分配的索引，避免重复
        const existingIndex = seenImageUrls.get(imageUrl);
        parts.push(`\n[图片${existingIndex}]\n`);
      } else {
        // 新图片，分配新索引
        imageIndex += 1;
        seenImageUrls.set(imageUrl, imageIndex);
        parts.push(`\n[图片${imageIndex}]\n`);
      }
    }
  }

  return parts
    .join('')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function toParagraphHtml(text) {
  const normalized = normalizeTextForParagraphs(text);
  if (!normalized) return '';
  return normalized
    .split(/\n{2,}/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => `<p>${line.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function setEditorHtml(html) {
  const normalizedHtml = normalizeEditorHtml(html || '');
  quillEditor.setContents([]);
  quillEditor.clipboard.dangerouslyPasteHTML(normalizedHtml);
}

function appendMissingImages(imageUrls) {
  const existing = quillEditor.root.querySelectorAll('img').length;
  if (existing > 0 || !Array.isArray(imageUrls) || imageUrls.length === 0) return;

  const blocks = imageUrls.map((url) => `
    <p><img src="${url}" data-original-src="${url}" class="wechat-image" loading="lazy"></p>
    <p><a href="${url}" target="_blank" rel="noopener noreferrer">查看原图链接</a></p>
  `).join('');
  quillEditor.clipboard.dangerouslyPasteHTML(quillEditor.getLength(), blocks);
}

function setImageFallbackHandlers() {
  const imgs = quillEditor.root.querySelectorAll('img.wechat-image, img[data-original-src], img[data-img-src]');
  imgs.forEach((img) => {
    img.onerror = () => {
      const src = img.getAttribute('data-original-src') || img.getAttribute('data-img-src') || img.getAttribute('src') || '';
      const holder = document.createElement('p');
      holder.innerHTML = src
        ? `图片加载失败：<a href="${src}" target="_blank" rel="noopener noreferrer">打开原图</a>`
        : '图片加载失败';
      img.replaceWith(holder);
    };
  });
}

function normalizeInlineStyle(styleText) {
  if (!styleText) return '';
  const blocked = new Set([
    'font-size', 'line-height', 'font-family',
    'margin', 'margin-top', 'margin-bottom', 'margin-left', 'margin-right',
    'padding', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right'
  ]);
  return styleText
    .split(';')
    .map(item => item.trim())
    .filter(Boolean)
    .filter((item) => {
      const [prop] = item.split(':');
      return prop && !blocked.has(prop.trim().toLowerCase());
    })
    .join('; ');
}

function normalizeEditorHtml(html) {
  const raw = String(html || '').trim();
  if (!raw) return '';

  const wrapper = document.createElement('div');
  wrapper.innerHTML = raw;

  wrapper.querySelectorAll('script, style').forEach(node => node.remove());

  wrapper.querySelectorAll('[style]').forEach((node) => {
    const cleaned = normalizeInlineStyle(node.getAttribute('style'));
    if (cleaned) {
      node.setAttribute('style', cleaned);
    } else {
      node.removeAttribute('style');
    }
  });

  const hasBlock = /<(p|h1|h2|h3|h4|h5|h6|ul|ol|li|blockquote|pre|img)\b/i.test(wrapper.innerHTML);
  if (!hasBlock) {
    return toParagraphHtml(wrapper.textContent || '');
  }

  // 空段落标准化
  wrapper.querySelectorAll('p').forEach((p) => {
    const hasMedia = p.querySelector('img,video,iframe');
    const text = (p.textContent || '').replace(/\u00a0/g, ' ').trim();
    if (!hasMedia && !text) {
      p.innerHTML = '<br>';
    }
  });

  let normalized = wrapper.innerHTML
    .replace(/<p>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>(?:\s*<p>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>){2,}/gi, '<p><br></p>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!normalized) {
    normalized = toParagraphHtml(wrapper.textContent || '');
  }
  return normalized;
}

function applyAutoTypesetting(showToastMessage = false) {
  const currentHtml = quillEditor.root.innerHTML;
  const normalized = normalizeEditorHtml(currentHtml);
  setEditorHtml(normalized);
  setImageFallbackHandlers();

  if (showToastMessage) {
    showToast('格式优化完成（段落/空行/字号已统一）', 'success');
  }
}

// 平台配置
const PLATFORMS = {
  xiaohongshu: {
    name: '小红书',
    limit: 1000,
    url: 'https://creator.xiaohongshu.com/publish/publish?from=tab_switch&target=article'
  },
  zhihu: {
    name: '知乎',
    limit: null,
    url: 'https://zhuanlan.zhihu.com/write'
  },
  jianshu: {
    name: '简书',
    limit: null,
    url: 'https://www.jianshu.com/writer'
  },
  toutiao: {
    name: '今日头条',
    limit: 5000,
    url: 'https://mp.toutiao.com/profile_v4/index/creation'
  },
  bilibili: {
    name: '哔哩哔哩',
    limit: null,
    url: 'https://member.bilibili.com/platform/article/text/new'
  }
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  initEditor();
  bindEvents();
  loadSavedContent();
  checkPlaywrightService(); // 检查 Playwright 服务
});

// 初始化 Quill 编辑器
function initEditor() {
  const toolbarOptions = [
    [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'color': [] }, { 'background': [] }],
    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
    [{ 'indent': '-1' }, { 'indent': '+1' }],
    [{ 'align': [] }],
    ['link', 'image'],
    ['blockquote', 'code-block'],
    ['clean']
  ];

  quillEditor = new Quill('#editor', {
    theme: 'snow',
    modules: {
      toolbar: toolbarOptions
    },
    placeholder: '在这里编辑您的内容...'
  });

  // 监听内容变化
  quillEditor.on('text-change', () => {
    updateWordCount();
    saveContent();
  });
}

// 绑定事件
function bindEvents() {
  // 获取文章按钮
  document.getElementById('fetchBtn').addEventListener('click', fetchArticle);

  // URL输入框回车事件
  document.getElementById('wechatUrl').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      fetchArticle();
    }
  });

  // 平台选择变化
  document.querySelectorAll('input[name="platform"]').forEach(checkbox => {
    checkbox.addEventListener('change', updateSelectedCount);
  });

  // Playwright checkbox 变化
  const usePlaywrightCheckbox = document.getElementById('usePlaywright');
  if (usePlaywrightCheckbox) {
    usePlaywrightCheckbox.addEventListener('change', updatePublishModeVisibility);
  }

  // 同步按钮
  document.getElementById('syncBtn').addEventListener('click', syncToPlatforms);

  // 清空按钮
  document.getElementById('clearBtn').addEventListener('click', clearContent);

  // 格式优化按钮
  document.getElementById('formatBtn').addEventListener('click', formatContent);

  // 更换封面按钮
  document.getElementById('changeCoverBtn').addEventListener('click', changeCover);

  // 标题修改同步保存
  document.getElementById('articleTitle').addEventListener('input', saveContent);

  // 设置按钮提示
  const settingsBtn = document.getElementById('settingsBtn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      showToast('设置面板开发中，当前可直接开始导入与分发', 'info');
    });
  }

  // 快捷键：Ctrl/Cmd + Enter 同步；Ctrl/Cmd + Shift + F 格式化
  document.addEventListener('keydown', (e) => {
    const isMeta = e.ctrlKey || e.metaKey;
    if (!isMeta) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      syncToPlatforms();
      return;
    }

    if (e.shiftKey && (e.key === 'F' || e.key === 'f')) {
      e.preventDefault();
      formatContent();
    }
  });
}

// 获取微信文章
async function fetchArticle() {
  if (document.getElementById('fetchBtn').disabled) return;

  const urlInput = document.getElementById('wechatUrl');
  const url = urlInput.value.trim();

  if (!url) {
    showToast('请输入微信公众号文章链接', 'warning');
    return;
  }

  if (!isValidWechatUrl(url)) {
    showToast('请输入有效的微信公众号文章链接', 'error');
    return;
  }

  showLoading(true);

  try {
    // 发送消息给 background script
    const response = await chrome.runtime.sendMessage({
      action: 'fetchWechatArticle',
      url: url
    });

    if (response.success) {
      currentArticle = response.data;
      displayArticle(currentArticle);
      showToast('文章获取成功！', 'success');
      focusEditorPanel();
    } else {
      throw new Error(response.error || '获取文章失败');
    }
  } catch (error) {
    console.error('获取文章失败:', error);
    showToast('获取文章失败: ' + error.message, 'error');
  } finally {
    showLoading(false);
  }
}

// 验证微信URL
function isValidWechatUrl(url) {
  const patterns = [
    /mp\.weixin\.qq\.com/,
    /mp\.weixin\.qq\.com\/s/,
    /weixin\.qq\.com/
  ];
  return patterns.some(pattern => pattern.test(url));
}

// 显示文章
function displayArticle(article) {
  console.log('展示文章数据:', {
    title: article?.title,
    contentLength: article?.content?.length || 0,
    textLength: article?.textContent?.length || 0,
    imageCount: article?.imageCount || 0,
    imagePreview: (article?.imageUrls || []).slice(0, 3)
  });

  // 显示元信息区域
  const metaSection = document.getElementById('articleMeta');
  metaSection.style.display = 'block';

  // 设置标题
  document.getElementById('articleTitle').value = article.title || '';

  // 设置封面
  const coverImg = document.getElementById('coverImage');
  if (article.cover) {
    coverImg.src = article.cover;
    coverImg.onerror = function() {
      this.style.display = 'none';
      showToast('封面图无法加载（防盗链），请手动上传', 'warning');
    };
    coverImg.style.display = 'block';
  } else {
    coverImg.style.display = 'none';
  }

  // 设置作者和字数
  const textContent = article.textContent || '';
  const unresolvedImageUrls = Array.isArray(article.unresolvedImageUrls) ? article.unresolvedImageUrls : [];
  const unresolvedImageCount = unresolvedImageUrls.length;
  let wordCountText = `字数：${textContent.length}`;
  if (article.imageCount && article.imageCount > 0) {
    wordCountText += ` | 图片：${article.imageCount}`;
    if (unresolvedImageCount > 0) {
      wordCountText += `（待处理 ${unresolvedImageCount}）`;
    }
  }
  document.getElementById('wordCount').textContent = wordCountText;
  document.getElementById('authorInfo').textContent = `作者：${article.author || '未知'}`;

  // 设置编辑器内容
  if (article.content) {
    // 处理图片 - 保留原图片标签但添加提示
    let content = article.content;

    // 为图片添加特殊class和属性，便于识别
    content = content.replace(/<img([^>]*)>/gi, (match, attrs) => {
      // 提取src或data-src
      const imgSrc = extractImageAttr(attrs).replace(/&amp;/g, '&');
      const hasSrc = /\bsrc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i.test(attrs);

      // 如果没有 src 但有 data-original-src/data-src，补上 src，避免编辑器里不显示
      let normalizedAttrs = attrs;
      if (!hasSrc && imgSrc) {
        normalizedAttrs = ` src="${imgSrc}"${attrs}`;
      }

      if (imgSrc && imgSrc.includes('mmbiz.qpic.cn')) {
        // 微信图片，添加特殊标记
        return `<img${normalizedAttrs} class="wechat-image" data-img-src="${imgSrc}" loading="lazy">`;
      }
      return `<img${normalizedAttrs}>`;
    });

    setEditorHtml(content);
    appendMissingImages(article.imageUrls);
    setImageFallbackHandlers();

    // 如果富文本插入后仍为空，回退为纯文本段落，保证一定可见
    if (quillEditor.getText().trim().length === 0 && article.textContent) {
      const paragraphHtml = toParagraphHtml(article.textContent);
      setEditorHtml(paragraphHtml || `<p>${article.textContent}</p>`);
      appendMissingImages(article.imageUrls);
      setImageFallbackHandlers();
    }

    // 添加图片下载按钮区域
    if (unresolvedImageCount > 0) {
      addImageDownloadSection(unresolvedImageUrls);
    }
  } else if (article.textContent) {
    const paragraphHtml = toParagraphHtml(article.textContent);
    setEditorHtml(paragraphHtml || `<p>${article.textContent}</p>`);
    appendMissingImages(article.imageUrls);
    setImageFallbackHandlers();
  }

  applyAutoTypesetting(false);

  // 显示提示
  if (unresolvedImageCount > 0) {
    setTimeout(() => {
      showToast(`有 ${unresolvedImageCount} 张图片仍需手动处理，已在下方列出`, 'warning');
    }, 500);
  }

  updateSyncButton();
}

function focusEditorPanel() {
  const panel = document.querySelector('.right-panel');
  if (!panel) return;
  panel.classList.add('editor-focus');
  setTimeout(() => panel.classList.remove('editor-focus'), 1200);
}

// 添加图片下载区域
function addImageDownloadSection(imageUrls) {
  // 若已存在则先移除，确保列表与当前文章一致
  const existing = document.getElementById('imageDownloadSection');
  if (existing) {
    existing.remove();
  }

  const leftPanel = document.querySelector('.left-panel');
  const section = document.createElement('div');
  section.id = 'imageDownloadSection';
  section.className = 'image-download-section';
  section.innerHTML = `
    <h3>📷 图片处理</h3>
    <p class="image-tip">微信图片有防盗链，需要下载后手动上传到各平台</p>
    <div class="image-actions">
      <button id="downloadAllImages" class="btn-secondary">
        📥 一键复制所有图片链接
      </button>
      <span class="image-count">共 ${imageUrls.length} 张图片</span>
    </div>
    <div class="image-list">
      ${imageUrls.map((url, index) => `
        <div class="image-item">
          <span class="image-index">${index + 1}</span>
          <input type="text" value="${url}" readonly class="image-url-input" id="imgUrl${index}">
          <button class="btn-icon-small copy-img-btn" data-url="${url}" data-index="${index}">复制</button>
        </div>
      `).join('')}
    </div>
  `;

  leftPanel.appendChild(section);

  // 绑定复制按钮事件
  document.querySelectorAll('.copy-img-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const url = this.dataset.url;
      navigator.clipboard.writeText(url).then(() => {
        showToast(`图片链接已复制`, 'success');
        this.textContent = '已复制';
        setTimeout(() => this.textContent = '复制', 2000);
      });
    });
  });

  // 一键复制所有链接
  document.getElementById('downloadAllImages').addEventListener('click', () => {
    const allUrls = imageUrls.join('\n');
    navigator.clipboard.writeText(allUrls).then(() => {
      showToast(`已复制 ${imageUrls.length} 个图片链接，请逐个下载`, 'success');
    });
  });
}

// 更新字数统计
function updateWordCount() {
  const text = quillEditor.getText().trim();
  const count = text.length;
  const metaSection = document.getElementById('articleMeta');

  if (metaSection.style.display !== 'none') {
    document.getElementById('wordCount').textContent = `字数：${count}`;
  }
}

// 更新选中平台数量
function updateSelectedCount() {
  const selected = document.querySelectorAll('input[name="platform"]:checked');
  const count = selected.length;
  document.getElementById('selectedCount').textContent = `已选择 ${count} 个平台`;
  updateSyncButton();
  updatePublishModeVisibility();
}

// 更新同步按钮状态
function updateSyncButton() {
  const syncBtn = document.getElementById('syncBtn');
  const selected = document.querySelectorAll('input[name="platform"]:checked');
  const hasContent = quillEditor.getText().trim().length > 0;

  syncBtn.disabled = selected.length === 0 || !hasContent;
}

// 同步到各平台
async function syncToPlatforms() {
  if (isSyncing) return;

  const selected = document.querySelectorAll('input[name="platform"]:checked');
  const platforms = Array.from(selected).map(cb => cb.value);

  if (platforms.length === 0) {
    showToast('请选择至少一个平台', 'warning');
    return;
  }

  // 生成带图片占位符的文本（用于写长文模式）
  const textWithImagePlaceholders = buildTextWithImagePlaceholders();

  const content = {
    title: document.getElementById('articleTitle').value,
    body: quillEditor.root.innerHTML,
    text: quillEditor.getText().trim(),
    textWithImages: textWithImagePlaceholders, // 带图片占位符的文本
    cover: document.getElementById('coverImage').src,
    // 从 currentArticle 或编辑器中提取图片 URL
    imageUrls: extractImageUrls(),
    // 获取发布模式
    publishMode: document.querySelector('input[name="publishMode"]:checked')?.value || 'upload'
  };

  console.log('[同步] 图片数量:', content.imageUrls.length);
  console.log('[同步] 发布模式:', content.publishMode);

  if (!content.text) {
    showToast('请先输入或导入内容', 'warning');
    return;
  }

  // 检查是否使用 Playwright 模式
  const usePlaywright = document.getElementById('usePlaywright')?.checked;

  if (usePlaywright && platforms.includes('xiaohongshu')) {
    // Playwright 模式同步小红书
    await syncWithPlaywright('xiaohongshu', content);
    // 移除小红书，其他平台用传统方式
    const otherPlatforms = platforms.filter(p => p !== 'xiaohongshu');
    if (otherPlatforms.length > 0) {
      await syncTraditional(otherPlatforms, content);
    }
  } else {
    // 传统方式同步所有平台
    await syncTraditional(platforms, content);
  }
}

// Playwright 同步（带图片上传）
async function syncWithPlaywright(platform, content) {
  isSyncing = true;
  setSyncLoading(true, 1);
  showToast(`正在启动浏览器同步到${PLATFORMS[platform]?.name || platform}...`, 'info');

  // 调试：输出传递的内容
  console.log('[Playwright] 同步内容:', {
    platform,
    title: content.title,
    textLength: content.text?.length,
    imageUrls: content.imageUrls,
    imageCount: content.imageUrls?.length
  });

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'playwrightSync',
      platform: platform,
      content: content
    });

    if (response.success) {
      // 异步模式：浏览器已启动，用户需要在浏览器窗口中操作
      showToast(`${PLATFORMS[platform]?.name}：${response.message}`, 'success');
      console.log('[Playwright] 浏览器已启动，请在打开的窗口中完成操作');
    } else {
      throw new Error(response.error || '同步失败');
    }
  } catch (error) {
    console.error('Playwright 同步失败:', error);
    showToast(`Playwright 同步失败: ${error.message}`, 'error');

    // 提示用户启动服务
    if (error.message.includes('未启动') || error.message.includes('Failed to fetch')) {
      showToast('请先在终端启动服务: npm run playwright-server', 'warning');
    }
  } finally {
    isSyncing = false;
    setSyncLoading(false);
  }
}

// 传统方式同步（打开标签页）
async function syncTraditional(platforms, content) {
  isSyncing = true;
  setSyncLoading(true, platforms.length);
  showToast(`开始同步到 ${platforms.length} 个平台...`, 'success');

  try {
    for (const platform of platforms) {
      try {
        await chrome.runtime.sendMessage({
          action: 'openPublishPage',
          platform: platform,
          content: content
        });
        await sleep(500);
      } catch (error) {
        console.error(`同步到 ${platform} 失败:`, error);
      }
    }
    showToast(`已打开 ${platforms.length} 个平台发布页面`, 'success');
  } finally {
    isSyncing = false;
    setSyncLoading(false);
  }
}

// 检查 Playwright 服务状态
async function checkPlaywrightService() {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'checkPlaywrightEnv'
    });

    playwrightAvailable = response.success && response.result?.available;

    updatePlaywrightUI();
  } catch (error) {
    console.log('Playwright 服务检查失败:', error.message);
    playwrightAvailable = false;
    updatePlaywrightUI();
  }
}

// 更新 Playwright 相关 UI
function updatePlaywrightUI() {
  const statusEl = document.getElementById('playwrightStatus');
  const checkboxEl = document.getElementById('usePlaywright');
  const publishModeOption = document.getElementById('publishModeOption');

  if (statusEl) {
    if (playwrightAvailable) {
      statusEl.textContent = 'Playwright 服务已就绪';
      statusEl.className = 'playwright-status online';
    } else {
      statusEl.textContent = 'Playwright 服务未启动';
      statusEl.className = 'playwright-status offline';
    }
  }

  if (checkboxEl) {
    checkboxEl.disabled = !playwrightAvailable;
  }

  // 更新发布模式选项的显示
  updatePublishModeVisibility();
}

// 更新发布模式选项的可见性
function updatePublishModeVisibility() {
  const publishModeOption = document.getElementById('publishModeOption');
  const usePlaywright = document.getElementById('usePlaywright')?.checked;

  // 检查小红书是否被选中
  const xiaohongshuCheckbox = document.querySelector('input[name="platform"][value="xiaohongshu"]');
  const xiaohongshuSelected = xiaohongshuCheckbox?.checked;

  if (publishModeOption) {
    // 只有当 Playwright 可用、已启用、且选择了小红书时才显示
    if (playwrightAvailable && usePlaywright && xiaohongshuSelected) {
      publishModeOption.style.display = 'flex';
    } else {
      publishModeOption.style.display = 'none';
    }
  }
}

// 从编辑器和 currentArticle 提取图片 URL
function extractImageUrls() {
  const urls = [];

  // 1. 从 currentArticle 获取
  if (currentArticle && Array.isArray(currentArticle.imageUrls)) {
    urls.push(...currentArticle.imageUrls);
  }

  // 2. 从编辑器中的 img 标签提取
  if (quillEditor) {
    const imgs = quillEditor.root.querySelectorAll('img');
    imgs.forEach(img => {
      const src = img.getAttribute('src') ||
                  img.getAttribute('data-original-src') ||
                  img.getAttribute('data-src') ||
                  img.getAttribute('data-img-src');
      if (src && !src.startsWith('data:') && !urls.includes(src)) {
        urls.push(src);
      }
    });
  }

  // 3. 从正文 HTML 中用正则提取
  if (quillEditor) {
    const html = quillEditor.root.innerHTML;
    const imgRegex = /(?:src|data-original-src|data-src)=["']([^"']+(?:mmbiz\.qpic\.cn|qpic\.cn)[^"']*)["']/gi;
    let match;
    while ((match = imgRegex.exec(html)) !== null) {
      const url = match[1].replace(/&amp;/g, '&');
      if (url && !urls.includes(url)) {
        urls.push(url);
      }
    }
  }

  return [...new Set(urls)]; // 去重
}

// 清空内容
function clearContent() {
  if (confirm('确定要清空所有内容吗？')) {
    quillEditor.setText('');
    document.getElementById('articleTitle').value = '';
    document.getElementById('articleMeta').style.display = 'none';
    document.getElementById('wechatUrl').value = '';
    currentArticle = null;
    chrome.storage.local.remove('savedContent');
    showToast('内容已清空', 'success');
    updateSyncButton();
  }
}

// 格式化内容
function formatContent() {
  const text = quillEditor.getText().trim();
  if (!text) {
    showToast('没有内容可以格式化', 'warning');
    return;
  }
  applyAutoTypesetting(true);
}

// 更换封面
function changeCover() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';

  input.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        document.getElementById('coverImage').src = e.target.result;
        showToast('封面已更新', 'success');
      };
      reader.readAsDataURL(file);
    }
  };

  input.click();
}

// 保存内容到本地存储
function saveContent() {
  const content = {
    title: document.getElementById('articleTitle').value,
    body: quillEditor.root.innerHTML,
    timestamp: Date.now()
  };
  chrome.storage.local.set({ savedContent: content });
}

// 加载保存的内容
function loadSavedContent() {
  chrome.storage.local.get(['savedContent'], (result) => {
    if (result.savedContent) {
      const { title, body } = result.savedContent;
      if (body) {
        document.getElementById('articleMeta').style.display = 'block';
        document.getElementById('articleTitle').value = title || '';
        setEditorHtml(body);
        updateWordCount();
        updateSyncButton();
      }
    }
  });
}

// 显示/隐藏加载状态
function showLoading(show) {
  document.getElementById('loading').style.display = show ? 'flex' : 'none';
  setFetchLoading(show);
}

function setFetchLoading(show) {
  const btn = document.getElementById('fetchBtn');
  if (!btn) return;
  btn.disabled = show;
  btn.classList.toggle('is-loading', show);
  btn.innerHTML = show
    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin-icon">
         <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
         <path d="M22 12a10 10 0 0 1-10 10"></path>
       </svg> 获取中...`
    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
         <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
         <polyline points="7 10 12 15 17 10"></polyline>
         <line x1="12" y1="15" x2="12" y2="3"></line>
       </svg> 获取内容`;
}

function setSyncLoading(show, count = 0) {
  const btn = document.getElementById('syncBtn');
  if (!btn) return;
  btn.classList.toggle('is-loading', show);
  if (show) {
    btn.disabled = true;
    btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin-icon">
        <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
        <path d="M22 12a10 10 0 0 1-10 10"></path>
      </svg> 正在同步 ${count} 个平台...`;
    return;
  }

  btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
    </svg> 开始同步分发`;
  updateSyncButton();
}

// 显示提示
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// 延迟函数
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
