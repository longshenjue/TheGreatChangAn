import { View, Text, Button, ScrollView } from '@tarojs/components';
import { useState, useEffect, useRef } from 'react';
import Taro from '@tarojs/taro';
import {
  GameState,
  DiceResult,
  BuildingConfig,
} from '../../../types/game';
import {
  rollDice,
  flipDice,
  checkWinCondition,
  getBuildingConfig,
  getElementColor,
  getElementName,
} from '../../../utils/gameEngine';
import { processSettlement, purchaseBuilding } from '../../../utils/settlement';
import buildingsData from '../../../config/buildings.json';
import DebugPanel from '../../../components/DebugPanel';
import '../../game/game.scss'; // 复用单机游戏样式
import './online-game.scss';

export default function OnlineGame() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [currentUserId, setCurrentUserId] = useState('');
  const [diceResult, setDiceResult] = useState<DiceResult | null>(null);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [showSettlements, setShowSettlements] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showMessage, setShowMessage] = useState('');
  const [showBuildingList, setShowBuildingList] = useState(false);
  const roomId = useRef('');
  const watcherRef = useRef<any>(null);

  useEffect(() => {
    // 获取路由参数
    const instance = Taro.getCurrentInstance();
    const params = instance.router?.params;
    if (params?.roomId) {
      roomId.current = params.roomId;
      initGame();
    }

    return () => {
      // 组件卸载时关闭监听
      if (watcherRef.current) {
        watcherRef.current.close();
      }
    };
  }, []);

  // 初始化游戏
  const initGame = async () => {
    try {
      const cloud = Taro.cloud;
      if (!cloud) {
        throw new Error('云开发未初始化');
      }

      Taro.showLoading({ title: '初始化游戏...', mask: true });

      // 获取当前用户ID
      const result = await cloud.callFunction({
        name: 'login',
        data: {}
      });
      const loginRes = result.result as any;
      setCurrentUserId(loginRes.user._openid);

      // 调用云函数初始化游戏状态
      const gameResult = await cloud.callFunction({
        name: 'gameAction',
        data: {
          roomId: roomId.current,
          action: 'init'
        }
      });

      const gameRes = gameResult.result as any;
      if (gameRes.success) {
        setGameState(gameRes.gameState);
        
        // 开始监听游戏状态变化
        startWatchGame();
      } else {
        throw new Error(gameRes.message || '初始化游戏失败');
      }

      Taro.hideLoading();
    } catch (error: any) {
      console.error('初始化游戏失败:', error);
      Taro.hideLoading();
      Taro.showModal({
        title: '错误',
        content: error.message || '初始化游戏失败',
        showCancel: false,
        success: () => {
          Taro.navigateBack();
        }
      });
    }
  };

  // 监听游戏状态变化
  const startWatchGame = () => {
    try {
      const cloud = Taro.cloud;
      if (!cloud) return;

      const db = cloud.database();
      const watcher = db.collection('game_states')
        .where({
          roomId: roomId.current
        })
        .watch({
          onChange: (snapshot) => {
            if (snapshot.docs && snapshot.docs.length > 0) {
              const newState = snapshot.docs[0].gameState as GameState;
              setGameState(newState);
              
              // 检查胜利条件
              const winCheck = checkWinCondition(newState);
              if (winCheck.hasWinner) {
                handleGameEnd(winCheck.winner!);
              }
            }
          },
          onError: (err) => {
            console.error('监听游戏状态失败:', err);
          }
        });

      watcherRef.current = watcher;
    } catch (error) {
      console.error('开启监听失败:', error);
    }
  };

  // 处理游戏结束
  const handleGameEnd = async (winnerId: string) => {
    try {
      const cloud = Taro.cloud;
      if (!cloud) return;

      // 调用云函数结算积分
      await cloud.callFunction({
        name: 'gameAction',
        data: {
          roomId: roomId.current,
          action: 'finish',
          winnerId
        }
      });

      // 显示结果
      const winnerNickname = gameState?.players.find(p => p.id === winnerId)?.nickname || '未知';
      
      Taro.showModal({
        title: '游戏结束',
        content: `恭喜 ${winnerNickname} 获得胜利！`,
        showCancel: false,
        confirmText: '返回大厅',
        success: () => {
          Taro.redirectTo({
            url: '/pages/online/lobby/lobby'
          });
        }
      });
    } catch (error) {
      console.error('处理游戏结束失败:', error);
    }
  };

  // 投掷骰子
  const handleRollDice = async (count: 1 | 2) => {
    if (!gameState || loading) return;

    // 检查是否是当前玩家的回合
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (currentPlayer.id !== currentUserId) {
      Taro.showToast({
        title: '不是你的回合',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    setLoading(true);
    try {
      const cloud = Taro.cloud;
      if (!cloud) {
        throw new Error('云开发未初始化');
      }

      // 调用云函数投掷骰子
      const result = await cloud.callFunction({
        name: 'gameAction',
        data: {
          roomId: roomId.current,
          action: 'rollDice',
          count
        }
      });

      const res = result.result as any;
      if (res.success) {
        setDiceResult(res.diceResult);
        setGameState(res.gameState);
        
        // 显示结算结果
        if (res.settlements && res.settlements.length > 0) {
          setSettlements(res.settlements);
          setShowSettlements(true);
        } else {
          Taro.showToast({
            title: '没有触发任何建筑',
            icon: 'none',
            duration: 2000
          });
        }
      } else {
        throw new Error(res.message || '投掷骰子失败');
      }
    } catch (error: any) {
      console.error('投掷骰子失败:', error);
      Taro.showToast({
        title: error.message || '操作失败',
        icon: 'none',
        duration: 2000
      });
    } finally {
      setLoading(false);
    }
  };

  // 打开建筑列表
  const openBuildingShop = () => {
    if (!gameState || loading) return;

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (currentPlayer.id !== currentUserId) {
      Taro.showToast({
        title: '不是你的回合',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    setShowBuildingList(true);
  };

  // 购买建筑
  const handlePurchase = async (buildingId: string) => {
    if (!gameState || loading) return;

    setLoading(true);
    try {
      const cloud = Taro.cloud;
      if (!cloud) {
        throw new Error('云开发未初始化');
      }

      // 调用云函数购买建筑
      const result = await cloud.callFunction({
        name: 'gameAction',
        data: {
          roomId: roomId.current,
          action: 'purchase',
          buildingId
        }
      });

      const res = result.result as any;
      if (res.success) {
        setGameState(res.gameState);
        setShowBuildingList(false);
        
        Taro.showToast({
          title: `购买了${res.building.name}`,
          icon: 'success',
          duration: 1500
        });
        
        // 检查是否胜利
        if (res.winCheck && res.winCheck.hasWinner) {
          setTimeout(() => {
            handleGameEnd(res.winCheck.winner);
          }, 2000);
        }
      } else {
        throw new Error(res.message || '购买失败');
      }
    } catch (error: any) {
      console.error('购买建筑失败:', error);
      Taro.showToast({
        title: error.message || '购买失败',
        icon: 'none',
        duration: 2000
      });
    } finally {
      setLoading(false);
    }
  };

  // 结束回合
  const handleEndTurn = async () => {
    if (!gameState || loading) return;

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (currentPlayer.id !== currentUserId) {
      Taro.showToast({
        title: '不是你的回合',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    setLoading(true);
    try {
      const cloud = Taro.cloud;
      if (!cloud) {
        throw new Error('云开发未初始化');
      }

      // 调用云函数结束回合
      const result = await cloud.callFunction({
        name: 'gameAction',
        data: {
          roomId: roomId.current,
          action: 'endTurn'
        }
      });

      const res = result.result as any;
      if (res.success) {
        setGameState(res.gameState);
        setDiceResult(null);
        
        const nextPlayer = res.gameState.players[res.gameState.currentPlayerIndex];
        Taro.showToast({
          title: `轮到 ${nextPlayer.nickname}`,
          icon: 'none',
          duration: 2000
        });
      } else {
        throw new Error(res.message || '结束回合失败');
      }
    } catch (error: any) {
      console.error('结束回合失败:', error);
      Taro.showToast({
        title: error.message || '操作失败',
        icon: 'none',
        duration: 2000
      });
    } finally {
      setLoading(false);
    }
  };

  if (!gameState) {
    return (
      <View className="game-container loading-state">
        <Text className="loading-text">加载游戏中...</Text>
      </View>
    );
  }

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = currentPlayer.id === currentUserId;

  return (
    <View className="game-container online-game-container">
      {/* 顶部信息栏 */}
      <View className="top-bar">
        <View className="current-turn">
          <Text className="turn-label">当前回合:</Text>
          <Text className={`turn-player ${isMyTurn ? 'my-turn' : ''}`}>
            {currentPlayer.nickname}
            {isMyTurn && ' (你)'}
          </Text>
        </View>
        <View className="turn-count">
          <Text>第 {gameState.turn} 回合</Text>
        </View>
      </View>

      {/* 玩家信息区域 */}
      <View className="players-info">
        {gameState.players.map((player, index) => (
          <View 
            key={player.id}
            className={`player-card ${index === gameState.currentPlayerIndex ? 'active' : ''} ${player.id === currentUserId ? 'me' : ''}`}
          >
            <Text className="player-name">{player.nickname}</Text>
            <Text className="player-gold">💰 {player.gold}</Text>
            <Text className="player-buildings">🏛 {player.buildings.length}</Text>
          </View>
        ))}
      </View>

      {/* 骰子区域 */}
      {diceResult && (
        <View className="dice-area">
          <Text className="dice-title">骰子结果</Text>
          <View className="dice-results">
            {diceResult.dice.map((value, idx) => (
              <View key={idx} className="dice-item">
                <Text className="dice-value">{value}</Text>
              </View>
            ))}
          </View>
          {diceResult.isDouble && (
            <Text className="double-badge">双骰!</Text>
          )}
        </View>
      )}

      {/* 操作按钮区域 */}
      <View className="actions-area">
        {isMyTurn ? (
          <>
            {!diceResult ? (
              <View className="dice-buttons">
                <Button 
                  className="action-btn roll-one"
                  onClick={() => handleRollDice(1)}
                  disabled={loading}
                >
                  投1个骰子
                </Button>
                <Button 
                  className="action-btn roll-two"
                  onClick={() => handleRollDice(2)}
                  disabled={loading}
                >
                  投2个骰子
                </Button>
              </View>
            ) : (
              <View className="turn-actions">
                <Button 
                  className="action-btn purchase-btn"
                  onClick={openBuildingShop}
                  disabled={loading}
                >
                  购买建筑
                </Button>
                <Button 
                  className="action-btn end-turn-btn"
                  onClick={handleEndTurn}
                  disabled={loading}
                >
                  结束回合
                </Button>
              </View>
            )}
          </>
        ) : (
          <View className="waiting-hint">
            <Text className="waiting-text">
              等待 {currentPlayer.nickname} 操作...
            </Text>
          </View>
        )}
      </View>

      {/* 结算弹窗 */}
      {showSettlements && (
        <View className="settlement-modal" onClick={() => setShowSettlements(false)}>
          <View className="modal-content" onClick={(e) => e.stopPropagation()}>
            <Text className="modal-title">结算结果</Text>
            <View className="settlements-list">
              {settlements.map((s, idx) => (
                <View key={idx} className="settlement-item">
                  <Text className="player-name">{s.playerNickname}</Text>
                  <Text className="building-name">{s.buildingName}</Text>
                  <Text className="amount positive">+{s.amount}金</Text>
                </View>
              ))}
            </View>
            <Button className="close-btn" onClick={() => setShowSettlements(false)}>
              确定
            </Button>
          </View>
        </View>
      )}

      {/* 建筑商店弹窗 */}
      {showBuildingList && gameState && (
        <View className="building-shop-modal" onClick={() => setShowBuildingList(false)}>
          <View className="modal-content shop-content" onClick={(e) => e.stopPropagation()}>
            <Text className="modal-title">建筑商店</Text>
            
            <ScrollView className="buildings-list" scrollY>
              {/* 按五行分类显示 */}
              {['water', 'wood', 'fire', 'metal', 'earth'].map(element => {
                const elementBuildings = [...buildingsData.basicBuildings, ...buildingsData.legendaryBuildings]
                  .filter((b: any) => {
                    const count = gameState.availableBuildings[b.id] || 0;
                    return count > 0 && (b.element === element || (element === 'earth' && b.element === 'none'));
                  });
                
                if (elementBuildings.length === 0) return null;
                
                return (
                  <View key={element} className="element-group">
                    <View className="element-header" style={{ backgroundColor: getElementColor(element as any) }}>
                      <Text className="element-name">{getElementName(element as any)}</Text>
                    </View>
                    
                    {elementBuildings.map((building: any) => {
                      const count = gameState.availableBuildings[building.id] || 0;
                      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
                      const canAfford = currentPlayer && currentPlayer.gold >= building.cost;
                      const owned = currentPlayer?.buildings.filter(b => b.configId === building.id).length || 0;
                      
                      return (
                        <View key={building.id} className="building-item">
                          <View className="building-info">
                            <View className="building-header">
                              <Text className="building-name">{building.name}</Text>
                              <Text className="building-cost">{building.cost}金</Text>
                            </View>
                            <View className="building-details">
                              <Text className="building-stock">库存: {count}</Text>
                              {owned > 0 && (
                                <Text className="building-owned">已拥有: {owned}</Text>
                              )}
                            </View>
                          </View>
                          <Button 
                            className={`buy-btn ${canAfford ? '' : 'disabled'}`}
                            onClick={() => handlePurchase(building.id)}
                            disabled={loading || !canAfford}
                          >
                            {canAfford ? '购买' : '金币不足'}
                          </Button>
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </ScrollView>
            
            <View className="shop-footer">
              <Text className="player-gold">
                当前金币: {gameState.players[gameState.currentPlayerIndex]?.gold || 0}
              </Text>
              <Button className="close-btn" onClick={() => setShowBuildingList(false)}>
                关闭
              </Button>
            </View>
          </View>
        </View>
      )}

      {/* 提示消息 */}
      {showMessage && (
        <View className="message-toast" onClick={() => setShowMessage('')}>
          <Text>{showMessage}</Text>
        </View>
      )}

      {/* 退出按钮 */}
      <View className="game-footer">
        <Button 
          className="exit-btn"
          onClick={() => {
            Taro.showModal({
              title: '提示',
              content: '确定要退出游戏吗？',
              success: (res) => {
                if (res.confirm) {
                  Taro.redirectTo({
                    url: '/pages/online/lobby/lobby'
                  });
                }
              }
            });
          }}
        >
          退出游戏
        </Button>
      </View>
      
      {/* 调试面板 */}
      <DebugPanel />
    </View>
  );
}
