#!/bin/bash

# 盛世长安 - 服务器部署脚本

echo "🚀 开始部署盛世长安游戏服务器..."

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查Node.js
echo "📦 检查Node.js..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js未安装，请先安装Node.js v16或更高版本${NC}"
    exit 1
fi
NODE_VERSION=$(node -v)
echo -e "${GREEN}✅ Node.js版本: $NODE_VERSION${NC}"

# 检查npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm未安装${NC}"
    exit 1
fi
NPM_VERSION=$(npm -v)
echo -e "${GREEN}✅ npm版本: $NPM_VERSION${NC}"

# 安装依赖
echo "📦 安装依赖..."
npm install
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 依赖安装失败${NC}"
    exit 1
fi
echo -e "${GREEN}✅ 依赖安装成功${NC}"

# 检查PM2
echo "📦 检查PM2..."
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}⚠️  PM2未安装，正在安装...${NC}"
    npm install -g pm2
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ PM2安装失败${NC}"
        exit 1
    fi
fi
PM2_VERSION=$(pm2 -v)
echo -e "${GREEN}✅ PM2版本: $PM2_VERSION${NC}"

# 创建日志目录
echo "📁 创建日志目录..."
mkdir -p logs
echo -e "${GREEN}✅ 日志目录创建成功${NC}"

# 复制环境变量文件
if [ ! -f .env ]; then
    echo "📝 创建环境变量文件..."
    cp .env.example .env
    echo -e "${YELLOW}⚠️  请编辑 .env 文件配置服务器参数${NC}"
fi

# 停止旧服务
echo "🛑 停止旧服务..."
pm2 stop changan-game 2>/dev/null || true
pm2 delete changan-game 2>/dev/null || true
echo -e "${GREEN}✅ 旧服务已停止${NC}"

# 启动新服务
echo "🚀 启动新服务..."
pm2 start ecosystem.config.js --env production
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 服务启动失败${NC}"
    exit 1
fi
echo -e "${GREEN}✅ 服务启动成功${NC}"

# 保存PM2配置
echo "💾 保存PM2配置..."
pm2 save
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  PM2配置保存失败${NC}"
fi

# 设置开机自启
echo "🔄 设置开机自启..."
pm2 startup > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 开机自启设置成功${NC}"
else
    echo -e "${YELLOW}⚠️  开机自启设置失败，请手动执行：pm2 startup${NC}"
fi

# 显示服务状态
echo ""
echo "📊 服务状态："
pm2 status

# 显示日志位置
echo ""
echo -e "${GREEN}✅ 部署完成！${NC}"
echo ""
echo "📌 服务信息："
echo "  - 服务名称: changan-game"
echo "  - 运行端口: 8888"
echo "  - 日志目录: ./logs"
echo ""
echo "📝 常用命令："
echo "  - 查看状态: pm2 status"
echo "  - 查看日志: pm2 logs changan-game"
echo "  - 重启服务: pm2 restart changan-game"
echo "  - 停止服务: pm2 stop changan-game"
echo "  - 实时监控: pm2 monit"
echo ""
echo "🌐 访问地址："
echo "  - ws://$(hostname -I | awk '{print $1}'):8888"
echo ""
