import { View, Button, Text, Image, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState, useEffect, useRef } from 'react';
import lanService from '../../../services/lanService';
import { generateQRCodeDataURL, generateConnectionText } from '../../../utils/qrcode';
import './room.scss';

interface Player {
  userId: string;
  nickname: string;
  avatar: string;
  ready: boolean;
}

interface Room {
  _id: string;
  code: string;
  hostId: string;
  players: Player[];
  settings: {
    weatherMode: 'prosperity' | 'chaos';
    legendaryBuildings: string[];
  };
  status: 'waiting' | 'playing' | 'finished';
}

// 传奇建筑配置
const LEGENDARY_BUILDINGS = [
  { id: 'guanxingtai', name: '观星台', desc: '解锁双骰', required: true },
  { id: 'dayunhe', name: '大运河', desc: '水木相生', required: true },
  { id: 'dayanta', name: '大雁塔', desc: '金系共鸣', required: true },
  { id: 'kunmingchi', name: '昆明池', desc: '水系共鸣', required: true },
  { id: 'tiancefu', name: '天策府', desc: '火金联动', required: true },
  { id: 'leyouyuan', name: '乐游原', desc: '双骰收益提升', group: 'optional' },
  { id: 'damminggong', name: '大明宫', desc: '五行共鸣', group: 'optional' },
  { id: 'wanguolaizhao', name: '万国来朝', desc: '存款99金获胜', group: 'win' },
  { id: 'jiudingshenmiao', name: '九鼎神庙', desc: '99金建造即胜', group: 'win' },
];

