#!/bin/bash
# DevBox 环境状态检查脚本

echo "======================================"
echo "📊 长安盛世 - 服务状态"
echo "======================================"
date
echo ""

# 1. 检查后端服务
echo "🔍 后端服务（端口 8888）："
BACKEND_PID=$(lsof -t -i:8888 2>/dev/null)
if [ -n "$BACKEND_PID" ]; then
    echo "   ✅ 运行中 (PID: $BACKEND_PID)"
    ps -p $BACKEND_PID -o pid,ppid,%cpu,%mem,etime,cmd | tail -1 | sed 's/^/      /'
    
    # 检查健康状态
    if curl -s http://localhost:8889/status > /dev/null 2>&1; then
        echo "   ✅ 健康检查通过"
        curl -s http://localhost:8889/status | head -5 | sed 's/^/      /'
    else
        echo "   ⚠️  健康检查失败"
    fi
else
    echo "   ❌ 未运行"
fi
echo ""

# 2. 检查前端服务
echo "🌐 前端服务（端口 8080）："
FRONTEND_PID=$(lsof -t -i:8080 2>/dev/null)
if [ -n "$FRONTEND_PID" ]; then
    echo "   ✅ 运行中 (PID: $FRONTEND_PID)"
    ps -p $FRONTEND_PID -o pid,ppid,%cpu,%mem,etime,cmd | tail -1 | sed 's/^/      /'
    
    # 检查访问状态
    if curl -s http://localhost:8080 > /dev/null 2>&1; then
        echo "   ✅ 访问正常"
    else
        echo "   ⚠️  访问失败"
    fi
else
    echo "   ❌ 未运行"
fi
echo ""

# 3. 网络连接统计
echo "🌐 活跃连接："
WS_CONN=$(netstat -an 2>/dev/null | grep :8888 | grep ESTABLISHED | wc -l)
HTTP_CONN=$(netstat -an 2>/dev/null | grep :8080 | grep ESTABLISHED | wc -l)
echo "   WebSocket (8888): $WS_CONN 个连接"
echo "   HTTP (8080): $HTTP_CONN 个连接"
echo ""

# 4. 最近的日志
echo "📋 最近的日志："
if [ -f backend.log ]; then
    echo "   后端日志（最后 3 行）："
    tail -3 backend.log | sed 's/^/      /'
else
    echo "   ⚠️  backend.log 不存在"
fi
echo ""

if [ -f frontend.log ]; then
    echo "   前端日志（最后 3 行）："
    tail -3 frontend.log | sed 's/^/      /'
else
    echo "   ⚠️  frontend.log 不存在"
fi
echo ""

# 5. 错误统计
echo "⚠️  错误统计："
if [ -f backend.log ]; then
    ERROR_COUNT=$(grep -i error backend.log 2>/dev/null | wc -l)
    echo "   后端错误: $ERROR_COUNT 条"
fi
if [ -f frontend.log ]; then
    ERROR_COUNT=$(grep -i error frontend.log 2>/dev/null | wc -l)
    echo "   前端错误: $ERROR_COUNT 条"
fi
echo ""

echo "======================================"
