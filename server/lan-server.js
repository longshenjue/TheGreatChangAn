/**
 * 长安盛世 - 局域网联机服务器
 * 
 * 功能：
 * 1. WebSocket 实时通信
 * 2. 房间管理
 * 3. 游戏状态同步
 * 4. 二维码生成（供客户端扫描）
 */

const WebSocket = require('ws');
const http = require('http');
const os = require('os');
const crypto = require('crypto');
const gameEngine = require('./gameEngine');

// 配置（支持环境变量）
const WS_PORT = process.env.WS_PORT || 8888;
const HTTP_PORT = process.env.HTTP_PORT || 8889;

// 公网访问地址配置（云服务器部署时设置）
// 本地开发时留空，会自动使用局域网IP
const PUBLIC_HOST = process.env.PUBLIC_HOST || '';  // 例如：'yourdomain.com' 或 '123.456.789.0'
const PUBLIC_PROTOCOL = process.env.PUBLIC_PROTOCOL || 'ws';  // 'ws' 或 'wss'（HTTPS时用wss）

// 内存数据库
const rooms = new Map();
const players = new Map();
const connections = new Map(); // playerId -> ws

// 获取局域网IP
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // 跳过内部和非IPv4地址
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// 获取服务器对外地址（优先使用公网配置，否则使用局域网IP）
function getServerHost() {
  if (PUBLIC_HOST) {
    console.log('📡 使用配置的公网地址:', PUBLIC_HOST);
    return PUBLIC_HOST;
  }
  const localIP = getLocalIP();
  console.log('🏠 使用局域网地址:', localIP);
  return localIP;
}

// 生成房间号（6位大写字母+数字）
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // 确保唯一性
  if (Array.from(rooms.values()).some(room => room.code === code)) {
    return generateRoomCode();
  }
  return code;
}

// 生成唯一ID
function generateId() {
  return crypto.randomBytes(16).toString('hex');
}

// 广播消息给房间内所有玩家
function broadcastToRoom(roomId, message, excludePlayerId = null) {
  const room = rooms.get(roomId);
  if (!room) {
    console.error('❌ [广播] 房间不存在:', roomId);
    return;
  }

  let successCount = 0;
  let failCount = 0;

  room.players.forEach(player => {
    if (player.userId !== excludePlayerId) {
      const ws = connections.get(player.userId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify(message));
          successCount++;
          console.log(`  ✓ 发送给: ${player.nickname} (${player.userId.substring(0, 8)}...)`);
        } catch (error) {
          failCount++;
          console.error(`  ✗ 发送失败: ${player.nickname}`, error.message);
        }
      } else {
        failCount++;
        console.warn(`  ⚠ 连接不可用: ${player.nickname}`);
      }
    }
  });
  
  console.log(`  📊 广播统计: 成功 ${successCount}, 失败 ${failCount}`);
}