export default function LANRoom() {
  const [room, setRoom] = useState<Room | null>(null);
  const [currentUserId, setCurrentUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [showLegendaryModal, setShowLegendaryModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [serverInfo, setServerInfo] = useState({ ip: '', port: '' });
  const [qrCodeDataURL, setQRCodeDataURL] = useState('');
  const roomId = useRef('');

  useEffect(() => {
    // 检查连接
    if (!lanService.isConnected()) {
      Taro.showModal({
        title: '未连接',
        content: '与服务器的连接已断开',
        showCancel: false,
        success: () => {
          Taro.navigateBack();
        }
      });
      return;
    }

    // 获取路由参数
    const instance = Taro.getCurrentInstance();
    const params = instance.router?.params;
    if (params?.roomId) {
      roomId.current = params.roomId;
      initRoom();
    }

    return () => {
      // 移除监听器
      lanService.off('roomUpdated', handleRoomUpdated);
      lanService.off('roomDismissed', handleRoomDismissed);
      lanService.off('gameStarted', handleGameStarted);
    };
  }, []);

  // 初始化房间
  const initRoom = () => {
    setCurrentUserId(lanService.getPlayerId());

    // 获取服务器信息用于生成二维码（从lanService获取实际连接的IP）
    const serverInfoFromService = lanService.getServerInfo();
    setServerInfo(serverInfoFromService);
    console.log('🌐 房间服务器信息:', serverInfoFromService);

    // 监听房间事件
    lanService.on('roomUpdated', handleRoomUpdated);
    lanService.on('roomDismissed', handleRoomDismissed);
    lanService.on('gameStarted', handleGameStarted);
    lanService.on('gameRestarted', handleGameRestarted);
    lanService.on('playerDisconnected', handlePlayerDisconnected);
    lanService.on('playerReconnected', handlePlayerReconnected);
    lanService.on('playerLeft', handlePlayerLeft);

    // 请求房间列表以获取当前房间信息
    refreshRoom();
  };

  // 处理游戏重新开始
  const handleGameRestarted = (data: any) => {
    console.log('🔄 收到游戏重新开始消息');
    
    Taro.showToast({
      title: data.message || '游戏已重新开始',
      icon: 'none',
      duration: 2000
    });
    
    // 刷新房间信息
    refreshRoom();
  };
  
  // 处理玩家断线
  const handlePlayerDisconnected = (data: any) => {
    console.log('⚠️  玩家断线:', data.nickname);
    Taro.showToast({
      title: `${data.nickname} 断线，等待重连...`,
      icon: 'none',
      duration: 2000
    });
    if (data.room) {
      setRoom(data.room);
    }
  };
  
  // 处理玩家重连
  const handlePlayerReconnected = (data: any) => {
    console.log('🔄 玩家重连:', data.nickname);
    Taro.showToast({
      title: `${data.nickname} 已重连`,
      icon: 'success',
      duration: 2000
    });
    if (data.room) {
      setRoom(data.room);
    }
  };
  
  // 处理玩家离开（超时未重连）
  const handlePlayerLeft = (data: any) => {
    console.log('❌ 玩家离开:', data.nickname, '原因:', data.reason);
    Taro.showToast({
      title: `${data.nickname} 已离开（${data.reason || '超时'}）`,
      icon: 'none',
      duration: 3000
    });
    if (data.room) {
      setRoom(data.room);
    }
  };

  // 生成二维码
  const generateQRCode = async () => {
    if (!room) return;
    
    const connectionText = generateConnectionText(
      serverInfo.ip,
      serverInfo.port,
      room.code
    );
    
    try {
      const dataURL = await generateQRCodeDataURL(connectionText, 300);
      setQRCodeDataURL(dataURL);
    } catch (error) {
      console.error('生成二维码失败:', error);
      Taro.showToast({
        title: '二维码生成失败',
        icon: 'none'
      });
    }
  };

  // 当显示二维码弹窗时生成二维码
  useEffect(() => {
    if (showQRModal && room) {
      generateQRCode();
    }
  }, [showQRModal, room]);

  // 刷新房间信息
  const refreshRoom = async () => {
    try {
      const rooms = await lanService.getRooms();
      const currentRoom = rooms.find(r => r._id === roomId.current);
      if (currentRoom) {
        setRoom(currentRoom);
        const currentPlayer = currentRoom.players.find(p => p.userId === currentUserId);
        setIsReady(currentPlayer?.ready || false);
      }
    } catch (error) {
      console.error('刷新房间信息失败:', error);
    }
  };

  // 处理房间更新
  const handleRoomUpdated = (data: any) => {
    if (data.room._id === roomId.current) {
      setRoom(data.room);
      // 只在非自己触发的更新时才同步准备状态（避免覆盖乐观更新）
      const currentPlayer = data.room.players.find((p: Player) => p.userId === currentUserId);
      const serverReady = currentPlayer?.ready || false;
      // 如果服务器状态与本地状态不一致，以服务器为准（最终一致性）
      if (serverReady !== isReady) {
        console.log('同步服务器准备状态:', serverReady);
        setIsReady(serverReady);
      }
    }
  };

  // 处理房间解散
  const handleRoomDismissed = (data: any) => {
    if (data.roomId === roomId.current) {
      Taro.showModal({
        title: '房间已解散',
        content: data.reason || '房主已解散房间',
        showCancel: false,
        success: () => {
          Taro.navigateBack();
        }
      });
    }
  };

  // 处理游戏开始
  const handleGameStarted = (data: any) => {
    console.log('🎮 收到游戏开始消息:', data);
    
    if (data.room._id === roomId.current) {
      setLoading(false);
      
      // 使用服务器返回的最新房间数据
      const gameRoom = data.room;
      const playerNames = gameRoom.players.map((p: any) => p.nickname);
      const weatherMode = gameRoom.settings.weatherMode;
      const legendaryBuildings = gameRoom.settings.legendaryBuildings || [];
      
      // 获取当前玩家的昵称（从房间数据中查找）
      const currentPlayer = gameRoom.players.find((p: any) => p.userId === currentUserId);
      const myNickname = currentPlayer?.nickname || Taro.getStorageSync('lan_nickname');
      
      console.log('📋 游戏参数:', { playerNames, weatherMode, legendaryBuildings, myNickname });
      
      // 构建游戏URL（联机模式，传递当前玩家昵称）
      let gameUrl = `/pages/game/game?mode=lan&roomId=${gameRoom._id}&players=${encodeURIComponent(JSON.stringify(playerNames))}&myNickname=${encodeURIComponent(myNickname)}&weather=${weatherMode}`;
      
      // 如果有传奇建筑配置，添加到URL
      if (legendaryBuildings.length > 0) {
        gameUrl += `&legendary=${encodeURIComponent(JSON.stringify(legendaryBuildings))}`;
      }
      
      console.log('🚀 跳转到游戏页面:', gameUrl);
      
      // 直接跳转到联机游戏页面
      Taro.redirectTo({ url: gameUrl });
    }
  };

  // 切换准备状态
  const toggleReady = () => {
    if (loading) return;

    // 房主不需要准备
    if (room?.hostId === currentUserId) {
      Taro.showToast({
        title: '房主无需准备',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    // 立即更新本地状态（乐观更新）
    const newReadyState = !isReady;
    setIsReady(newReadyState);
    console.log('🎯 立即更新准备状态（乐观更新）:', {
      旧状态: isReady,
      新状态: newReadyState,
      玩家ID: currentUserId
    });

    // 发送准备状态切换到服务器
    lanService.toggleReady(roomId.current);
  };

  // 离开房间
  const leaveRoom = () => {
    Taro.showModal({
      title: '提示',
      content: '确定要离开房间吗？',
      success: (res) => {
        if (res.confirm) {
          lanService.leaveRoom(roomId.current);
          Taro.navigateBack();
        }
      }
    });
  };

  // 再来一局
  const restartGame = () => {
    if (!isHost || loading) return;
    
    Taro.showModal({
      title: '确认重新开始',
      content: '将重新开始游戏，所有玩家需要重新准备',
      success: (res) => {
        if (res.confirm) {
          setLoading(true);
          
          try {
            lanService.restartGame(roomId.current);
            
            Taro.showToast({
              title: '游戏已重置',
              icon: 'success',
              duration: 1500
            });
            
            // 刷新房间信息
            setTimeout(() => {
              refreshRoom();
              setLoading(false);
            }, 1500);
          } catch (error: any) {
            console.error('重新开始游戏失败:', error);
            Taro.showToast({
              title: error.message || '操作失败',
              icon: 'none',
              duration: 2000
            });
            setLoading(false);
          }
        }
      }
    });
  };

  // 开始游戏
  const startGame = () => {
    if (loading) return;

    // 检查是否是房主
    if (room?.hostId !== currentUserId) {
      Taro.showToast({
        title: '只有房主可以开始游戏',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    // 检查人数（允许单人测试）
    if (!room || room.players.length < 1) {
      Taro.showToast({
        title: '至少需要1名玩家',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    // 检查是否设置了胜利条件（传奇建筑）
    if (!room.settings.legendaryBuildings || room.settings.legendaryBuildings.length === 0) {
      Taro.showToast({
        title: '请先选择传奇建筑（胜利条件）',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    // 检查是否包含胜利条件建筑
    const hasWinCondition = room.settings.legendaryBuildings.some(id => 
      id === 'wanguolaizhao' || id === 'jiudingshenmiao'
    );
    
    if (!hasWinCondition) {
      Taro.showToast({
        title: '请至少选择一个胜利条件建筑',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    // 检查所有玩家是否准备（房主除外）
    const allReady = room.players.every(p =>
      p.userId === room.hostId || p.ready
    );

    if (!allReady) {
      Taro.showToast({
        title: '还有玩家未准备',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    console.log('🎮 房主点击开始游戏');
    setLoading(true);
    
    // 发送开始游戏消息
    lanService.startGame(roomId.current);
    
    console.log('✅ 已发送开始游戏消息');
  };

  // 切换天时模式
  const changeWeatherMode = (mode: 'prosperity' | 'chaos') => {
    if (room?.hostId !== currentUserId) {
      Taro.showToast({
        title: '只有房主可以修改设置',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    if (!room || room.settings.weatherMode === mode) return;

    lanService.updateSettings(roomId.current, { weatherMode: mode });

    Taro.showToast({
      title: `已切换为${mode === 'prosperity' ? '贞观盛世' : '乾坤变色'}`,
      icon: 'success',
      duration: 1500
    });
  };

  // 切换传奇建筑选择
  const toggleLegendaryBuilding = (buildingId: string) => {
    if (room?.hostId !== currentUserId) {
      Taro.showToast({
        title: '只有房主可以修改设置',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    if (!room) return;

    const current = room.settings.legendaryBuildings || [];
    const building = LEGENDARY_BUILDINGS.find(b => b.id === buildingId);
    if (!building) return;

    let newList = [...current];
    const index = newList.indexOf(buildingId);

    if (index > -1) {
      // 取消选择
      if (building.required) {
        Taro.showToast({
          title: '必选建筑不可取消',
          icon: 'none',
          duration: 2000
        });
        return;
      }
      newList.splice(index, 1);
    } else {
      // 添加选择
      const optionalCount = newList.filter(id => {
        const b = LEGENDARY_BUILDINGS.find(b => b.id === id);
        return b && b.group === 'optional';
      }).length;

      const winCount = newList.filter(id => {
        const b = LEGENDARY_BUILDINGS.find(b => b.id === id);
        return b && b.group === 'win';
      }).length;

      if (building.group === 'optional' && optionalCount >= 1) {
        newList = newList.filter(id => {
          const b = LEGENDARY_BUILDINGS.find(b => b.id === id);
          return !b || b.group !== 'optional';
        });
      }

      if (building.group === 'win' && winCount >= 1) {
        newList = newList.filter(id => {
          const b = LEGENDARY_BUILDINGS.find(b => b.id === id);
          return !b || b.group !== 'win';
        });
      }

      newList.push(buildingId);
    }

    lanService.updateSettings(roomId.current, { legendaryBuildings: newList });

    Taro.showToast({
      title: index > -1 ? '已取消选择' : '已选择',
      icon: 'success',
      duration: 1000
    });
  };

  if (!room) {
    return (
      <View className="lan-room-container loading-state">
        <Text className="loading-text">加载中...</Text>
      </View>
    );
  }

  const isHost = room.hostId === currentUserId;

  return (
    <View className="lan-room-container">
      {/* 头部 */}
      <View className="header">
        <View className="header-top">
          <Text className="room-code">{room.code}</Text>
          <Button className="dismiss-btn" onClick={leaveRoom} disabled={loading}>
            {isHost ? '解散房间' : '离开房间'}
          </Button>
        </View>
        <View className="header-bottom">
          <View className="lan-badge">🌐 局域网房间</View>
          {isHost && (
            <Button 
              className="qr-btn" 
              onClick={() => setShowQRModal(true)}
            >
              📱 邀请好友
            </Button>
          )}
        </View>
      </View>

      {/* 玩家列表 */}
      <View className="players-section">
        <Text className="section-title">玩家列表 ({room.players.length}/4)</Text>
        <ScrollView className="players-list" scrollY>
          {room.players.map((player, index) => (
            <View key={player.userId} className="player-item">
              <View className="player-info">
                <View className="player-avatar">
                  <View className="avatar-placeholder">{player.nickname.substring(0, 1)}</View>
                  {player.userId === room.hostId && (
                    <View className="host-badge">房主</View>
                  )}
                </View>
                <View className="player-details">
                  <Text className="player-nickname">{player.nickname}</Text>
                  <Text className="player-index">玩家 {index + 1}</Text>
                </View>
              </View>
              <View className={`ready-status ${player.ready ? 'ready' : ''}`}>
                {player.userId === room.hostId ? '房主' : (player.ready ? '已准备' : '未准备')}
              </View>
            </View>
          ))}

          {/* 空位 */}
          {Array.from({ length: 4 - room.players.length }).map((_, index) => (
            <View key={`empty-${index}`} className="player-item empty">
              <View className="player-info">
                <View className="player-avatar empty-avatar">
                  <Text className="empty-text">空位</Text>
                </View>
                <View className="player-details">
                  <Text className="player-nickname">等待加入...</Text>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* 游戏设置 */}
      <View className="settings-section">
        <Text className="section-title">游戏设置</Text>
        <View className="settings-content">
          <View className="setting-item">
            <Text className="setting-label">天时系统</Text>
            <View className="weather-switch">
              <Button
                className={`weather-btn ${room.settings.weatherMode === 'prosperity' ? 'active' : ''}`}
                onClick={() => changeWeatherMode('prosperity')}
                disabled={!isHost || loading}
              >
                <View className="weather-btn-content">
                  <Text className="weather-name">贞观盛世</Text>
                  <Text className="weather-desc">简单收益模式</Text>
                </View>
              </Button>
              <Button
                className={`weather-btn ${room.settings.weatherMode === 'chaos' ? 'active' : ''}`}
                onClick={() => changeWeatherMode('chaos')}
                disabled={!isHost || loading}
              >
                <View className="weather-btn-content">
                  <Text className="weather-name">乾坤变色</Text>
                  <Text className="weather-desc">复杂博弈模式</Text>
                </View>
              </Button>
            </View>
          </View>
          <View className="setting-item">
            <Text className="setting-label">传奇建筑</Text>
            <View className="legendary-display">
              {room.settings.legendaryBuildings.length === 0 ? (
                <Text className="legendary-hint">未选择</Text>
              ) : (
                room.settings.legendaryBuildings.map(id => {
                  const building = LEGENDARY_BUILDINGS.find(b => b.id === id);
                  return building ? (
                    <View key={id} className="legendary-tag">
                      {building.name}
                    </View>
                  ) : null;
                })
              )}
              <Button
                className="select-btn"
                onClick={() => setShowLegendaryModal(true)}
                disabled={!isHost || loading}
              >
                {isHost ? '选择' : '查看'}
              </Button>
            </View>
          </View>
        </View>
      </View>

      {/* 传奇建筑选择弹窗 */}
      {showLegendaryModal && (
        <View className="modal-overlay" onClick={() => setShowLegendaryModal(false)}>
          <View className="modal-content" onClick={(e) => e.stopPropagation()}>
            <View className="modal-header">
              <Text className="modal-title">传奇建筑选择</Text>
              <Text className="modal-subtitle">（选择合适的建筑）</Text>
            </View>

            <ScrollView className="modal-body" scrollY>
              {/* 必选建筑 */}
              <View className="building-group">
                <Text className="group-title">必备建筑</Text>
                {LEGENDARY_BUILDINGS.filter(b => b.required).map(building => (
                  <View key={building.id} className="building-item disabled">
                    <Text className="building-name">✓ {building.name}</Text>
                    <Text className="building-desc">{building.desc}</Text>
                  </View>
                ))}
              </View>

              {/* 可选建筑 */}
              <View className="building-group">
                <Text className="group-title">可选建筑（0-1个）</Text>
                {LEGENDARY_BUILDINGS.filter(b => b.group === 'optional').map(building => {
                  const isSelected = room.settings.legendaryBuildings.includes(building.id);
                  return (
                    <View
                      key={building.id}
                      className={`building-item ${isSelected ? 'active' : ''} ${!isHost ? 'disabled' : ''}`}
                      onClick={() => isHost && toggleLegendaryBuilding(building.id)}
                    >
                      <Text className="building-name">
                        {isSelected ? '✓' : '○'} {building.name}
                      </Text>
                      <Text className="building-desc">{building.desc}</Text>
                    </View>
                  );
                })}
              </View>

              {/* 胜利条件 */}
              <View className="building-group">
                <Text className="group-title">胜利条件（二选一）</Text>
                {LEGENDARY_BUILDINGS.filter(b => b.group === 'win').map(building => {
                  const isSelected = room.settings.legendaryBuildings.includes(building.id);
                  return (
                    <View
                      key={building.id}
                      className={`building-item ${isSelected ? 'active' : ''} ${!isHost ? 'disabled' : ''}`}
                      onClick={() => isHost && toggleLegendaryBuilding(building.id)}
                    >
                      <Text className="building-name">
                        {isSelected ? '✓' : '○'} {building.name}
                      </Text>
                      <Text className="building-desc">{building.desc}</Text>
                    </View>
                  );
                })}
              </View>
            </ScrollView>

            <View className="modal-footer">
              <Button className="close-btn" onClick={() => setShowLegendaryModal(false)}>
                关闭
              </Button>
            </View>
          </View>
        </View>
      )}

      {/* 二维码/分享弹窗 */}
      {showQRModal && (
        <View className="modal-overlay" onClick={() => setShowQRModal(false)}>
          <View className="modal-content qr-modal" onClick={(e) => e.stopPropagation()}>
            <View className="modal-header">
              <Text className="modal-title">邀请好友</Text>
              <Text className="modal-subtitle">扫码或手动输入加入房间</Text>
            </View>

            <View className="qr-modal-body">
              {/* 房间信息 */}
              <View className="room-info-card">
                <View className="info-row highlight">
                  <Text className="info-label">房间号</Text>
                  <Text className="info-value">{room.code}</Text>
                </View>
                <View className="info-row">
                  <Text className="info-label">服务器IP</Text>
                  <Text className="info-value">{serverInfo.ip}</Text>
                </View>
                <View className="info-row">
                  <Text className="info-label">端口</Text>
                  <Text className="info-value">{serverInfo.port}</Text>
                </View>
              </View>

              {/* 二维码区域 */}
              <View className="qr-container">
                {qrCodeDataURL ? (
                  <Image 
                    className="qr-image" 
                    src={qrCodeDataURL} 
                    mode="aspectFit"
                  />
                ) : (
                  <View className="qr-loading">生成中...</View>
                )}
                <View className="qr-text">
                  <Text className="qr-instruction">📱 扫码快速加入</Text>
                  <Text className="qr-hint">二维码包含完整连接信息</Text>
                  <Text className="qr-url">
                    {generateConnectionText(serverInfo.ip, serverInfo.port, room.code)}
                  </Text>
                  <Text className="qr-hint-small">扫码后将自动连接并加入房间 <Text className="code-highlight">{room.code}</Text></Text>
                </View>
              </View>

              {/* 使用说明 */}
              <View className="join-instructions">
                <Text className="instruction-title">💡 如何加入</Text>
                <Text className="instruction-item">1. 确保设备连接同一Wi-Fi</Text>
                <Text className="instruction-item">2. 打开游戏，点击「局域网联机」</Text>
                <Text className="instruction-item">3. 连接服务器或扫码</Text>
                <Text className="instruction-item">4. 输入房间号: <Text className="highlight-code">{room.code}</Text></Text>
              </View>
            </View>

            <View className="modal-footer">
              <Button className="close-btn" onClick={() => setShowQRModal(false)}>
                关闭
              </Button>
            </View>
          </View>
        </View>
      )}

      {/* 底部操作按钮 */}
      <View className="footer">
        {room.status === 'finished' ? (
          // 游戏结束状态
          isHost ? (
            <View
              className="lan-custom-start-btn"
              onClick={loading ? undefined : restartGame}
            >
              🔄 再来一局
            </View>
          ) : (
            <View className="lan-custom-ready-btn disabled">
              等待房主重新开始
            </View>
          )
        ) : (
          // 游戏等待状态
          !isHost ? (
            <View
              className={`lan-custom-ready-btn ${isReady ? 'ready' : ''}`}
              onClick={loading ? undefined : toggleReady}
            >
              {isReady ? '取消准备' : '准备'}
            </View>
          ) : (
            <View
              className={`lan-custom-start-btn ${loading ? 'disabled' : ''}`}
              onClick={loading ? undefined : startGame}
            >
              {loading ? '启动中...' : '开始游戏'}
            </View>
          )
        )}
      </View>
    </View>
  );
}
