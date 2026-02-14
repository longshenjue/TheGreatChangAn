#!/bin/bash
# DevBox 环境停止脚本

echo "🛑 停止长安盛世服务..."
echo ""

# 方式1：通过 PID 文件停止
if [ -f ".backend.pid" ]; then
    BACKEND_PID=$(cat .backend.pid)
    if ps -p $BACKEND_PID > /dev/null 2>&1; then
        kill $BACKEND_PID
        echo "✅ 后端已停止 (PID: $BACKEND_PID)"
    else
        echo "⚠️  后端进程不存在"
    fi
    rm .backend.pid
fi

if [ -f ".frontend.pid" ]; then
    FRONTEND_PID=$(cat .frontend.pid)
    if ps -p $FRONTEND_PID > /dev/null 2>&1; then
        kill $FRONTEND_PID
        echo "✅ 前端已停止 (PID: $FRONTEND_PID)"
    else
        echo "⚠️  前端进程不存在"
    fi
    rm .frontend.pid
fi

# 方式2：强制停止所有相关进程
echo ""
echo "🧹 清理残留进程..."
pkill -f "node server/lan-server.js" 2>/dev/null && echo "   清理后端进程" || true
pkill -f "serve.*dist" 2>/dev/null && echo "   清理前端进程" || true

sleep 2

# 验证是否停止成功
echo ""
echo "🔍 验证服务状态..."
RUNNING=$(ps aux | grep -E "lan-server|serve.*dist" | grep -v grep | wc -l)

if [ $RUNNING -eq 0 ]; then
    echo "✅ 所有服务已停止"
else
    echo "⚠️  仍有 $RUNNING 个进程在运行："
    ps aux | grep -E "lan-server|serve.*dist" | grep -v grep
fi
echo ""
