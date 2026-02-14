/**
 * 图片处理工具函数
 */

/**
 * 微信图片 URL 候选列表（处理不同格式）
 */
export function normalizeWechatImageCandidates(url) {
  const source = String(url || '').trim();
  if (!source) return [];

  const decoded = source.replace(/&amp;/g, '&');
  const withoutProtocol = decoded.replace(/^\/\//, 'https://');
  const httpsUrl = withoutProtocol.replace(/^http:\/\//i, 'https://');

  return [...new Set([source, decoded, withoutProtocol, httpsUrl].filter(Boolean))];
}

/**
 * 从 URL 猜测 MIME 类型
 */
export function guessMimeTypeFromUrl(url) {
  const lower = String(url || '').toLowerCase();
  if (lower.includes('.png')) return 'image/png';
  if (lower.includes('.gif')) return 'image/gif';
  if (lower.includes('.webp')) return 'image/webp';
  return 'image/jpeg';
}

/**
 * Blob 转为 Data URL
 */
export async function blobToDataUrl(blob, mimeType) {
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

/**
 * 替换 HTML 中的图片源
 */
export function replaceImageSources(html, imageMap) {
  if (!html || !imageMap?.size) return html;

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

    if (!matchedKey) return imgTag;

    const dataUrl = imageMap.get(matchedKey);
    let updated = imgTag;
    if (/\bsrc\s*=\s*(['"]).*?\1/i.test(updated)) {
      updated = updated.replace(/\bsrc\s*=\s*(['"]).*?\1/i, `src="${dataUrl}"`);
    } else {
      updated = updated.replace(/<img/i, `<img src="${dataUrl}"`);
    }

    if (!/\bdata-original-url\s*=/i.test(updated)) {
      updated = updated.replace(/<img/i, `<img data-original-url="${matchedOriginal}"`);
    }

    updated = updated.replace(/\sdata-src\s*=\s*(['"]).*?\1/gi, '');
    updated = updated.replace(/\sdata-img-src\s*=\s*(['"]).*?\1/gi, '');
    return updated;
  });
}
