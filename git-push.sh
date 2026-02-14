#!/bin/bash
# Git 推送脚本（同时推送到 GitHub 和 Gitee）

set -e

echo "📤 开始推送代码..."

# 推送到 GitHub（如果可访问）
echo "1️⃣ 尝试推送到 GitHub..."
if git push origin main 2>/dev/null; then
  echo "✅ GitHub 推送成功"
else
  echo "❌ GitHub 推送失败（网络问题）"
fi

# 推送到 Gitee（如果已配置）
if git remote | grep -q "gitee"; then
  echo ""
  echo "2️⃣ 推送到 Gitee..."
  if git push gitee main 2>/dev/null; then
    echo "✅ Gitee 推送成功"
  else
    echo "⚠️ Gitee 推送失败（可能未配置或网络问题）"
  fi
else
  echo ""
  echo "ℹ️ 未配置 Gitee 远程仓库"
  echo "   配置命令: git remote add gitee https://gitee.com/你的用户名/TheGreatChangAn.git"
fi

echo ""
echo "📋 远程仓库状态："
git remote -v

echo ""
echo "✅ 推送完成！"
