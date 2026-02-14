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
  // 部署时修改这里的IP地址为你的云服务器IP
  production: {
    host: 'byerlmoutikg.sealoshzh.site',  // Sealos DevBox 后端专属域名
    port: '443',  // WSS 使用 443 端口（HTTPS 默认端口）
    protocol: 'wss',
    name: 'Sealos DevBox'
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
