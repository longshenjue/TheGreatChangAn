import { View, Text, Button, ScrollView } from '@tarojs/components';
import { useState, useEffect } from 'react';
import Taro, { useRouter } from '@tarojs/taro';
import {
  GameState,
  Player,
  DiceResult,
  WeatherMode,
  SettlementResult,
  BuildingConfig,
  ElementType,
  BuildingLevel,
} from '../../types/game';
import {
  initializeGame,
  rollDice,
  flipDice,
  getBuildingConfig,
  getElementColor,
  getElementName,
  calculateTotalAssets,
  checkWinCondition,
  playerHasBuilding,
  processWeatherEffect,
  getPlayerBuildingCountByElement,
  getAllBuildingCountByElement,
} from '../../utils/gameEngine';
import { processSettlement, purchaseBuilding } from '../../utils/settlement';
import lanService from '../../services/lanService';
import { soundManager } from '../../utils/soundEffects';
import './game.scss';

// 骰子点数显示组件（使用真实点数）
function DiceDots({ value }: { value: number }) {
  const renderDots = () => {
    const dots = [];
    
    // 根据点数渲染对应的点
    if (value === 1) {
      dots.push(<View key="center" className="dot dot-center" />);
    } else if (value === 2) {
      dots.push(<View key="tl" className="dot dot-top-left" />);
      dots.push(<View key="br" className="dot dot-bottom-right" />);
    } else if (value === 3) {
      dots.push(<View key="tl" className="dot dot-top-left" />);
      dots.push(<View key="center" className="dot dot-center" />);
      dots.push(<View key="br" className="dot dot-bottom-right" />);
    } else if (value === 4) {
      dots.push(<View key="tl" className="dot dot-top-left" />);
      dots.push(<View key="tr" className="dot dot-top-right" />);
      dots.push(<View key="bl" className="dot dot-bottom-left" />);
      dots.push(<View key="br" className="dot dot-bottom-right" />);
    } else if (value === 5) {
      dots.push(<View key="tl" className="dot dot-top-left" />);
      dots.push(<View key="tr" className="dot dot-top-right" />);
      dots.push(<View key="center" className="dot dot-center" />);
      dots.push(<View key="bl" className="dot dot-bottom-left" />);
      dots.push(<View key="br" className="dot dot-bottom-right" />);
    } else if (value === 6) {
      dots.push(<View key="tl" className="dot dot-top-left" />);
      dots.push(<View key="tr" className="dot dot-top-right" />);
      dots.push(<View key="ml" className="dot dot-middle-left" />);
      dots.push(<View key="mr" className="dot dot-middle-right" />);
      dots.push(<View key="bl" className="dot dot-bottom-left" />);
      dots.push(<View key="br" className="dot dot-bottom-right" />);
    }
    
    return dots;
  };
  
  return <View className="dice-dots">{renderDots()}</View>;
}

