/**
 * HTML 处理工具函数
 */

/**
 * 去除 HTML 标签
 */
export function stripHtml(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * HTML 实体转义
 */
export function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 文本转段落 HTML
 */
export function buildParagraphHtml(text) {
  return String(text || '')
    .split(/\n{2,}/)
    .map(block => block.trim())
    .filter(Boolean)
    .map(block => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/**
 * 从 HTML 中收集图片 URL
 */
export function collectImageUrlsFromHtml(html) {
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
 * 从块元素构建富文本 HTML
 */
export function buildRichHtmlFromBlocks(rootEl) {
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

/**
 * 检查是否为视频噪音文本
 */
export function isVideoNoiseLine(line) {
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
 * 过滤视频噪音文本
 */
export function filterVideoNoiseText(text) {
  return String(text || '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => !isVideoNoiseLine(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
