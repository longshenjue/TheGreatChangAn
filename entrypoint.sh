#!/bin/bash
# Sealos 应用启动脚本
# ⚠️ DevBox 发布时 dist 目录不会包含（在 .gitignore 中）
# 因此需要在首次启动时构建

set -e

echo "🚀 启动盛世长安应用..."

# 1. 检查并构建前端（如果需要）
if [ ! -d "dist" ]; then
  echo "📦 未找到构建产物，开始构建前端..."
  echo "   这可能需要 1-2 分钟，请耐心等待..."
  
  # 构建前注入环境变量
  export BACKEND_HOST="${PUBLIC_HOST:-localhost}"
  if [ "${PUBLIC_PROTOCOL}" = "wss" ]; then
    export BACKEND_PORT="443"
  else
    export BACKEND_PORT="${WS_PORT:-8888}"
  fi
  export BACKEND_PROTOCOL="${PUBLIC_PROTOCOL:-wss}"
  
  npm run build:h5
  
  if [ ! -d "dist" ]; then
    echo "❌ 构建失败：dist 目录未生成"
    exit 1
  fi
  
  echo "✅ 构建完成！"
  echo ""
else
  echo "✅ 找到构建产物，跳过构建步骤"
  echo ""
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
