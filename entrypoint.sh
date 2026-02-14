#!/bin/bash
# Sealos 应用启动脚本
# ⚠️ 重要：构建必须在发布前完成（npm run build:h5）

set -e

echo "🚀 启动盛世长安应用..."

# 1. 检查构建产物
if [ ! -d "dist" ]; then
  echo "❌ 错误：未找到 dist 目录"
  echo "   请在发布前运行: npm run build:h5"
  exit 1
fi

# 2. 显示环境配置
echo "📝 环境配置："
echo "   PUBLIC_HOST: ${PUBLIC_HOST:-未设置}"
echo "   PUBLIC_PROTOCOL: ${PUBLIC_PROTOCOL:-wss}"
echo "   WS_PORT: ${WS_PORT:-8888}"
echo "   HTTP_PORT: ${HTTP_PORT:-8889}"
echo ""

# 3. 启动后端服务（后台）
echo "🔧 启动后端 WebSocket 服务..."
node server/lan-server.js &
BACKEND_PID=$!

# 4. 等待后端启动
sleep 2

# 5. 检查后端是否启动成功
if ! kill -0 $BACKEND_PID 2>/dev/null; then
  echo "❌ 后端服务启动失败"
  exit 1
fi

echo "✅ 后端服务已启动 (PID: $BACKEND_PID)"
echo ""

# 6. 启动前端静态服务（主进程，保持容器运行）
echo "🎨 启动前端静态服务..."
echo "   监听端口: 8080"
echo "   准备就绪！"
echo ""

# serve 作为主进程（不使用 &，保持前台运行）
exec npx serve -s dist -l 8080
