/**
 * 小红书 Playwright 自动化同步脚本
 *
 * 方案：连接到已运行的 Chrome 浏览器
 * 用户需要先启动带调试端口的 Chrome
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const { execSync, spawn } = require('child_process');

// 配置
const CONFIG = {
  xiaohongshu: {
    publishUrl: 'https://creator.xiaohongshu.com/publish/publish?from=tab_switch&target=article',
    titleSelector: 'input[placeholder*="标题"], textarea[placeholder*="标题"], .title-input input, input[class*="title"]',
    editorSelector: '[contenteditable="true"][role="textbox"], [contenteditable="true"], .ql-editor, .draft-editor',
    // 图片上传相关选择器 - 小红书创作者中心
    uploadSelectors: [
      // 直接的 file input
      'input[type="file"][accept*="image"]',
      'input[type="file"]',
      'input[accept="image/*"]',
      // 带类名的 file input
      '[class*="upload"] input[type="file"]',
      '[class*="Upload"] input[type="file"]',
      '[class*="image"] input[type="file"]',
      '[class*="Image"] input[type="file"]',
      '[class*="file-input"]',
      '[class*="FileInput"]',
      // 小红书特定选择器
      '.upload-input input',
      '.upload-btn input',
      '[class*="cover"] input[type="file"]',
      '[class*="poster"] input[type="file"]',
      // 通用隐藏的 file input
      'input[style*="display: none"]',
      'input[style*="visibility: hidden"]'
    ],
    uploadButtonSelectors: [
      // 上传按钮
      '[class*="upload-btn"]',
      '[class*="UploadBtn"]',
      'button[class*="upload"]',
      '[class*="add-image"]',
      '[class*="addImage"]',
      '.upload-area',
      '[class*="picture-card"]',
      '[class*="PictureCard"]',
      // 小红书特定的上传区域
      '[class*="cover-upload"]',
      '[class*="CoverUpload"]',
      '[class*="poster-upload"]',
      '[class*="PosterUpload"]',
      '[class*="image-upload"]',
      '[class*="ImageUpload"]',
      // 添加按钮
      '[class*="add-btn"]',
      '[class*="AddBtn"]',
      'button[class*="add"]',
      // 图标按钮
      '[class*="plus"]',
      '[class*="Plus"]',
      '[class*="icon-add"]',
      // 上传区域点击
      '.upload-zone',
      '[class*="uploadZone"]',
      '[class*="drag-upload"]'
    ],
    timeout: 60000
  },
  chrome: {
    debugPort: 9222,
    userDataDir: path.join(process.env.HOME, '.content-distributor', 'chrome-debug-profile')
  }
};

/**
 * 启动带调试端口的 Chrome
 */
