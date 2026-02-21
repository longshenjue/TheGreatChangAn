import { View, Button, Text, Image, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState, useEffect, useRef } from 'react';
import DebugPanel from '../../../components/DebugPanel';
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
  { id: 'leyouyuan', name: '乐游原', desc: '双骰收益提升', group: 'optional' },
  { id: 'damminggong', name: '大明宫', desc: '五行共鸣', group: 'optional' },
  { id: 'tiancefu', name: '天策府', desc: '火金联动', group: 'optional' },
  { id: 'wanguolaizhao', name: '万国来朝', desc: '存款99金获胜', group: 'win' },
  { id: 'jiudingshenmiao', name: '九鼎神庙', desc: '99金建造即胜', group: 'win' },
];

export default function Room() {
  const [room, setRoom] = useState<Room | null>(null);
  const [currentUserId, setCurrentUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [showLegendaryModal, setShowLegendaryModal] = useState(false);
  const roomId = useRef('');
  const watcherRef = useRef<any>(null);

  useEffect(() => {
    // 获取路由参数
    const instance = Taro.getCurrentInstance();
    const params = instance.router?.params;
    if (params?.roomId) {
      roomId.current = params.roomId;
      initRoom();
    }

    return () => {
      // 组件卸载时关闭监听
      if (watcherRef.current) {
        watcherRef.current.close();
      }
    };
  }, []);

  // 初始化房间
  const initRoom = async () => {
    try {
      const cloud = Taro.cloud;
      if (!cloud) {
        throw new Error('云开发未初始化');
      }

      // 获取当前用户ID
      const result = await cloud.callFunction({
        name: 'login',
        data: {}
      });
      const loginRes = result.result as any;
      setCurrentUserId(loginRes.user._openid);

      // 加载房间信息
      await loadRoom();

      // 开始监听房间变化
      startWatchRoom();
    } catch (error: any) {
      console.error('初始化房间失败:', error);
      Taro.showToast({
        title: error.message || '初始化失败',
        icon: 'none',
        duration: 2000
      });
    }
  };

  // 加载房间信息
  const loadRoom = async () => {
    try {
      const cloud = Taro.cloud;
      if (!cloud) return;

      const db = cloud.database();
      const result = await db.collection('rooms')
        .doc(roomId.current)
        .get();

      if (result.data.length > 0) {
        const roomData = result.data[0] as Room;
        setRoom(roomData);
        
        // 更新自己的准备状态
        const currentPlayer = roomData.players.find(p => p.userId === currentUserId);
        setIsReady(currentPlayer?.ready || false);
      }
    } catch (error) {
      console.error('加载房间信息失败:', error);
    }
  };

  // 监听房间变化
  const startWatchRoom = () => {
    try {
      const cloud = Taro.cloud;
      if (!cloud) return;

      const db = cloud.database();
      const watcher = db.collection('rooms')
        .doc(roomId.current)
        .watch({
          onChange: (snapshot) => {
            if (snapshot.docs && snapshot.docs.length > 0) {
              const roomData = snapshot.docs[0] as Room;
              setRoom(roomData);
              
              // 如果游戏已开始，跳转到游戏页面
              if (roomData.status === 'playing') {
                Taro.redirectTo({
                  url: `/pages/online/game/online-game?roomId=${roomId.current}`
                });
              }
            }
          },
          onError: (err) => {
            console.error('监听房间失败:', err);
          }
        });

      watcherRef.current = watcher;
    } catch (error) {
      console.error('开启监听失败:', error);
    }
  };

  // 切换准备状态
  const toggleReady = async () => {
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

    setLoading(true);
    try {
      const cloud = Taro.cloud;
      if (!cloud) {
        throw new Error('云开发未初始化');
      }

      const db = cloud.database();
      const _ = db.command;

      // 更新准备状态
      await db.collection('rooms')
        .doc(roomId.current)
        .update({
          data: {
            players: _.push({
              each: [],
              sort: (a: Player, b: Player) => {
                if (a.userId === currentUserId) {
                  return { ...a, ready: !isReady };
                }
                return a;
              }
            })
          }
        });

      // 直接调用云函数更新
      await cloud.callFunction({
        name: 'joinRoom',
        data: {
          roomId: roomId.current,
          action: 'toggleReady',
          ready: !isReady
        }
      });

      setIsReady(!isReady);
      Taro.showToast({
        title: isReady ? '取消准备' : '已准备',
        icon: 'success',
        duration: 1500
      });
    } catch (error: any) {
      console.error('切换准备状态失败:', error);
      Taro.showToast({
        title: error.message || '操作失败',
        icon: 'none',
        duration: 2000
      });
    } finally {
      setLoading(false);
    }
  };

  // 离开房间
  const leaveRoom = async () => {
    Taro.showModal({
      title: '提示',
      content: '确定要离开房间吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            const cloud = Taro.cloud;
            if (!cloud) return;

            // 如果是房主，解散房间
            if (room?.hostId === currentUserId) {
              const db = cloud.database();
              await db.collection('rooms')
                .doc(roomId.current)
                .remove();
            } else {
              // 普通玩家退出
              await cloud.callFunction({
                name: 'joinRoom',
                data: {
                  roomId: roomId.current,
                  action: 'leave'
                }
              });
            }

            Taro.navigateBack();
          } catch (error: any) {
            console.error('离开房间失败:', error);
            Taro.navigateBack();
          }
        }
      }
    });
  };

  // 开始游戏
  const startGame = async () => {
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

    // 检查人数
    if (!room || room.players.length < 2) {
      Taro.showToast({
        title: '至少需要2名玩家',
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

    setLoading(true);
    try {
      const cloud = Taro.cloud;
      if (!cloud) {
        throw new Error('云开发未初始化');
      }

      // 更新房间状态为游戏中
      const db = cloud.database();
      await db.collection('rooms')
        .doc(roomId.current)
        .update({
          data: {
            status: 'playing'
          }
        });

      // 跳转到游戏页面会由监听器自动触发
    } catch (error: any) {
      console.error('开始游戏失败:', error);
      Taro.showToast({
        title: error.message || '开始失败',
        icon: 'none',
        duration: 2000
      });
      setLoading(false);
    }
  };

  // 切换天时模式
  const changeWeatherMode = async (mode: 'prosperity' | 'chaos') => {
    if (room?.hostId !== currentUserId) {
      Taro.showToast({
        title: '只有房主可以修改设置',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    if (!room || room.settings.weatherMode === mode) return;

    try {
      const cloud = Taro.cloud;
      if (!cloud) return;
      
      const db = cloud.database();
      await db.collection('rooms')
        .doc(roomId.current)
        .update({
          data: {
            'settings.weatherMode': mode
          }
        });

      Taro.showToast({
        title: `已切换为${mode === 'prosperity' ? '贞观盛世' : '乾坤变色'}`,
        icon: 'success',
        duration: 1500
      });
    } catch (error) {
      console.error('切换天时模式失败:', error);
    }
  };

  // 切换传奇建筑选择
  const toggleLegendaryBuilding = (buildingId: string) => {
    // 检查房主权限
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
      // 检查数量限制
      const optionalCount = newList.filter(id => {
        const b = LEGENDARY_BUILDINGS.find(b => b.id === id);
        return b && b.group === 'optional';
      }).length;
      
      const winCount = newList.filter(id => {
        const b = LEGENDARY_BUILDINGS.find(b => b.id === id);
        return b && b.group === 'win';
      }).length;

      if (building.group === 'optional' && optionalCount >= 1) {
        // 先移除其他可选建筑
        newList = newList.filter(id => {
          const b = LEGENDARY_BUILDINGS.find(b => b.id === id);
          return !b || b.group !== 'optional';
        });
      }

      if (building.group === 'win' && winCount >= 1) {
        // 先移除其他胜利条件
        newList = newList.filter(id => {
          const b = LEGENDARY_BUILDINGS.find(b => b.id === id);
          return !b || b.group !== 'win';
        });
      }

      newList.push(buildingId);
    }

    // 更新数据库
    updateLegendaryBuildings(newList);
    
    // 显示反馈
    Taro.showToast({
      title: index > -1 ? '已取消选择' : '已选择',
      icon: 'success',
      duration: 1000
    });
  };

  // 更新传奇建筑配置
  const updateLegendaryBuildings = async (buildings: string[]) => {
    try {
      const cloud = Taro.cloud;
      if (!cloud) {
        console.log('[Mock] 更新传奇建筑:', buildings);
        return;
      }
      
      const db = cloud.database();
      await db.collection('rooms')
        .doc(roomId.current)
        .update({
          data: {
            'settings.legendaryBuildings': buildings
          }
        });
      
      console.log('传奇建筑已更新:', buildings);
    } catch (error) {
      console.error('更新传奇建筑失败:', error);
      Taro.showToast({
        title: '更新失败',
        icon: 'none',
        duration: 2000
      });
    }
  };

  if (!room) {
    return (
      <View className="room-container loading-state">
        <Text className="loading-text">加载中...</Text>
      </View>
    );
  }

  const isHost = room.hostId === currentUserId;

  return (
    <View className="room-container">
      {/* 头部 */}
      <View className="header">
        <Text className="room-code">房间号: {room.code}</Text>
        <Button className="dismiss-btn" onClick={leaveRoom} disabled={loading}>
          {isHost ? '解散' : '离开'}
        </Button>
      </View>

      {/* 玩家列表 */}
      <View className="players-section">
        <Text className="section-title">玩家列表 ({room.players.length}/4)</Text>
        <ScrollView className="players-list" scrollY>
          {room.players.map((player, index) => (
            <View key={player.userId} className="player-item">
              <View className="player-info">
                <View className="player-avatar">
                  <Image 
                    className="avatar-img" 
                    src={player.avatar || 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'}
                    mode="aspectFill"
                  />
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
                  <Text className="weather-desc">对子：5金+属性建筑数</Text>
                </View>
              </Button>
              <Button 
                className={`weather-btn ${room.settings.weatherMode === 'chaos' ? 'active' : ''}`}
                onClick={() => changeWeatherMode('chaos')}
                disabled={!isHost || loading}
              >
                <View className="weather-btn-content">
                  <Text className="weather-name">乾坤变色</Text>
                  <Text className="weather-desc">对子：建筑数x3金+相克惩罚</Text>
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
              <Text className="modal-subtitle">（选择3-4个）</Text>
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

      {/* 底部操作按钮 */}
      <View className="footer">
        {!isHost ? (
          <Button 
            className={`ready-btn ${isReady ? 'ready' : ''}`}
            onClick={toggleReady}
            disabled={loading}
          >
            {isReady ? '取消准备' : '准备'}
          </Button>
        ) : (
          <Button 
            className="start-btn"
            onClick={startGame}
            disabled={loading}
          >
            {loading ? '启动中...' : '开始游戏'}
          </Button>
        )}
      </View>
      
      {/* 调试面板 */}
      <DebugPanel />
    </View>
  );
}
