// 小红书自动填充脚本（增强版）

(function() {
  console.log('[XHS] 内容填充脚本已加载:', location.href);
  let lastHandledTimestamp = 0;

  const TITLE_SELECTORS = [
    'input[placeholder*="标题"]',
    'textarea[placeholder*="标题"]',
    'input[placeholder*="请输入标题"]',
    '.title-input input',
    '.c-input__inner',
    '[data-testid*="title"] input',
    '[class*="title"] input'
  ];

  const EDITOR_SELECTORS = [
    '[contenteditable="true"][role="textbox"]',
    '[contenteditable="true"]',
    '.ql-editor',
    '.DraftEditor-root [contenteditable="true"]',
    '.editor-content',
    '.draft-editor',
    'textarea[placeholder*="正文"]'
  ];

  // 监听来自页面消息（保留兼容）
  window.addEventListener('message', async (event) => {
    if (event.source !== window) return;
    const { type, content } = event.data || {};
    if (type !== 'FILL_XIAOHONGSHU_CONTENT' || !content) return;

    await waitForPageReady();
    await fillXiaohongshuContent(content);
  });

  // 从 storage 读取并消费待填充内容（处理首次加载 + 更新竞态）
  chrome.storage.local.get(['pendingContent'], async (result) => {
    await tryConsumePending(result.pendingContent, 'initial-get');
  });

  // 监听后续更新，防止“页面先加载，数据后写入”导致错过
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== 'local' || !changes.pendingContent) return;
    const next = changes.pendingContent.newValue;
    await tryConsumePending(next, 'storage-changed');
  });

  async function waitForPageReady() {
    if (document.readyState !== 'complete') {
      await new Promise((resolve) => window.addEventListener('load', resolve, { once: true }));
    }
    await sleep(1200);
  }

  async function fillXiaohongshuContent(content) {
    const title = String(content?.title || '').trim();
    const html = String(content?.body || '');
    const text = String(content?.text || '').trim();
    const plainText = normalizePlainText(extractPlainText(html) || text);
    const richHtml = buildRichHtmlForXhs(html, plainText);
    const imageUrls = extractImageUrlsFromHtml(html);

    try {
      console.log('[XHS] 开始填充，正文长度:', plainText.length, '图片数:', imageUrls.length);
      const titleInput = await waitForFirst(TITLE_SELECTORS, 25000);
      setNativeInputValue(titleInput, title);
      titleInput.dispatchEvent(new Event('input', { bubbles: true }));
      titleInput.dispatchEvent(new Event('change', { bubbles: true }));
      titleInput.blur();
      console.log('[XHS] 标题已填充');

      const editor = await waitForEditor(EDITOR_SELECTORS, 25000);
      await fillEditor(editor, { plainText, richHtml, imageUrls });
      console.log('[XHS] 正文已填充, length=', plainText.length);

      showNotification('内容已自动填充，请检查并发布');
    } catch (error) {
      console.error('[XHS] 填充失败:', error);
      showNotification(`自动填充失败：${error.message}`, 'error');
    }
  }

  async function tryConsumePending(pending, source) {
    if (!pending) return;

    const { platform, content, timestamp } = pending;
    const isRecent = Date.now() - timestamp < 5 * 60 * 1000;
    if (platform !== 'xiaohongshu' || !isRecent) return;
    if (!timestamp || timestamp <= lastHandledTimestamp) return;

    lastHandledTimestamp = timestamp;
    console.log('[XHS] 命中待填充数据:', { source, timestamp });

    await waitForPageReady();
    await fillXiaohongshuContent(content);

    // 仅在当前消息仍是同一条时删除，避免并发覆盖
    chrome.storage.local.get(['pendingContent'], (result) => {
      const current = result.pendingContent;
      if (current && current.timestamp === timestamp && current.platform === 'xiaohongshu') {
        chrome.storage.local.remove('pendingContent');
      }
    });
  }

  async function fillEditor(editor, payload) {
    const text = payload?.plainText || '';
    const richHtml = payload?.richHtml || '';
    const imageUrls = Array.isArray(payload?.imageUrls) ? payload.imageUrls : [];
    if (!editor) throw new Error('未找到正文编辑器');
    if (!text) throw new Error('正文为空');

    editor.focus();
    await sleep(120);

    // contenteditable 编辑器优先
    if (editor.isContentEditable || editor.getAttribute('contenteditable') === 'true') {
      clearEditable(editor);
      let inserted = false;

      // 长文页优先尝试富文本（保留段落/列表/引用/链接，图片尽量插入）
      if (richHtml) {
        try {
          inserted = document.execCommand('insertHTML', false, richHtml);
        } catch (e) {
          inserted = false;
        }
      }

      // 回退纯文本
      if (!inserted) {
        const ok = document.execCommand('insertText', false, text);
        if (!ok) {
          editor.innerText = text;
        }
      }

      editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
      editor.dispatchEvent(new Event('change', { bubbles: true }));

      // 填充校验：防止命中到错误可编辑节点后正文仍为空
      if (getEditorText(editor).length < Math.min(20, text.length)) {
        editor.innerText = text;
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        editor.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // 若编辑器吞掉了图片节点，补充图片链接列表，避免图片信息丢失
      if (imageUrls.length > 0) {
        const imgCount = editor.querySelectorAll('img').length;
        if (imgCount === 0) {
          const linkText = '\n\n图片链接：\n' + imageUrls.map((url, idx) => `${idx + 1}. ${url}`).join('\n');
          const ok = document.execCommand('insertText', false, linkText);
          if (!ok) editor.textContent += linkText;
          editor.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
      return;
    }

    // textarea/input 回退
    if (editor.tagName === 'TEXTAREA' || editor.tagName === 'INPUT') {
      setNativeInputValue(editor, text);
      editor.dispatchEvent(new Event('input', { bubbles: true }));
      editor.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    // 最终兜底
    editor.textContent = text;
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function clearEditable(el) {
    try {
      el.innerHTML = '';
      el.innerText = '';
    } catch (e) {
      el.textContent = '';
    }
  }

  function setNativeInputValue(element, value) {
    const proto = element.tagName === 'TEXTAREA'
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
    if (descriptor && descriptor.set) {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
    }
  }

  function normalizePlainText(text) {
    return String(text || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function extractPlainText(html) {
    if (!html) return '';
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.innerText || div.textContent || '';
  }

  function buildRichHtmlForXhs(html, plainText) {
    if (!html) {
      return toParagraphHtml(plainText);
    }

    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;

    // 清理风险节点与多余属性
    wrapper.querySelectorAll('script,style,iframe,video').forEach(node => node.remove());
    wrapper.querySelectorAll('*').forEach((node) => {
      [...node.attributes].forEach((attr) => {
        const name = attr.name.toLowerCase();
        if (name.startsWith('on') || name.startsWith('data-') || name === 'class' || name === 'style' || name === 'id') {
          node.removeAttribute(attr.name);
        }
      });
    });

    // 处理图片：优先尝试 <img>，同时追加链接兜底，避免“完全没有图片信息”
    wrapper.querySelectorAll('img').forEach((img) => {
      const src = img.getAttribute('src') || img.getAttribute('data-original-src') || '';
      if (!src) {
        img.remove();
        return;
      }
      const block = document.createElement('div');
      block.innerHTML = `
        <p><img src="${escapeHtmlAttr(src)}" alt="image"></p>
        <p>图片链接：<a href="${escapeHtmlAttr(src)}" target="_blank" rel="noopener noreferrer">${escapeHtmlText(src)}</a></p>
      `;
      img.replaceWith(block);
    });

    // 只保留常见排版标签
    const allowed = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'A', 'STRONG', 'EM', 'BR', 'IMG']);
    const walk = (node) => {
      const children = [...node.children];
      children.forEach((child) => {
        walk(child);
        if (!allowed.has(child.tagName)) {
          const fragment = document.createDocumentFragment();
          while (child.firstChild) fragment.appendChild(child.firstChild);
          child.replaceWith(fragment);
        }
      });
    };
    walk(wrapper);

    const result = wrapper.innerHTML.trim();
    return result || toParagraphHtml(plainText);
  }

  function extractImageUrlsFromHtml(html) {
    if (!html) return [];
    const urls = [];
    const div = document.createElement('div');
    div.innerHTML = html;
    div.querySelectorAll('img').forEach((img) => {
      const src = img.getAttribute('src') || img.getAttribute('data-original-src') || '';
      if (src) urls.push(src);
    });
    return [...new Set(urls)];
  }

  function toParagraphHtml(text) {
    return String(text || '')
      .split(/\n{2,}/)
      .map(block => block.trim())
      .filter(Boolean)
      .map(block => `<p>${escapeHtmlText(block).replace(/\n/g, '<br>')}</p>`)
      .join('');
  }

  function escapeHtmlText(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function escapeHtmlAttr(text) {
    return escapeHtmlText(text).replace(/"/g, '&quot;');
  }

  async function waitForFirst(selectors, timeout = 15000) {
    const start = Date.now();
    let logged = false;
    while (Date.now() - start < timeout) {
      for (const selector of selectors) {
        const el = deepQuerySelector(selector);
        if (el && isVisible(el)) {
          return el;
        }
      }
      if (!logged && Date.now() - start > 4000) {
        logged = true;
        console.warn('[XHS] 标题输入框仍未出现，继续等待...');
      }
      await sleep(250);
    }
    throw new Error(`等待标题输入框超时: ${selectors[0]}`);
  }

  async function waitForEditor(selectors, timeout = 20000) {
    const start = Date.now();
    let logged = false;
    while (Date.now() - start < timeout) {
      const candidates = [];
      for (const selector of selectors) {
        const nodes = deepQuerySelectorAll(selector);
        nodes.forEach((node) => {
          if (isVisible(node) && isLikelyBodyEditor(node)) {
            candidates.push(node);
          }
        });
      }

      if (candidates.length > 0) {
        candidates.sort((a, b) => elementScore(b) - elementScore(a));
        console.log('[XHS] 命中正文候选数量:', candidates.length);
        return candidates[0];
      }
      if (!logged && Date.now() - start > 5000) {
        logged = true;
        console.warn('[XHS] 正文编辑器仍未出现，继续等待...');
      }
      await sleep(250);
    }
    throw new Error('等待正文编辑器超时');
  }

  function isLikelyBodyEditor(el) {
    if (!el) return false;
    const placeholder = ((el.getAttribute('placeholder') || el.getAttribute('aria-label') || '') + '').toLowerCase();
    const classText = (el.className || '').toString().toLowerCase();

    const likelyTitle = placeholder.includes('标题') || classText.includes('title');
    const likelySearch = placeholder.includes('搜索') || classText.includes('search');
    if (likelyTitle || likelySearch) return false;

    const rect = el.getBoundingClientRect();
    return rect.height >= 80 || el.isContentEditable;
  }

  function elementScore(el) {
    const rect = el.getBoundingClientRect();
    let score = rect.width * rect.height;
    if (el.isContentEditable) score += 100000;
    const classText = (el.className || '').toString().toLowerCase();
    if (classText.includes('editor')) score += 50000;
    return score;
  }

  function getEditorText(el) {
    return normalizePlainText(el?.innerText || el?.textContent || el?.value || '');
  }

  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    const hasRect = !!(el.getClientRects && el.getClientRects().length > 0);
    return style.display !== 'none' && style.visibility !== 'hidden' && hasRect;
  }

  function deepQuerySelector(selector) {
    const all = deepQuerySelectorAll(selector);
    return all.length ? all[0] : null;
  }

  function deepQuerySelectorAll(selector, root = document) {
    const results = [];
    const stack = [root];
    const visited = new Set();

    while (stack.length) {
      const node = stack.pop();
      if (!node || visited.has(node)) continue;
      visited.add(node);

      try {
        if (node.querySelectorAll) {
          results.push(...node.querySelectorAll(selector));
        }
      } catch (e) {
        // ignore invalid scope
      }

      const children = node.children || [];
      for (const child of children) {
        if (child.shadowRoot) {
          stack.push(child.shadowRoot);
        }
        stack.push(child);
      }
    }

    return [...new Set(results)];
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function showNotification(message, type = 'success') {
    const id = 'xhs-fill-toast';
    const old = document.getElementById(id);
    if (old) old.remove();

    const notification = document.createElement('div');
    notification.id = id;
    notification.style.cssText = `
      position: fixed;
      top: 16px;
      right: 16px;
      padding: 10px 16px;
      background: ${type === 'success' ? '#16a34a' : '#dc2626'};
      color: #fff;
      border-radius: 8px;
      z-index: 99999;
      font-size: 13px;
      box-shadow: 0 8px 20px rgba(0,0,0,0.2);
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 2800);
  }
})();
