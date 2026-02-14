// Background Service Worker

// 点击扩展图标时打开独立页面
chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.create({
    url: chrome.runtime.getURL('pages/distributor.html')
  });
});

// 监听来自content script和页面的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchWechatArticle') {
    fetchWechatArticle(request.url)
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // 保持消息通道开启
  }

  if (request.action === 'syncToPlatform') {
    syncToPlatform(request.platform, request.content)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'openPublishPage') {
    openPublishPage(request.platform, request.content);
    sendResponse({ success: true });
    return true;
  }

  // Playwright 同步（带图片上传）
  if (request.action === 'playwrightSync') {
    playwrightSync(request.platform, request.content)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // 检查 Playwright 环境
  if (request.action === 'checkPlaywrightEnv') {
    checkPlaywrightEnv()
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// 获取微信公众号文章内容
async function fetchWechatArticle(url) {
  console.log('开始获取文章:', url);

  let tab = null;

  try {
    // 创建隐藏标签页
    tab = await chrome.tabs.create({ url, active: false });
    console.log('创建标签页:', tab.id);

    // 等待页面加载完成
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('页面加载超时'));
      }, 30000);

      const onUpdated = (tabId, changeInfo) => {
        if (tabId === tab.id) {
          console.log('标签页状态变化:', changeInfo.status);
          if (changeInfo.status === 'complete') {
            clearTimeout(timeout);
            chrome.tabs.onUpdated.removeListener(onUpdated);
            resolve();
          } else if (changeInfo.status === 'loading') {
            // 页面开始加载
            console.log('页面开始加载...');
          }
        }
      };

      chrome.tabs.onUpdated.addListener(onUpdated);
    });

    console.log('页面加载完成，等待内容渲染...');

    // 额外等待确保内容渲染
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 检查标签页是否还存在
    try {
      await chrome.tabs.get(tab.id);
    } catch (e) {
      throw new Error('标签页已被关闭');
    }

    console.log('开始执行提取脚本...');

    // 执行提取脚本
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractWechatContent,
    });

    console.log('脚本执行完成，结果:', results);

    // 关闭标签页
    try {
      await chrome.tabs.remove(tab.id);
      console.log('标签页已关闭');
    } catch (e) {
      console.warn('关闭标签页失败:', e.message);
    }

    if (results && results[0] && results[0].result) {
      const article = await hydrateWechatImages(results[0].result);
      console.log('提取成功:', article.title, article.textContent?.length, '字符');
      return article;
    } else {
      throw new Error('无法提取文章内容 - 脚本返回空结果');
    }

  } catch (error) {
    console.error('获取文章失败:', error);

    // 确保关闭标签页
    if (tab) {
      try {
        await chrome.tabs.remove(tab.id);
      } catch (e) {
        // 标签页可能已经关闭
      }
    }

    throw new Error('获取文章失败: ' + error.message);
  }
}

async function hydrateWechatImages(article) {
  if (!article || !article.content) {
    return article;
  }

  const originalUrls = Array.isArray(article.imageUrls) ? article.imageUrls : [];
  if (!originalUrls.length) {
    return article;
  }

  const uniqueUrls = [...new Set(originalUrls.map(url => String(url || '').trim()).filter(Boolean))];
  const imageMap = new Map();

  for (const originalUrl of uniqueUrls) {
    try {
      const dataUrl = await fetchImageAsDataUrl(originalUrl);
      if (dataUrl) {
        imageMap.set(originalUrl, dataUrl);
      }
    } catch (error) {
      console.warn('图片转换失败:', originalUrl, error.message);
    }
  }

  if (!imageMap.size) {
    article.unresolvedImageUrls = uniqueUrls;
    return article;
  }

  const unresolvedUrls = uniqueUrls.filter(url => !imageMap.has(url));
  article.content = replaceImageSources(article.content, imageMap);
  article.cover = imageMap.get(article.cover) || article.cover;
  article.imageUrls = originalUrls;
  article.unresolvedImageUrls = unresolvedUrls;
  article.resolvedImageCount = imageMap.size;
  return article;
}

