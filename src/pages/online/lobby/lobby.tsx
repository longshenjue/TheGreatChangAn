import { View, Button, Input, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState, useEffect } from 'react';
import DebugPanel from '../../../components/DebugPanel';
import { TestHelper } from '../../../utils/testHelper';
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

export default function Lobby() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadRooms();
    
    // 定时刷新房间列表
    const timer = setInterval(() => {
      loadRooms(true);
    }, 5000);
    
    return () => clearInterval(timer);
  }, []);

  // 加载房间列表
  const loadRooms = async (silent = false) => {
    if (!silent) {
      setRefreshing(true);
    }
    
    TestHelper.log('大厅', '加载房间列表');
    
    try {
      const cloud = Taro.cloud;
      if (!cloud) {
        Taro.showToast({
          title: '云开发未初始化',
          icon: 'none',
          duration: 2000
        });
        return;
      }

      // 调用云函数获取房间列表
      const db = cloud.database();
      const result = await db.collection('rooms')
        .where({
          status: 'waiting'
        })
        .orderBy('createTime', 'desc')
        .limit(20)
        .get();

      setRooms(result.data as Room[]);
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
      const cloud = Taro.cloud;
      if (!cloud) {
        throw new Error('云开发未初始化');
      }

      // 调用创建房间云函数
      const result = await cloud.callFunction({
        name: 'createRoom',
        data: {}
      });

      const res = result.result as any;
      if (res.success) {
        // 跳转到房间页面
        Taro.navigateTo({
          url: `/pages/online/room/room?roomId=${res.room._id}`
        });
      } else {
        throw new Error(res.message || '创建房间失败');
      }
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
      const cloud = Taro.cloud;
      if (!cloud) {
        throw new Error('云开发未初始化');
      }

      // 查找房间
      const db = cloud.database();
      const result = await db.collection('rooms')
        .where({
          code: roomCode.trim().toUpperCase()
        })
        .get();

      if (result.data.length === 0) {
        throw new Error('房间不存在');
      }

      const room = result.data[0] as Room;
      
      // 调用加入房间云函数
      const joinResult = await cloud.callFunction({
        name: 'joinRoom',
        data: {
          roomId: room._id
        }
      });

      const res = joinResult.result as any;
      if (res.success) {
        // 跳转到房间页面
        Taro.navigateTo({
          url: `/pages/online/room/room?roomId=${room._id}`
        });
      } else {
        throw new Error(res.message || '加入房间失败');
      }
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
      const cloud = Taro.cloud;
      if (!cloud) {
        throw new Error('云开发未初始化');
      }

      // 调用加入房间云函数
      const result = await cloud.callFunction({
        name: 'joinRoom',
        data: {
          roomId: room._id
        }
      });

      const res = result.result as any;
      if (res.success) {
        // 跳转到房间页面
        Taro.navigateTo({
          url: `/pages/online/room/room?roomId=${room._id}`
        });
      } else {
        throw new Error(res.message || '加入房间失败');
      }
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

  return (
    <View className="lobby-container">
      {/* 顶部导航栏 */}
      <View className="header">
        <Text className="title">游戏大厅</Text>
        <View className="header-actions">
          <Button 
            className="refresh-btn" 
            onClick={() => loadRooms()}
            disabled={refreshing}
          >
            {refreshing ? '刷新中' : '刷新'}
          </Button>
          <Button 
            className="back-btn" 
            onClick={() => Taro.navigateBack()}
            disabled={loading}
          >
            返回
          </Button>
        </View>
      </View>

      {/* 房间操作区 - 创建和加入在同一行 */}
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
                    <Text className="room-host">房主: {room.players[0]?.nickname || '未知'}</Text>
                    <Text className="room-players">
                      人数: {room.players.length}/4
                    </Text>
                  </View>
                  
                  <View className="room-settings">
                    <Text className="setting-item">
                      天时: {room.settings.weatherMode === 'prosperity' ? '贞观盛世' : '乾坤变色'}
                    </Text>
                  </View>
                </View>
                
                <Button 
                  className={`join-room-btn ${room.players.length >= 4 ? 'disabled' : ''}`}
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
      
      {/* 调试面板 */}
      <DebugPanel />
    </View>
  );
}