function launchChromeWithDebug() {
  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const userDataDir = CONFIG.chrome.userDataDir;

  // 确保用户数据目录存在
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  console.log(`启动 Chrome (调试端口: ${CONFIG.chrome.debugPort})...`);

  // 后台启动 Chrome
  const chrome = spawn(chromePath, [
    `--remote-debugging-port=${CONFIG.chrome.debugPort}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
  ], {
    detached: true,
    stdio: 'ignore'
  });

  chrome.unref();
  return chrome;
}

/**
 * 检查 Chrome 调试端口是否可用
 */
async function checkDebugPort() {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: CONFIG.chrome.debugPort,
      path: '/json/version',
      method: 'GET',
      timeout: 2000
    }, (res) => {
      if (res.statusCode === 200) {
        resolve(true);
      } else {
        resolve(false);
      }
    });

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

/**
 * 下载图片
 */
async function downloadImage(url, outputPath) {
  return new Promise((resolve, reject) => {
    if (url.startsWith('data:')) {
      try {
        const matches = url.match(/^data:image\/(\w+);base64,(.+)$/);
        if (matches) {
          const buffer = Buffer.from(matches[2], 'base64');
          fs.writeFileSync(outputPath, buffer);
          resolve(outputPath);
          return;
        }
      } catch (e) {
        reject(e);
        return;
      }
    }

    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(outputPath);

    protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': 'https://mp.weixin.qq.com/'
      }
    }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        fs.unlinkSync(outputPath);
        downloadImage(response.headers.location, outputPath).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(outputPath);
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(outputPath);
      });
    }).on('error', (err) => {
      file.close();
      fs.unlink(outputPath, () => {});
      reject(err);
    });
  });
}

/**
 * 批量下载图片
 */
async function downloadImages(imageUrls, tempDir) {
  const downloaded = [];

  for (let i = 0; i < imageUrls.length; i++) {
    const url = imageUrls[i];
    const ext = url.includes('.png') ? 'png' : url.includes('.gif') ? 'gif' : url.includes('.webp') ? 'webp' : 'jpg';
    const outputPath = path.join(tempDir, `image_${i + 1}.${ext}`);

    try {
      await downloadImage(url, outputPath);
      downloaded.push(outputPath);
      console.log(`[OK] 下载图片 ${i + 1}/${imageUrls.length}`);
    } catch (error) {
      console.error(`[FAIL] 下载图片失败: ${error.message}`);
    }
  }

  return downloaded;
}

/**
 * 从 HTML 提取纯文本
 */
function extractTextFromHtml(html) {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function clearEditorContent(page, editorSelector) {
  const cleared = await page.evaluate((selector) => {
    const editor = document.querySelector(selector);
    if (!editor) return false;
    editor.focus();

    // ProseMirror/tiptap 兼容清空
    if (editor.classList.contains('ProseMirror') || editor.closest('.ProseMirror')) {
      editor.innerHTML = '<p><br class="ProseMirror-trailingBreak"></p>';
      return true;
    }

    editor.innerHTML = '';
    return true;
  }, editorSelector);

  if (!cleared) {
    await page.keyboard.down('Meta');
    await page.keyboard.press('a');
    await page.keyboard.up('Meta');
    await page.keyboard.press('Backspace');
  }
}

async function pasteTextToEditor(page, editorSelector, text) {
  if (!text) return;
  const normalizedText = String(text).replace(/\r\n/g, '\n');

  await page.evaluate(({ selector, content }) => {
    const editor = document.querySelector(selector);
    if (!editor) return;
    editor.focus();

    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', content);

    const pasteEvent = new ClipboardEvent('paste', {
      clipboardData,
      bubbles: false,
      cancelable: true
    });

    editor.dispatchEvent(pasteEvent);
  }, { selector: editorSelector, content: normalizedText });
}

async function pasteImageToEditor(page, editorSelector, imagePath, imageIndex) {
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const imageHash = require('crypto').createHash('md5').update(imageBuffer).digest('hex').substring(0, 8);

  const insertResult = await page.evaluate(({ selector, base64Img, index, hash }) => {
    const editor = document.querySelector(selector);
    if (!editor) return { ok: false, reason: 'editor-not-found' };

    // 使用图片哈希作为锁，防止同一张图片被重复粘贴
    const lockKey = '__xhsImagePasteLockUntil';
    const hashKey = '__xhsLastImageHash';
    const now = Date.now();

    // 检查是否被锁定
    if (window[lockKey] && window[lockKey] > now) {
      return { ok: false, reason: 'paste-locked' };
    }

    // 检查是否是同一张图片（防止重复粘贴）
    if (window[hashKey] === hash) {
      console.log(`[防重] 跳过重复图片, hash=${hash}`);
      return { ok: false, reason: 'duplicate-image' };
    }

    // 设置锁和哈希
    window[lockKey] = now + 3000; // 延长锁时间到 3 秒
    window[hashKey] = hash;

    editor.focus();

    const binaryString = atob(base64Img);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const file = new File([bytes], `image_${index + 1}.jpg`, { type: 'image/jpeg' });
    const clipboardData = new DataTransfer();
    clipboardData.items.add(file);

    const pasteEvent = new ClipboardEvent('paste', {
      clipboardData,
      bubbles: true, // 改为 true，让事件冒泡
      cancelable: true
    });

    editor.dispatchEvent(pasteEvent);
    console.log(`[粘贴] 已分发粘贴事件, hash=${hash}`);
    return { ok: true };
  }, { selector: editorSelector, base64Img: base64Image, index: imageIndex, hash: imageHash });

  return insertResult;
}

/**
 * 拦截小红书内部的上传逻辑，防止重复上传
 */
async function interceptXhsUpload(page) {
  await page.evaluate(() => {
    console.log('[拦截] 开始注入上传拦截器...');

    // 记录上传次数
    window.__xhsUploadCount = 0;
    window.__xhsLastUploadTime = 0;

    // 方法：拦截小红书的 infraUploader 模块
    // 通过重写 XMLHttpRequest 来检测和控制上传

    const originalXHR = window.XMLHttpRequest;

    window.XMLHttpRequest = function() {
      const xhr = new originalXHR();

      const originalOpen = xhr.open.bind(xhr);
      xhr.open = function(method, url, ...args) {
        // 检测小红书的上传请求
        if (url && typeof url === 'string') {
          const isUploadUrl = url.includes('spectrum') ||
                             url.includes('upload') ||
                             url.includes('image');

          if (isUploadUrl) {
            window.__xhsUploadCount++;
            const now = Date.now();
            const timeSinceLast = now - window.__xhsLastUploadTime;

            console.log(`[拦截] 检测到上传请求 #${window.__xhsUploadCount}, 距上次 ${timeSinceLast}ms`);
            window.__xhsLastUploadTime = now;

            // 如果在短时间内（2秒内）有第二次上传，阻止它
            if (window.__xhsUploadCount >= 2 && timeSinceLast < 2000) {
              console.log(`[拦截] ⚠️ 阻止重复上传 #${window.__xhsUploadCount}`);

              // 拦截 send 方法
              const originalSend = xhr.send.bind(xhr);
              xhr.send = function(...args) {
                // 阻止发送
                console.log(`[拦截] ✗ 阻止重复上传`);
                // 模拟上传失败
                setTimeout(() => {
                  if (xhr.onerror) xhr.onerror(new Error('Blocked by dedup'));
                  if (xhr.onloadend) xhr.onloadend();
                }, 0);
                return;
              };
            }
          }
        }
        return originalOpen(method, url, ...args);
      };

      return xhr;
    };

    // 也拦截 fetch
    const originalFetch = window.fetch;
    window.fetch = function(url, ...args) {
      if (url && typeof url === 'string' &&
          (url.includes('spectrum') || url.includes('upload') || url.includes('image'))) {
        window.__xhsUploadCount++;
        const now = Date.now();
        const timeSinceLast = now - window.__xhsLastUploadTime;

        console.log(`[拦截-fetch] 检测到上传 #${window.__xhsUploadCount}, 距上次 ${timeSinceLast}ms`);

        // 阻止重复上传
        if (window.__xhsUploadCount >= 2 && timeSinceLast < 2000) {
          console.log(`[拦截-fetch] ⚠️ 阻止重复上传 #${window.__xhsUploadCount}`);
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              reject(new Error('Blocked duplicate upload'));
            }, 0);
          });
        }
      }
      return originalFetch(url, ...args);
    };

    console.log('[拦截] 注入完成 - XHR + Fetch 拦截已启用');
  });
}

/**
 * 在小红书编辑器中注入图片去重拦截器
 * 使用多种策略实时检测并删除重复图片
 */
async function injectImageDedupInterceptor(page) {
  await page.evaluate(() => {
    // 防止重复注入
    if (window.__xhsImageDedupInterceptorInjected) return;
    window.__xhsImageDedupInterceptorInjected = true;

    console.log('[去重] 开始注入去重拦截器...');

    // 图片签名计算函数 - 使用元素属性作为主要签名
    const computeSignature = (img) => {
      const style = img.getAttribute('style') || '';
      // 提取 style 中的关键尺寸属性
      const widthMatch = style.match(/width:\s*([\d.]+)/);
      const minHeightMatch = style.match(/min-height:\s*([\d.]+)/);
      // 从元素属性读取尺寸
      const attrWidth = img.getAttribute('width') || 0;
      const attrHeight = img.getAttribute('height') || 0;
      return `${attrWidth}x${attrHeight}_${widthMatch?.[1] || 0}_${minHeightMatch?.[1] || 0}`;
    };

    // 主动去重函数
    const dedupImages = () => {
      // 查找所有可能的编辑器
      const selectors = [
        '.tiptap.ProseMirror',
        '.ProseMirror[contenteditable="true"]',
        '[contenteditable="true"]',
        '.draft-editor',
        '.ql-editor'
      ];

      for (const sel of selectors) {
        const editor = document.querySelector(sel);
        if (!editor) continue;

        const imgs = Array.from(editor.querySelectorAll('img'));
        if (imgs.length <= 1) continue; // 只有一张不需要去重

        const seen = new Map();
        let removedCount = 0;
        let totalCount = imgs.length;

        imgs.forEach(img => {
          if (!img.parentElement || img.parentElement.tagName === 'BODY') return;

          const sig = computeSignature(img);
          if (!sig || sig === '0x0_0_0') return;

          if (seen.has(sig)) {
            // 发现重复，删除当前图片（保留第一个）
            const imageBlock = img.closest('[data-dom-type="image"]');
            if (imageBlock) {
              imageBlock.remove();
            } else {
              img.remove();
            }
            removedCount++;
            console.log(`[去重] 删除重复图片, sig=${sig}`);
          } else {
            seen.set(sig, img);
          }
        });

        if (removedCount > 0) {
          console.log(`[去重] ${totalCount} -> ${totalCount - removedCount}, 移除 ${removedCount} 张`);
        }
      }
    };

    // 方法1：MutationObserver 监听
    const observer = new MutationObserver(() => {
      dedupImages();
      setTimeout(dedupImages, 100);
      setTimeout(dedupImages, 300);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'style']
    });

    // 方法2：setInterval 定期清理（每 100ms，更频繁）
    setInterval(dedupImages, 100);

    // 初始去重
    setTimeout(dedupImages, 500);

    console.log('[去重] 注入完成 - MutationObserver + setInterval 已启用');

    // 暴露去重函数到全局
    window.__forceDedup = dedupImages;
  });
}

