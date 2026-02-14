// 通用平台自动填充脚本（适用于简书、今日头条、哔哩哔哩等）

(function() {
  console.log('通用内容填充脚本已加载');

  // 平台配置
  const PLATFORM_CONFIG = {
    jianshu: {
      name: '简书',
      titleSelectors: [
        'input[placeholder*="标题"]',
        '.title-input input',
        'input[name="title"]'
      ],
      contentSelectors: [
        '[contenteditable="true"]',
        '.ql-editor',
        '.draft-editor',
        '.editor-content'
      ]
    },
    toutiao: {
      name: '今日头条',
      titleSelectors: [
        'input[placeholder*="标题"]',
        'input[placeholder*="请输入标题"]',
        '.title-input input'
      ],
      contentSelectors: [
        '[contenteditable="true"]',
        '.ql-editor',
        '.editor-content',
        '.mega-editor-content'
      ]
    },
    bilibili: {
      name: '哔哩哔哩',
      titleSelectors: [
        'input[placeholder*="标题"]',
        '.title-input input',
        'input[name="title"]'
      ],
      contentSelectors: [
        '[contenteditable="true"]',
        '.ql-editor',
        '.editor-content',
        '.braft-editor-content'
      ]
    }
  };

  // 检测当前平台
  function detectPlatform() {
    const hostname = window.location.hostname;
    if (hostname.includes('jianshu')) return 'jianshu';
    if (hostname.includes('toutiao')) return 'toutiao';
    if (hostname.includes('bilibili')) return 'bilibili';
    return null;
  }

  // 检查是否有待填充的内容
  chrome.storage.local.get(['pendingContent'], async (result) => {
    if (result.pendingContent) {
      const { platform, content, timestamp } = result.pendingContent;

      // 检查是否是最近的内容（5分钟内）
      if (Date.now() - timestamp < 5 * 60 * 1000) {
        const currentPlatform = detectPlatform();

        if (currentPlatform === platform || !currentPlatform) {
          await waitForPageLoad();
          await fillContent(platform, content);

          // 清除待填充内容
          chrome.storage.local.remove('pendingContent');
        }
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

  async function fillContent(platform, content) {
    const config = PLATFORM_CONFIG[platform];
    if (!config) {
      console.error('不支持的平台:', platform);
      return;
    }

    try {
      console.log(`开始填充 ${config.name} 内容...`);

      // 等待编辑器加载
      await waitForAnySelector(config.titleSelectors.concat(config.contentSelectors), 15000);

      // 填充标题
      for (const selector of config.titleSelectors) {
        const titleInput = document.querySelector(selector);
        if (titleInput) {
          titleInput.value = content.title || '';
          titleInput.dispatchEvent(new Event('input', { bubbles: true }));
          titleInput.dispatchEvent(new Event('change', { bubbles: true }));
          console.log('标题已填充');
          break;
        }
      }

      await sleep(1000);

      // 填充正文
      for (const selector of config.contentSelectors) {
        const editor = document.querySelector(selector);
        if (editor) {
          editor.focus();

          // 尝试使用 execCommand
          document.execCommand('selectAll', false, null);

          // 对于支持HTML的编辑器，使用剪贴板方式
          try {
            const clipboardData = new DataTransfer();
            clipboardData.setData('text/html', content.body);
            clipboardData.setData('text/plain', content.text);

            const clipboardEvent = new ClipboardEvent('paste', {
              clipboardData: clipboardData,
              bubbles: true,
              cancelable: true
            });

            editor.dispatchEvent(clipboardEvent);
            console.log('正文已通过剪贴板填充');
          } catch (e) {
            // 回退到纯文本方式
            document.execCommand('insertText', false, content.text);
            console.log('正文已通过纯文本填充');
          }

          editor.dispatchEvent(new Event('input', { bubbles: true }));
          break;
        }
      }

      showNotification(`内容已自动填充到${config.name}，请检查并完善`);

    } catch (error) {
      console.error('填充内容失败:', error);
      showNotification('自动填充失败，请手动粘贴内容', 'error');
    }
  }

  function waitForAnySelector(selectors, timeout = 10000) {
    return new Promise((resolve, reject) => {
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          resolve(element);
          return;
        }
      }

      const observer = new MutationObserver((mutations, obs) => {
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element) {
            obs.disconnect();
            resolve(element);
            return;
          }
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
      background: ${type === 'success' ? '#22c55e' : '#ef4444'};
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
