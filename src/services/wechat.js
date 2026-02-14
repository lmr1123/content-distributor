/**
 * 微信文章提取服务
 */

import {
  stripHtml,
  escapeHtml,
  buildParagraphHtml,
  filterVideoNoiseText
} from '../utils/html.js';

/**
 * 移除视频噪音 DOM 元素
 */
function removeVideoNoiseElements(rootEl) {
  if (!rootEl) return 0;
  let removedCount = 0;
  const candidates = rootEl.querySelectorAll('p,span,div,section,li,a,button,strong,em');

  candidates.forEach((node) => {
    if (!node || !node.parentElement) return;
    if (node.querySelector('img')) return;

    const text = (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text) return;

    const shortAndNoisy = text.length <= 80 && isVideoNoiseLine(text);
    const containsControlWords = /(已关注|Follow|Replay|Share|Like|Close|Play|观看更多|继续观看|退出全屏|倍速播放中)/i.test(text);

    if (shortAndNoisy || containsControlWords) {
      node.remove();
      removedCount += 1;
    }
  });

  return removedCount;
}

function isVideoNoiseLine(line) {
  const text = String(line || '').replace(/\s+/g, ' ').trim();
  if (!text) return true;
  const noisePatterns = [
    /^已关注$/i, /^follow$/i, /^replay$/i, /^share$/i,
    /^like$/i, /^close$/i, /^play$/i, /^倍速$/i,
    /^继续观看$/i, /^观看更多$/i, /^转载$/i,
    /^全屏$/i, /^退出全屏$/i, /^切换到[横竖]屏.*$/i,
    /^0\/0$/, /^\d{2}:\d{2}\s*\/\s*\d{2}:\d{2}$/,
    /^时长\d{2}:\d{2}$/i, /^0\.\d+倍$/, /^\d+\.\d+倍$/,
    /^超清$/, /^流畅$/, /^share video$/i,
    /^enter comment$/i, /^wowadded to top stories$/i,
    /^added to top stories$/i, /^continue watching$/i
  ];
  if (noisePatterns.some((re) => re.test(text))) return true;
  if (/^(更多|退出全屏|继续播放进度条|倍速播放中)/.test(text)) return true;
  if (/^(已关注|Follow|Replay|Share|Like|Close|Play)/i.test(text)) return true;
  if (/^00:00\s*\/\s*01:05$/i.test(text)) return true;
  if (/^0\/\d+$/.test(text)) return true;
  if (/^[\d:\s/]+$/.test(text) && text.length <= 16) return true;
  return false;
}

/**
 * 从块元素构建富文本 HTML
 */
function buildRichHtmlFromBlocks(rootEl) {
  if (!rootEl) return '';
  const blocks = Array.from(rootEl.querySelectorAll('h1,h2,h3,h4,h5,h6,p,section,blockquote,pre,ul,ol,li'));
  if (!blocks.length) return rootEl.innerHTML || '';

  const htmlBlocks = [];
  blocks.forEach((node) => {
    const text = (node.innerText || node.textContent || '').trim();
    const hasImage = !!node.querySelector('img');
    if (!text && !hasImage) return;
    if (!hasImage && isVideoNoiseLine(text)) return;

    const tag = node.tagName.toLowerCase();
    if (tag === 'li') {
      htmlBlocks.push(`<p>• ${node.innerHTML}</p>`);
      return;
    }
    htmlBlocks.push(`<${tag}>${node.innerHTML}</${tag}>`);
  });

  return htmlBlocks.join('');
}

/**
 * 从 HTML 收集图片 URL
 */
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

/**
 * 在页面上下文中执行的提取函数
 * 注意：此函数必须自包含，不能依赖外部函数
 */