/**
 * 直接插入 base64 图片到 DOM
 * 这是最激进的方案：完全绕过小红书的上传逻辑，直接插入图片
 */
async function insertImageDirect(page, imagePath, imageIndex) {
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const imageHash = require('crypto').createHash('md5').update(imageBuffer).digest('hex').substring(0, 8);

  console.log(`[直接插入] === 图片 ${imageIndex + 1}, hash=${imageHash} ===`);

  const result = await page.evaluate(async ({ base64Img, index, hash }) => {
    const result = { ok: false, method: 'none', error: '' };

    // 查找编辑器
    const selectors = [
      '.tiptap.ProseMirror',
      '.ProseMirror[contenteditable="true"]',
      '[contenteditable="true"]',
      '.draft-editor',
      '.ql-editor'
    ];

    let editor = null;
    for (const sel of selectors) {
      editor = document.querySelector(sel);
      if (editor) break;
    }

    if (!editor) {
      result.error = 'no-editor';
      return result;
    }

    // 创建图片元素，使用 data URL
    const imgUrl = `data:image/jpeg;base64,${base64Img}`;

    // 创建 figure 或 p 包装元素（更接近小红书的格式）
    const wrapper = document.createElement('figure');
    wrapper.setAttribute('data-dom-type', 'image');
    wrapper.style.cssText = 'margin: 0; padding: 0; width: 100%;';

    const img = document.createElement('img');
    img.src = imgUrl;
    img.setAttribute('data-original-src', imgUrl);
    img.setAttribute('data-local-hash', hash);
    img.style.cssText = 'width: 100%; max-width: 100%; height: auto; display: block; object-fit: contain;';

    wrapper.appendChild(img);

    // 插入到编辑器末尾
    editor.appendChild(wrapper);

    console.log(`[直接插入] ✓ 已插入 base64 图片`);
    result.ok = true;
    result.method = 'direct-dom';
    return result;
  }, { base64Img: base64Image, index: imageIndex, hash: imageHash });

  console.log(`[直接插入] 结果: ${JSON.stringify(result)}`);
  return result;
}

/**
 * 通过 ProseMirror/Tiptap 直接插入图片
 * 这是最可靠的方案：绕过小红书内部的 paste/drop 处理，直接操作编辑器状态
 */
async function insertImageViaProseMirror(page, imagePath, imageIndex) {
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const imageHash = require('crypto').createHash('md5').update(imageBuffer).digest('hex').substring(0, 8);

  console.log(`[PM插入] === 开始插入图片 ${imageIndex + 1} ===`);
  console.log(`[PM插入] hash=${imageHash}`);
  console.log(`[PM插入] base64长度=${base64Image.length}`);

  const result = await page.evaluate(async ({ base64Img, index, hash }) => {
    const result = { ok: false, method: 'none', error: '', debug: {} };

    // 查找编辑器
    const selectors = [
      '.tiptap.ProseMirror',
      '.ProseMirror[contenteditable="true"]',
      '[contenteditable="true"]',
      '.draft-editor',
      '.ql-editor'
    ];

    let editor = null;
    for (const sel of selectors) {
      editor = document.querySelector(sel);
      if (editor) {
        result.debug.selector = sel;
        break;
      }
    }

    if (!editor) {
      result.error = 'no-editor-found';
      return result;
    }

    result.debug.editorTag = editor.tagName;
    result.debug.editorClass = editor.className?.substring(0, 100);

    console.log(`[PM插入] 找到编辑器: ${result.debug.editorTag}.${(result.debug.editorClass || '').substring(0, 50)}`);

    // 尝试查找 Tiptap/ProseMirror 实例
    let editorView = null;
    let foundInstance = false;

    // 方法1：检查 DOM 元素本身
    if (editor.editorView) {
      editorView = editor.editorView;
      foundInstance = true;
      console.log(`[PM插入] 从 DOM 获取 editorView`);
    }

    // 方法2：检查全局 Tiptap 对象
    if (!editorView && window.tiptap) {
      if (window.tiptap.editor?.view) {
        editorView = window.tiptap.editor.view;
        foundInstance = true;
        console.log(`[PM插入] 从 window.tiptap.editor.view 获取`);
      } else if (window.tiptap.view) {
        editorView = window.tiptap.view;
        foundInstance = true;
        console.log(`[PM插入] 从 window.tiptap.view 获取`);
      }
    }

    // 方法3：遍历 window 查找
    if (!editorView) {
      for (const key in window) {
        try {
          const obj = window[key];
          if (obj && typeof obj === 'object' && obj.view && obj.view.state && obj.view.state.schema) {
            editorView = obj.view;
            foundInstance = true;
            console.log(`[PM插入] 从 window.${key}.view 获取`);
            break;
          }
        } catch (e) {}
      }
    }

    result.debug.foundEditorView = foundInstance;

    if (editorView) {
      result.debug.hasSchema = !!(editorView.state?.schema);
      if (editorView.state?.schema) {
        const schema = editorView.state.schema;
        result.debug.hasImageNode = !!(schema.nodes.image || schema.nodes.img);
        console.log(`[PM插入] schema.nodes: ${Object.keys(schema.nodes).join(', ')}`);
      }

      // 尝试插入
      try {
        const schema = editorView.state.schema;
        const imageNodeType = schema.nodes.image || schema.nodes.img;

        if (imageNodeType) {
          const imgUrl = `data:image/jpeg;base64,${base64Img}`;
          const imgNode = imageNodeType.create({ src: imgUrl });

          const tr = editorView.state.tr.insert(0, imgNode);
          editorView.dispatch(tr);

          result.ok = true;
          result.method = 'proseMirror-direct';
          console.log(`[PM插入] ✓ 成功通过 ProseMirror 插入`);
          return result;
        }
      } catch (e) {
        result.error = e.message;
        console.log(`[PM插入] ✗ ProseMirror 失败: ${e.message}`);
      }
    } else {
      console.log(`[PM插入] 未找到 editorView`);
    }

    // 方法：使用 innerHTML
    try {
      const imgUrl = `data:image/jpeg;base64,${base64Img}`;
      editor.innerHTML = `<img src="${imgUrl}" style="width:100%;max-width:100%;" />`;
      result.ok = true;
      result.method = 'innerHTML';
      console.log(`[PM插入] ✓ 使用 innerHTML 插入`);
      return result;
    } catch (e) {
      result.error = e.message;
      console.log(`[PM插入] ✗ innerHTML 失败: ${e.message}`);
    }

    return result;
  }, { base64Img: base64Image, index: imageIndex, hash: imageHash });

  console.log(`[PM插入] 结果: ${JSON.stringify(result)}`);
  return result;
}

