/**
 * 服务器配置
 * 支持本地开发和云服务器部署
 */

export interface ServerConfig {
  host: string;
  port: string;
  protocol: 'ws' | 'wss';
  name: string;
}

export const SERVER_CONFIG: Record<string, ServerConfig> = {
  // 生产环境（云服务器）
  // 优先使用构建时注入的环境变量，否则使用默认值
  production: {
    host: typeof BACKEND_HOST !== 'undefined' && BACKEND_HOST ? BACKEND_HOST : 'byerlmoutikg.sealoshzh.site',
    port: typeof BACKEND_PORT !== 'undefined' && BACKEND_PORT ? BACKEND_PORT : '443',
    protocol: (typeof BACKEND_PROTOCOL !== 'undefined' && BACKEND_PROTOCOL ? BACKEND_PROTOCOL : 'wss') as 'ws' | 'wss',
    name: '生产服务器'
  },
  
  // 开发环境（本地测试）
  development: {
    host: 'localhost',
    port: '8888',
    protocol: 'ws',
    name: '本地服务器'
  }
};

/**
 * 获取当前环境的服务器配置
 */
export function getServerConfig(): ServerConfig {
  // 可以通过环境变量控制
  const env = process.env.NODE_ENV === 'production' ? 'production' : 'development';
  return SERVER_CONFIG[env];
}

/**
 * 获取服务器显示名称
 */
export function getServerDisplayName(): string {
  const config = getServerConfig();
  return `${config.name} (${config.host}:${config.port})`;
}