export function extractWechatContent() {
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

  // 内部工具函数
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
      /^已关注$/i, /^follow$/i, /^replay$/i, /^share$/i,
      /^like$/i, /^close$/i, /^play$/i, /^倍速$/i,
      /^继续观看$/i, /^观看更多$/i, /^转载$/i,
      /^全屏$/i, /^退出全屏$/i, /^切换到[横竖]屏.*$/i,
      /^0\/0$/, /^\d{2}:\d{2}\s*\/\s*\d{2}:\d{2}$/,
      /^时长\d{2}:\d{2}$/i, /^0\.\d+倍$/, /^\d+\.\d+倍$/,
      /^超清$/, /^流畅$/, /^share video$/i,
      /^enter comment$/i, /^wowadded to top stories$/i,
      /^added to top stories$/i, /^continue watching$/i
    ];
    if (noisePatterns.some((re) => re.test(text))) return true;
    if (/^(更多|退出全屏|继续播放进度条|倍速播放中)/.test(text)) return true;
    if (/^(已关注|Follow|Replay|Share|Like|Close|Play)/i.test(text)) return true;
    if (/^00:00\s*\/\s*01:05$/i.test(text)) return true;
    if (/^0\/\d+$/.test(text)) return true;
    if (/^[\d:\s/]+$/.test(text) && text.length <= 16) return true;
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
    // 等待正文渲染
    const waitStart = Date.now();
    const waitTimeout = 12000;
    while (Date.now() - waitStart < waitTimeout) {
      const candidate = document.querySelector('#js_content, .rich_media_content, #img-content');
      const textLen = candidate?.textContent?.trim()?.length || 0;
      const imageLen = candidate?.querySelectorAll?.('img')?.length || 0;
      if (textLen > 20 || imageLen > 0) break;
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // 提取标题
    const titleEl = document.querySelector('#activity-name') ||
                    document.querySelector('.rich_media_title') ||
                    document.querySelector('h1.rich_media_title') ||
                    document.querySelector('h1');
    if (titleEl) article.title = titleEl.textContent.trim();

    // 提取封面
    const coverEl = document.querySelector('.rich_media_thumb') ||
                    document.querySelector('meta[property="og:image"]');
    if (coverEl) article.cover = coverEl.src || coverEl.content || '';

    // 提取作者
    const authorEl = document.querySelector('#js_name') ||
                     document.querySelector('.rich_media_meta_nickname') ||
                     document.querySelector('.rich_media_meta_text');
    if (authorEl) article.author = authorEl.textContent.trim();

    // 提取发布时间
    const timeEl = document.querySelector('#publish_time') ||
                   document.querySelector('.rich_media_meta_date');
    if (timeEl) article.publishTime = timeEl.textContent.trim();

    // 提取正文内容
    const contentEl = document.querySelector('#js_content') ||
                      document.querySelector('.rich_media_content') ||
                      document.querySelector('#img-content') ||
                      document.querySelector('article');

    if (contentEl) {
      const clonedContent = contentEl.cloneNode(true);

      // 处理图片
      const images = clonedContent.querySelectorAll('img');
      images.forEach((img) => {
        const imgSrc = img.getAttribute('data-src') ||
                      img.getAttribute('data-original') ||
                      img.getAttribute('data-original-src') ||
                      img.getAttribute('src') ||
                      img.currentSrc;
        if (imgSrc) {
          const normalized = imgSrc.replace(/^\/\//, 'https://')
                                    .replace(/^http:\/\//i, 'https://')
                                    .replace(/&amp;/g, '&');
          article.imageUrls.push(normalized);
          img.setAttribute('src', normalized);
          img.setAttribute('data-original-src', normalized);
        }
      });

      // 移除视频元素
      const videos = clonedContent.querySelectorAll('video');
      videos.forEach(video => video.remove());

      // 清理视频噪音节点
      const videoNoiseSelectors = [
        'iframe[src*="v.qq.com"]', 'iframe[src*="video"]',
        '.js_tx_video_container', '.js_video_channel_container',
        '.txp_player_container', '.txp_video_container',
        '[class*="video-player"]', '[class*="videoPlayer"]',
        '[class*="txp"]', '[id*="txp"]',
        '.qqmusic_iframe', '.js_wechat_video',
        '.wx_video_context', '.wx_video_play_area'
      ];
      const videoNoiseNodes = clonedContent.querySelectorAll(videoNoiseSelectors.join(','));
      videoNoiseNodes.forEach(node => node.remove());

      localRemoveVideoNoiseElements(clonedContent);
      clonedContent.querySelectorAll('script, style, .original_primary_card_tips')
                  .forEach(node => node.remove());
      clonedContent.querySelectorAll('[style*="display:none"], [style*="visibility:hidden"], .dn, .hidden')
                  .forEach(node => node.remove());

      article.content = localBuildRichHtmlFromBlocks(clonedContent) || clonedContent.innerHTML;
      article.textContent = localFilterVideoNoiseText(clonedContent.innerText || clonedContent.textContent || '');
      article.imageCount = article.imageUrls.length;

      if (article.imageUrls.length === 0) {
        const htmlImageUrls = localCollectImageUrlsFromHtml(clonedContent.innerHTML);
        if (htmlImageUrls.length > 0) {
          article.imageUrls.push(...htmlImageUrls);
          article.imageCount = article.imageUrls.length;
        }
      }
    } else {
      const fallbackEl = document.querySelector('article') || document.querySelector('main') || document.body;
      const fallbackHtml = fallbackEl?.innerHTML || '';
      const fallbackText = localFilterVideoNoiseText(fallbackEl?.innerText || fallbackEl?.textContent || '');
      article.content = fallbackHtml ? `<div>${fallbackHtml}</div>` : '<p>未提取到正文</p>';
      article.textContent = fallbackText.substring(0, 12000);
    }

    article.imageUrls = [...new Set(article.imageUrls)];
    article.imageCount = article.imageUrls.length;

    if ((!article.content || localStripHtml(article.content).length < 10) && article.textContent) {
      article.content = localBuildParagraphHtml(article.textContent);
    }

    if (!article.textContent || article.textContent.length < 10) {
      const metaDesc = document.querySelector('meta[property="og:description"]')?.content ||
                      document.querySelector('meta[name="description"]')?.content || '';
      if (metaDesc) {
        article.textContent = localFilterVideoNoiseText(metaDesc.trim());
        if (!article.content || article.content === '<p>未提取到正文</p>') {
          article.content = `<p>${localEscapeHtml(article.textContent)}</p>`;
        }
      }
    }

  } catch (error) {
    console.error('提取过程出错:', error);
    const fallbackText = localFilterVideoNoiseText(document.body?.innerText || document.body?.textContent || '');
    article.textContent = fallbackText.substring(0, 12000);
    article.content = article.textContent
      ? localBuildParagraphHtml(article.textContent)
      : '<p>提取失败: ' + error.message + '</p>';
  }

  return article;
}