/**
 * 通过原生方式上传图片到编辑器
 *
 * 优先级：
 * 1. 直接 DOM 插入（完全绕过小红书上传）
 * 2. ProseMirror 直接操作
 * 3. innerHTML
 * 4. DragEvent
 * 5. ClipboardEvent（最后兜底）
 */
async function uploadImageViaNativeInput(page, imagePath, imageIndex) {
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const imageHash = require('crypto').createHash('md5').update(imageBuffer).digest('hex').substring(0, 8);

  console.log(`[上传] === 图片 ${imageIndex + 1}, hash=${imageHash} ===`);

  // 方法1：直接 DOM 插入（完全绕过小红书上传逻辑）
  console.log(`[上传] 尝试直接 DOM 插入...`);
  const directResult = await insertImageDirect(page, imagePath, imageIndex);
  if (directResult.ok) {
    console.log(`[上传] ✓ 直接插入成功`);
    return { ok: true, method: 'direct-dom' };
  }
  console.log(`[上传] 直接插入失败: ${directResult.error}`);

  // 方法2：ProseMirror 直接操作
  console.log(`[上传] 尝试 ProseMirror 插入...`);
  const pmResult = await insertImageViaProseMirror(page, imagePath, imageIndex);
  if (pmResult.ok) {
    console.log(`[上传] ✓ ProseMirror 插入成功`);
    return { ok: true, method: pmResult.method };
  }
  console.log(`[上传] ProseMirror 失败: ${pmResult.error}`);

  // 方法3：innerHTML
  console.log(`[上传] 尝试 innerHTML...`);
  const innerResult = await page.evaluate(async ({ selector, base64Img, index, hash }) => {
    const editor = document.querySelector(selector);
    if (!editor) return { ok: false, error: 'no-editor' };

    try {
      const imgUrl = `data:image/jpeg;base64,${base64Img}`;
      editor.innerHTML += `<img src="${imgUrl}" style="width:100%;max-width:100%;" />`;
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }, { selector: '.tiptap.ProseMirror, .ProseMirror[contenteditable="true"]', base64Img: base64Image, index: imageIndex, hash: imageHash });

  if (innerResult.ok) {
    return { ok: true, method: 'innerHTML' };
  }

  // 方法4：DragEvent
  console.log(`[上传] 尝试 DragEvent...`);
  const dragResult = await page.evaluate(async ({ selector, base64Img, index, hash }) => {
    const editor = document.querySelector(selector);
    if (!editor) return { ok: false, error: 'no-editor' };

    const rect = editor.getBoundingClientRect();
    if (!rect) return { ok: false, error: 'no-rect' };

    try {
      const response = await fetch(`data:image/jpeg;base64,${base64Img}`);
      const blob = await response.blob();
      const file = new File([blob], `image_${index + 1}.jpg`, { type: 'image/jpeg' });

      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      const dragOverEvent = new DragEvent('dragover', {
        bubbles: true,
        cancelable: true,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        dataTransfer
      });
      editor.dispatchEvent(dragOverEvent);

      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        dataTransfer
      });
      editor.dispatchEvent(dropEvent);

      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }, { selector: '.tiptap.ProseMirror, .ProseMirror[contenteditable="true"]', base64Img: base64Image, index: imageIndex, hash: imageHash });

  if (dragResult.ok) {
    return { ok: true, method: 'drag-drop' };
  }

  // 最后兜底：ClipboardEvent
  console.log(`[上传] 回退到 ClipboardEvent...`);
  return await pasteImageToEditor(page, '.tiptap.ProseMirror, .ProseMirror[contenteditable="true"]', imagePath, imageIndex);
}

async function normalizeInsertedImageStyle(page, editorSelector) {
  await page.evaluate((selector) => {
    const editor = document.activeElement?.closest?.('.ProseMirror') || document.querySelector(selector);
    if (!editor) return;

    const images = editor.querySelectorAll('img');
    images.forEach((img) => {
      // 按编辑器宽度放大展示，同时保持原始比例
      img.style.width = '100%';
      img.style.maxWidth = '100%';
      img.style.minWidth = '0';
      img.style.height = 'auto';
      img.style.display = 'block';
      img.style.objectFit = 'contain';
      img.removeAttribute('width');
      img.removeAttribute('height');

      const parent = img.parentElement;
      if (parent && parent !== editor) {
        parent.style.width = '100%';
        parent.style.maxWidth = '100%';
      }
    });
  }, editorSelector);
}

async function deduplicateAdjacentImages(page, editorSelector) {
  return page.evaluate((selector) => {
    const editor = document.activeElement?.closest?.('.ProseMirror') || document.querySelector(selector);
    if (!editor) return 0;

    const images = Array.from(editor.querySelectorAll('img'));
    let removed = 0;

    // 使用 Map 记录已见过的图片签名，检测所有重复（不限于相邻）
    const seenSignatures = new Map();

    images.forEach((img) => {
      if (!img || !img.parentElement) return;

      // 获取图片的唯一标识：优先使用 src，其次 data-original-src
      const sig = (img.currentSrc || img.getAttribute('src') || img.getAttribute('data-original-src') || '').trim();

      if (!sig) return;

      if (seenSignatures.has(sig)) {
        // 找到重复图片，删除当前这个
        // 同时检查是否需要删除父级包装块（小红书编辑器的 data-dom-type="image" 块）
        const imageBlock = img.closest('[data-dom-type="image"]');
        if (imageBlock) {
          imageBlock.remove();
        } else {
          img.remove();
        }
        removed += 1;
        return;
      }

      seenSignatures.set(sig, true);
    });

    return removed;
  }, editorSelector);
}

async function getEditorImageCount(page, editorSelector) {
  return page.evaluate((selector) => {
    const editor = document.activeElement?.closest?.('.ProseMirror') || document.querySelector(selector);
    if (!editor) return 0;
    return editor.querySelectorAll('img').length;
  }, editorSelector);
}

async function trimExtraInsertedImages(page, editorSelector, beforeCount, expectedIncrease = 1) {
  return page.evaluate(({ selector, baseline, increase }) => {
    const editor = document.activeElement?.closest?.('.ProseMirror') || document.querySelector(selector);
    if (!editor) return 0;

    const images = Array.from(editor.querySelectorAll('img'));
    const maxAllowed = baseline + increase;
    if (images.length <= maxAllowed) return 0;

    let removed = 0;
    for (let i = images.length - 1; i >= 0 && images.length - removed > maxAllowed; i--) {
      const img = images[i];
      if (!img || !img.parentElement) continue;
      img.remove();
      removed += 1;
    }

    return removed;
  }, { selector: editorSelector, baseline: beforeCount, increase: expectedIncrease });
}

