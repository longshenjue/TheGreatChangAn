# 局域网服务器说明

## 服务器文件

`lan-server.js` - 长安盛世局域网联机服务器

## 快速启动

```bash
# 在项目根目录执行
node server/lan-server.js
```

或使用npm脚本：

```bash
npm run lan:server
```

## 端口说明

- **WebSocket端口**：`8888` - 用于游戏实时通信
- **HTTP端口**：`8889` - 用于状态查询和信息展示

## 环境要求

- Node.js 14.0 或更高版本
- `ws` 包（WebSocket库）

## 功能特性

### 1. 玩家管理
- 玩家注册
- 连接管理
- 断线检测
- 自动重连支持

### 2. 房间管理
- 创建房间（生成6位房间号）
- 加入/离开房间
- 房间设置管理
- 自动清理空房间

### 3. 游戏同步
- 实时游戏状态广播
- 准备状态同步
- 游戏开始通知
- 游戏动作转发

### 4. 监控接口

#### 获取服务器状态
```bash
curl http://localhost:8889/status
```

返回：
```json
{
  "status": "running",
  "ip": "192.168.1.100",
  "wsPort": 8888,
  "httpPort": 8889,
  "players": 3,
  "rooms": 1,
  "connections": 3
}
```

#### 获取连接信息
```bash
curl http://localhost:8889/info
```

返回：
```json
{
  "serverIP": "192.168.1.100",
  "wsPort": 8888,
  "wsUrl": "ws://192.168.1.100:8888",
  "qrData": "{\"ip\":\"192.168.1.100\",\"port\":8888}"
}
```

## 消息协议

### 客户端 → 服务器

| 消息类型 | 说明 | 数据格式 |
|---------|------|---------|
| `register` | 注册玩家 | `{ nickname, avatar }` |
| `createRoom` | 创建房间 | `{ playerId }` |
| `joinRoom` | 加入房间 | `{ playerId, roomId/roomCode }` |
| `leaveRoom` | 离开房间 | `{ playerId, roomId }` |
| `toggleReady` | 切换准备 | `{ playerId, roomId }` |
| `updateSettings` | 更新设置 | `{ playerId, roomId, settings }` |
| `startGame` | 开始游戏 | `{ playerId, roomId }` |
| `getRooms` | 获取房间列表 | `{}` |
| `gameAction` | 游戏动作 | `{ roomId, action, data }` |
| `ping` | 心跳 | `{}` |

### 服务器 → 客户端

| 消息类型 | 说明 | 数据格式 |
|---------|------|---------|
| `registered` | 注册成功 | `{ playerId, player }` |
| `roomCreated` | 房间已创建 | `{ room }` |
| `roomJoined` | 已加入房间 | `{ room }` |
| `roomUpdated` | 房间更新 | `{ room }` |
| `roomDismissed` | 房间解散 | `{ roomId, reason }` |
| `gameStarted` | 游戏开始 | `{ room }` |
| `roomList` | 房间列表 | `{ rooms }` |
| `gameAction` | 游戏动作广播 | `{ action, data }` |
| `error` | 错误信息 | `{ message }` |
| `pong` | 心跳响应 | `{}` |
| `serverShutdown` | 服务器关闭 | `{ message }` |

## 数据结构

### Room（房间）
```typescript
{
  _id: string;              // 房间ID
  code: string;             // 6位房间号
  hostId: string;           // 房主ID
  hostNickname: string;     // 房主昵称
  players: Player[];        // 玩家列表
  settings: {               // 游戏设置
    weatherMode: string;    // 天时模式
    legendaryBuildings: string[];  // 传奇建筑
  };
  status: string;           // 状态：waiting/playing/finished
  gameState: any;           // 游戏状态（可选）
  createTime: string;       // 创建时间
}
```

### Player（玩家）
```typescript
{
  userId: string;           // 玩家ID
  nickname: string;         // 昵称
  avatar: string;           // 头像URL
  ready: boolean;           // 是否准备
}
```

## 日志说明

服务器会输出以下日志：

- `📱 新客户端连接` - 有客户端连接
- `✅ 玩家注册: [昵称]` - 玩家注册成功
- `🏠 房间创建: [房间号] by [昵称]` - 房间创建
- `👤 玩家加入: [昵称] → [房间号]` - 玩家加入房间
- `👋 玩家离开: [玩家ID] from [房间号]` - 玩家离开
- `🚪 房间解散: [房间号]` - 房间解散
- `✋ [昵称] 已准备/取消准备` - 准备状态变化
- `⚙️ 房间设置更新: [房间号]` - 设置更新
- `🎮 游戏开始: [房间号]` - 游戏开始
- `🧹 清理空房间: [房间号]` - 自动清理

## 安全注意事项

1. **仅用于局域网**：不要将服务器暴露到公网
2. **无身份验证**：目前不包含身份验证机制
3. **数据不持久化**：所有数据存储在内存中，重启即丢失

## 性能优化建议

1. **内存管理**：
   - 定期清理断线玩家（已实现）
   - 清理空房间（已实现，30分钟）

2. **并发处理**：
   - 当前可支持约50-100个同时在线玩家
   - 如需更多，建议使用Redis等外部存储

3. **网络优化**：
   - 已实现心跳机制（30秒）
   - 已实现自动重连

## 故障排查

### 端口被占用

```bash
# 查找占用端口的进程（macOS/Linux）
lsof -i :8888

# Windows
netstat -ano | findstr :8888

# 杀死进程
kill -9 [PID]
```

### 防火墙问题

确保防火墙允许8888和8889端口：

```bash
# macOS
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add node

# Linux (Ubuntu)
sudo ufw allow 8888
sudo ufw allow 8889

# Windows
# 在防火墙设置中添加入站规则
```

### 无法获取局域网IP

如果`getLocalIP()`无法获取正确的IP：

1. 手动指定IP地址
2. 检查网络接口配置
3. 确保连接到Wi-Fi而非移动网络

## 开发建议

### 添加新功能

1. 在`handleMessage`中添加新的消息类型处理
2. 实现对应的处理函数
3. 更新客户端`lanService.ts`

### 调试技巧

```javascript
// 启用详细日志
console.log('详细的调试信息');

// 监控房间状态
setInterval(() => {
  console.log('当前房间数:', rooms.size);
  console.log('当前玩家数:', players.size);
}, 10000);
```

## 优雅关闭

按 `Ctrl+C` 停止服务器，会自动：
1. 通知所有客户端
2. 关闭所有连接
3. 清理资源

## 许可证

与主项目保持一致
