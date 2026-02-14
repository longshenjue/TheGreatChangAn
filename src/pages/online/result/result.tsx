import { View, Button, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState, useEffect } from 'react';
import './result.scss';

interface PlayerResult {
  userId: string;
  nickname: string;
  avatar: string;
  finalGold: number;
  finalAssets: number;
  buildingCount: number;
  rank: number;
  scoreChange: number;
}

export default function Result() {
  const [results, setResults] = useState<PlayerResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState('');

  useEffect(() => {
    loadResults();
  }, []);

  const loadResults = async () => {
    try {
      const instance = Taro.getCurrentInstance();
      const params = instance.router?.params;
      
      if (params?.results) {
        const resultsData = JSON.parse(decodeURIComponent(params.results));
        setResults(resultsData);
      }

      // 获取当前用户ID
      const cloud = Taro.cloud;
      if (cloud) {
        const result = await cloud.callFunction({
          name: 'login',
          data: {}
        });
        const loginRes = result.result as any;
        setCurrentUserId(loginRes.user._openid);
      }
    } catch (error) {
      console.error('加载结果失败:', error);
      Taro.showToast({
        title: '加载失败',
        icon: 'none',
        duration: 2000
      });
    } finally {
      setLoading(false);
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1: return '#ffd700'; // 金色
      case 2: return '#c0c0c0'; // 银色
      case 3: return '#cd7f32'; // 铜色
      default: return '#888888'; // 灰色
    }
  };

  const getRankEmoji = (rank: number) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return '🏅';
    }
  };

  const backToLobby = () => {
    Taro.redirectTo({
      url: '/pages/online/lobby/lobby'
    });
  };

  if (loading) {
    return (
      <View className="result-container loading-state">
        <Text className="loading-text">加载中...</Text>
      </View>
    );
  }

  return (
    <View className="result-container">
      {/* 标题 */}
      <View className="result-header">
        <Text className="result-title">游戏结束</Text>
        <Text className="result-subtitle">最终排名</Text>
      </View>

      {/* 排名列表 */}
      <View className="rankings-list">
        {results.map((player, index) => {
          const isMe = player.userId === currentUserId;
          const rankColor = getRankColor(player.rank);
          
          return (
            <View 
              key={player.userId}
              className={`rank-item rank-${player.rank} ${isMe ? 'me' : ''}`}
              style={{ borderColor: rankColor }}
            >
              {/* 排名标识 */}
              <View className="rank-badge" style={{ backgroundColor: rankColor }}>
                <Text className="rank-emoji">{getRankEmoji(player.rank)}</Text>
                <Text className="rank-number">第{player.rank}名</Text>
              </View>

              {/* 玩家信息 */}
              <View className="player-info">
                <Image 
                  className="player-avatar"
                  src={player.avatar || 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'}
                  mode="aspectFill"
                />
                <View className="player-details">
                  <Text className="player-nickname">
                    {player.nickname}
                    {isMe && <Text className="me-tag"> (你)</Text>}
                  </Text>
                  <View className="player-stats">
                    <Text className="stat-item">💰 {player.finalGold}金</Text>
                    <Text className="stat-item">🏛 {player.buildingCount}建筑</Text>
                  </View>
                </View>
              </View>

              {/* 总资产 */}
              <View className="assets-section">
                <Text className="assets-label">总资产</Text>
                <Text className="assets-value">{player.finalAssets}</Text>
              </View>

              {/* 积分变化 */}
              <View className="score-change-section">
                <Text className="score-label">积分变化</Text>
                <Text 
                  className={`score-value ${player.scoreChange >= 0 ? 'positive' : 'negative'}`}
                >
                  {player.scoreChange > 0 ? '+' : ''}{player.scoreChange}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* 按钮区域 */}
      <View className="result-footer">
        <Button className="lobby-btn" onClick={backToLobby}>
          返回大厅
        </Button>
      </View>
    </View>
  );
}
