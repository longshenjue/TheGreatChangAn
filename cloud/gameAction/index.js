// 云函数：游戏操作（完整版）
const cloud = require('wx-server-sdk');
const gameEngine = require('../common/gameEngine');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 积分计算规则
function calculateScoreChange(rank, totalPlayers) {
  const baseScore = 100;
  
  switch (rank) {
    case 1: // 第一名
      return Math.floor(baseScore * 1.5); // +150分
    case 2: // 第二名
      return Math.floor(baseScore * 0.5); // +50分
    case 3: // 第三名
      return 0; // 0分
    case 4: // 第四名
      return Math.floor(-baseScore * 0.3); // -30分
    default:
      return 0;
  }
}

exports.main = async (event, context) => {
  const { action, roomId, data, count, buildingId, winnerId } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  
  try {
    // 初始化游戏
    if (action === 'init') {
      // 获取房间信息
      const roomRes = await db.collection('rooms').doc(roomId).get();
      if (!roomRes.data) {
        return { success: false, message: '房间不存在' };
      }
      
      const room = roomRes.data;
      
      // 检查是否已有游戏状态
      const existingState = await db.collection('game_states').where({
        roomId: roomId
      }).get();
      
      if (existingState.data.length > 0) {
        // 已有游戏状态，返回现有状态
        return {
          success: true,
          gameState: existingState.data[0].gameState
        };
      }
      
      // 使用游戏引擎初始化游戏状态
      const initialGameState = gameEngine.initializeGame(
        room.players,
        room.settings.weatherMode,
        room.settings.legendaryBuildings || {}
      );
      
      // 保存游戏状态
      await db.collection('game_states').add({
        data: {
          roomId: roomId,
          gameState: initialGameState,
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        }
      });
      
      return {
        success: true,
        gameState: initialGameState
      };
    }
    
    // 获取游戏状态
    const stateRes = await db.collection('game_states').where({
      roomId: roomId
    }).get();
    
    if (stateRes.data.length === 0) {
      return { success: false, message: '游戏未开始' };
    }
    
    const gameStateDoc = stateRes.data[0];
    const gameState = gameStateDoc.gameState;
    
    // 验证是否是当前玩家（观战除外）
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (currentPlayer.id !== openid && action !== 'watchState' && action !== 'finish') {
      return { success: false, message: '不是您的回合' };
    }
    
    // 执行操作
    switch (action) {
      case 'rollDice':
        // 使用游戏引擎投掷骰子
        const diceResult = gameEngine.rollDice(count || 1);
        
        // 处理天时效果（如果是双骰）
        let weatherSettlements = [];
        if (diceResult.isDouble) {
          weatherSettlements = gameEngine.processWeatherEffect(diceResult, gameState, currentPlayer);
        }
        
        // 处理普通结算
        const settlements = gameEngine.processSettlement(diceResult, gameState, currentPlayer);
        
        // 合并所有结算结果
        const allSettlements = [...weatherSettlements, ...settlements];
        
        // 记录到回合历史
        if (!gameState.turnHistory) {
          gameState.turnHistory = [];
        }
        gameState.turnHistory.push({
          playerId: currentPlayer.id,
          action: 'rollDice',
          diceResult,
          weatherTriggered: diceResult.isDouble,
          settlements: allSettlements,
          timestamp: new Date().toISOString()
        });
        
        // 更新游戏状态
        await db.collection('game_states').doc(gameStateDoc._id).update({
          data: {
            gameState: gameState,
            updateTime: db.serverDate()
          }
        });
        
        return {
          success: true,
          gameState: gameState,
          diceResult: diceResult,
          settlements: allSettlements,
          weatherTriggered: diceResult.isDouble
        };
      
      case 'flipDice':
        // 翻转指定骰子（大明宫功能）
        if (!data || !data.diceIndex) {
          return { success: false, message: '缺少骰子索引' };
        }
        
        // 这里需要从上次投掷结果中获取骰子值并翻转
        // 简化实现：返回翻转后的值
        const flipped = gameEngine.flipDice(data.diceValue);
        
        return {
          success: true,
          flippedValue: flipped
        };
      
      case 'purchase':
        // 使用游戏引擎购买建筑
        if (!buildingId) {
          return { success: false, message: '缺少建筑ID' };
        }
        
        const purchaseResult = gameEngine.purchaseBuilding(buildingId, gameState, currentPlayer);
        
        if (!purchaseResult.success) {
          return purchaseResult;
        }
        
        // 记录购买历史
        if (!gameState.turnHistory) {
          gameState.turnHistory = [];
        }
        gameState.turnHistory.push({
          playerId: currentPlayer.id,
          action: 'purchase',
          buildingId: buildingId,
          buildingName: purchaseResult.building.name,
          cost: purchaseResult.building.cost,
          timestamp: new Date().toISOString()
        });
        
        // 检查胜利条件
        const winCheck = gameEngine.checkWinCondition(gameState);
        if (winCheck.hasWinner) {
          gameState.gameEnded = true;
        }
        
        // 更新游戏状态
        await db.collection('game_states').doc(gameStateDoc._id).update({
          data: {
            gameState: gameState,
            updateTime: db.serverDate()
          }
        });
        
        return {
          success: true,
          gameState: gameState,
          building: purchaseResult.building,
          winCheck: winCheck
        };
      
      case 'endTurn':
        // 使用游戏引擎结束回合
        gameEngine.endTurn(gameState);
        
        // 记录回合结束
        if (!gameState.turnHistory) {
          gameState.turnHistory = [];
        }
        gameState.turnHistory.push({
          playerId: currentPlayer.id,
          action: 'endTurn',
          turn: gameState.turn,
          timestamp: new Date().toISOString()
        });
        
        // 更新游戏状态
        await db.collection('game_states').doc(gameStateDoc._id).update({
          data: {
            gameState: gameState,
            updateTime: db.serverDate()
          }
        });
        
        return {
          success: true,
          gameState: gameState
        };
      
      case 'finish':
        // 游戏结束，结算积分
        const players = gameState.players;
        
        // 使用游戏引擎计算每个玩家的总资产
        const rankedPlayers = players.map((p, index) => ({
          ...p,
          index: index,
          finalAssets: gameEngine.calculateTotalAssets(p), // 包含金币和建筑价值
          buildingCount: p.buildings.length
        })).sort((a, b) => b.finalAssets - a.finalAssets);
        
        // 分配排名和积分变化
        const playersWithRank = rankedPlayers.map((p, index) => ({
          userId: p.id,
          nickname: p.nickname,
          avatar: p.avatar,
          finalGold: p.gold,
          finalAssets: p.finalAssets,
          buildingCount: p.buildingCount,
          rank: index + 1,
          scoreChange: calculateScoreChange(index + 1, players.length)
        }));
        
        // 更新每个玩家的积分和统计
        for (const p of playersWithRank) {
          await db.collection('users').where({
            _openid: p.userId
          }).update({
            data: {
              score: _.inc(p.scoreChange),
              totalGames: _.inc(1),
              winCount: _.inc(p.rank === 1 ? 1 : 0),
              updateTime: db.serverDate()
            }
          });
        }
        
        // 保存游戏记录
        await db.collection('game_records').add({
          data: {
            roomId: roomId,
            players: playersWithRank,
            winner: winnerId || playersWithRank[0].userId,
            duration: gameState.turn, // 游戏回合数
            finishedAt: db.serverDate(),
            createTime: db.serverDate()
          }
        });
        
        // 更新房间状态为已结束
        await db.collection('rooms').doc(roomId).update({
          data: {
            status: 'finished',
            finishedAt: db.serverDate()
          }
        });
        
        // 删除游戏状态（游戏已结束）
        await db.collection('game_states').doc(gameStateDoc._id).remove();
        
        return {
          success: true,
          players: playersWithRank,
          message: '游戏结束，积分已结算'
        };
      
      case 'watchState':
        // 仅观看状态，不需要操作权限
        return {
          success: true,
          gameState: gameState
        };
      
      default:
        return {
          success: false,
          message: '未知操作'
        };
    }
  } catch (error) {
    console.error('游戏操作失败:', error);
    return { 
      success: false, 
      message: error.message || '操作失败'
    };
  }
};

// 注意：此云函数是简化版本
// 完整版本需要移植前端的游戏逻辑到云端
// 建议：将 src/utils/gameEngine.ts 和 src/utils/settlement.ts 
// 改写为可在Node.js环境运行的纯函数，然后在此调用
