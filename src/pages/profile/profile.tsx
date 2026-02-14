import { View, Button, Text, Image, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState, useEffect } from 'react';
import { getAvatarUrl } from '../../utils/avatarHelper';
import './profile.scss';

interface UserProfile {
  _id: string;
  _openid: string;
  nickname: string;
  avatar: string;
  score: number;
  winCount: number;
  totalGames: number;
  createTime: string;
  updateTime: string;
}

interface GameRecord {
  _id: string;
  roomId: string;
  players: Array<{
    userId: string;
    nickname: string;
    finalGold: number;
    finalAssets: number;
    rank: number;
    scoreChange: number;
  }>;
  winner: string;
  finishedAt: string;
}

export default function Profile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [gameRecords, setGameRecords] = useState<GameRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  // 加载个人资料
  const loadProfile = async (silent = false) => {
    if (!silent) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const cloud = Taro.cloud;
      if (!cloud) {
        throw new Error('云开发未初始化');
      }

      // 调用云函数获取个人资料
      const result = await cloud.callFunction({
        name: 'getProfile',
        data: {}
      });

      const res = result.result as any;
      if (res.success) {
        setProfile(res.profile);
        setGameRecords(res.gameRecords || []);
      } else {
        throw new Error(res.message || '加载失败');
      }
    } catch (error: any) {
      console.error('加载个人资料失败:', error);
      Taro.showToast({
        title: error.message || '加载失败',
        icon: 'none',
        duration: 2000
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 刷新
  const handleRefresh = () => {
    loadProfile(true);
  };

  // 清除缓存
  const clearCache = () => {
    Taro.showModal({
      title: '提示',
      content: '确定要清除本地缓存吗？',
      success: (res) => {
        if (res.confirm) {
          Taro.clearStorage({
            success: () => {
              Taro.showToast({
                title: '清除成功',
                icon: 'success',
                duration: 1500
              });
            }
          });
        }
      }
    });
  };

  // 计算胜率
  const getWinRate = () => {
    if (!profile || profile.totalGames === 0) return '0%';
    return `${((profile.winCount / profile.totalGames) * 100).toFixed(1)}%`;
  };

  // 获取排名颜色
  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1: return '#ffd700'; // 金色
      case 2: return '#c0c0c0'; // 银色
      case 3: return '#cd7f32'; // 铜色
      default: return '#888888'; // 灰色
    }
  };

  if (loading) {
    return (
      <View className="profile-container loading-state">
        <Text className="loading-text">加载中...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View className="profile-container error-state">
        <Text className="error-text">加载失败</Text>
        <Button className="retry-btn" onClick={() => loadProfile()}>
          重试
        </Button>
      </View>
    );
  }

  return (
    <View className="profile-container">
      {/* 头部 */}
      <View className="header">
        <Text className="title">个人中心</Text>
        <Button 
          className="back-btn" 
          onClick={() => Taro.navigateBack()}
        >
          返回
        </Button>
      </View>

      <ScrollView 
        className="content"
        scrollY
        refresherEnabled
        refresherTriggered={refreshing}
        onRefresherRefresh={handleRefresh}
      >
        {/* 用户信息卡片 */}
        <View className="user-card">
          <View className="user-avatar-section">
            <Image 
              className="user-avatar"
              src={getAvatarUrl(profile.avatar, profile._openid)}
              mode="aspectFill"
            />
            <View className="user-info">
              <Text className="user-nickname">{profile.nickname}</Text>
              <Text className="user-id">ID: {profile._openid.slice(-8)}</Text>
            </View>
          </View>

          <View className="score-section">
            <View className="score-main">
              <Text className="score-label">当前积分</Text>
              <Text className="score-value">{profile.score}</Text>
            </View>
          </View>
        </View>

        {/* 战绩统计 */}
        <View className="stats-section">
          <Text className="section-title">战绩统计</Text>
          
          <View className="stats-grid">
            <View className="stat-item">
              <Text className="stat-value">{profile.totalGames}</Text>
              <Text className="stat-label">总局数</Text>
            </View>
            
            <View className="stat-item">
              <Text className="stat-value win">{profile.winCount}</Text>
              <Text className="stat-label">胜利</Text>
            </View>
            
            <View className="stat-item">
              <Text className="stat-value">{getWinRate()}</Text>
              <Text className="stat-label">胜率</Text>
            </View>
            
            <View className="stat-item">
              <Text className="stat-value">{profile.score}</Text>
              <Text className="stat-label">积分</Text>
            </View>
          </View>
        </View>

        {/* 游戏记录 */}
        <View className="records-section">
          <Text className="section-title">最近游戏记录</Text>
          
          {gameRecords.length === 0 ? (
            <View className="empty-state">
              <Text className="empty-text">暂无游戏记录</Text>
              <Text className="empty-hint">快去开始一局游戏吧</Text>
            </View>
          ) : (
            <View className="records-list">
              {gameRecords.map((record) => {
                const myData = record.players.find(p => p.userId === profile._openid);
                if (!myData) return null;

                return (
                  <View key={record._id} className="record-item">
                    <View className="record-header">
                      <View 
                        className="record-rank"
                        style={{ color: getRankColor(myData.rank) }}
                      >
                        第 {myData.rank} 名
                      </View>
                      <Text className="record-date">
                        {new Date(record.finishedAt).toLocaleDateString()}
                      </Text>
                    </View>
                    
                    <View className="record-details">
                      <View className="record-row">
                        <Text className="detail-label">最终资产:</Text>
                        <Text className="detail-value">{myData.finalAssets}</Text>
                      </View>
                      <View className="record-row">
                        <Text className="detail-label">积分变化:</Text>
                        <Text 
                          className={`detail-value ${myData.scoreChange > 0 ? 'positive' : 'negative'}`}
                        >
                          {myData.scoreChange > 0 ? '+' : ''}{myData.scoreChange}
                        </Text>
                      </View>
                    </View>
                    
                    <View className="record-players">
                      <Text className="players-label">对手:</Text>
                      <View className="players-list">
                        {record.players
                          .filter(p => p.userId !== profile._openid)
                          .map((p, idx) => (
                            <Text key={idx} className="player-nickname">
                              {p.nickname}
                            </Text>
                          ))}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* 设置区域 */}
        <View className="settings-section">
          <Text className="section-title">设置</Text>
          
          <View className="settings-list">
            <Button className="setting-item" onClick={clearCache}>
              <Text className="setting-label">清除缓存</Text>
              <Text className="setting-arrow">›</Text>
            </Button>
            
            <View className="setting-item version">
              <Text className="setting-label">版本信息</Text>
              <Text className="setting-value">v1.0.0</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