async function enforceMaxImageCount(page, editorSelector, maxCount) {
  return page.evaluate(({ selector, max }) => {
    const editor = document.activeElement?.closest?.('.ProseMirror') || document.querySelector(selector);
    if (!editor) return 0;

    // 先执行基于 src 的去重，优先删除重复图片
    let removed = 0;
    const images = Array.from(editor.querySelectorAll('img'));
    const seenSignatures = new Map();

    // 第一遍：移除重复图片
    images.forEach((img) => {
      if (!img || !img.parentElement) return;
      const sig = (img.currentSrc || img.getAttribute('src') || img.getAttribute('data-original-src') || '').trim();
      if (!sig) return;

      if (seenSignatures.has(sig)) {
        // 删除重复图片，连同其父级包装块一起删除
        const imageBlock = img.closest('[data-dom-type="image"]');
        if (imageBlock) {
          imageBlock.remove();
        } else {
          img.remove();
        }
        removed += 1;
        return;
      }
      seenSignatures.set(sig, true);
    });

    // 第二遍：如果去重后仍超过限制，从末尾删除多余的图片
    const remainingImages = Array.from(editor.querySelectorAll('img'));
    if (remainingImages.length <= max) return removed;

    for (let i = remainingImages.length - 1; i >= 0 && remainingImages.length - (removed - (images.length - remainingImages.length)) > max; i--) {
      const img = remainingImages[i];
      if (!img || !img.parentElement) continue;
      const imageBlock = img.closest('[data-dom-type="image"]');
      if (imageBlock) {
        imageBlock.remove();
      } else {
        img.remove();
      }
      removed += 1;
    }

    return removed;
  }, { selector: editorSelector, max: maxCount });
}

async function settleAndEnforceImageCount(page, editorSelector, maxCount) {
  let totalRemoved = 0;
  // 直接插入不需要长时间等待
  for (let i = 0; i < 3; i++) {
    await page.waitForTimeout(300);
    totalRemoved += await enforceMaxImageCount(page, editorSelector, maxCount);
  }
  return totalRemoved;
}

async function cleanupXhsImageDomArtifacts(page, editorSelector) {
  const result = await page.evaluate((selector) => {
    const editor = document.activeElement?.closest?.('.ProseMirror') || document.querySelector(selector);
    if (!editor) return { removed: 0, diagnostics: [] };

    const diagnostics = [];
    let removed = 0;

    // 收集所有图片信息
    const allImgs = editor.querySelectorAll('img');
    const imageBlocks = editor.querySelectorAll('[data-dom-type="image"]');
    diagnostics.push(`编辑器中共有 ${allImgs.length} 个 img 标签, ${imageBlocks.length} 个 [data-dom-type="image"] 块`);

    // 收集每个图片的详细信息
    const imgInfos = [];
    allImgs.forEach((img, idx) => {
      const inBlock = img.closest('[data-dom-type="image"]');
      const src = (img.currentSrc || img.src || '').substring(0, 50);
      const style = img.getAttribute('style') || '';
      const naturalWidth = img.naturalWidth || 0;
      const naturalHeight = img.naturalHeight || 0;
      imgInfos.push(`img[${idx}]: inBlock=${!!inBlock}, style="${style.substring(0, 40)}", src=${src}..., size=${naturalWidth}x${naturalHeight}`);
    });
    diagnostics.push(...imgInfos);

    // 计算图片签名（用于检测重复）
    // 签名 = naturalWidth + "x" + naturalHeight + style中与尺寸相关的部分
    // 同一张图片的两次上传会有相同的尺寸签名，但不同的 src URL
    const computeImageSignature = (img) => {
      const width = img.naturalWidth || parseInt(img.getAttribute('width')) || 0;
      const height = img.naturalHeight || parseInt(img.getAttribute('height')) || 0;
      const style = img.getAttribute('style') || '';

      // 从 style 中提取关键尺寸属性
      const widthMatch = style.match(/width:\s*([\d.]+)/);
      const minHeightMatch = style.match(/min-height:\s*([\d.]+)/);

      const keyWidth = widthMatch ? widthMatch[1] : '0';
      const keyMinHeight = minHeightMatch ? minHeightMatch[1] : '0';

      // 返回尺寸签名（排除具体的 src URL）
      return `${width}x${height}_${keyWidth}_${keyMinHeight}`;
    };

    // 策略1：基于尺寸签名的去重（不仅限于相邻）
    // 这是核心去重逻辑：同一张图片的两次上传会有相同的尺寸签名
    const imgArray = Array.from(editor.querySelectorAll('img'));
    const signatureGroups = new Map();

    imgArray.forEach((img, idx) => {
      if (!img || !img.parentElement) return;

      const sig = computeImageSignature(img);
      if (!signatureGroups.has(sig)) {
        signatureGroups.set(sig, []);
      }
      signatureGroups.get(sig).push({ img, idx });
    });

    // 对于每个签名组，只保留第一个，删除其余的
    signatureGroups.forEach((group, sig) => {
      if (group.length > 1) {
        diagnostics.push(`发现重复签名 "${sig}" 有 ${group.length} 张图片`);
        // 跳过第一个，删除其余的
        for (let i = 1; i < group.length; i++) {
          const img = group[i].img;
          const imageBlock = img.closest('[data-dom-type="image"]');

          if (imageBlock) {
            diagnostics.push(`删除重复图片块 (签名: ${sig})`);
            imageBlock.remove();
          } else {
            diagnostics.push(`删除重复图片 (签名: ${sig})`);
            img.remove();
          }
          removed += 1;
        }
      }
    });

    // 策略2：清理相邻且相同样式的图片（作为补充）
    const nakedImgs = Array.from(editor.querySelectorAll('img')).filter(img => !img.closest('[data-dom-type="image"]'));
    if (nakedImgs.length > 1) {
      let prevImg = null;
      nakedImgs.forEach((img) => {
        if (!img || !img.parentElement) return;

        const currentStyle = img.getAttribute('style') || '';

        if (prevImg) {
          const prevStyle = prevImg.getAttribute('style') || '';
          // 如果相邻图片的 style 完全相同，删除后一个
          if (currentStyle === prevStyle && currentStyle.includes('width')) {
            diagnostics.push(`删除相邻重复图片, style="${currentStyle.substring(0, 30)}"`);
            img.remove();
            removed += 1;
            return;
          }
        }
        prevImg = img;
      });
    }

    // 策略3：清理重复的 [data-dom-type="image"] 包装块
    const blocks = Array.from(editor.querySelectorAll('[data-dom-type="image"]'));
    if (blocks.length > 1) {
      let prevBlock = null;
      blocks.forEach((block) => {
        const img = block.querySelector('img');
        if (!img) return;

        const currentStyle = img.getAttribute('style') || '';

        if (prevBlock) {
          const prevImg = prevBlock.querySelector('img');
          if (prevImg) {
            const prevStyle = prevImg.getAttribute('style') || '';
            if (currentStyle === prevStyle && currentStyle.includes('width')) {
              diagnostics.push(`删除相邻重复图片块, style="${currentStyle.substring(0, 30)}"`);
              block.remove();
              removed += 1;
              return;
            }
          }
        }
        prevBlock = block;
      });
    }

    diagnostics.push(`清理完成，共移除 ${removed} 个节点`);
    return { removed, diagnostics };
  }, editorSelector);

  // 在 Node.js 端打印诊断信息
  result.diagnostics.forEach(msg => console.log(`[诊断] ${msg}`));
  return result.removed;
}

