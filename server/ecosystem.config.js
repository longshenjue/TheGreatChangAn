/**
 * PM2 进程管理配置文件
 * 用于云服务器部署
 * 
 * 使用方法：
 *   pm2 start ecosystem.config.js
 *   pm2 logs changAn-server
 *   pm2 restart changAn-server
 *   pm2 stop changAn-server
 */

module.exports = {
  apps: [
    {
      name: 'changAn-server',
      script: './lan-server.js',
      cwd: __dirname,
      
      // 实例数量（根据CPU核心数调整）
      instances: 1,
      exec_mode: 'fork',
      
      // 自动重启配置
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      
      // 环境变量配置
      env: {
        NODE_ENV: 'development',
        // 本地开发：留空，自动使用局域网IP
        PUBLIC_HOST: '',
        PUBLIC_PROTOCOL: 'ws',
        WS_PORT: 8888,
        HTTP_PORT: 8889
      },
      
      env_production: {
        NODE_ENV: 'production',
        // 云服务器部署：填入你的公网IP或域名
        // PUBLIC_HOST: 'yourdomain.com',  // 取消注释并填入
        // PUBLIC_PROTOCOL: 'wss',          // HTTPS用wss
        PUBLIC_HOST: '',  // 或填入公网IP: '123.456.789.0'
        PUBLIC_PROTOCOL: 'ws',
        WS_PORT: 8888,
        HTTP_PORT: 8889
      },
      
      // 日志配置
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/error.log',
      out_file: './logs/output.log',
      merge_logs: true,
      
      // 进程标题
      instance_var: 'INSTANCE_ID'
    }
  ]
};