// 发送消息给特定玩家
function sendToPlayer(playerId, message) {
  const ws = connections.get(playerId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

// 创建WebSocket服务器
const wss = new WebSocket.Server({ port: WS_PORT });

const serverHost = getServerHost();
const isPublicServer = !!PUBLIC_HOST;

console.log(`\n🎮 长安盛世 ${isPublicServer ? '云服务器' : '局域网服务器'}已启动\n`);
console.log(`📡 WebSocket服务器: ${PUBLIC_PROTOCOL}://${serverHost}:${WS_PORT}`);
console.log(`🌐 HTTP服务器: http://${serverHost}:${HTTP_PORT}`);

if (isPublicServer) {
  console.log(`\n✨ 公网服务器信息:`);
  console.log(`   公网地址: ${PUBLIC_HOST}`);
  console.log(`   协议: ${PUBLIC_PROTOCOL}`);
  console.log(`   端口: ${WS_PORT}`);
  console.log(`   本地IP: ${getLocalIP()}`);
} else {
  console.log(`\n✨ 客户端配置信息:`);
  console.log(`   局域网IP: ${serverHost}`);
  console.log(`   端口: ${WS_PORT}`);
}

console.log(`\n等待玩家连接...\n`);

wss.on('connection', (ws, req) => {
  const clientIP = req.socket.remoteAddress;
  console.log('\n========================================');
  console.log('📱 [连接] 新客户端连接');
  console.log('  客户端IP:', clientIP);
  console.log('  时间:', new Date().toLocaleString('zh-CN'));
  console.log('========================================\n');

  let currentPlayerId = null;

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      const timestamp = new Date().toLocaleTimeString('zh-CN');
      console.log(`\n[${timestamp}] 📨 收到消息: ${message.type}`);

      switch (message.type) {
        case 'register':
          handleRegister(ws, message);
          break;
        case 'createRoom':
          handleCreateRoom(ws, message);
          break;
        case 'joinRoom':
          handleJoinRoom(ws, message);
          break;
        case 'leaveRoom':
          handleLeaveRoom(ws, message);
          break;
        case 'toggleReady':
          handleToggleReady(ws, message);
          break;
        case 'updateSettings':
          handleUpdateSettings(ws, message);
          break;
        case 'startGame':
          handleStartGame(ws, message);
          break;
        case 'getRooms':
          handleGetRooms(ws, message);
          break;
        case 'gameAction':
          handleGameAction(ws, message);
          break;
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
        default:
          console.log('❓ 未知消息类型:', message.type);
      }
    } catch (error) {
      console.error('❌ 处理消息错误:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: '服务器错误'
      }));
    }
  });

  ws.on('close', () => {
    console.log('\n========================================');
    console.log('👋 [断开] 客户端断开连接');
    if (currentPlayerId) {
      const player = players.get(currentPlayerId);
      console.log('  玩家:', player?.nickname || '未知');
      console.log('  玩家ID:', currentPlayerId.substring(0, 8) + '...');
      handleDisconnect(currentPlayerId);
    } else {
      console.log('  未注册的客户端');
    }
    console.log('========================================\n');
  });

  ws.on('error', (error) => {
    console.error('\n========================================');
    console.error('❌ [错误] WebSocket错误');
    console.error('  错误信息:', error.message);
    console.error('  错误堆栈:', error.stack);
    console.error('========================================\n');
  });

  // 注册玩家
  function handleRegister(ws, message) {
    const { nickname, avatar } = message.data;
    
    console.log('\n========================================');
    console.log('📝 [注册] 玩家注册请求');
    console.log('  昵称:', nickname);
    console.log('========================================\n');
    
    // 检查是否是断线重连（通过昵称查找）
    let playerId = null;
    let isReconnect = false;
    let reconnectRoom = null;
    
    // 查找是否有断线的玩家具有相同昵称
    for (const [roomId, room] of rooms.entries()) {
      const disconnectedPlayer = room.players.find(p => p.nickname === nickname && p.disconnected);
      if (disconnectedPlayer) {
        playerId = disconnectedPlayer.userId;
        isReconnect = true;
        reconnectRoom = room;
        
        // 恢复玩家连接状态
        disconnectedPlayer.disconnected = false;
        delete disconnectedPlayer.disconnectTime;
        
        console.log(`🔄 玩家重连: ${nickname} (${playerId})`);
        break;
      }
    }
    
    // 如果不是重连，创建新玩家
    if (!playerId) {
      playerId = generateId();
      console.log('✅ 新玩家注册:', nickname, playerId);
    }
    
    const player = {
      userId: playerId,
      nickname: nickname || `玩家${Math.floor(Math.random() * 1000)}`,
      avatar: avatar || '',
      connectedAt: Date.now()
    };

    players.set(playerId, player);
    connections.set(playerId, ws);
    currentPlayerId = playerId;

    // 获取服务器对外地址（公网地址或局域网IP）
    const serverHost = getServerHost();
    
    console.log('✅ [注册] 注册成功');
    console.log('  玩家ID:', playerId.substring(0, 8) + '...');
    console.log('  服务器地址:', serverHost);
    console.log('  地址类型:', PUBLIC_HOST ? '公网' : '局域网');

    // 发送注册成功响应（包含服务器的对外地址）
    ws.send(JSON.stringify({
      type: 'registered',
      data: { 
        playerId, 
        player,
        isReconnect,
        room: isReconnect ? reconnectRoom : null,
        serverInfo: {
          ip: serverHost,           // 公网地址或局域网IP
          port: WS_PORT,
          protocol: PUBLIC_PROTOCOL  // ws 或 wss
        }
      }
    }));
    
    // 如果是重连，通知房间内其他玩家
    if (isReconnect && reconnectRoom) {
      broadcastToRoom(reconnectRoom._id, {
        type: 'playerReconnected',
        data: {
          playerId,
          nickname,
          room: reconnectRoom
        }
      });
    }
  }

  // 创建房间
  function handleCreateRoom(ws, message) {
    const { playerId } = message.data;
    const player = players.get(playerId);
    
    if (!player) {
      ws.send(JSON.stringify({
        type: 'error',
        message: '玩家不存在'
      }));
      return;
    }

    const roomId = generateId();
    const code = generateRoomCode();
    
    const room = {
      _id: roomId,
      code: code,
      hostId: playerId,
      hostNickname: player.nickname,
      players: [{
        userId: playerId,
        nickname: player.nickname,
        avatar: player.avatar,
        ready: false
      }],
      settings: {
        weatherMode: 'prosperity',
        // 默认包含所有必备传奇建筑
        legendaryBuildings: ['guanxingtai', 'dayunhe', 'dayanta', 'kunmingchi', 'tiancefu']
      },
      status: 'waiting',
      gameState: null,
      createTime: new Date().toISOString()
    };

    rooms.set(roomId, room);

    ws.send(JSON.stringify({
      type: 'roomCreated',
      data: { room }
    }));

    console.log('🏠 房间创建:', code, 'by', player.nickname);
  }

  // 加入房间
  function handleJoinRoom(ws, message) {
    const { playerId, roomId, roomCode } = message.data;
    const player = players.get(playerId);
    
    if (!player) {
      ws.send(JSON.stringify({
        type: 'error',
        message: '玩家不存在'
      }));
      return;
    }

    // 通过房间号查找
    let room;
    if (roomCode) {
      room = Array.from(rooms.values()).find(r => r.code === roomCode);
    } else {
      room = rooms.get(roomId);
    }

    if (!room) {
      ws.send(JSON.stringify({
        type: 'error',
        message: '房间不存在'
      }));
      return;
    }

    if (room.status !== 'waiting') {
      ws.send(JSON.stringify({
        type: 'error',
        message: '游戏已开始'
      }));
      return;
    }

    if (room.players.length >= 4) {
      ws.send(JSON.stringify({
        type: 'error',
        message: '房间已满'
      }));
      return;
    }

    // 检查是否已在房间中
    if (room.players.some(p => p.userId === playerId)) {
      ws.send(JSON.stringify({
        type: 'roomJoined',
        data: { room }
      }));
      return;
    }

    // 加入房间
    room.players.push({
      userId: playerId,
      nickname: player.nickname,
      avatar: player.avatar,
      ready: false
    });

    // 通知加入者
    ws.send(JSON.stringify({
      type: 'roomJoined',
      data: { room }
    }));

    // 广播给房间其他玩家
    broadcastToRoom(room._id, {
      type: 'roomUpdated',
      data: { room }
    }, playerId);

    console.log('👤 玩家加入:', player.nickname, '→', room.code);
  }

  // 离开房间
  function handleLeaveRoom(ws, message) {
    const { playerId, roomId } = message.data;
    const room = rooms.get(roomId);
    
    if (!room) return;

    // 如果是房主，解散房间
    if (room.hostId === playerId) {
      broadcastToRoom(roomId, {
        type: 'roomDismissed',
        data: { roomId }
      });
      rooms.delete(roomId);
      console.log('🚪 房间解散:', room.code);
      return;
    }

    // 移除玩家
    room.players = room.players.filter(p => p.userId !== playerId);

    // 广播更新
    broadcastToRoom(roomId, {
      type: 'roomUpdated',
      data: { room }
    });

    console.log('👋 玩家离开:', playerId, 'from', room.code);
  }

  // 切换准备状态
  function handleToggleReady(ws, message) {
    const { playerId, roomId } = message.data;
    const room = rooms.get(roomId);
    
    console.log('📨 收到准备状态切换请求:', { playerId, roomId, room: !!room });
    
    if (!room) {
      ws.send(JSON.stringify({
        type: 'error',
        message: '房间不存在'
      }));
      return;
    }

    const player = room.players.find(p => p.userId === playerId);
    if (!player) {
      ws.send(JSON.stringify({
        type: 'error',
        message: '你不在此房间中'
      }));
      return;
    }

    // 房主无需准备
    if (room.hostId === playerId) {
      ws.send(JSON.stringify({
        type: 'error',
        message: '房主无需准备'
      }));
      return;
    }

    player.ready = !player.ready;

    console.log('✋', player.nickname, player.ready ? '已准备' : '取消准备');

    // 广播更新（包括发送者自己）
    broadcastToRoom(roomId, {
      type: 'roomUpdated',
      data: { room }
    });

    // 也发送给发起者
    ws.send(JSON.stringify({
      type: 'roomUpdated',
      data: { room }
    }));
  }

  // 更新房间设置
  function handleUpdateSettings(ws, message) {
    const { playerId, roomId, settings } = message.data;
    const room = rooms.get(roomId);
    
    if (!room) {
      ws.send(JSON.stringify({
        type: 'error',
        message: '房间不存在'
      }));
      return;
    }

    // 只有房主可以修改
    if (room.hostId !== playerId) {
      ws.send(JSON.stringify({
        type: 'error',
        message: '只有房主可以修改设置'
      }));
      return;
    }

    room.settings = { ...room.settings, ...settings };

    // 广播更新
    broadcastToRoom(roomId, {
      type: 'roomUpdated',
      data: { room }
    });

    console.log('⚙️ 房间设置更新:', room.code);
  }

  // 开始游戏
  function handleStartGame(ws, message) {
    const { playerId, roomId } = message.data;
    const room = rooms.get(roomId);
    
    if (!room) {
      ws.send(JSON.stringify({
        type: 'error',
        message: '房间不存在'
      }));
      return;
    }

    // 只有房主可以开始
    if (room.hostId !== playerId) {
      ws.send(JSON.stringify({
        type: 'error',
        message: '只有房主可以开始游戏'
      }));
      return;
    }

    // 检查人数（允许单人测试）
    if (room.players.length < 1) {
      ws.send(JSON.stringify({
        type: 'error',
        message: '至少需要1名玩家'
      }));
      return;
    }

    // 检查准备状态
    const allReady = room.players.every(p => 
      p.userId === room.hostId || p.ready
    );
    
    if (!allReady) {
      ws.send(JSON.stringify({
        type: 'error',
        message: '还有玩家未准备'
      }));
      return;
    }

    // 初始化游戏状态
    const playerNames = room.players.map(p => p.nickname);
    const weatherMode = room.settings.weatherMode;
    const legendaryBuildings = room.settings.legendaryBuildings;
    
    console.log('🎮 游戏开始 - 房间:', room.code, '玩家数:', room.players.length);
    console.log('👥 房间玩家信息:', room.players.map(p => ({ 
      userId: p.userId.substring(0, 8), 
      nickname: p.nickname,
      ready: p.ready 
    })));
    console.log('📋 玩家名称数组:', playerNames);
    console.log('⚙️ 传奇建筑配置:', legendaryBuildings);
    
    // 使用游戏引擎初始化
    room.gameState = gameEngine.initializeGame(playerNames, weatherMode, legendaryBuildings);
    
    console.log('🎲 初始化后的游戏玩家:', room.gameState.players.map(p => ({ 
      id: p.id, 
      name: p.name 
    })));
    
    // 为每个玩家添加 userId 映射
    room.players.forEach((player, index) => {
      room.gameState.players[index].userId = player.userId;
      console.log(`  玩家 ${index}: userId=${player.userId.substring(0, 8)}, nickname=${player.nickname} → gameState.name=${room.gameState.players[index].name}`);
    });
    
    room.status = 'playing';
    
    // 统计传奇建筑数量
    const legendaryCount = Object.keys(room.gameState.availableBuildings)
      .filter(id => id.startsWith('legendary_'))
      .filter(id => room.gameState.availableBuildings[id] > 0)
      .length;
    console.log(`🏛️ 启用的传奇建筑数量: ${legendaryCount}`);

    // 广播游戏开始（包含完整游戏状态）
    broadcastToRoom(roomId, {
      type: 'gameStarted',
      data: { 
        room,
        gameState: room.gameState
      }
    });
    
    // 也发送给房主自己
    ws.send(JSON.stringify({
      type: 'gameStarted',
      data: { 
        room,
        gameState: room.gameState
      }
    }));
  }

  // 获取房间列表
  function handleGetRooms(ws, message) {
    const roomList = Array.from(rooms.values())
      .filter(room => room.status === 'waiting')
      .sort((a, b) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime())
      .slice(0, 20);

    ws.send(JSON.stringify({
      type: 'roomList',
      data: { rooms: roomList }
    }));
  }

  // 游戏动作 - 服务器权威模式
  function handleGameAction(ws, message) {
    const { roomId, action, playerId, data: actionData } = message.data;
    
    console.log('\n========================================');
    console.log('📥 [游戏动作] 收到请求');
    console.log('  房间ID:', roomId);
    console.log('  动作类型:', action);
    console.log('  玩家ID:', playerId?.substring(0, 8) + '...');
    console.log('  动作数据:', JSON.stringify(actionData));
    console.log('========================================\n');
    
    const room = rooms.get(roomId);
    
    if (!room) {
      console.error('❌ [游戏动作] 错误: 房间不存在');
      ws.send(JSON.stringify({
        type: 'error',
        message: '房间不存在'
      }));
      return;
    }

    // 如果是重新开始游戏，不需要游戏状态
    if (action === 'restartGame') {
      handleRestartGame(room, message.data);
      return;
    }

    // 其他操作需要游戏状态
    if (!room.gameState) {
      console.error('❌ [游戏动作] 错误: 游戏状态不存在');
      ws.send(JSON.stringify({
        type: 'error',
        message: '游戏状态不存在'
      }));
      return;
    }

    const gameState = room.gameState;
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    
    console.log('🎯 [游戏动作] 验证回合');
    console.log('  当前回合:', gameState.currentPlayerIndex);
    console.log('  当前玩家:', currentPlayer.name, `(${currentPlayer.userId.substring(0, 8)}...)`);
    console.log('  操作玩家ID:', playerId?.substring(0, 8) + '...');
    console.log('  是否匹配:', currentPlayer.userId === playerId ? '✅' : '❌');

    // 验证是否是当前玩家
    if (currentPlayer.userId !== playerId) {
      console.warn('⚠️ [游戏动作] 拒绝: 不是当前玩家的回合');
      ws.send(JSON.stringify({
        type: 'error',
        message: '不是你的回合'
      }));
      return;
    }

    let result = null;

    try {
      switch (action) {
        case 'rollDice':
          result = handleRollDice(room, message.data);
          break;
        case 'flipDice':
          result = handleFlipDice(room, message.data);
          break;
        case 'purchaseBuilding':
          result = handlePurchaseBuilding(room, message.data);
          break;
        case 'endTurn':
          result = handleEndTurn(room, message.data);
          break;
        default:
          console.warn('未知操作:', action);
          return;
      }

      if (result) {
        console.log('\n📡 [广播] 开始广播游戏状态更新');
        console.log('  房间ID:', roomId);
        console.log('  动作类型:', action);
        console.log('  房间玩家数:', room.players.length);
        
        // 广播更新后的游戏状态给所有玩家
        const broadcastMessage = {
          type: 'gameStateUpdated',
          data: {
            action,
            gameState: room.gameState,
            result: result.data
          }
        };
        
        broadcastToRoom(roomId, broadcastMessage);
        
        console.log('✅ [广播] 游戏状态已更新并广播给所有玩家');
        console.log('========================================\n');
      }
    } catch (error) {
      console.error('❌ 处理游戏操作失败:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: error.message
      }));
    }
  }

  // 处理投骰子
  function handleRollDice(room, data) {
    const { diceCount } = data;
    const gameState = room.gameState;
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];

    console.log('\n🎲 [投骰子] 开始处理');
    console.log('  玩家:', currentPlayer.name);
    console.log('  骰子数量:', diceCount);
    console.log('  投骰前状态:');
    console.log('    - 金币:', currentPlayer.gold);
    console.log('    - 建筑数:', currentPlayer.buildings.length);

    // 执行投骰子
    const diceResult = gameEngine.rollDice(diceCount || 1);
    console.log('  骰子结果:');
    console.log('    - 点数:', diceResult.dice.join(', '));
    console.log('    - 总和:', diceResult.total);
    console.log('    - 是否对子:', diceResult.isDouble ? '是' : '否');
    
    // 处理结算
    const settlementResults = gameEngine.processSettlement(diceResult, gameState, currentPlayer);
    
    console.log('  结算结果:');
    if (settlementResults && settlementResults.length > 0) {
      settlementResults.forEach((result, index) => {
        console.log(`    ${index + 1}. ${result.buildingName || result.type}`);
        console.log(`       - 收益: ${result.income || 0} 金币`);
        console.log(`       - 描述: ${result.description || ''}`);
      });
    } else {
      console.log('    - 无结算收益');
    }
    console.log('  投骰后状态:');
    console.log('    - 金币:', currentPlayer.gold);
    console.log('✅ [投骰子] 处理完成\n');

    return {
      success: true,
      data: {
        diceResult,
        settlementResults,
        playerIndex: gameState.currentPlayerIndex
      }
    };
  }

  // 处理翻转骰子
  function handleFlipDice(room, data) {
    const { diceValue } = data;
    const gameState = room.gameState;
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];

    console.log(`🔄 ${currentPlayer.name} 翻转骰子: ${diceValue}`);

    const flipped = gameEngine.flipDice(diceValue);
    const diceResult = { 
      dice: [flipped], 
      dice1: flipped,
      dice2: null,
      count: 1, 
      isDouble: false, 
      total: flipped 
    };
    
    // 处理结算
    const settlementResults = gameEngine.processSettlement(diceResult, gameState, currentPlayer);

    return {
      success: true,
      data: {
        diceResult,
        settlementResults,
        playerIndex: gameState.currentPlayerIndex
      }
    };
  }

  // 处理购买建筑
  function handlePurchaseBuilding(room, data) {
    const { buildingId } = data;
    const gameState = room.gameState;
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];

    console.log(`🏗️ ${currentPlayer.name} 购买建筑: ${buildingId}`);

    // 执行购买
    const result = gameEngine.purchaseBuilding(currentPlayer, buildingId, gameState);
    
    if (result.success) {
      console.log(`✅ 购买成功: ${result.building.name}`);
      
      // 检查胜利条件
      const winCheck = gameEngine.checkWinCondition(gameState);
      if (winCheck.hasWinner) {
        console.log(`🎉 游戏结束！胜者: ${winCheck.winner.name}`);
        
        // 将房间状态设置为finished，但不删除房间
        room.status = 'finished';
        room.winner = winCheck.winner;
        
        return {
          success: true,
          data: {
            purchased: true,
            building: result.building,
            playerIndex: gameState.currentPlayerIndex,
            gameOver: true,
            winner: winCheck.winner,
            winType: winCheck.winType,
            totalAssets: winCheck.totalAssets,
            message: winCheck.message
          }
        };
      }
    } else {
      console.log(`❌ 购买失败: ${result.message}`);
    }

    return {
      success: result.success,
      data: {
        purchased: result.success,
        building: result.building,
        message: result.message,
        playerIndex: gameState.currentPlayerIndex
      }
    };
  }

  // 处理重新开始游戏
  function handleRestartGame(room, data) {
    const { playerId } = data;
    
    console.log('🔄 [重新开始游戏] 房间:', room.code);
    console.log('  请求玩家:', playerId?.substring(0, 8) + '...');
    console.log('  房主:', room.hostId.substring(0, 8) + '...');
    
    // 只有房主可以重新开始游戏
    if (playerId !== room.hostId) {
      console.warn('⚠️ 只有房主可以重新开始游戏');
      return;
    }
    
    // 重置房间状态
    room.status = 'waiting';
    room.gameState = null;
    room.winner = null;
    
    // 重置所有玩家的准备状态
    room.players.forEach(player => {
      if (player.userId !== room.hostId) {
        player.ready = false;
      }
    });
    
    console.log('✅ 房间已重置，等待玩家准备');
    
    // 广播房间已重置
    broadcastToRoom(room._id, {
      type: 'roomUpdated',
      data: { room }
    });
    
    broadcastToRoom(room._id, {
      type: 'gameRestarted',
      data: { message: '房主已重新开始游戏，请重新准备' }
    });
  }

  // 处理结束回合
  function handleEndTurn(room, data) {
    const gameState = room.gameState;
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];

    console.log(`⏭️ ${currentPlayer.name} 结束回合`);

    // 执行结束回合
    gameEngine.endTurn(gameState);

    const nextPlayer = gameState.players[gameState.currentPlayerIndex];
    console.log(`👉 下一个玩家: ${nextPlayer.name}`);

    return {
      success: true,
      data: {
        currentPlayerIndex: gameState.currentPlayerIndex,
        round: gameState.round
      }
    };
  }

  // 处理断开连接
  function handleDisconnect(playerId) {
    // 查找玩家所在的房间
    for (const [roomId, room] of rooms.entries()) {
      const player = room.players.find(p => p.userId === playerId);
      if (player) {
        // 如果是房主，解散房间
        if (room.hostId === playerId) {
          broadcastToRoom(roomId, {
            type: 'roomDismissed',
            data: { roomId, reason: '房主断开连接' }
          });
          rooms.delete(roomId);
          console.log('🚪 房间解散（房主断线）:', room.code);
        } else {
          // 非房主断开连接，标记为断线状态，而不是立即移除
          player.disconnected = true;
          player.disconnectTime = Date.now();
          
          console.log(`⚠️  玩家断线: ${player.nickname}, 等待重连...`);
          
          // 通知其他玩家
          broadcastToRoom(roomId, {
            type: 'playerDisconnected',
            data: { 
              playerId,
              nickname: player.nickname,
              room 
            }
          });
          
          // 设置30秒超时，如果未重连则移除
          setTimeout(() => {
            const currentRoom = rooms.get(roomId);
            if (currentRoom) {
              const currentPlayer = currentRoom.players.find(p => p.userId === playerId);
              if (currentPlayer && currentPlayer.disconnected) {
                // 30秒后仍未重连，移除玩家
                currentRoom.players = currentRoom.players.filter(p => p.userId !== playerId);
                
                console.log(`❌ 玩家超时未重连，已移除: ${currentPlayer.nickname}`);
                
                broadcastToRoom(roomId, {
                  type: 'playerLeft',
                  data: { 
                    playerId,
                    nickname: currentPlayer.nickname,
                    reason: '超时未重连',
                    room: currentRoom 
                  }
                });
              }
            }
          }, 30000); // 30秒超时
        }
        break;
      }
    }

    // 清理连接映射（但保留玩家信息，用于重连）
    connections.delete(playerId);
  }
});

