import { View, Button, Input, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState, useEffect } from 'react';
import lanService from '../../../services/lanService';
import './lobby.scss';

interface Room {
  _id: string;
  code: string;
  hostId: string;
  hostNickname: string;
  players: Array<{
    userId: string;
    nickname: string;
    avatar: string;
    ready: boolean;
  }>;
  settings: {
    weatherMode: string;
    legendaryBuildings: string[];
  };
  status: 'waiting' | 'playing' | 'finished';
  createTime: string;
}

export default function LANLobby() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // 检查连接状态
    if (!lanService.isConnected()) {
      console.warn('🚫 未连接到服务器，返回连接页面');
      Taro.showToast({
        title: '连接已断开，请重新连接',
        icon: 'none',
        duration: 2000
      });
      setTimeout(() => {
        Taro.redirectTo({
          url: '/pages/lan/connect/connect'
        });
      }, 1000);
      return;
    }

    setConnected(true);
    loadRooms();

    // 定时刷新房间列表
    const timer = setInterval(() => {
      loadRooms(true);
    }, 5000);

    // 定期检查连接状态（每3秒）
    const connectionCheck = setInterval(() => {
      if (!lanService.isConnected()) {
        console.warn('🚫 检测到连接断开，返回连接页面');
        clearInterval(connectionCheck);
        clearInterval(timer);
        Taro.showToast({
          title: '连接已断开',
          icon: 'none',
          duration: 2000
        });
        setTimeout(() => {
          Taro.redirectTo({
            url: '/pages/lan/connect/connect'
          });
        }, 1000);
      }
    }, 3000);

    // 监听房间更新
    lanService.on('roomUpdated', handleRoomUpdated);
    lanService.on('roomDismissed', handleRoomDismissed);
    lanService.on('disconnected', handleDisconnected);

    return () => {
      clearInterval(timer);
      clearInterval(connectionCheck);
      lanService.off('roomUpdated', handleRoomUpdated);
      lanService.off('roomDismissed', handleRoomDismissed);
      lanService.off('disconnected', handleDisconnected);
    };
  }, []);

  // 处理房间更新
  const handleRoomUpdated = (data: any) => {
    console.log('房间更新:', data);
    loadRooms(true);
  };

  // 处理房间解散
  const handleRoomDismissed = (data: any) => {
    console.log('房间解散:', data);
    loadRooms(true);
  };

  // 处理断开连接
  const handleDisconnected = () => {
    console.warn('🚫 连接断开事件触发，返回连接页面');
    Taro.showToast({
      title: '连接已断开',
      icon: 'none',
      duration: 2000
    });
    setTimeout(() => {
      Taro.redirectTo({
        url: '/pages/lan/connect/connect'
      });
    }, 1000);
  };

  // 加载房间列表
  const loadRooms = async (silent = false) => {
    if (!silent) {
      setRefreshing(true);
    }

    try {
      const roomList = await lanService.getRooms();
      setRooms(roomList);
    } catch (error) {
      console.error('加载房间列表失败:', error);
      if (!silent) {
        Taro.showToast({
          title: '加载失败',
          icon: 'none',
          duration: 2000
        });
      }
    } finally {
      setRefreshing(false);
    }
  };

  // 创建房间
  const createRoom = async () => {
    if (loading) return;

    setLoading(true);
    try {
      const room = await lanService.createRoom();

      Taro.showToast({
        title: '房间创建成功',
        icon: 'success',
        duration: 1500
      });

      // 跳转到房间页面
      setTimeout(() => {
        Taro.navigateTo({
          url: `/pages/lan/room/room?roomId=${room._id}`
        });
      }, 1500);
    } catch (error: any) {
      console.error('创建房间失败:', error);
      Taro.showToast({
        title: error.message || '创建失败',
        icon: 'none',
        duration: 2000
      });
    } finally {
      setLoading(false);
    }
  };

  // 加入房间（通过房间号）
  const joinRoomByCode = async () => {
    if (!roomCode.trim()) {
      Taro.showToast({
        title: '请输入房间号',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    if (loading) return;

    setLoading(true);
    try {
      const room = await lanService.joinRoom(roomCode.trim().toUpperCase());

      Taro.showToast({
        title: '加入成功',
        icon: 'success',
        duration: 1500
      });

      // 跳转到房间页面
      setTimeout(() => {
        Taro.navigateTo({
          url: `/pages/lan/room/room?roomId=${room._id}`
        });
      }, 1500);
    } catch (error: any) {
      console.error('加入房间失败:', error);
      Taro.showToast({
        title: error.message || '加入失败',
        icon: 'none',
        duration: 2000
      });
    } finally {
      setLoading(false);
    }
  };

  // 直接加入房间（从列表）
  const joinRoom = async (room: Room) => {
    if (loading) return;

    if (room.players.length >= 4) {
      Taro.showToast({
        title: '房间已满',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    if (room.status !== 'waiting') {
      Taro.showToast({
        title: '游戏已开始',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    setLoading(true);
    try {
      await lanService.joinRoom(room._id);

      Taro.showToast({
        title: '加入成功',
        icon: 'success',
        duration: 1500
      });

      // 跳转到房间页面
      setTimeout(() => {
        Taro.navigateTo({
          url: `/pages/lan/room/room?roomId=${room._id}`
        });
      }, 1500);
    } catch (error: any) {
      console.error('加入房间失败:', error);
      Taro.showToast({
        title: error.message || '加入失败',
        icon: 'none',
        duration: 2000
      });
    } finally {
      setLoading(false);
    }
  };

  // 断开连接
  const disconnect = () => {
    Taro.showModal({
      title: '确认',
      content: '确定要断开连接吗？',
      success: (res) => {
        if (res.confirm) {
          // ⚠️ 【修复 Bug #2】断开连接并清理状态
          lanService.disconnect();
          
          // 使用 redirect 而不是 navigateBack，避免页面历史堆栈问题
          Taro.redirectTo({
            url: '/pages/lan/connect/connect'
          });
        }
      }
    });
  };

  if (!connected) {
    return (
      <View className="lan-lobby-container loading-state">
        <Text className="loading-text">连接中...</Text>
      </View>
    );
  }

  return (
    <View className="lan-lobby-container">
      {/* 顶部导航栏 */}
      <View className="header">
        <View className="header-left">
          <Text className="title">局域网大厅</Text>
          <View className="status-badge connected">
            <View className="status-dot"></View>
            <Text className="status-text">已连接</Text>
          </View>
        </View>
        <View className="header-actions">
          <Button
            className="refresh-btn"
            onClick={() => loadRooms()}
            disabled={refreshing}
          >
            {refreshing ? '刷新中' : '刷新'}
          </Button>
          <Button
            className="disconnect-btn"
            onClick={disconnect}
            disabled={loading}
          >
            断开
          </Button>
        </View>
      </View>

      {/* 房间操作区 */}
      <View className="actions">
        <View className="room-actions">
          <Button
            className="create-room-btn"
            onClick={createRoom}
            disabled={loading}
          >
            {loading ? '创建中...' : '创建房间'}
          </Button>

          <Input
            className="room-code-input"
            placeholder="输入房间号"
            maxlength={6}
            value={roomCode}
            onInput={(e) => setRoomCode(e.detail.value.toUpperCase())}
            disabled={loading}
          />

          <Button
            className="join-btn"
            onClick={joinRoomByCode}
            disabled={loading}
          >
            加入房间
          </Button>
        </View>
      </View>

      {/* 房间列表 */}
      <View className="room-list-container">
        <View className="list-header">
          <Text className="list-title">可加入的房间</Text>
          <Text className="list-count">（{rooms.length}）</Text>
        </View>

        <ScrollView
          className="room-list"
          scrollY
          refresherEnabled
          refresherTriggered={refreshing}
          onRefresherRefresh={loadRooms}
        >
          {rooms.length === 0 ? (
            <View className="empty-state">
              <Text className="empty-text">暂无可加入的房间</Text>
              <Text className="empty-hint">创建一个新房间开始游戏吧</Text>
            </View>
          ) : (
            rooms.map(room => (
              <View key={room._id} className="room-item">
                <View className="room-info">
                  <View className="room-header">
                    <Text className="room-code">#{room.code}</Text>
                    <View className="room-status">
                      <Text className="status-text">等待中</Text>
                    </View>
                  </View>

                  <View className="room-details">
                    <Text className="room-host">房主：{room.players[0]?.nickname || '未知'}</Text>
                    <Text className="room-players">人数：{room.players.length}/4</Text>
                    <Text className="setting-item">
                      天时：{room.settings.weatherMode === 'prosperity' ? '贞观盛世' : '乾坤变色'}
                    </Text>
                  </View>
                </View>

                <Button
                  className={`lan-lobby-join-btn ${room.players.length >= 4 ? 'disabled' : ''}`}
                  onClick={() => joinRoom(room)}
                  disabled={loading || room.players.length >= 4}
                >
                  {room.players.length >= 4 ? '已满' : '加入'}
                </Button>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </View>
  );
}
