#!/bin/bash
# DevBox 环境启动脚本（改进版）

set -e  # 遇到错误立即退出

echo "======================================"
echo "🚀 长安盛世 - DevBox 部署启动"
echo "======================================"
echo ""

# 检查是否在项目目录
if [ ! -f "package.json" ]; then
    echo "❌ 错误：请在项目根目录执行此脚本"
    exit 1
fi

# 1. 设置环境变量（根据实际情况修改）
echo "🔧 配置环境变量..."
export PUBLIC_HOST="${PUBLIC_HOST:-byerlmoutikg.sealoshzh.site}"
export PUBLIC_PROTOCOL="${PUBLIC_PROTOCOL:-wss}"
export WS_PORT="${WS_PORT:-8888}"
export HTTP_PORT="${HTTP_PORT:-8889}"
export NODE_ENV="${NODE_ENV:-production}"

echo "   PUBLIC_HOST: $PUBLIC_HOST"
echo "   PUBLIC_PROTOCOL: $PUBLIC_PROTOCOL"
echo "   WS_PORT: $WS_PORT"
echo ""

# 2. 检查依赖是否已安装
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
else
    echo "✅ 依赖已安装"
fi
echo ""

# 3. 构建前端
echo "🎨 构建前端..."
npm run build:h5
echo ""

# 4. 停止旧进程（如果存在）
echo "🛑 停止旧进程..."
pkill -f "node server/lan-server.js" 2>/dev/null || true
pkill -f "serve.*dist" 2>/dev/null || true
sleep 2
echo ""

# 5. 启动后端服务器
echo "🔧 启动后端服务器..."
nohup node server/lan-server.js > backend.log 2>&1 &
BACKEND_PID=$!
echo "   后端 PID: $BACKEND_PID"
echo "   日志文件: backend.log"
sleep 2

# 检查后端是否启动成功
if ps -p $BACKEND_PID > /dev/null 2>&1; then
    echo "   ✅ 后端启动成功"
else
    echo "   ❌ 后端启动失败，请查看日志："
    tail -20 backend.log
    exit 1
fi
echo ""

# 6. 启动前端服务
echo "🌐 启动前端服务..."
nohup npx serve -s dist -l 8080 > frontend.log 2>&1 &
FRONTEND_PID=$!
echo "   前端 PID: $FRONTEND_PID"
echo "   日志文件: frontend.log"
sleep 2

# 检查前端是否启动成功
if ps -p $FRONTEND_PID > /dev/null 2>&1; then
    echo "   ✅ 前端启动成功"
else
    echo "   ❌ 前端启动失败，请查看日志："
    tail -20 frontend.log
    exit 1
fi
echo ""

# 7. 测试服务
echo "🧪 测试服务..."
sleep 3

# 测试后端健康检查
if curl -s http://localhost:$HTTP_PORT/status > /dev/null 2>&1; then
    echo "   ✅ 后端健康检查通过"
else
    echo "   ⚠️  后端健康检查失败（可能还在启动中）"
fi

# 测试前端
if curl -s http://localhost:8080 > /dev/null 2>&1; then
    echo "   ✅ 前端访问正常"
else
    echo "   ⚠️  前端访问失败（可能还在启动中）"
fi
echo ""

# 8. 显示访问信息
echo "======================================"
echo "✅ 部署完成！"
echo "======================================"
echo ""
echo "📱 访问地址："
echo "   前端: https://bpuwgiqhfxzg.sealoshzh.site"
echo "   后端: wss://$PUBLIC_HOST:$WS_PORT"
echo ""
echo "📊 监控命令："
echo "   查看后端日志: tail -f backend.log"
echo "   查看前端日志: tail -f frontend.log"
echo "   查看进程状态: ps aux | grep -E 'node|serve' | grep -v grep"
echo "   查看端口占用: lsof -i :8080 -i :8888"
echo ""
echo "🛑 停止服务："
echo "   停止后端: kill $BACKEND_PID"
echo "   停止前端: kill $FRONTEND_PID"
echo "   停止全部: pkill -f 'lan-server' && pkill -f 'serve'"
echo ""
echo "======================================"
echo ""

# 保存 PID 到文件（方便后续管理）
echo $BACKEND_PID > .backend.pid
echo $FRONTEND_PID > .frontend.pid

echo "💡 提示：服务已在后台运行，关闭终端不会影响服务"
echo "    进程 ID 已保存到 .backend.pid 和 .frontend.pid"
echo ""
