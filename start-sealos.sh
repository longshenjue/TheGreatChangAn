#!/bin/bash
# Sealos 部署启动脚本

echo "🚀 开始部署长安盛世..."

# 1. 安装依赖
echo "📦 安装依赖..."
npm install

# 2. 构建前端（注入环境变量）
echo "🎨 构建前端..."
echo "   后端配置: ${PUBLIC_HOST:-未设置} (${PUBLIC_PROTOCOL:-wss})"

# 将后端配置注入到前端构建
export BACKEND_HOST="${PUBLIC_HOST:-localhost}"
# Sealos 应用部署：如果是 WSS，使用 443；否则使用配置的端口
if [ "${PUBLIC_PROTOCOL}" = "wss" ]; then
  export BACKEND_PORT="443"
else
  export BACKEND_PORT="${WS_PORT:-8888}"
fi
export BACKEND_PROTOCOL="${PUBLIC_PROTOCOL:-wss}"

npm run build:h5

# 3. 启动后端服务器
echo "🔧 启动后端服务器..."
node server/lan-server.js &
BACKEND_PID=$!

# 4. 启动前端服务
echo "🌐 启动前端服务..."
npx serve -s dist -l 8080 &
FRONTEND_PID=$!

# 5. 等待进程
echo "✅ 部署完成！"
echo "   前端服务: http://0.0.0.0:8080"
echo "   后端服务: ws://0.0.0.0:8888"

# 保持脚本运行
wait $BACKEND_PID $FRONTEND_PID