async function injectEditorImageStyle(page) {
  await page.evaluate(() => {
    const styleId = 'xhs-codex-image-style';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .ProseMirror img,
      .tiptap.ProseMirror img {
        width: 100% !important;
        max-width: 100% !important;
        height: auto !important;
        object-fit: contain !important;
        display: block !important;
      }
      .ProseMirror figure,
      .tiptap.ProseMirror figure,
      .ProseMirror p,
      .tiptap.ProseMirror p {
        max-width: 100% !important;
      }
    `;
    document.head.appendChild(style);
  });
}

/**
 * 同步到小红书
 * @param {Object} content - 内容对象
 * @param {string} content.title - 标题
 * @param {string} content.body - HTML正文
 * @param {string} content.text - 纯文本正文
 * @param {string} content.textWithImages - 带图片占位符的文本
 * @param {string[]} content.imageUrls - 图片URL数组
 * @param {string} content.publishMode - 发布模式: 'upload' (上传图文) 或 'longArticle' (写长文)
 */
async function syncToXiaohongshu(content) {
  const { title, body, text, textWithImages, imageUrls = [], publishMode = 'upload' } = content;
  const plainText = text || extractTextFromHtml(body);

  console.log('========================================');
  console.log('小红书 Playwright 自动化同步');
  console.log('========================================');
  console.log(`标题: ${title}`);
  console.log(`正文字数: ${plainText.length}`);
  console.log(`图片数量: ${imageUrls.length}`);
  console.log(`发布模式: ${publishMode === 'longArticle' ? '写长文' : '上传图文'}`);
  console.log(`textWithImages 长度: ${textWithImages?.length || 0}`);
  console.log(`textWithImages 包含占位符: ${(textWithImages || '').match(/\[图片\d+\]/g)?.length || 0}`);

  // 创建临时目录
  const tempDir = path.join(process.env.HOME, '.content-distributor', 'temp-images', Date.now().toString());
  fs.mkdirSync(tempDir, { recursive: true });

  let browser = null;
  let context = null;
  let page = null;

  try {
    // 1. 下载图片
    console.log('\n[1/4] 下载图片...');
    const localImages = await downloadImages(imageUrls, tempDir);
    console.log(`成功下载 ${localImages.length}/${imageUrls.length} 张图片`);

    // 2. 检查/启动 Chrome 调试端口
    console.log('\n[2/4] 连接浏览器...');

    let debugAvailable = await checkDebugPort();

    if (!debugAvailable) {
      console.log('Chrome 调试端口未启动，正在启动...');
      launchChromeWithDebug();

      // 等待 Chrome 启动
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 1000));
        debugAvailable = await checkDebugPort();
        if (debugAvailable) {
          console.log('Chrome 已启动');
          break;
        }
      }

      if (!debugAvailable) {
        throw new Error('无法启动 Chrome，请手动运行: open -a "Google Chrome" --args --remote-debugging-port=9222');
      }
    } else {
      console.log('Chrome 调试端口已就绪');
    }

    // 3. 连接到 Chrome
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${CONFIG.chrome.debugPort}`);

    // 获取或创建上下文
    const contexts = browser.contexts();
    context = contexts[0] || await browser.newContext();

    // 获取或创建页面
    const pages = context.pages();
    page = pages.find(p => p.url().includes('xiaohongshu')) || pages[0] || await context.newPage();

    // 4. 打开发布页面
    console.log('\n[3/4] 打开小红书发布页面...');
    try {
      await page.goto(CONFIG.xiaohongshu.publishUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
    } catch (e) {
      console.log(`页面导航警告: ${e.message}`);
    }

    // 等待页面完全加载
    await page.waitForTimeout(5000);

    // 检查登录状态 - 多种检测方式
    let needsLogin = false;
    const currentUrl = page.url();

    // 检查 URL
    if (currentUrl.includes('login') || currentUrl.includes('signin') || !currentUrl.includes('creator.xiaohongshu.com')) {
      needsLogin = true;
    }

    // 检查是否有登录相关元素
    const loginElements = await page.$$('.login, [class*="login"], [class*="Login"], .signin, [class*="signin"]');
    if (loginElements.length > 0) {
      needsLogin = true;
    }

    // 检查是否有发布相关的输入框（表示已登录）
    const hasEditor = await page.$(CONFIG.xiaohongshu.titleSelector);
    if (hasEditor) {
      needsLogin = false;
    }

    if (needsLogin) {
      console.log('');
      console.log('========================================');
      console.log('⚠ 检测到需要登录！');
      console.log('请在打开的 Chrome 浏览器窗口中登录小红书');
      console.log('系统会自动检测登录状态...');
      console.log('========================================');

      // 将页面带到前台
      await page.bringToFront();

      // 自动等待登录完成
      const maxWaitTime = 180000; // 最多等待 3 分钟
      const startTime = Date.now();
      let loggedIn = false;

      while (Date.now() - startTime < maxWaitTime) {
        await page.waitForTimeout(3000);

        // 检查 URL 变化
        const newUrl = page.url();
        if (newUrl.includes('creator.xiaohongshu.com') && !newUrl.includes('login') && !newUrl.includes('signin')) {
          // 再检查是否有编辑器
          const editor = await page.$(CONFIG.xiaohongshu.titleSelector);
          if (editor) {
            console.log('✓ 检测到登录成功！');
            loggedIn = true;
            break;
          }
        }

        // 每隔一段时间提示
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        if (elapsed % 15 === 0) {
          console.log(`等待登录中... (${elapsed}秒)`);
        }
      }

      if (!loggedIn) {
        throw new Error('登录超时，请重试');
      }

      // 登录后重新导航到发布页面
      try {
        await page.goto(CONFIG.xiaohongshu.publishUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
      } catch (e) {
        console.log(`页面导航警告: ${e.message}`);
      }
      await page.waitForTimeout(3000);
    }

    // 5. 根据用户选择的发布模式切换
    const isLongArticleMode = publishMode === 'longArticle';
    console.log(`\n[4/6] 切换到发布模式: ${isLongArticleMode ? '写长文' : '上传图文'}`);

    let imagesUploaded = false;
    let titleFilled = false;
    let contentFilled = false;

    if (isLongArticleMode) {
      // === 写长文模式 ===
      console.log('切换到"写长文"标签...');
      try {
        const tabs = await page.$$('.creator-tab');
        for (let i = 0; i < tabs.length; i++) {
          const text = await tabs[i].textContent();
          if (text?.includes('写长文')) {
            await tabs[i].evaluate(el => el.click());
            await page.waitForTimeout(2000);
            console.log('✓ 已切换到写长文模式');
            break;
          }
        }

        // 点击"新的创作"按钮
        console.log('点击"新的创作"...');
        const createBtn = await page.locator('button:has-text("新的创作")').first();
        if (await createBtn.count() > 0) {
          await createBtn.click({ force: true });
          await page.waitForTimeout(3000);
          console.log('✓ 已进入编辑页面');
        }
      } catch (e) {
        console.log(`⚠ 切换到写长文失败: ${e.message}`);
      }

      // 写长文模式：分段填充内容，在占位符位置插入图片
      console.log('\n[5/6] 填充内容（带图片占位符）...');

      // 填充标题
      try {
        let titleInput = await page.$(CONFIG.xiaohongshu.titleSelector);
        if (!titleInput) {
          titleInput = await page.$('textarea[placeholder*="标题"], textarea.d-text');
        }

        if (titleInput) {
          await titleInput.click();
          await titleInput.fill('');
          await page.waitForTimeout(50);
          await titleInput.fill(title);
          titleFilled = true;
          console.log('✓ 标题已填充');
        } else {
          console.log('⚠ 标题输入框未找到');
        }
      } catch (e) {
        console.log('⚠ 标题填充失败');
      }

      // 使用带图片占位符的文本
      const textToUse = textWithImages || plainText;
      const truncatedText = textToUse.length > 5000 ? textToUse.substring(0, 5000) + '...' : textToUse;

      // 解析文本，分割成文本段和图片占位符
      const placeholderPattern = /\[图片(\d+)\]/g;
      const segments = [];
      let lastIndex = 0;
      let match;

      while ((match = placeholderPattern.exec(truncatedText)) !== null) {
        // 添加占位符前的文本
        if (match.index > lastIndex) {
          segments.push({ type: 'text', content: truncatedText.substring(lastIndex, match.index) });
        }
        // 添加图片占位符
        const imageIndex = parseInt(match[1]) - 1; // 转换为0-based索引
        segments.push({ type: 'image', index: imageIndex });
        lastIndex = match.index + match[0].length;
      }
      // 添加最后一段文本
      if (lastIndex < truncatedText.length) {
        segments.push({ type: 'text', content: truncatedText.substring(lastIndex) });
      }

      // 如果没有占位符，整个文本作为一段
      if (segments.length === 0) {
        segments.push({ type: 'text', content: truncatedText });
      }

      // 合并相邻文本，并确保每个图片索引只插入一次（防止重复图片）
      const normalizedSegments = [];
      const insertedImageIndices = new Set(); // 记录已插入的图片索引

      for (const segment of segments) {
        if (segment.type === 'text') {
          if (!normalizedSegments.length) {
            normalizedSegments.push(segment);
            continue;
          }
          const prev = normalizedSegments[normalizedSegments.length - 1];
          if (prev.type === 'text') {
            prev.content = `${prev.content || ''}${segment.content || ''}`;
          } else {
            normalizedSegments.push(segment);
          }
          continue;
        }

        // 图片类型：检查是否已插入过该索引的图片
        if (insertedImageIndices.has(segment.index)) {
          // 已插入过相同索引的图片，跳过（避免重复）
          console.log(`跳过重复图片索引 ${segment.index + 1}`);
          continue;
        }

        normalizedSegments.push(segment);
        insertedImageIndices.add(segment.index);
      }

      const validImageSegmentCount = normalizedSegments.filter(
        (s) => s.type === 'image' && s.index >= 0 && s.index < localImages.length
      ).length;

      console.log(`解析结果: ${segments.length} 个片段（${segments.filter(s => s.type === 'image').length} 个图片占位符）`);
      console.log(`归一化后: ${normalizedSegments.length} 个片段（有效图片 ${validImageSegmentCount}）`);

      // 填充正文和图片
      try {
        const editorSelector = '.tiptap.ProseMirror, .ProseMirror[contenteditable="true"]';
        let editor = await page.$(editorSelector);
        if (!editor) {
          editor = await page.$(CONFIG.xiaohongshu.editorSelector);
        }

        if (editor) {
          await editor.click();
          await page.waitForTimeout(50);

          // 立即注入去重拦截器和上传拦截器（在任何图片操作之前）
          await injectImageDedupInterceptor(page);
          await interceptXhsUpload(page);
          await page.waitForTimeout(300); // 等待拦截器初始化

          await injectEditorImageStyle(page);

          // 清空
          await clearEditorContent(page, editorSelector);
          await page.waitForTimeout(100); // 等待清空完成

          let expectedInsertedImages = 0;

          // 逐段填充
          for (const segment of normalizedSegments) {
            if (segment.type === 'text') {
              const textContent = segment.content;
              if (textContent) {
                await pasteTextToEditor(page, editorSelector, textContent);
                await page.waitForTimeout(120);
              }
            } else if (segment.type === 'image') {
              // 插入图片
              const imageIndex = segment.index;
              if (imageIndex >= 0 && imageIndex < localImages.length) {
                const imagePath = localImages[imageIndex];
                console.log(`在位置插入图片 ${imageIndex + 1}: ${imagePath}`);
                const beforeImageCount = await getEditorImageCount(page, editorSelector);
                expectedInsertedImages += 1;

                // 优先使用拖拽上传方式
                let uploadResult = await uploadImageViaNativeInput(page, imagePath, imageIndex);

                // 如果拖拽上传失败，回退到剪贴板方式
                if (!uploadResult || !uploadResult.ok) {
                  console.log(`[上传] 拖拽上传失败，回退到 ClipboardEvent 方式`);
                  uploadResult = await pasteImageToEditor(page, editorSelector, imagePath, imageIndex);
                  if (!uploadResult.ok && uploadResult.reason === 'paste-locked') {
                    await page.waitForTimeout(300);
                    uploadResult = await pasteImageToEditor(page, editorSelector, imagePath, imageIndex);
                  }
                }

                await page.waitForTimeout(500); // 直接插入不需要长时间等待

                // 多次去重
                await cleanupXhsImageDomArtifacts(page, editorSelector);
                await page.waitForTimeout(200);
                await cleanupXhsImageDomArtifacts(page, editorSelector);
                await page.waitForTimeout(300);
                await cleanupXhsImageDomArtifacts(page, editorSelector);

                await normalizeInsertedImageStyle(page, editorSelector);
                const removedDuplicates = await deduplicateAdjacentImages(page, editorSelector);
                if (removedDuplicates > 0) {
                  console.log(`已去重相邻重复图片: ${removedDuplicates} 张`);
                }
                const removedArtifacts = await cleanupXhsImageDomArtifacts(page, editorSelector);
                if (removedArtifacts > 0) {
                  console.log(`已清理小红书图片残留节点: ${removedArtifacts} 个`);
                }
                const removedOverflow = await trimExtraInsertedImages(page, editorSelector, beforeImageCount, 1);
                if (removedOverflow > 0) {
                  console.log(`已移除超额新增图片: ${removedOverflow} 张`);
                }
                const removedByCap = await enforceMaxImageCount(page, editorSelector, expectedInsertedImages);
                if (removedByCap > 0) {
                  console.log(`按阶段上限移除图片: ${removedByCap} 张（上限 ${expectedInsertedImages}）`);
                }

                // 强制触发全局去重
                await page.evaluate(() => {
                  if (typeof window.__forceDedup === 'function') {
                    window.__forceDedup();
                    window.__forceDedup();
                    window.__forceDedup();
                  }
                });
              }
            }
          }

          // 最终收敛：直接插入不需要长时间等待
          // 多次去重
          for (let i = 0; i < 3; i++) {
            await page.waitForTimeout(200);
            const removed = await cleanupXhsImageDomArtifacts(page, editorSelector);
            if (removed === 0) break;
          }
          const removedAfterSettle = await settleAndEnforceImageCount(page, editorSelector, validImageSegmentCount);
          if (removedAfterSettle > 0) {
            console.log(`最终收敛移除重复图片: ${removedAfterSettle} 张（目标总数 ${validImageSegmentCount}）`);
          }
          const removedArtifactsAfterSettle = await cleanupXhsImageDomArtifacts(page, editorSelector);
          if (removedArtifactsAfterSettle > 0) {
            console.log(`最终清理小红书图片残留节点: ${removedArtifactsAfterSettle} 个`);
          }

          contentFilled = true;
          imagesUploaded = localImages.length > 0;
          console.log('✓ 正文和图片已填充');
        } else {
          console.log('⚠ 正文编辑器未找到');
        }
      } catch (e) {
        console.log('⚠ 正文填充失败:', e.message);
      }

    } else {
      // === 上传图文模式 ===
      console.log('切换到"上传图文"标签...');
      try {
        const tabs = await page.$$('.creator-tab');
        let uploadImageTabIndex = -1;
        for (let i = 0; i < tabs.length; i++) {
          const text = await tabs[i].textContent();
          if (text?.includes('上传图文') && !text?.includes('视频')) {
            uploadImageTabIndex = i;
          }
        }

        if (uploadImageTabIndex >= 0) {
          await tabs[uploadImageTabIndex].evaluate(el => el.click());
          await page.waitForTimeout(3000);
          console.log('✓ 已切换到图文上传模式');
        }
      } catch (e) {
        console.log(`⚠ 切换标签失败: ${e.message}`);
      }

      // 上传图片（如果有）
      if (localImages.length > 0) {
        console.log('\n[5/6] 上传图片...');
        console.log(`图片文件: ${localImages.join(', ')}`);

        try {
          await page.waitForTimeout(2000);
          const fileInputs = await page.$$('input[type="file"]');
          console.log(`找到 ${fileInputs.length} 个 file input`);

          if (fileInputs.length > 0) {
            console.log(`准备上传 ${localImages.length} 张图片...`);
            await fileInputs[0].setInputFiles(localImages);
            imagesUploaded = true;
            console.log(`✓ 已上传 ${localImages.length} 张图片`);
            console.log('等待进入编辑页面...');
            await page.waitForTimeout(5000);
          } else {
            console.log('⚠ 未找到图片上传入口');
          }
        } catch (e) {
          console.log(`⚠ 图片上传失败: ${e.message}`);
        }
      }
    }

    // 6. 填充内容（仅上传图文模式需要，写长文模式已在上面处理）
    if (!isLongArticleMode) {
      console.log('\n[6/6] 填充内容...');

      // 填充标题 - 尝试多种选择器
      try {
        // 先尝试标准选择器
        let titleInput = await page.$(CONFIG.xiaohongshu.titleSelector);

        if (titleInput) {
          await titleInput.click();
          await titleInput.fill('');
          await page.waitForTimeout(50);
          await titleInput.fill(title);
          titleFilled = true;
          console.log('✓ 标题已填充');
        } else {
          console.log('⚠ 标题输入框未找到');
        }
      } catch (e) {
        console.log('⚠ 标题填充失败');
      }

      // 填充正文 - 尝试多种选择器
      try {
        let editor = await page.$(CONFIG.xiaohongshu.editorSelector);

        if (editor) {
          await editor.click();
          await page.waitForTimeout(50);

          // 清空
          await page.keyboard.down('Meta');
          await page.keyboard.press('a');
          await page.keyboard.up('Meta');
          await page.keyboard.press('Backspace');
          await page.waitForTimeout(50);

          // 填充正文
          const textToInput = plainText.length > 5000 ? plainText.substring(0, 5000) + '...' : plainText;
          await page.keyboard.type(textToInput, { delay: 1 });
          contentFilled = true;
          console.log('✓ 正文已填充');
        } else {
          console.log('⚠ 正文编辑器未找到');
        }
      } catch (e) {
        console.log('⚠ 正文填充失败');
      }
    }

    // 将页面带到前台
    await page.bringToFront();

    console.log('\n========================================');
    console.log('内容填充状态:');
    console.log(`  标题: ${titleFilled ? '✓' : '✗'}`);
    console.log(`  正文: ${contentFilled ? '✓' : '✗'}`);
    console.log(`  图片: ${localImages.length === 0 ? '无' : (imagesUploaded ? '✓' : '✗')}`);
    console.log('========================================');
    console.log('请在 Chrome 浏览器中检查并发布');

    return {
      success: true,
      message: '内容已填充',
      details: { titleFilled, contentFilled, imagesUploaded, imageCount: localImages.length }
    };

  } catch (error) {
    console.error('\n❌ 同步失败:', error.message);
    return { success: false, error: error.message };
  } finally {
    // 断开连接（不关闭浏览器）
    if (browser) {
      await browser.close().catch(() => {});
    }

    // 清理临时文件
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log('临时文件已清理');
    } catch (e) {}
  }
}

module.exports = { syncToXiaohongshu };

// 直接运行
if (require.main === module) {
  const content = {
    title: process.argv[2] || '测试标题',
    text: process.argv[3] || '测试正文内容',
    imageUrls: []
  };
  syncToXiaohongshu(content);
}