// 创建HTTP服务器（用于健康检查和信息显示）
const httpServer = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.url === '/status') {
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'running',
      ip: getLocalIP(),
      wsPort: WS_PORT,
      httpPort: HTTP_PORT,
      players: players.size,
      rooms: rooms.size,
      connections: connections.size
    }));
  } else if (req.url === '/info') {
    res.writeHead(200);
    res.end(JSON.stringify({
      serverIP: getLocalIP(),
      wsPort: WS_PORT,
      wsUrl: `ws://${getLocalIP()}:${WS_PORT}`,
      qrData: JSON.stringify({
        ip: getLocalIP(),
        port: WS_PORT
      })
    }));
  } else {
    res.writeHead(200);
    res.end(JSON.stringify({
      name: '长安盛世 局域网服务器',
      version: '1.0.0',
      status: 'running',
      endpoints: {
        status: '/status',
        info: '/info'
      }
    }));
  }
});

httpServer.listen(HTTP_PORT, () => {
  console.log(`📡 HTTP服务器运行在 http://${getLocalIP()}:${HTTP_PORT}`);
});

// 定期清理空房间
setInterval(() => {
  const now = Date.now();
  for (const [roomId, room] of rooms.entries()) {
    // 清理超过30分钟无人的房间
    if (room.players.length === 0) {
      const createTime = new Date(room.createTime).getTime();
      if (now - createTime > 30 * 60 * 1000) {
        rooms.delete(roomId);
        console.log('🧹 清理空房间:', room.code);
      }
    }
  }
}, 5 * 60 * 1000); // 每5分钟检查一次

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n\n👋 服务器关闭中...');
  
  // 通知所有客户端
  for (const ws of connections.values()) {
    ws.send(JSON.stringify({
      type: 'serverShutdown',
      message: '服务器已关闭'
    }));
    ws.close();
  }
  
  wss.close();
  httpServer.close();
  
  console.log('✅ 服务器已关闭');
  process.exit(0);
});
