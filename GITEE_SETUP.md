# Gitee 镜像仓库配置指南

## 📋 为什么需要 Gitee 镜像？

- ✅ **国内访问速度快**：无需代理，稳定可靠
- ✅ **备份仓库**：多一个备份，数据更安全
- ✅ **网络问题应对**：GitHub 无法访问时的替代方案

---

## 🚀 快速配置（5 分钟）

### 步骤1：在 Gitee 创建镜像仓库

1. 访问 [Gitee.com](https://gitee.com)，注册/登录账号
2. 点击右上角 **"+"** → **"从 GitHub/GitLab 导入仓库"**
3. 输入 GitHub 仓库地址：
   ```
   https://github.com/longshenjue/TheGreatChangAn
   ```
4. 点击 **"导入"**，等待完成（1-2 分钟）

### 步骤2：配置本地仓库

在本地项目目录中执行：

```bash
cd /Users/longshenjue/Documents/AI-project/TheGreatChangAn

# 添加 Gitee 作为远程仓库
git remote add gitee https://gitee.com/你的Gitee用户名/TheGreatChangAn.git

# 验证配置
git remote -v
```

应该看到：
```
origin    https://github.com/longshenjue/TheGreatChangAn.git (fetch)
origin    https://github.com/longshenjue/TheGreatChangAn.git (push)
gitee     https://gitee.com/你的Gitee用户名/TheGreatChangAn.git (fetch)
gitee     https://gitee.com/你的Gitee用户名/TheGreatChangAn.git (push)
```

### 步骤3：配置 DevBox 使用 Gitee

在 DevBox 终端中执行：

```bash
cd /home/devbox/project/TheGreatChangAn

# 添加 Gitee 远程仓库
git remote add gitee https://gitee.com/你的Gitee用户名/TheGreatChangAn.git

# 从 Gitee 拉取代码
git pull gitee main
```

---

## 📝 日常使用

### 方式1：使用推送脚本（推荐）

```bash
# 提交代码
git add .
git commit -m "你的提交信息"

# 使用脚本推送（自动尝试 GitHub 和 Gitee）
bash git-push.sh
```

### 方式2：手动推送

```bash
# 只推送到 Gitee（GitHub 无法访问时）
git push gitee main

# 只推送到 GitHub（网络正常时）
git push origin main

# 同时推送到两个仓库
git push origin main && git push gitee main
```

### DevBox 中拉取代码

```bash
# 从 Gitee 拉取（推荐，速度快）
git pull gitee main

# 从 GitHub 拉取（DevBox 网络通畅）
git pull origin main
```

---

## 🔄 自动同步 Gitee ↔ GitHub

### Gitee 自动同步 GitHub（推荐）

在 Gitee 仓库页面：

1. 点击 **"管理"** → **"仓库镜像管理"**
2. 添加镜像：
   - 镜像方向：**从 GitHub 同步到 Gitee**
   - GitHub 仓库地址：`https://github.com/longshenjue/TheGreatChangAn`
3. 设置同步频率：**每天自动同步** 或 **手动触发**

这样：
- 你在 DevBox 推送到 GitHub
- Gitee 自动从 GitHub 同步
- 本地可以从 Gitee 拉取（速度快）

---

## ⚙️ 高级配置

### 设置默认推送到 Gitee

如果经常无法访问 GitHub，可以设置 Gitee 为默认：

```bash
# 推送到 Gitee（简化命令）
git push  # 默认推送到 origin（GitHub）

# 修改 origin 指向 Gitee
git remote set-url origin https://gitee.com/你的用户名/TheGreatChangAn.git

# GitHub 改为 github 别名
git remote add github https://github.com/longshenjue/TheGreatChangAn.git
```

这样：
- `git push` → 推送到 Gitee（快）
- `git push github main` → 推送到 GitHub（需要时）

---

## 🔍 常见问题

### Q1：推送到 Gitee 时要求输入密码？

**解决**：配置 Git 凭据缓存

```bash
# 缓存凭据 15 分钟
git config --global credential.helper cache

# 永久存储凭据（谨慎使用）
git config --global credential.helper store

# 或者使用 SSH（更安全）
# 1. 生成 SSH 密钥
ssh-keygen -t ed25519 -C "your_email@example.com"

# 2. 查看公钥
cat ~/.ssh/id_ed25519.pub

# 3. 添加到 Gitee: 设置 → SSH 公钥

# 4. 修改远程地址为 SSH
git remote set-url gitee git@gitee.com:你的用户名/TheGreatChangAn.git
```

### Q2：如何删除 Gitee 远程仓库？

```bash
git remote remove gitee
```

### Q3：两个仓库不同步怎么办？

```bash
# 强制推送本地到 Gitee（谨慎使用）
git push gitee main --force

# 或者从 GitHub 拉取后推送到 Gitee
git pull origin main
git push gitee main
```

---

## 📊 工作流示例

### 场景1：GitHub 无法访问

```bash
# 1. 本地开发
git add .
git commit -m "新功能"

# 2. 推送到 Gitee
git push gitee main

# 3. DevBox 从 Gitee 拉取
# 在 DevBox 终端
git pull gitee main

# 4. 发布版本
# 在 DevBox 界面点击"发布版本"
```

### 场景2：GitHub 正常访问

```bash
# 1. 本地开发并推送
git add .
git commit -m "修复 bug"
bash git-push.sh  # 自动推送到 GitHub 和 Gitee

# 2. DevBox 从 GitHub 拉取（DevBox 网络通畅）
git pull origin main

# 3. Gitee 自动同步（如果配置了自动同步）
```

---

## 🎯 推荐配置

**对于经常遇到网络问题的情况：**

1. ✅ 创建 Gitee 镜像仓库
2. ✅ 本地同时配置 origin（GitHub）和 gitee（Gitee）
3. ✅ 使用 `git-push.sh` 脚本同时推送
4. ✅ DevBox 优先使用 GitHub（网络通畅），备用 Gitee
5. ✅ 配置 Gitee 自动同步 GitHub（可选）

这样无论网络如何，都能正常开发和部署！🚀

---

**更新时间**：2026-02-14
