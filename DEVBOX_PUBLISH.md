# DevBox 发布版本指南

## 📋 发布前准备

### 1️⃣ 确保代码已构建

**在发布版本前，必须先在 DevBox 中完成构建：**

```bash
# 安装依赖（首次或依赖变更时）
npm install

# 构建前端（重要！）
npm run build:h5

# 验证构建产物
ls -l dist/
```

### 2️⃣ 测试启动脚本

```bash
# 测试 entrypoint.sh 是否正常工作
./entrypoint.sh
```

**如果启动成功，按 `Ctrl+C` 停止测试。**

---

## 🚀 发布版本

### 步骤1：打开发布界面

在 DevBox 界面点击 **"发布版本"** 按钮

### 步骤2：填写版本信息

| 字段 | 说明 | 示例 |
|------|------|------|
| **镜像名** | 自动生成，无需修改 | `hub.hzh.sealos.run/ns-xxx/changean-server` |
| **版本号** | 语义化版本号 | `v1.0.0`, `v1.1.0` |
| **版本描述** | 本次发布的更新内容 | `支持环境变量动态配置后端地址` |

### 步骤3：发布

1. 点击 **"发版"** 按钮
2. 等待发布完成（会自动提交所有更改）
3. 发布完成后 DevBox 会自动重启

---

## 🎯 应用部署

### 从 DevBox 镜像部署应用

发布成功后，你会得到一个镜像地址，例如：
```
hub.hzh.sealos.run/ns-joctqbne/changean-server:v1.0.0
```

### 在 Sealos 应用管理中部署

#### 1️⃣ 创建应用

- **镜像地址**：使用上面的镜像地址
- **启动命令**：留空（会自动使用 entrypoint.sh）

#### 2️⃣ 配置环境变量

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `PUBLIC_HOST` | `你的应用域名.sealoshzh.site` | **必填**，后端域名 |
| `PUBLIC_PROTOCOL` | `wss` | WebSocket 协议 |
| `WS_PORT` | `8888` | WebSocket 端口 |
| `HTTP_PORT` | `8889` | HTTP 健康检查端口 |

#### 3️⃣ 暴露端口

| 容器端口 | 说明 |
|----------|------|
| `8080` | 前端静态服务 |
| `8888` | 后端 WebSocket |
| `8889` | 健康检查（可选）|

#### 4️⃣ 部署

点击部署，等待应用启动。

---

## 🔍 验证部署

### 检查应用状态

```bash
# 查看应用日志
kubectl logs -f deployment/your-app-name

# 检查后端健康状态
curl http://your-app-domain:8889/status
```

### 测试连接

1. 访问前端：`https://your-app-domain.sealoshzh.site`
2. 点击 **"快速连接"** 或 **"直连模式"**
3. 输入后端域名（或留空使用默认配置）
4. 测试创建房间和加入房间

---

## ⚠️ 常见问题

### 1. 发布失败：找不到 dist 目录

**原因**：构建步骤未完成

**解决**：
```bash
npm run build:h5
```

### 2. 应用启动后无法连接后端

**检查**：
- 环境变量 `PUBLIC_HOST` 是否正确设置
- 后端域名是否可访问（不是前端域名）
- 防火墙是否开放 8888 端口

### 3. 前端页面显示但后端无响应

**检查后端日志**：
```bash
# 在应用容器中
ps aux | grep node
```

**查看后端是否启动**：
```bash
curl http://localhost:8889/status
```

---

## 📚 相关文档

- [Sealos 应用启动配置](https://sealos.run/docs/guides/fundamentals/entrypoint-sh)
- [Sealos 环境变量配置](https://sealos.run/docs/guides/app-management/environment-variables)
- [项目部署指南](./DEPLOYMENT.md)

---

## 🎉 最佳实践

1. **版本号规范**：
   - 主版本号：重大功能更新或架构变更
   - 次版本号：新功能添加
   - 修订号：Bug 修复

   示例：`v1.2.3`

2. **发布前检查**：
   - ✅ 代码已构建（`npm run build:h5`）
   - ✅ 本地测试通过
   - ✅ `entrypoint.sh` 可执行
   - ✅ 环境变量已配置

3. **发布描述**：
   ```
   v1.0.0 - 初始发布
   v1.1.0 - 支持环境变量动态配置
   v1.1.1 - 修复连接超时问题
   ```

---

**更新时间**：2026-02-14
