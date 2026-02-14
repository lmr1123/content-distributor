// 知乎自动填充脚本

(function() {
  console.log('知乎内容填充脚本已加载');

  // 检查是否有待填充的内容
  chrome.storage.local.get(['pendingContent'], async (result) => {
    if (result.pendingContent) {
      const { platform, content, timestamp } = result.pendingContent;

      // 检查是否是最近的内容（5分钟内）
      if (platform === 'zhihu' && Date.now() - timestamp < 5 * 60 * 1000) {
        await waitForPageLoad();
        await fillZhihuContent(content);

        // 清除待填充内容
        chrome.storage.local.remove('pendingContent');
      }
    }
  });

  async function waitForPageLoad() {
    return new Promise((resolve) => {
      if (document.readyState === 'complete') {
        setTimeout(resolve, 2000);
      } else {
        window.addEventListener('load', () => {
          setTimeout(resolve, 2000);
        });
      }
    });
  }

  async function fillZhihuContent(content) {
    try {
      // 等待编辑器加载
      await waitForSelector('.public-DraftEditor-content, [contenteditable="true"]', 15000);

      // 填充标题
      const titleInput = document.querySelector('input[placeholder*="标题"]') ||
                        document.querySelector('.TitleInput input') ||
                        document.querySelector('input[class*="title"]');

      if (titleInput) {
        titleInput.value = content.title || '';
        titleInput.dispatchEvent(new Event('input', { bubbles: true }));
        titleInput.dispatchEvent(new Event('change', { bubbles: true }));
        console.log('标题已填充');
      }

      await sleep(1000);

      // 填充正文 - 知乎使用 Draft.js
      const editor = document.querySelector('.public-DraftEditor-content') ||
                    document.querySelector('[contenteditable="true"]');

      if (editor) {
        editor.focus();

        // 对于富文本内容，使用剪贴板方式
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content.body;

        // 创建一个简化的HTML版本
        const simplifiedHtml = simplifyHtml(content.body);

        // 使用 ClipboardEvent 插入内容
        const clipboardData = new DataTransfer();
        clipboardData.setData('text/html', simplifiedHtml);
        clipboardData.setData('text/plain', content.text);

        const clipboardEvent = new ClipboardEvent('paste', {
          clipboardData: clipboardData,
          bubbles: true,
          cancelable: true
        });

        editor.dispatchEvent(clipboardEvent);
        console.log('正文已填充');
      }

      showNotification('内容已自动填充，请检查并完善');

    } catch (error) {
      console.error('填充内容失败:', error);
      showNotification('自动填充失败，请手动粘贴内容', 'error');
    }
  }

  function simplifyHtml(html) {
    // 简化HTML，只保留基本格式
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/class="[^"]*"/gi, '')
      .replace(/style="[^"]*"/gi, '')
      .replace(/data-[a-z-]+="[^"]*"/gi, '');
  }

  function waitForSelector(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver((mutations, obs) => {
        const element = document.querySelector(selector);
        if (element) {
          obs.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error('等待元素超时'));
      }, timeout);
    });
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 24px;
      background: ${type === 'success' ? '#0066ff' : '#ef4444'};
      color: white;
      border-radius: 8px;
      z-index: 10000;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => notification.remove(), 3000);
  }

})();
