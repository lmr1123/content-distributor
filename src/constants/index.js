/**
 * 平台配置常量
 */

export const PLATFORMS = {
  xiaohongshu: {
    id: 'xiaohongshu',
    name: '小红书',
    limit: 1000,
    url: 'https://creator.xiaohongshu.com/publish/publish?from=tab_switch&target=article'
  },
  zhihu: {
    id: 'zhihu',
    name: '知乎',
    limit: null,
    url: 'https://zhuanlan.zhihu.com/write'
  },
  jianshu: {
    id: 'jianshu',
    name: '简书',
    limit: null,
    url: 'https://www.jianshu.com/writer'
  },
  toutiao: {
    id: 'toutiao',
    name: '今日头条',
    limit: 5000,
    url: 'https://mp.toutiao.com/profile_v4/index/creation'
  },
  bilibili: {
    id: 'bilibili',
    name: '哔哩哔哩',
    limit: null,
    url: 'https://member.bilibili.com/platform/article/text/new'
  }
};

export const PLAYWRIGHT_CONFIG = {
  serverPort: 3456,
  chromePort: 9222,
  timeout: 60000
};

export const WECHAT_URL_PATTERNS = [
  /mp\.weixin\.qq\.com/,
  /mp\.weixin\.qq\.com\/s/,
  /weixin\.qq\.com/
];

export const WECHAT_HOST_PERMISSIONS = [
  'https://mp.weixin.qq.com/*',
  'https://mmbiz.qpic.cn/*',
  'https://*.qpic.cn/*'
];

export const PLATFORM_HOST_PERMISSIONS = [
  'https://*.xiaohongshu.com/*',
  'https://*.zhihu.com/*',
  'https://*.jianshu.com/*',
  'https://*.toutiao.com/*',
  'https://*.bilibili.com/*'
];