async function fetchImageAsDataUrl(originalUrl) {
  const candidates = normalizeWechatImageCandidates(originalUrl);

  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate, {
        method: 'GET',
        redirect: 'follow',
        credentials: 'omit',
        referrer: 'https://mp.weixin.qq.com/'
      });

      if (!response.ok) {
        continue;
      }

      const blob = await response.blob();
      const mimeType = blob.type || guessMimeTypeFromUrl(candidate) || 'image/jpeg';

      if (!mimeType.startsWith('image/')) {
        continue;
      }

      return await blobToDataUrl(blob, mimeType);
    } catch (error) {
      console.warn('拉取图片失败:', candidate, error.message);
    }
  }

  return null;
}

function normalizeWechatImageCandidates(url) {
  const source = String(url || '').trim();
  if (!source) return [];

  const decoded = source.replace(/&amp;/g, '&');
  const withoutProtocol = decoded.replace(/^\/\//, 'https://');
  const httpsUrl = withoutProtocol.replace(/^http:\/\//i, 'https://');

  return [...new Set([source, decoded, withoutProtocol, httpsUrl].filter(Boolean))];
}

function guessMimeTypeFromUrl(url) {
  const lower = String(url || '').toLowerCase();
  if (lower.includes('.png')) return 'image/png';
  if (lower.includes('.gif')) return 'image/gif';
  if (lower.includes('.webp')) return 'image/webp';
  return 'image/jpeg';
}

async function blobToDataUrl(blob, mimeType) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  const base64 = btoa(binary);
  return `data:${mimeType};base64,${base64}`;
}

function replaceImageSources(html, imageMap) {
  if (!html || !imageMap.size) return html;

  const readCandidatesFromImgTag = (imgTag) => {
    const attrRegex = /(src|data-src|data-original-src|data-img-src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
    const candidates = [];
    let match;
    while ((match = attrRegex.exec(imgTag)) !== null) {
      const value = match[2] || match[3] || match[4] || '';
      if (value) candidates.push(value);
    }
    return candidates;
  };

  return html.replace(/<img\b[^>]*>/gi, (imgTag) => {
    const candidates = readCandidatesFromImgTag(imgTag);

    let matchedOriginal = null;
    let matchedKey = null;

    for (const candidate of candidates) {
      const normalized = normalizeWechatImageCandidates(candidate);
      const hit = normalized.find(item => imageMap.has(item));
      if (hit) {
        matchedOriginal = candidate;
        matchedKey = hit;
        break;
      }
    }

    if (!matchedKey) {
      return imgTag;
    }

    const dataUrl = imageMap.get(matchedKey);
    let updated = imgTag;
    if (/\bsrc\s*=\s*(['"]).*?\1/i.test(updated)) {
      updated = updated.replace(/\bsrc\s*=\s*(['"]).*?\1/i, `src="${dataUrl}"`);
    } else {
      updated = updated.replace(/<img/i, `<img src="${dataUrl}"`);
    }

    if (!/\bdata-original-src\s*=/i.test(updated)) {
      updated = updated.replace(/<img/i, `<img data-original-src="${matchedOriginal}"`);
    }

    updated = updated.replace(/\sdata-src\s*=\s*(['"]).*?\1/gi, '');
    updated = updated.replace(/\sdata-img-src\s*=\s*(['"]).*?\1/gi, '');
    return updated;
  });
}

// 在微信页面中执行的提取函数
async function extractWechatContent() {
  console.log('开始提取微信文章内容...');

  const article = {
    title: '',
    cover: '',
    content: '',
    author: '',
    publishTime: '',
    textContent: '',
    imageUrls: [],
    imageCount: 0
  };

  // 注意：该函数运行在目标页面上下文，必须自包含，不能依赖外部函数
  const localStripHtml = (html) => String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const localEscapeHtml = (text) => String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const localBuildParagraphHtml = (text) => String(text || '')
    .split(/\n{2,}/)
    .map(block => block.trim())
    .filter(Boolean)
    .map(block => `<p>${localEscapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('');

  const localIsVideoNoiseLine = (line) => {
    const text = String(line || '').replace(/\s+/g, ' ').trim();
    if (!text) return true;
    const noisePatterns = [
      /^已关注$/i,
      /^follow$/i,
      /^replay$/i,
      /^share$/i,
      /^like$/i,
      /^close$/i,
      /^play$/i,
      /^倍速$/i,
      /^继续观看$/i,
      /^观看更多$/i,
      /^转载$/i,
      /^全屏$/i,
      /^退出全屏$/i,
      /^切换到[横竖]屏.*$/i,
      /^0\/0$/,
      /^\d{2}:\d{2}\s*\/\s*\d{2}:\d{2}$/,
      /^时长\d{2}:\d{2}$/i,
      /^0\.\d+倍$/,
      /^\d+\.\d+倍$/,
      /^超清$/,
      /^流畅$/,
      /^share video$/i,
      /^enter comment$/i,
      /^wowadded to top stories$/i,
      /^added to top stories$/i,
      /^continue watching$/i
    ];

    if (noisePatterns.some((re) => re.test(text))) return true;

    if (/^(更多|退出全屏|继续播放进度条|倍速播放中)/.test(text)) return true;
    if (/^(已关注|Follow|Replay|Share|Like|Close|Play)/i.test(text)) return true;
    if (/^00:00\s*\/\s*01:05$/i.test(text)) return true;
    if (/^0\/\d+$/.test(text)) return true;
    if (/^[\d:\s/]+$/.test(text) && text.length <= 16) return true;
    if (/^(观看|继续观看|切换到|退出全屏|全屏|倍速|超清|流畅)/.test(text)) return true;

    return false;
  };

  const localRemoveVideoNoiseElements = (rootEl) => {
    if (!rootEl) return 0;
    let removedCount = 0;
    const candidates = rootEl.querySelectorAll('p,span,div,section,li,a,button,strong,em');

    candidates.forEach((node) => {
      if (!node || !node.parentElement) return;
      if (node.querySelector('img')) return;

      const text = (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text) return;

      const shortAndNoisy = text.length <= 80 && localIsVideoNoiseLine(text);
      const containsControlWords = /(已关注|Follow|Replay|Share|Like|Close|Play|观看更多|继续观看|退出全屏|倍速播放中)/i.test(text);

      if (shortAndNoisy || containsControlWords) {
        node.remove();
        removedCount += 1;
      }
    });

    return removedCount;
  };

  const localFilterVideoNoiseText = (text) => String(text || '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => !localIsVideoNoiseLine(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const localCollectImageUrlsFromHtml = (html) => {
    const urls = [];
    if (!html) return urls;
    const re = /https?:\/\/[^"'()\s<>]*?(?:mmbiz\.qpic\.cn|qpic\.cn)[^"'()\s<>]*/gi;
    let match;
    while ((match = re.exec(html)) !== null) {
      urls.push(match[0].replace(/&amp;/g, '&'));
    }
    return [...new Set(urls)];
  };

  const localBuildRichHtmlFromBlocks = (rootEl) => {
    if (!rootEl) return '';
    const blocks = Array.from(rootEl.querySelectorAll('h1,h2,h3,h4,h5,h6,p,section,blockquote,pre,ul,ol,li'));
    if (!blocks.length) return rootEl.innerHTML || '';

    const htmlBlocks = [];
    blocks.forEach((node) => {
      const text = (node.innerText || node.textContent || '').trim();
      const hasImage = !!node.querySelector('img');
      if (!text && !hasImage) return;
      if (!hasImage && localIsVideoNoiseLine(text)) return;

      const tag = node.tagName.toLowerCase();
      if (tag === 'li') {
        htmlBlocks.push(`<p>• ${node.innerHTML}</p>`);
        return;
      }
      htmlBlocks.push(`<${tag}>${node.innerHTML}</${tag}>`);
    });

    return htmlBlocks.join('');
  };

  try {
    // 等待正文渲染，避免拿到空壳 DOM
    const waitStart = Date.now();
    const waitTimeout = 12000;
    while (Date.now() - waitStart < waitTimeout) {
      const candidate = document.querySelector('#js_content, .rich_media_content, #img-content');
      const textLen = candidate?.textContent?.trim()?.length || 0;
      const imageLen = candidate?.querySelectorAll?.('img')?.length || 0;
      if (textLen > 20 || imageLen > 0) {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // 提取标题
    const titleEl = document.querySelector('#activity-name') ||
                    document.querySelector('.rich_media_title') ||
                    document.querySelector('h1.rich_media_title') ||
                    document.querySelector('h1');
    if (titleEl) {
      article.title = titleEl.textContent.trim();
      console.log('标题:', article.title);
    } else {
      console.warn('未找到标题元素');
    }

    // 提取封面图
    const coverEl = document.querySelector('.rich_media_thumb') ||
                    document.querySelector('meta[property="og:image"]');
    if (coverEl) {
      article.cover = coverEl.src || coverEl.content || '';
      console.log('封面:', article.cover ? '已找到' : '未找到');
    }

    // 提取作者
    const authorEl = document.querySelector('#js_name') ||
                     document.querySelector('.rich_media_meta_nickname') ||
                     document.querySelector('.rich_media_meta_text');
    if (authorEl) {
      article.author = authorEl.textContent.trim();
      console.log('作者:', article.author);
    }

    // 提取发布时间
    const timeEl = document.querySelector('#publish_time') ||
                   document.querySelector('.rich_media_meta_date');
    if (timeEl) {
      article.publishTime = timeEl.textContent.trim();
    }

    // 提取正文内容（保留格式）
    const contentEl = document.querySelector('#js_content') ||
                      document.querySelector('.rich_media_content') ||
                      document.querySelector('#img-content') ||
                      document.querySelector('article');

    if (contentEl) {
      console.log('找到内容元素，开始处理...');

      // 克隆内容元素以避免修改原始DOM
      const clonedContent = contentEl.cloneNode(true);

      // 处理图片
      const images = clonedContent.querySelectorAll('img');
      console.log('找到图片数量:', images.length);

      images.forEach((img) => {
        // 获取图片URL（兼容微信懒加载）
        const imgSrc = img.getAttribute('data-src') ||
                      img.getAttribute('data-original') ||
                      img.getAttribute('data-original-src') ||
                      img.getAttribute('src') ||
                      img.currentSrc;
        if (imgSrc) {
          const normalized = imgSrc.replace(/^\/\//, 'https://').replace(/^http:\/\//i, 'https://').replace(/&amp;/g, '&');
          article.imageUrls.push(normalized);
          img.setAttribute('src', normalized);
          img.setAttribute('data-original-src', normalized);
        }
      });

      // 移除视频元素（通常有防盗链）
      const videos = clonedContent.querySelectorAll('video');
      console.log('移除视频数量:', videos.length);
      videos.forEach(video => video.remove());

      // 清理视频播放器/浮层等噪音节点
      const videoNoiseSelectors = [
        'iframe[src*="v.qq.com"]',
        'iframe[src*="video"]',
        '.js_tx_video_container',
        '.js_video_channel_container',
        '.txp_player_container',
        '.txp_video_container',
        '[class*="video-player"]',
        '[class*="videoPlayer"]',
        '[class*="txp"]',
        '[id*="txp"]',
        '.qqmusic_iframe',
        '.js_wechat_video',
        '.wx_video_context',
        '.wx_video_play_area'
      ];
      const videoNoiseNodes = clonedContent.querySelectorAll(videoNoiseSelectors.join(','));
      console.log('移除视频噪音节点数量:', videoNoiseNodes.length);
      videoNoiseNodes.forEach(node => node.remove());

      const removedByTextNoise = localRemoveVideoNoiseElements(clonedContent);
      console.log('按文本规则移除噪音节点数量:', removedByTextNoise);

      // 清理干扰节点
      clonedContent.querySelectorAll('script, style, .original_primary_card_tips').forEach(node => node.remove());
      // 清理明显隐藏节点，避免拿到“存在但不可见”的空内容
      clonedContent.querySelectorAll('[style*="display:none"], [style*="visibility:hidden"], .dn, .hidden').forEach(node => node.remove());

      // 获取HTML内容（优先保留块级结构）
      article.content = localBuildRichHtmlFromBlocks(clonedContent) || clonedContent.innerHTML;

      // 同时获取纯文本（用于平台字数限制计算），innerText能保留更多换行
      article.textContent = localFilterVideoNoiseText(clonedContent.innerText || clonedContent.textContent || '');
      article.imageCount = article.imageUrls.length;

      // 如果DOM图片没提到，尝试从HTML字符串中补提 URL
      if (article.imageUrls.length === 0) {
        const htmlImageUrls = localCollectImageUrlsFromHtml(clonedContent.innerHTML);
        if (htmlImageUrls.length > 0) {
          article.imageUrls.push(...htmlImageUrls);
          article.imageCount = article.imageUrls.length;
        }
      }

      console.log('内容长度:', article.textContent.length, '字符');
      console.log('图片数量:', article.imageCount);
    } else {
      console.error('未找到内容元素！尝试其他选择器...');

      // 尝试更多兜底
      const fallbackEl = document.querySelector('article') || document.querySelector('main') || document.body;
      const fallbackHtml = fallbackEl?.innerHTML || '';
      const fallbackText = localFilterVideoNoiseText(fallbackEl?.innerText || fallbackEl?.textContent || '');
      article.content = fallbackHtml ? `<div>${fallbackHtml}</div>` : '<p>未提取到正文</p>';
      article.textContent = fallbackText.substring(0, 12000);
    }

    article.imageUrls = [...new Set(article.imageUrls)];
    article.imageCount = article.imageUrls.length;

    // 如果 HTML 内容几乎为空，但有文本，则按段落重建可见内容
    if ((!article.content || localStripHtml(article.content).length < 10) && article.textContent) {
      article.content = localBuildParagraphHtml(article.textContent);
    }

    if (!article.textContent || article.textContent.length < 10) {
      const metaDesc = document.querySelector('meta[property="og:description"]')?.content ||
                      document.querySelector('meta[name="description"]')?.content ||
                      '';
      if (metaDesc) {
        article.textContent = localFilterVideoNoiseText(metaDesc.trim());
        if (!article.content || article.content === '<p>未提取到正文</p>') {
          article.content = `<p>${localEscapeHtml(article.textContent)}</p>`;
        }
      }
    }

    console.log('提取完成:', article.title, article.textContent.length, '字符');

  } catch (error) {
    console.error('提取过程出错:', error);
    // 出错时至少兜底返回可用文本，避免编辑区空白
    const fallbackText = localFilterVideoNoiseText(document.body?.innerText || document.body?.textContent || '');
    article.textContent = fallbackText.substring(0, 12000);
    article.content = article.textContent
      ? localBuildParagraphHtml(article.textContent)
      : '<p>提取失败: ' + error.message + '</p>';
  }

  return article;
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildParagraphHtml(text) {
  return String(text || '')
    .split(/\n{2,}/)
    .map(block => block.trim())
    .filter(Boolean)
    .map(block => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function collectImageUrlsFromHtml(html) {
  const urls = [];
  if (!html) return urls;
  const re = /https?:\/\/[^"'()\s<>]*?(?:mmbiz\.qpic\.cn|qpic\.cn)[^"'()\s<>]*/gi;
  let match;
  while ((match = re.exec(html)) !== null) {
    urls.push(match[0].replace(/&amp;/g, '&'));
  }
  return [...new Set(urls)];
}

function buildRichHtmlFromBlocks(rootEl) {
  if (!rootEl) return '';
  const blocks = Array.from(rootEl.querySelectorAll('h1,h2,h3,h4,h5,h6,p,section,blockquote,pre,ul,ol,li'));
  if (!blocks.length) return rootEl.innerHTML || '';

  const htmlBlocks = [];
  blocks.forEach((node) => {
    const text = (node.innerText || node.textContent || '').trim();
    const hasImage = !!node.querySelector('img');
    if (!text && !hasImage) return;

    const tag = node.tagName.toLowerCase();
    if (tag === 'li') {
      htmlBlocks.push(`<p>• ${node.innerHTML}</p>`);
      return;
    }
    htmlBlocks.push(`<${tag}>${node.innerHTML}</${tag}>`);
  });

  return htmlBlocks.join('');
}

// 打开目标平台发布页面
async function openPublishPage(platform, content) {
  const platformUrls = {
    xiaohongshu: 'https://creator.xiaohongshu.com/publish/publish?from=tab_switch&target=article',
    zhihu: 'https://zhuanlan.zhihu.com/write',
    jianshu: 'https://www.jianshu.com/writer',
    toutiao: 'https://mp.toutiao.com/profile_v4/index/creation',
    bilibili: 'https://member.bilibili.com/platform/article/text/new'
  };

  const url = platformUrls[platform];
  if (!url) {
    throw new Error('不支持的平台: ' + platform);
  }

  // 存储内容供content script使用
  await chrome.storage.local.set({
    pendingContent: {
      platform,
      content,
      timestamp: Date.now()
    }
  });

  // 创建新标签页（先写入再打开，避免内容脚本读取竞态）
  const tab = await chrome.tabs.create({ url });

  return { tabId: tab.id };
}

// 同步到平台的处理函数
async function syncToPlatform(platform, content) {
  // 这个函数主要用于后续可能的API同步
  // 目前主要使用openPublishPage
  return { status: 'ready', platform };
}

// Playwright 同步（带图片上传）
async function playwrightSync(platform, content) {
  console.log('[Playwright] 开始同步到:', platform);

  // 目前仅支持小红书
  if (platform !== 'xiaohongshu') {
    throw new Error('Playwright 同步目前仅支持小红书平台');
  }

  // 使用 Native Messaging 启动外部 Node.js 脚本
  // 由于 Chrome Extension 无法直接运行 Node.js
  // 我们采用本地 HTTP 服务方式通信

  try {
    const response = await fetch('http://127.0.0.1:3456/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        platform: platform,
        content: {
          title: content.title,
          body: content.body,
          text: content.text,
          textWithImages: content.textWithImages || '',
          imageUrls: content.imageUrls || [],
          publishMode: content.publishMode || 'upload'
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    console.log('[Playwright] 同步结果:', result);
    return result;

  } catch (error) {
    console.error('[Playwright] 同步失败:', error);
    throw new Error('Playwright 服务未启动，请先运行: npm run playwright-server');
  }
}

// 检查 Playwright 环境
async function checkPlaywrightEnv() {
  try {
    const response = await fetch('http://127.0.0.1:3456/health', {
      method: 'GET',
      timeout: 3000
    });

    if (response.ok) {
      const result = await response.json();
      return { available: true, ...result };
    }

    return { available: false, reason: 'Service not responding' };
  } catch (error) {
    return { available: false, reason: error.message };
  }
}
