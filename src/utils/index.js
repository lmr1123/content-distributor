/**
 * 通用工具函数
 */

/**
 * 延迟函数
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 移除数组重复元素
 */
export function uniqueArray(arr) {
  return [...new Set(arr)];
}

/**
 * 从对象中提取指定属性
 */
export function pick(obj, keys) {
  return keys.reduce((acc, key) => {
    if (key in obj) acc[key] = obj[key];
    return acc;
  }, {});
}
