/**
 * 头像辅助工具
 */

import avatarCat from '../assets/images/cat.png';
import avatarDog from '../assets/images/dog.png';

// 默认头像列表
const DEFAULT_AVATARS = [
  avatarCat,  // 猫咪皇帝
  avatarDog,  // 柯基
];

/**
 * 获取随机默认头像
 */
export function getRandomAvatar(): string {
  const index = Math.floor(Math.random() * DEFAULT_AVATARS.length);
  return DEFAULT_AVATARS[index];
}

/**
 * 根据用户ID获取固定头像（确保同一用户总是得到相同头像）
 */
export function getAvatarByUserId(userId: string): string {
  // 使用用户ID的hash来确定头像索引
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  const index = Math.abs(hash) % DEFAULT_AVATARS.length;
  return DEFAULT_AVATARS[index];
}

/**
 * 验证头像URL是否有效
 */
export function isValidAvatarUrl(url: string | undefined): boolean {
  if (!url) return false;
  return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:') || url.startsWith('data:');
}

/**
 * 获取头像URL，如果无效则返回默认头像
 */
export function getAvatarUrl(url: string | undefined, userId?: string): string {
  if (isValidAvatarUrl(url)) {
    return url!;
  }
  return userId ? getAvatarByUserId(userId) : getRandomAvatar();
}