export default function Game() {
  const router = useRouter();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [diceResult, setDiceResult] = useState<DiceResult | null>(null);
  const [isRolling, setIsRolling] = useState(false); // 骰子动画状态
  const [settlementResults, setSettlementResults] = useState<SettlementResult[]>([]);
  const [showBuildingShop, setShowBuildingShop] = useState(false);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [buildingDetailModal, setBuildingDetailModal] = useState<BuildingConfig | null>(null); // 建筑详情弹窗
  const [purchaseAnimation, setPurchaseAnimation] = useState<{ show: boolean; buildingName: string; isLegendary: boolean }>({ show: false, buildingName: '', isLegendary: false }); // 购买动画
  const [canFlipDice, setCanFlipDice] = useState(false);
  const [hasPurchased, setHasPurchased] = useState(false);
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [showDiceCalculator, setShowDiceCalculator] = useState(false);
  const [weatherInfoExpanded, setWeatherInfoExpanded] = useState(false);

  // 联机模式状态
  const [isLANMode, setIsLANMode] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string>('');
  const [myNickname, setMyNickname] = useState<string>(''); // 从URL参数获取，不依赖localStorage

  // 处理服务器推送的游戏状态更新（服务器权威模式）
  const handleGameStateUpdated = (data: any) => {
    const { action, gameState: newGameState, result } = data;
    console.log('📨 收到游戏状态更新:', action, result);
    
    // 直接使用服务器返回的游戏状态
    setGameState(newGameState);
    
    // 根据操作类型更新UI
    switch (action) {
      case 'rollDice':
        // 清除超时定时器
        if ((window as any).rollDiceTimeout) {
          clearTimeout((window as any).rollDiceTimeout);
          (window as any).rollDiceTimeout = null;
        }
        
        // 延迟显示结果，确保骰子动画播放完整（至少1.2秒）
        console.log('🎲 处理投骰子结果:', result);
        setTimeout(() => {
          if (result.diceResult) {
            console.log('✅ 显示骰子结果:', result.diceResult);
            setDiceResult(result.diceResult);
            setIsRolling(false);
          } else {
            console.error('❌ 没有骰子结果！', result);
            setIsRolling(false);
          }
          if (result.settlementResults) {
            setSettlementResults(result.settlementResults);
            setShowSettlementModal(true);
          }
        }, 1200); // 1.2秒动画时间（与投骰子动画保持一致）
        break;
        
      case 'flipDice':
        // 显示翻转后的骰子结果
        if (result.diceResult) {
          setDiceResult(result.diceResult);
          setCanFlipDice(false);
        }
        if (result.settlementResults) {
          setSettlementResults(result.settlementResults);
          setShowSettlementModal(true);
        }
        break;
        
      case 'purchaseBuilding':
        // 显示购买结果
        if (result.purchased && result.building) {
          const isLegendary = result.building.level === 'legendary';
          
          // 播放购买音效
          if (isLegendary) {
            soundManager.playLegendaryPurchase();
          } else {
            soundManager.playPurchase();
          }
          
          setPurchaseAnimation({
            show: true,
            buildingName: result.building.name,
            isLegendary
          });
          // 传奇建筑动画持续更久
          const animationDuration = isLegendary ? 5000 : 2000;
          setTimeout(() => {
            setPurchaseAnimation({ show: false, buildingName: '', isLegendary: false });
          }, animationDuration);
          
          setHasPurchased(true);
          setShowBuildingShop(false);
          
          // 检查游戏结束
          if (result.gameOver && result.winner) {
            setTimeout(() => {
              const winMessage = result.winType === 'instant' 
                ? `🎉 ${result.winner.name} 建造【九鼎神庙】，立即获胜！`
                : result.winType === 'wanguolaizhao'
                ? `🎉 ${result.winner.name} 拥有【万国来朝】，总资产达到 ${result.totalAssets} 金，获胜！`
                : `🎉 恭喜 ${result.winner.name} 获得胜利！`;
              
              Taro.showModal({
                title: '游戏结束',
                content: winMessage,
                confirmText: '返回房间',
                cancelText: '回到首页',
                success: (res) => {
                  if (res.confirm) {
                    // 返回房间，准备下一局
                    if (isLANMode && roomId) {
                      console.log('🔄 游戏结束，返回房间:', roomId);
                      // 使用 reLaunch 重新加载房间页面，避免页面栈问题
                      Taro.reLaunch({ 
                        url: `/pages/lan/room/room?roomId=${roomId}` 
                      });
                    } else {
                      Taro.reLaunch({ url: '/pages/welcome/welcome' });
                    }
                  } else {
                    // 回到首页
                    Taro.reLaunch({ url: '/pages/welcome/welcome' });
                  }
                },
              });
            }, 2000);
          }
        } else if (result.message) {
          Taro.showToast({
            title: result.message,
            icon: 'none',
            duration: 2000
          });
        }
        break;
        
      case 'endTurn':
        // 重置UI状态
        setDiceResult(null);
        setSettlementResults([]);
        setCanFlipDice(false);
        setHasPurchased(false);
        setShowSettlementModal(false);
        break;
    }
  };

  // 初始化游戏
  useEffect(() => {
    const params = router.params;
    
    // 检查是否为局域网模式
    if (params.mode === 'lan' && params.roomId) {
      console.log('🌐 局域网联机模式（服务器权威）');
      setIsLANMode(true);
      setRoomId(params.roomId);
      setMyPlayerId(lanService.getPlayerId());
      
      // 从URL参数获取当前玩家昵称（关键！不依赖localStorage）
      if (params.myNickname) {
        const nickname = decodeURIComponent(params.myNickname);
        setMyNickname(nickname);
        console.log('👤 从URL获取当前玩家昵称:', nickname);
      }
      
      // 监听服务器推送的游戏状态更新
      lanService.on('gameStateUpdated', handleGameStateUpdated);
      
      // 监听玩家断线/重连事件
      lanService.on('playerDisconnected', (data: any) => {
        Taro.showToast({
          title: `${data.nickname} 断线`,
          icon: 'none',
          duration: 2000
        });
      });
      
      lanService.on('playerReconnected', (data: any) => {
        Taro.showToast({
          title: `${data.nickname} 重连成功`,
          icon: 'success',
          duration: 2000
        });
      });
      
      lanService.on('playerLeft', (data: any) => {
        Taro.showToast({
          title: `${data.nickname} 离开了游戏`,
          icon: 'none',
          duration: 3000
        });
      });
      
      // 初始化游戏（使用服务器发送的初始状态）
      if (params.players && params.weather) {
        const players = JSON.parse(decodeURIComponent(params.players));
        const weather = params.weather as WeatherMode;
        const legendary = params.legendary ? JSON.parse(decodeURIComponent(params.legendary)) : undefined;
        const initialState = initializeGame(players, weather, legendary);
        setGameState(initialState);
        
        const myStoredNickname = Taro.getStorageSync('lan_nickname');
        console.log('🎮 游戏初始化完成（等待服务器状态）');
        console.log('📋 URL参数中的玩家列表:', players);
        console.log('👤 本设备存储的昵称:', myStoredNickname);
        console.log('🎯 初始化的游戏玩家:', initialState.players.map(p => ({ id: p.id, name: p.name })));
      }
      
      return () => {
        lanService.off('gameStateUpdated', handleGameStateUpdated);
      };
    } else {
      // 单机模式
      console.log('🖥️ 单机模式');
      if (params.players && params.weather) {
        const players = JSON.parse(decodeURIComponent(params.players));
        const weather = params.weather as WeatherMode;
        const legendary = params.legendary ? JSON.parse(decodeURIComponent(params.legendary)) : undefined;
        const initialState = initializeGame(players, weather, legendary);
        setGameState(initialState);
      }
    }
  }, []);

  if (!gameState) {
    return <View className="loading">加载中...</View>;
  }

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  
  // 安全检查：确保 currentPlayer 存在
  if (!currentPlayer) {
    console.error('当前玩家不存在:', {
      currentPlayerIndex: gameState.currentPlayerIndex,
      players: gameState.players
    });
    return <View className="loading">游戏初始化失败，请返回重试</View>;
  }
  
  // 检查是否是自己的回合（联机模式下需要判断）
  // 关键：使用URL参数传递的昵称，而不是localStorage（因为同一浏览器多标签会共享localStorage）
  const isMyTurn = !isLANMode || currentPlayer.name === myNickname;
  
  // 调试信息
  if (isLANMode) {
    console.log('🎯 回合判断:', {
      isLANMode,
      currentPlayer: currentPlayer.name,
      myNickname: myNickname,
      myNicknameSource: 'URL参数',
      isMyTurn,
      currentPlayerIndex: gameState.currentPlayerIndex
    });
  }

  // 投掷骰子
  const handleRollDice = (count: 1 | 2) => {
    // 播放骰子音效
    soundManager.playDiceRoll();
    
    if (isLANMode && roomId) {
      // 联机模式：只发送指令给服务器
      console.log('📤 发送投骰子指令到服务器', {
        roomId,
        diceCount: count,
        currentPlayer: currentPlayer.name,
        myNickname
      });
      setIsRolling(true);
      
      // 添加超时保护
      const timeoutId = setTimeout(() => {
        console.error('⚠️  投骰子超时（5秒未收到响应）');
        setIsRolling(false);
        Taro.showToast({
          title: '网络超时，请重试',
          icon: 'none',
          duration: 2000
        });
      }, 5000);
      
      // 清除超时定时器（当收到响应时会清除）
      (window as any).rollDiceTimeout = timeoutId;
      
      lanService.sendGameAction(roomId, 'rollDice', {
        diceCount: count
      });
    } else {
      // 单机模式：本地执行游戏逻辑
      setIsRolling(true);
      setHasPurchased(false);
      
      setTimeout(() => {
        const result = rollDice(count);
        setDiceResult(result);
        setCanFlipDice(
          count === 2 && playerHasBuilding(currentPlayer, 'legendary_damminggong')
        );
        setIsRolling(false);

        if (count === 2 && playerHasBuilding(currentPlayer, 'legendary_damminggong')) {
          return;
        }

        performSettlement(result);
      }, 1200); // 增加到1.2秒，与联机模式保持一致
    }
  };

  // 执行结算（统一的结算逻辑）
  const performSettlement = (result: DiceResult) => {
    // 处理天气效果
    let weatherResults: SettlementResult[] = [];
    if (result.isDouble) {
      weatherResults = processWeatherEffect(result, gameState, currentPlayer);
    }

    // 处理正常结算
    const normalResults = processSettlement(
      result,
      gameState,
      currentPlayer,
      result.isDouble
    );

    setSettlementResults([...weatherResults, ...normalResults]);
    setCanFlipDice(false); // 结算后禁用翻转
    
    // 显示结算弹窗（不自动关闭，需要手动点击关闭）
    if ([...weatherResults, ...normalResults].length > 0) {
      setShowSettlementModal(true);
    }

    // 检查胜利条件
    const winCheck = checkWinCondition(gameState);
    if (winCheck.hasWinner && winCheck.winner) {
      setTimeout(() => {
        const winMessage = `🎉 恭喜 ${winCheck.winner?.name} 获得胜利！`;
        
        Taro.showModal({
          title: '游戏结束',
          content: winMessage,
          confirmText: '再来一局',
          cancelText: '返回大厅',
          success: (res) => {
            if (res.confirm) {
              // 再来一局：重新初始化游戏
              const playerNames = router.params.players ? JSON.parse(decodeURIComponent(router.params.players as string)) : [];
              const weatherMode = router.params.weather as WeatherMode || 'prosperity';
              const legendaryBuildings = router.params.legendary ? JSON.parse(decodeURIComponent(router.params.legendary as string)) : [];
              
              const newGameState = initializeGame(playerNames, weatherMode, legendaryBuildings);
              setGameState(newGameState);
              setDiceResult(null);
              setSettlementResults([]);
              setCanFlipDice(false);
              setHasPurchased(false);
              
              Taro.showToast({
                title: '新游戏开始！',
                icon: 'success',
                duration: 2000
              });
            } else {
              // 返回大厅
              Taro.redirectTo({
                url: '/pages/index/index'
              });
            }
          },
        });
      }, 500);
    }

    setGameState({ ...gameState });
  };

  // 翻转骰子（大明宫）
  const handleFlipDice = (diceIndex: 1 | 2) => {
    if (!diceResult || !canFlipDice) return;

    const newResult = { ...diceResult };
    if (diceIndex === 1) {
      newResult.dice1 = flipDice(newResult.dice1);
    } else if (diceIndex === 2 && newResult.dice2) {
      newResult.dice2 = flipDice(newResult.dice2);
    }
    newResult.total = newResult.dice2
      ? newResult.dice1 + newResult.dice2
      : newResult.dice1;
    newResult.isDouble = newResult.dice2 !== undefined && newResult.dice1 === newResult.dice2;

    setDiceResult(newResult);
    // 翻转后仍然可以继续翻转或确认，不自动结算
  };

  // 确认骰子点数并结算（大明宫确认按钮）
  const handleConfirmDice = () => {
    if (!diceResult) return;
    performSettlement(diceResult);
  };

  // 购买建筑
  const handlePurchase = (buildingId: string) => {
    if (isLANMode && roomId) {
      // 联机模式：只发送指令给服务器
      console.log('📤 发送购买建筑指令到服务器:', buildingId);
      
      lanService.sendGameAction(roomId, 'purchaseBuilding', {
        buildingId
      });
    } else {
      // 单机模式：本地执行游戏逻辑
      const config = getBuildingConfig(buildingId);
      const isLegendary = config?.level === 'legendary';
      const wasFreeBuilding = currentPlayer.canFreeBuilding && !isLegendary;
      
      // 检查是否已经购买过且没有额外购买权限（免费购买不算）
      if (hasPurchased && !currentPlayer.canBuyExtra && !wasFreeBuilding) {
        Taro.showToast({
          title: '每回合只能购买一个建筑',
          icon: 'none',
          duration: 2000,
        });
        return;
      }

      const result = purchaseBuilding(currentPlayer, buildingId, gameState);
      
      if (result.success) {
        // 播放购买音效
        const isLegendary = config?.level === 'legendary';
        if (isLegendary) {
          soundManager.playLegendaryPurchase();
        } else {
          soundManager.playPurchase();
        }
        
        // 显示购买成功动画
        setPurchaseAnimation({ show: true, buildingName: config?.name || '', isLegendary });
        // 传奇建筑动画持续更久
        const animationDuration = isLegendary ? 5000 : 2000;
        setTimeout(() => {
          setPurchaseAnimation({ show: false, buildingName: '', isLegendary: false });
        }, animationDuration);
        
        const hadExtraBuyChance = currentPlayer.canBuyExtra;
        
        // 免费购买不算作hasPurchased
        if (!wasFreeBuilding) {
          if (!hasPurchased) {
            setHasPurchased(true);
          } else if (currentPlayer.canBuyExtra) {
            // 使用了额外购买权限
            currentPlayer.canBuyExtra = false;
          }
        }
        setGameState({ ...gameState });

        // 检查胜利条件
        const winCheck = checkWinCondition(gameState);
        if (winCheck.hasWinner && winCheck.winner) {
          setTimeout(() => {
            Taro.showModal({
              title: '游戏结束',
              content: `🎉 恭喜 ${winCheck.winner?.name} 获得胜利！`,
              showCancel: false,
              success: () => {
                Taro.redirectTo({
                  url: '/pages/index/index'
                });
              },
            });
          }, 500);
        } else {
          // 没有胜利者，检查是否需要自动关闭弹窗并结束回合
          // 免费购买不自动关闭弹窗
          if (!wasFreeBuilding) {
            // 如果购买前没有额外购买机会，或者购买后用完了额外购买机会
            if (!hadExtraBuyChance || !currentPlayer.canBuyExtra) {
              // 自动关闭弹窗并结束回合
              setTimeout(() => {
                setShowBuildingShop(false);
                // 再延迟一点结束回合，让用户看到购买成功的提示
                setTimeout(() => {
                  handleEndTurn();
                }, 500);
              }, 500);
            }
          }
          // 如果还有额外购买机会（营造司首次购买）或免费购买，保持弹窗打开
        }
      } else {
        // 购买失败，显示Toast提示
        Taro.showToast({
          title: result.message,
          icon: 'none',
          duration: 2000,
        });
      }
    }
  };

  // 卖升级卡
  const handleSellUpgradeCard = (count: number) => {
    // 播放卖卡音效
    soundManager.playSellCard();
    
    if (isLANMode && roomId) {
      // LAN模式：发送卖卡请求到服务器
      lanService.sendGameAction(roomId, 'sellUpgradeCard', {
        count
      });
    } else {
      // 单机模式：本地执行
      if (!currentPlayer.upgradeCards || currentPlayer.upgradeCards < count) {
        Taro.showToast({
          title: '升级卡不足',
          icon: 'none',
          duration: 2000,
        });
        return;
      }

      currentPlayer.upgradeCards -= count;
      currentPlayer.gold += count;
      
      setGameState({ ...gameState });
      
      Taro.showToast({
        title: `卖出${count}张升级卡，获得${count}金`,
        icon: 'success',
        duration: 2000,
      });
    }
  };

  // 结束回合
  const handleEndTurn = () => {
    if (isLANMode && roomId) {
      // 联机模式：只发送指令给服务器
      console.log('📤 发送结束回合指令到服务器');
      
      lanService.sendGameAction(roomId, 'endTurn', {});
    } else {
      // 单机模式：本地执行游戏逻辑
      currentPlayer.canBuyExtra = false;
      currentPlayer.canFreeBuilding = false;
      currentPlayer.grandCanalTriggered = false;
      
      const nextIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
      
      setGameState({
        ...gameState,
        currentPlayerIndex: nextIndex,
      });
      setDiceResult(null);
      setSettlementResults([]);
      setShowBuildingShop(false);
      setHasPurchased(false);
      setCanFlipDice(false);
    }
  };

  return (
    <View className="game-container">
      {/* 顶部状态栏 */}
      <View className="status-bar">
        <Button className="back-btn" onClick={() => {
          Taro.showModal({
            title: '确认退出',
            content: '确定要退出当前游戏吗？',
            success: (res) => {
              if (res.confirm) {
                Taro.redirectTo({
                  url: '/pages/index/index'
                });
              }
            }
          });
        }}>
          <Text className="back-icon">&lt;</Text>
        </Button>
        <View className="status-center">
          <View className="weather-info">
            <Text className="weather-badge">
              {gameState.weatherMode === WeatherMode.PROSPERITY ? '贞观盛世' : '乾坤变色'}
            </Text>
          </View>
        </View>
        <View className="status-right">
          {/* 国库信息：常驻显示（不限模式） */}
          <View className="treasury-info">
            <Text className="label">国库：</Text>
            <Text className="value">{gameState.treasury} 金</Text>
          </View>
          <Button className="calculator-btn" onClick={() => setShowDiceCalculator(true)}>
            <Text className="calc-text">🧮</Text>
          </Button>
        </View>
      </View>

      {/* 玩家面板 */}
      <ScrollView scrollY className="players-panel">
        {gameState.players.map((player, index) => (
          <View
            key={player.id}
            className={`player-card ${index === gameState.currentPlayerIndex ? 'active' : ''}`}
          >
            <View className="player-header">
              <View className="player-info">
                <Text className="player-name">{player.name}</Text>
                {index === gameState.currentPlayerIndex && (
                  <Text className="current-tag">当前回合</Text>
                )}
              </View>
              <View className="player-resources">
                <Text className="gold">💰 {player.gold}</Text>
                {(player.upgradeCards || 0) > 0 && (
                  <>
                    <Text className="upgrade-card">🎫 {player.upgradeCards}</Text>
                    {index === gameState.currentPlayerIndex && isMyTurn && (
                      <Button
                        className="sell-card-btn"
                        onClick={() => {
                          if (player.upgradeCards && player.upgradeCards > 0) {
                            Taro.showModal({
                              title: '卖出升级卡',
                              content: `确认卖出1张升级卡，获得1金？\n（当前：${player.upgradeCards}张）`,
                              success: (res) => {
                                if (res.confirm) {
                                  handleSellUpgradeCard(1);
                                }
                              }
                            });
                          }
                        }}
                      >
                        卖卡
                      </Button>
                    )}
                  </>
                )}
              </View>
            </View>
            
            <View className="player-buildings">
              {(() => {
                // 统计建筑数量
                const buildingCount: { [key: string]: number } = {};
                player.buildings.forEach(pb => {
                  buildingCount[pb.configId] = (buildingCount[pb.configId] || 0) + 1;
                });
                
                // 按五行元素排序：水→木→火→土→金→传奇
                const elementOrder = { 
                  'water': 1, 
                  'wood': 2, 
                  'fire': 3, 
                  'earth': 4, 
                  'metal': 5, 
                  'null': 6 
                };
                
                const sortedBuildings = Object.keys(buildingCount).sort((a, b) => {
                  const configA = getBuildingConfig(a);
                  const configB = getBuildingConfig(b);
                  if (!configA || !configB) return 0;
                  
                  const orderA = elementOrder[configA.element || 'null'] || 99;
                  const orderB = elementOrder[configB.element || 'null'] || 99;
                  
                  if (orderA !== orderB) return orderA - orderB;
                  // 同元素按cost排序
                  return configA.cost - configB.cost;
                });
                
                return sortedBuildings.map(configId => {
                  const config = getBuildingConfig(configId);
                  if (!config) return null;
                  const count = buildingCount[configId];
                  return (
                    <View
                      key={configId}
                      className="building-tag clickable"
                      style={{ borderColor: getElementColor(config.element) }}
                      onClick={() => setBuildingDetailModal(config)}
                    >
                      <Text className="building-name">{config.name}</Text>
                      {count > 1 && <Text className="building-count">×{count}</Text>}
                    </View>
                  );
                });
              })()}
            </View>

            <View className="player-stats">
              <Text className="stat">总资产: {calculateTotalAssets(player)}</Text>
              <Text className="stat">建筑数: {player.buildings.length}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* 骰子区域 */}
      {!diceResult && (
        <View className="dice-area">
          <Text className="prompt">{isRolling ? '投掷中...' : '请投掷骰子'}</Text>
          {isRolling && (
            <View className="rolling-dice-animation">
              <View className="rolling-dice">🎲</View>
            </View>
          )}
          <View className="dice-buttons">
            <Button 
              className="dice-button" 
              onClick={() => {
                if (isRolling || (isLANMode && !isMyTurn)) return;
                handleRollDice(1);
              }}
              disabled={isRolling || (isLANMode && !isMyTurn)}
            >
              投掷 1 颗骰子 {isLANMode && !isMyTurn && '(等待中)'}
            </Button>
            {currentPlayer?.diceCount === 2 && (
              <Button 
                className="dice-button special" 
                onClick={() => {
                  if (isRolling || (isLANMode && !isMyTurn)) return;
                  handleRollDice(2);
                }}
                disabled={isRolling || (isLANMode && !isMyTurn)}
              >
                投掷 2 颗骰子 {isLANMode && !isMyTurn && '(等待中)'}
              </Button>
            )}
          </View>
        </View>
      )}

      {/* 骰子结果 */}
      {diceResult && (
        <View className="dice-result">
          <View className="dice-display">
            <View
              className={`dice dice-real ${canFlipDice ? 'flippable' : ''}`}
              onClick={() => canFlipDice && handleFlipDice(1)}
            >
              <DiceDots value={diceResult.dice1} />
            </View>
            {diceResult.count === 2 && diceResult.dice2 !== null && (
              <>
                <Text className="plus">+</Text>
                <View
                  className={`dice dice-real ${canFlipDice ? 'flippable' : ''}`}
                  onClick={() => canFlipDice && handleFlipDice(2)}
                >
                  <DiceDots value={diceResult.dice2 || 1} />
                </View>
              </>
            )}
            <Text className="equals">=</Text>
            <View className="dice total">
              <Text className="dice-value">{diceResult.total}</Text>
            </View>
          </View>
          {diceResult.isDouble && (
            <Text className="double-tag">双子点数！天时触发</Text>
          )}
          {canFlipDice && (
            <Text className="flip-hint">【大明宫】点击骰子可翻转</Text>
          )}
        </View>
      )}

      {/* 结算日志弹窗 */}
      {showSettlementModal && settlementResults.length > 0 && (
        <View className="settlement-modal-overlay" onClick={() => setShowSettlementModal(false)}>
          <View className="settlement-modal" onClick={(e) => e.stopPropagation()}>
            <View className="modal-header">
              <Text className="modal-title">📜 结算记录</Text>
              <View className="close-btn" onClick={() => setShowSettlementModal(false)}>
                <Text className="close-text">✕</Text>
              </View>
            </View>
            {/* 显示当前掷出的点数 */}
            {diceResult && (
              <View className="dice-result-display">
                <Text className="dice-result-text">
                  🎲 本轮点数：
                  {diceResult.count === 2 && diceResult.dice2 !== null
                    ? `${diceResult.dice1} + ${diceResult.dice2} = ${diceResult.total}`
                    : diceResult.total
                  }
                  {diceResult.isDouble && (
                    <Text className="double-indicator"> (双子)</Text>
                  )}
                </Text>
              </View>
            )}
            <ScrollView scrollY className="modal-content">
              {(() => {
                // 按玩家ID分组所有结算结果
                const playerGroups: { [playerId: string]: { 
                  player: Player,
                  incomeBuildings: { [buildingName: string]: { totalGold: number; count: number } },
                  passiveIncome: typeof settlementResults, // 被动收益（不合并）
                  expenses: typeof settlementResults,
                  special: typeof settlementResults,
                  totalGold: number,
                  totalUpgradeCards: number
                } } = {};

                // 初始化所有玩家的分组
                gameState.players.forEach(player => {
                playerGroups[player.id] = {
                  player,
                  incomeBuildings: {}, // 自己建筑的收益（可合并）
                  passiveIncome: [],   // 被动收益（不合并）
                  expenses: [],        // 支付给他人的损失（不合并）
                  special: [],         // 特殊效果
                  totalGold: 0,
                  totalUpgradeCards: 0     // 升级卡总数
                };
                });

                // 传奇建筑名称列表
                const legendaryBuildings = ['大运河', '天策府', '乐游原', '万国来朝', '观星台', '大明宫', '九鼎神庙'];
                
                // 分类处理所有结算结果
                settlementResults.forEach(result => {
                  const group = playerGroups[result.playerId];
                  if (!group) return;

                  group.totalGold += result.goldChange;
                  
                  // 提取升级卡数量
                  const upgradeCardMatch = result.description.match(/获得\s*(\d+)\s*张升级卡/);
                  if (upgradeCardMatch) {
                    group.totalUpgradeCards += parseInt(upgradeCardMatch[1]);
                  }
                  
                  // 检查是否包含传奇建筑效果
                  const hasLegendaryEffect = legendaryBuildings.some(name => 
                    result.description.includes(`【${name}】`)
                  );
                  
                  // 提取建筑名称（如果有）
                  const buildingMatch = result.description.match(/【(.+?)】/);
                  if (buildingMatch && !hasLegendaryEffect) {
                    const buildingName = buildingMatch[1];
                    // 判断是收益还是支出
                    const isExpense = result.description.includes('支付') || result.description.includes('向');
                    // 判断是否是被动收益（不应合并）
                    const isPassiveIncome = result.description.includes('从国库') || 
                                          result.description.includes('被动') ||
                                          result.description.includes('每回合') ||
                                          result.description.includes('存款') ||
                                          result.description.includes('利息');
                    
                    if (isExpense) {
                      // 支出：单独显示，不合并
                      group.expenses.push(result);
                    } else if (isPassiveIncome) {
                      // 被动收益：单独显示，不合并
                      group.passiveIncome.push(result);
                    } else {
                      // 收益：仅合并触发收益
                      if (group.incomeBuildings[buildingName]) {
                        group.incomeBuildings[buildingName].totalGold += result.goldChange;
                        group.incomeBuildings[buildingName].count++;
                      } else {
                        group.incomeBuildings[buildingName] = {
                          totalGold: result.goldChange,
                          count: 1
                        };
                      }
                    }
                  } else {
                    // 特殊效果（如营造司、祭天坛、天气效果、传奇建筑等）单独显示
                    group.special.push(result);
                  }
                });

                // 渲染每个玩家的收益
                return (
                  <>
                    {Object.values(playerGroups).map((group, groupIndex) => {
                      // 跳过没有任何收益变化的玩家
                      if (group.totalGold === 0 && 
                          Object.keys(group.incomeBuildings).length === 0 && 
                          group.passiveIncome.length === 0 &&
                          group.expenses.length === 0 &&
                          group.special.length === 0) {
                        return null;
                      }

                      return (
                        <View key={`player-${groupIndex}`} className="player-settlement-group">
                          {/* 玩家被动收益 */}
                          {group.passiveIncome.map((result, index) => (
                            <View key={`passive-${groupIndex}-${index}`} className="log-item">
                              <Text className="log-text">{result.description}</Text>
                            </View>
                          ))}
                          {/* 玩家建筑收益 */}
                          {Object.entries(group.incomeBuildings).map(([buildingName, buildingData], index) => (
                            <View key={`income-${groupIndex}-${index}`} className="log-item">
                              <Text className="log-text">
                                {buildingData.count > 1 
                                  ? `${group.player.name} 的【${buildingName}】×${buildingData.count} 触发，获得 ${buildingData.totalGold} 金`
                                  : `${group.player.name} 的【${buildingName}】触发，获得 ${buildingData.totalGold} 金`
                                }
                              </Text>
                            </View>
                          ))}
                          {/* 玩家支出 */}
                          {group.expenses.map((result, index) => (
                            <View key={`expense-${groupIndex}-${index}`} className="log-item expense">
                              <Text className="log-text">{result.description}</Text>
                            </View>
                          ))}
                          {/* 玩家特殊效果 */}
                          {group.special.map((result, index) => (
                            <View key={`special-${groupIndex}-${index}`} className="log-item">
                              <Text className="log-text">{result.description}</Text>
                            </View>
                          ))}
                          {/* 玩家总收益 */}
                          <View className="log-item total">
                            <Text className="log-text total-text">
                              {group.player.name} 本轮总收益：
                              <Text className={group.totalGold >= 0 ? 'positive' : 'negative'}>
                                {group.totalGold >= 0 ? `+${group.totalGold}` : group.totalGold} 金
                              </Text>
                              {group.totalUpgradeCards > 0 && (
                                <Text className="tax-card-text">
                                  ，🎫 +{group.totalUpgradeCards} 张升级卡
                                </Text>
                              )}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </>
                );
              })()}
            </ScrollView>
          </View>
        </View>
      )}

      {/* 大明宫确认按钮 */}
      {diceResult && canFlipDice && (
        <View className="action-buttons">
          <Button
            className="action-btn confirm-dice-btn"
            onClick={handleConfirmDice}
          >
            ✓ 确认点数
          </Button>
        </View>
      )}

      {/* 操作按钮 */}
      {diceResult && !canFlipDice && (
        <View className="action-buttons">
          <Button
            className="action-btn shop-btn"
            onClick={() => {
              setShowBuildingShop(true);
            }}
          >
            建筑商店 {isLANMode && !isMyTurn && '(仅查看)'}
          </Button>
          <Button 
            className="action-btn end-btn" 
            onClick={() => {
              if (isLANMode && !isMyTurn) return;
              handleEndTurn();
            }}
            disabled={isLANMode && !isMyTurn}
          >
            结束回合 {isLANMode && !isMyTurn && '(等待中)'}
          </Button>
        </View>
      )}

      {/* 建筑商店弹窗 */}
      {showBuildingShop && (
        <View className="shop-overlay" onClick={() => setShowBuildingShop(false)}>
          <View className="shop-modal" onClick={(e) => e.stopPropagation()}>
            <View className="modal-header">
              <Text className="modal-title">🏪 建筑商店</Text>
              <View className="close-btn" onClick={() => setShowBuildingShop(false)}>
                <Text className="close-text">✕</Text>
              </View>
            </View>
            <View className="shop-info-bar">
              <Text className="info-text">💰 当前金币: {currentPlayer.gold}</Text>
              <Text className="info-text">🎫 升级卡: {currentPlayer.upgradeCards || 0}</Text>
            </View>
            <ScrollView scrollY className="shop-content">
            {Object.keys(gameState.availableBuildings)
              .filter(id => {
                const config = getBuildingConfig(id);
                if (!config) return false;
                
                // 传奇建筑：必须在本局启用（quantity > 0）且未拥有
                if (config.level === 'legendary') {
                  // 检查本局是否启用该传奇建筑（初始化时未启用的会被设置为0）
                  const isEnabled = gameState.availableBuildings[id] > 0;
                  if (!isEnabled) return false;
                  // 检查玩家是否已拥有
                  return !playerHasBuilding(currentPlayer, id);
                }
                // 普通建筑：有库存就显示
                return gameState.availableBuildings[id] > 0;
              })
              .map(buildingId => {
                const config = getBuildingConfig(buildingId);
                if (!config) return null;
                
                // 构建触发条件文本
                let triggerText = '';
                if (config.triggerNumbers.length > 0) {
                  triggerText = `点数 ${config.triggerNumbers.join('/')} 触发`;
                } else if (config.level === 'legendary') {
                  triggerText = '传奇建筑';
                }

                // 计算实际费用和资源需求
                const isLegendary = config.level === 'legendary';
                const isAdvanced = config.level === 'advanced';
                const isFree = currentPlayer.canFreeBuilding && !isLegendary;
                const isDirectBuy = currentPlayer.canDirectBuyAdvanced && isAdvanced;
                const actualCost = isFree || isDirectBuy ? 0 : config.cost;
                
                // 检查升级卡（高级建筑需要升级卡，除非是祭天坛直接购买）
                const needsUpgradeCards = isAdvanced && config.requiresUpgrade && !isDirectBuy;
                const requiredUpgradeCards = needsUpgradeCards ? (config.requiresUpgradeCards || 3) : 0;
                const hasEnoughUpgradeCards = !needsUpgradeCards || (currentPlayer.upgradeCards || 0) >= requiredUpgradeCards;
                
                // 检查是否拥有中级建筑（升级要求）
                const needsSourceBuilding = isAdvanced && config.requiresUpgrade && config.upgradeFrom && !isDirectBuy;
                const hasSourceBuilding = !needsSourceBuilding || currentPlayer.buildings.some(b => b.configId === config.upgradeFrom);
                
                const canAfford = (currentPlayer.gold >= actualCost || isFree || isDirectBuy) && hasEnoughUpgradeCards && hasSourceBuilding;

                return (
                  <View 
                    key={buildingId} 
                    className={`building-shop-item ${isLegendary ? 'legendary' : ''}`}
                    style={isLegendary ? {} : { 
                      backgroundColor: `${getElementColor(config.element)}15` 
                    }}
                  >
                    <View className="building-info">
                      <View className="building-header">
                        <Text
                          className="building-title"
                          style={!isLegendary ? { 
                            color: config.element === 'metal' 
                              ? '#FFD700' 
                              : getElementColor(config.element) 
                          } : {}}
                        >
                          {config.name}
                          {config.requiresUpgrade && config.upgradeFrom && (
                            <Text className="upgrade-source">
                              ⬆{getBuildingConfig(config.upgradeFrom)?.name}
                            </Text>
                          )}
                        </Text>
                        {triggerText && (
                          <Text className="trigger-text">{triggerText}</Text>
                        )}
                      </View>
                      <Text className="building-effect">{config.effect}</Text>
                      <View className="building-meta">
                        <Text className="cost">
                          💰 {config.cost}
                          {(isFree || isDirectBuy) && (
                            <Text className="discount"> → 免费</Text>
                          )}
                        </Text>
                        {needsUpgradeCards && (
                          <Text className="upgrade-cards-required">
                            🎫 需要 {requiredUpgradeCards} 张升级卡
                          </Text>
                        )}
                        <Text className="owned">
                          已拥有: {currentPlayer.buildings.filter(b => b.configId === buildingId).length}
                        </Text>
                        {!isLegendary && (
                          <Text className="stock">
                            剩余: {gameState.availableBuildings[buildingId]}
                          </Text>
                        )}
                      </View>
                    </View>
                    <Button
                      className={`buy-btn ${canAfford || isFree || isDirectBuy ? 'can-afford' : ''} ${isFree || isDirectBuy ? 'free' : ''}`}
                      onClick={() => handlePurchase(buildingId)}
                      disabled={
                        (isLANMode && !isMyTurn) ||
                        (hasPurchased && !currentPlayer.canBuyExtra && !currentPlayer.canFreeBuilding && !currentPlayer.canDirectBuyAdvanced) ||
                        !canAfford
                      }
                    >
                      {isFree || isDirectBuy ? '免费获取' : (canAfford ? '购买' : '资源不足')}
                    </Button>
                  </View>
                );
              })}
          </ScrollView>
          </View>
        </View>
      )}

      {/* 骰子收益计算器 */}
      {showDiceCalculator && (
        <View className="calculator-overlay" onClick={() => setShowDiceCalculator(false)}>
          <View className="calculator-modal" onClick={(e) => e.stopPropagation()}>
            <View className="modal-header">
              <Text className="modal-title">📊 骰子收益查看器</Text>
              <View className="close-btn" onClick={() => setShowDiceCalculator(false)}>
                <Text className="close-text">✕</Text>
              </View>
            </View>
            <ScrollView scrollY className="calculator-content">
              {/* 天气系统说明面板 */}
              <View className="weather-info-panel">
                <View 
                  className="weather-info-header"
                  onClick={() => setWeatherInfoExpanded(!weatherInfoExpanded)}
                >
                  <View className="weather-title">
                    <Text>📖 天气系统说明</Text>
                    <Text className="weather-current">
                      当前：{gameState.weatherMode === 'prosperity' ? '贞观盛世' : '乾坤变色'}
                    </Text>
                  </View>
                  <Text className={`expand-icon ${weatherInfoExpanded ? 'expanded' : ''}`}>
                    ▼
                  </Text>
                </View>
                
                {weatherInfoExpanded && (
                  <View className="weather-info-content">
                    {/* 当前天气模式详细说明 */}
                    {gameState.weatherMode === 'prosperity' ? (
                      <View className="weather-mode-section active-mode">
                        <View className="mode-title">
                          <Text className="mode-name">贞观盛世</Text>
                          <Text className="mode-subtitle">（简单/收益模式）</Text>
                        </View>
                        <Text className="mode-desc">双子点数触发时，获得基础金币+对应属性建筑加成</Text>
                        <View className="weather-effects">
                          <Text className="effect-item">• (1,1) 甘霖：5金 + 水建筑×1金</Text>
                          <Text className="effect-item">• (2,2) 回春：5金 + 木建筑×1金</Text>
                          <Text className="effect-item">• (3,3) 地灵：5金 + 土建筑×1金</Text>
                          <Text className="effect-item">• (4,4) 烛照：5金 + 火建筑×1金</Text>
                          <Text className="effect-item">• (5,5) 瑞雪：5金 + 金建筑×1金</Text>
                          <Text className="effect-item">• (6,6) 盛世：直接获得 12金</Text>
                        </View>
                        <View className="weather-note">
                          <Text className="note-text">💡 收益稳定，适合新手玩家</Text>
                        </View>
                      </View>
                    ) : (
                      <View className="weather-mode-section active-mode">
                        <View className="mode-title">
                          <Text className="mode-name">乾坤变色</Text>
                          <Text className="mode-subtitle">（复杂/博弈模式）</Text>
                        </View>
                        <Text className="mode-desc">双子点数触发时，强制结算对应属性所有建筑×2倍，并对相克属性惩罚</Text>
                        <View className="weather-effects">
                          <Text className="effect-item">• (1,1) 洪涝：水系建筑×2，火系-3金/张</Text>
                          <Text className="effect-item">• (2,2) 大风：木系建筑×2，土系-3金/张</Text>
                          <Text className="effect-item">• (3,3) 地动：土系建筑×2，金系-3金/张</Text>
                          <Text className="effect-item">• (4,4) 大旱：火系建筑×2，水系-3金/张</Text>
                          <Text className="effect-item">• (5,5) 霜降：金系建筑×2，木系-3金/张</Text>
                          <Text className="effect-item">• (6,6) 日食：10金+国库，其他人建筑数×1金</Text>
                        </View>
                        <View className="weather-note warning">
                          <Text className="note-text">⚠️ 注意：强制结算时，大运河、天策府等触发型传奇不生效</Text>
                        </View>
                      </View>
                    )}
                    
                    {/* 另一个天气模式简略说明 */}
                    <View className="weather-mode-section other-mode">
                      <View className="mode-title">
                        <Text className="mode-name">
                          {gameState.weatherMode === 'prosperity' ? '乾坤变色' : '贞观盛世'}
                        </Text>
                        <Text className="mode-subtitle">
                          （{gameState.weatherMode === 'prosperity' ? '复杂/博弈模式' : '简单/收益模式'}）
                        </Text>
                      </View>
                      <Text className="mode-hint">💡 在房间设置中可以切换天气系统</Text>
                    </View>
                  </View>
                )}
              </View>

              {/* 生成所有可能的骰子组合 - 分组显示 */}
              {(() => {
                // 单骰子组合
                const singleDice: Array<{dice1: number, dice2?: number, total: number, isDouble: boolean, type: string}> = [];
                for (let i = 1; i <= 6; i++) {
                  singleDice.push({ dice1: i, total: i, isDouble: false, type: 'single' });
                }
                
                // 双骰子组合（非双子）
                const doubleDice: Array<{dice1: number, dice2?: number, total: number, isDouble: boolean, type: string}> = [];
                for (let i = 1; i <= 6; i++) {
                  for (let j = i + 1; j <= 6; j++) {
                    doubleDice.push({ 
                      dice1: i, 
                      dice2: j, 
                      total: i + j,
                      isDouble: false,
                      type: 'double'
                    });
                  }
                }
                
                // 双子组合（天时触发）
                const twinDice: Array<{dice1: number, dice2?: number, total: number, isDouble: boolean, type: string}> = [];
                for (let i = 1; i <= 6; i++) {
                  twinDice.push({ 
                    dice1: i, 
                    dice2: i, 
                    total: i * 2,
                    isDouble: true,
                    type: 'twin'
                  });
                }
                
                const allCombinations = [
                  { title: '🎲 单骰子', combos: singleDice },
                  { title: '🎲🎲 双骰子', combos: doubleDice },
                  { title: '⚡ 双子天时', combos: twinDice }
                ];
                
                return allCombinations.map((group, groupIdx) => (
                  <View key={groupIdx} className="calc-group">
                    <View className="group-title-bar">
                      <Text className="group-title">{group.title}</Text>
                    </View>
                    {group.combos.map((combo, idx) => {
                  const { dice1, dice2, total, isDouble } = combo;
                  
                  // 计算天时倍数（乾坤变色模式下，双子点数收益×2）
                  const weatherMultiplier = (isDouble && gameState.weatherMode === 'chaos') ? 2 : 1;
                  
                  // 为每个玩家计算收益（假设该玩家是掷骰者）
                  const earnings = gameState.players.map(roller => {
                    let totalGoldChange = 0;
                    let details: string[] = [];

                    // 1. 天时系统效果（双子点数）
                    if (isDouble) {
                      if (gameState.weatherMode === 'prosperity') {
                        // 贞观盛世：基础5金 + 元素建筑×1金
                        let weatherGold = 0;
                        switch (dice1) {
                          case 1: weatherGold = 5 + getPlayerBuildingCountByElement(roller, ElementType.WATER) * 1; break;
                          case 2: weatherGold = 5 + getPlayerBuildingCountByElement(roller, ElementType.WOOD) * 1; break;
                          case 3: weatherGold = 5 + getPlayerBuildingCountByElement(roller, ElementType.EARTH) * 1; break;
                          case 4: weatherGold = 5 + getPlayerBuildingCountByElement(roller, ElementType.FIRE) * 1; break;
                          case 5: weatherGold = 5 + getPlayerBuildingCountByElement(roller, ElementType.METAL) * 1; break;
                          case 6: weatherGold = 12; break;
                        }
                        if (weatherGold > 0) {
                          details.push(`天时:+${weatherGold}`);
                          totalGoldChange += weatherGold;
                        }
                      } else {
                        // 乾坤变色
                        if (dice1 === 6) {
                          // 日食特殊处理
                          let weatherGold = 10 + Math.floor(gameState.treasury / (playerHasBuilding(roller, 'legendary_jitiantan') ? 1 : 2));
                          details.push(`天时·日食:+${weatherGold}`);
                          totalGoldChange += weatherGold;
                          // 国祭惩罚（其他玩家）
                          if (roller.id !== currentPlayer.id) {
                            const penalty = roller.buildings.length * 1;
                            details.push(`国祭:-${penalty}`);
                            totalGoldChange -= penalty;
                          }
                        } else {
                          // 乾坤变色：强制结算对应属性建筑（×2倍收益）
                          const resonanceElements = {
                            1: ElementType.WATER,
                            2: ElementType.WOOD,
                            3: ElementType.EARTH,
                            4: ElementType.FIRE,
                            5: ElementType.METAL
                          };
                          const resonanceElement = resonanceElements[dice1];
                          
                          // 强制结算对应属性的所有建筑
                          let resonanceGold = 0;
                          roller.buildings.forEach(pb => {
                            const config = getBuildingConfig(pb.configId);
                            if (!config || config.element !== resonanceElement.toString()) return;
                            
                            let buildingGold = 0;
                            switch (config.id) {
                              // 水属性
                              case 'water_basic_yuliang': buildingGold = 1; break;
                              case 'water_intermediate_yantian': buildingGold = 2; break;
                              case 'water_advanced_caoyun': 
                                buildingGold = 5 + getAllBuildingCountByElement(gameState.players, ElementType.WATER) * 1; 
                                break;
                              // 木属性（乾坤变色强制结算时，大运河不触发）
                              case 'wood_basic_sangyuan': 
                                buildingGold = 1;
                                break;
                              case 'wood_intermediate_caoyaopu': 
                                buildingGold = 2;
                                break;
                              case 'wood_advanced_hanlin': 
                                buildingGold = 5 + getPlayerBuildingCountByElement(roller, ElementType.WOOD) * 2;
                                break;
                              // 土属性
                              case 'earth_basic_caishichang': buildingGold = 1; break;
                              case 'earth_intermediate_yingzaosi': buildingGold = 3; break;
                              case 'earth_advanced_jitiantan': buildingGold = 8; break;
                              // 火属性（乾坤变色强制结算时，天策府不触发）
                              case 'fire_basic_jiusi': 
                                buildingGold = (gameState.players.length - 1) * 2;
                                break;
                              case 'fire_intermediate_biaoju': 
                                buildingGold = (gameState.players.length - 1) * 3;
                                break;
                              case 'fire_advanced_hongxiuzhao': 
                                buildingGold = Math.min(Math.floor(roller.gold / 3), 20);
                                break;
                              // 金属性
                              case 'metal_basic_tiejiangpu': buildingGold = 2; break;
                              case 'metal_intermediate_kuangyesuo': buildingGold = 5; break;
                              case 'metal_advanced_datangqianzhuang': 
                                buildingGold = Math.min(Math.floor(roller.gold * 0.3), 25) + 5;
                                break;
                            }
                            resonanceGold += buildingGold * 2; // ×2倍数
                          });
                          
                          if (resonanceGold > 0) {
                            const elementNames = {
                              [ElementType.WATER]: '水',
                              [ElementType.WOOD]: '木',
                              [ElementType.EARTH]: '土',
                              [ElementType.FIRE]: '火',
                              [ElementType.METAL]: '金'
                            };
                            details.push(`天时·${elementNames[resonanceElement]}系强制结算:+${resonanceGold}`);
                            totalGoldChange += resonanceGold;
                          }
                          
                          // 劫难惩罚（掷骰者不受惩罚，3金/张）
                          const punishElements = {1: ElementType.FIRE, 2: ElementType.EARTH, 3: ElementType.METAL, 4: ElementType.WATER, 5: ElementType.WOOD};
                          const punishElement = punishElements[dice1];
                          if (punishElement && roller.id !== currentPlayer.id) {
                            const count = getPlayerBuildingCountByElement(roller, punishElement);
                            if (count > 0) {
                              const penalty = count * 3;
                              details.push(`劫难:-${penalty}`);
                              totalGoldChange -= penalty;
                            }
                          }
                        }
                      }
                    }

                    // 2. 自己的建筑收益（木、金、土）
                    roller.buildings.forEach(pb => {
                      const config = getBuildingConfig(pb.configId);
                      if (!config || config.triggerType !== 'self_roll') return;
                      if (!config.triggerNumbers.includes(total)) return;

                      let gold = 0;
                      let grandCanalBonus = 0;
                      const hasGrandCanal = playerHasBuilding(roller, 'legendary_dayunhe');
                      
                      switch (config.id) {
                        case 'wood_basic_sangyuan': 
                          gold = 1;
                          // 大运河：木建筑触发时，水建筑×2金（双骰）或×1金（单骰）
                          if (hasGrandCanal) {
                            const waterCount = getPlayerBuildingCountByElement(roller, ElementType.WATER);
                            grandCanalBonus = waterCount * (combo.type === 'single' ? 1 : 2);
                          }
                          break;
                        case 'wood_intermediate_caoyaopu': 
                          gold = 2;
                          if (hasGrandCanal) {
                            const waterCount = getPlayerBuildingCountByElement(roller, ElementType.WATER);
                            grandCanalBonus = waterCount * (combo.type === 'single' ? 1 : 2);
                          }
                          break;
                        case 'wood_advanced_hanlin': 
                          gold = 5 + getPlayerBuildingCountByElement(roller, ElementType.WOOD) * 2;
                          if (hasGrandCanal) {
                            const waterCount = getPlayerBuildingCountByElement(roller, ElementType.WATER);
                            grandCanalBonus = waterCount * (combo.type === 'single' ? 1 : 2);
                          }
                          break;
                        case 'metal_basic_tiejiangpu': gold = 2; break;
                        case 'metal_intermediate_kuangyesuo': gold = 5; break;
                        case 'metal_advanced_datangqianzhuang': 
                          gold = Math.min(Math.floor(roller.gold * 0.3), 25);
                          // 加上国库收益（简化计算，假设5金）
                          gold += 5;
                          break;
                        case 'earth_basic_caishichang': gold = 1; break;
                        case 'earth_intermediate_yingzaosi': gold = 3; break;
                        case 'earth_advanced_jitiantan': gold = 8; break;
                      }
                      gold *= weatherMultiplier;
                      grandCanalBonus *= weatherMultiplier;
                      
                      if (gold > 0) {
                        details.push(`${config.name}:+${gold}`);
                        totalGoldChange += gold;
                      }
                      if (grandCanalBonus > 0) {
                        details.push(`大运河:+${grandCanalBonus}`);
                        totalGoldChange += grandCanalBonus;
                      }
                    });

                    // 3. 水系建筑（所有人）
                    gameState.players.forEach(owner => {
                      owner.buildings.forEach(pb => {
                        const config = getBuildingConfig(pb.configId);
                        if (!config || config.element !== 'water') return;
                        if (!config.triggerNumbers.includes(total)) return;

                        let gold = 0;
                        switch (config.id) {
                          case 'water_basic_yuliang': gold = 1; break;
                          case 'water_intermediate_yantian': gold = 2; break;
                          case 'water_advanced_caoyun': 
                            gold = 5 + getAllBuildingCountByElement(gameState.players, ElementType.WATER) * 1; break;
                        }
                        gold *= weatherMultiplier;
                        if (gold > 0 && owner.id === roller.id) {
                          details.push(`${config.name}:+${gold}`);
                          totalGoldChange += gold;
                        }
                      });
                    });

                    // 4. 火系建筑（掷骰者向其他人支付）
                    gameState.players.forEach(owner => {
                      if (owner.id === roller.id) return;
                      owner.buildings.forEach(pb => {
                        const config = getBuildingConfig(pb.configId);
                        if (!config || config.element !== 'fire') return;
                        if (config.id === 'fire_intermediate_biaoju') return;
                        if (!config.triggerNumbers.includes(total)) return;

                        let cost = 0;
                        const isHongxiuzhao = config.id === 'fire_advanced_hongxiuzhao';
                        switch (config.id) {
                          case 'fire_basic_jiusi': 
                            cost = 2; break;
                          case 'fire_advanced_hongxiuzhao': 
                            cost = Math.min(Math.floor(roller.gold / 3), 20); break;
                        }
                        // 金光罩防御（红袖招无视金光罩）
                        if (!isHongxiuzhao && playerHasBuilding(roller, 'metal_intermediate_jinbiaoju')) {
                          cost = Math.ceil(cost / 2);
                        }
                        cost *= weatherMultiplier;
                        if (cost > 0) {
                          details.push(`${config.name}:-${cost}`);
                          totalGoldChange -= cost;
                          // 天策府加成
                          if (playerHasBuilding(owner, 'legendary_tiancefu')) {
                            const metalCount = getPlayerBuildingCountByElement(owner, ElementType.METAL);
                            const tianCefuBonus = metalCount * 3;
                            if (owner.id === roller.id) {
                              details.push(`天策府:+${tianCefuBonus}`);
                              totalGoldChange += tianCefuBonus;
                            }
                          }
                        }
                      });
                    });

                    // 5. 镖局（自己掷出4或8）
                    if (total === 4 || total === 8) {
                      roller.buildings.forEach(pb => {
                        const config = getBuildingConfig(pb.configId);
                        if (config?.id === 'fire_intermediate_biaoju') {
                          let income = (gameState.players.length - 1) * 3;
                          income *= weatherMultiplier;
                          details.push(`镖局:+${income}`);
                          totalGoldChange += income;
                          // 天策府加成
                          if (playerHasBuilding(roller, 'legendary_tiancefu')) {
                            const metalCount = getPlayerBuildingCountByElement(roller, ElementType.METAL);
                            const tianCefuBonus = metalCount * 3;
                            details.push(`天策府:+${tianCefuBonus}`);
                            totalGoldChange += tianCefuBonus;
                          }
                        }
                      });
                    }

                    // 6. 传奇建筑被动效果（每回合开始，只在显示时计入预估）
                    if (idx === 0 && groupIdx === 0) { // 只在第一个点数显示一次
                      if (playerHasBuilding(roller, 'legendary_guanxingtai')) {
                        details.push(`观星台(被动):+1`);
                        totalGoldChange += 1;
                      }
                      if (playerHasBuilding(roller, 'legendary_dayanta')) {
                        const metalCount = getPlayerBuildingCountByElement(roller, ElementType.METAL);
                        if (metalCount > 0) {
                          details.push(`大雁塔(被动):+${metalCount}`);
                          totalGoldChange += metalCount;
                        }
                      }
                      if (playerHasBuilding(roller, 'legendary_kunmingchi')) {
                        const waterCount = getPlayerBuildingCountByElement(roller, ElementType.WATER);
                        if (waterCount > 0) {
                          details.push(`昆明池(被动):+${waterCount}`);
                          totalGoldChange += waterCount;
                        }
                      }
                    }

                    // 7. 其他传奇建筑效果
                    if (total >= 7 && playerHasBuilding(roller, 'legendary_leyouyuan')) {
                      details.push(`乐游原:+2`);
                      totalGoldChange += 2;
                    }
                    if (playerHasBuilding(roller, 'legendary_wanguolaizhao')) {
                      details.push(`万国来朝:+10`);
                      totalGoldChange += 10;
                    }

                    return { player: roller, totalGoldChange, details };
                  });

                      // 显示标签
                      let label = '';
                      let diceDisplay = '';
                      
                      if (combo.type === 'single') {
                        label = `点数 ${total}`;
                        diceDisplay = '🎲';
                      } else if (combo.type === 'twin') {
                        const weatherNames = {
                          1: gameState.weatherMode === 'prosperity' ? '甘霖' : '洪涝',
                          2: gameState.weatherMode === 'prosperity' ? '回春' : '大风',
                          3: gameState.weatherMode === 'prosperity' ? '地灵' : '地动',
                          4: gameState.weatherMode === 'prosperity' ? '烛照' : '大旱',
                          5: gameState.weatherMode === 'prosperity' ? '瑞雪' : '霜降',
                          6: gameState.weatherMode === 'prosperity' ? '盛世' : '日食',
                        };
                        label = `${dice1}+${dice1} = ${total}`;
                        diceDisplay = weatherNames[dice1];
                      } else {
                        label = `${dice1}+${dice2} = ${total}`;
                        diceDisplay = '🎲🎲';
                      }

                      return (
                        <View key={idx} className="dice-calc-item">
                          <View className="dice-num-label">
                            <Text className="dice-icon">{diceDisplay}</Text>
                            <Text className="num-text">{label}</Text>
                            {combo.type === 'twin' && (
                              <Text className="weather-tag">
                                {gameState.weatherMode === 'prosperity' ? '贞观盛世' : '乾坤变色'}
                              </Text>
                            )}
                          </View>
                      <View className="earnings-list">
                        {earnings.map(({ player, totalGoldChange, details }) => (
                          <View key={player.id} className="player-earning">
                            <Text className="player-name">{player.name}:</Text>
                            <Text 
                              className="earning-amount"
                              style={{ color: totalGoldChange >= 0 ? '#52c41a' : '#f5222d' }}
                            >
                              {totalGoldChange >= 0 ? '+' : ''}{totalGoldChange} 金
                            </Text>
                            {details.length > 0 && (
                              <Text className="earning-details">({details.join(', ')})</Text>
                            )}
                          </View>
                        ))}
                      </View>
                    </View>
                      );
                    })}
                  </View>
                ));
              })()}
            </ScrollView>
          </View>
        </View>
      )}

      {/* 购买成功动画 */}
      {purchaseAnimation.show && (
        <View className={`purchase-animation ${purchaseAnimation.isLegendary ? 'legendary' : ''}`}>
          {purchaseAnimation.isLegendary && (
            <>
              {/* 烟花粒子效果 - 20个随机分布的烟花爆炸 */}
              <View className="fireworks-container">
                {[...Array(20)].map((_, idx) => (
                  <View key={`firework-${idx}`} className={`firework-burst firework-pos-${idx + 1}`}>
                    {[...Array(12)].map((_, i) => (
                      <View key={`fw${idx}-${i}`} className={`particle particle-${i + 1}`} />
                    ))}
                  </View>
                ))}
              </View>
            </>
          )}
          <View className="purchase-card">
            <Text className="purchase-icon">
              {purchaseAnimation.isLegendary ? '✨⭐✨' : '✨'}
            </Text>
            <Text className="purchase-title">{purchaseAnimation.isLegendary ? '传奇建筑建成！' : '建造成功！'}</Text>
            <Text className="purchase-building">{purchaseAnimation.buildingName}</Text>
          </View>
        </View>
      )}

      {/* 建筑详情弹窗 */}
      {buildingDetailModal && (
        <View className="building-detail-overlay" onClick={() => setBuildingDetailModal(null)}>
          <View className="building-detail-modal" onClick={(e) => e.stopPropagation()}>
            <View className="modal-header">
              <Text className="modal-title">{buildingDetailModal.name}</Text>
              <View className="close-btn" onClick={() => setBuildingDetailModal(null)}>
                <Text className="close-text">✕</Text>
              </View>
            </View>
            <View className="building-detail-content">
              <View className="detail-row">
                <Text className="detail-label">属性：</Text>
                <Text 
                  className="detail-value" 
                  style={{ color: getElementColor(buildingDetailModal.element) }}
                >
                  {buildingDetailModal.element ? getElementName(buildingDetailModal.element as ElementType) : '无'}
                </Text>
              </View>
              <View className="detail-row">
                <Text className="detail-label">等级：</Text>
                <Text className="detail-value">
                  {buildingDetailModal.level === BuildingLevel.BASIC && '初级'}
                  {buildingDetailModal.level === BuildingLevel.INTERMEDIATE && '中级'}
                  {buildingDetailModal.level === BuildingLevel.ADVANCED && '高级'}
                  {buildingDetailModal.level === BuildingLevel.LEGENDARY && '传奇'}
                </Text>
              </View>
              <View className="detail-row">
                <Text className="detail-label">建造费用：</Text>
                <Text className="detail-value">{buildingDetailModal.cost} 金</Text>
              </View>
              {buildingDetailModal.triggerNumbers && buildingDetailModal.triggerNumbers.length > 0 && (
                <View className="detail-row">
                  <Text className="detail-label">触发点数：</Text>
                  <Text className="detail-value">{buildingDetailModal.triggerNumbers.join(', ')}</Text>
                </View>
              )}
              {buildingDetailModal.requiresUpgrade && (
                <View className="detail-row upgrade-info">
                  <Text className="detail-label">升级要求：</Text>
                  <Text className="detail-value upgrade-text">
                    需要消耗【{getBuildingConfig(buildingDetailModal.upgradeFrom!)?.name}】升级
                  </Text>
                </View>
              )}
              <View className="detail-effect">
                <Text className="effect-label">效果：</Text>
                <Text className="effect-text">{buildingDetailModal.effect}</Text>
              </View>
              {buildingDetailModal.passive && (
                <View className="passive-tag">
                  <Text className="passive-text">🛡️ 被动效果</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
