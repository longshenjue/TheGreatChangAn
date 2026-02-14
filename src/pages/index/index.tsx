import { View, Text, Input, Button } from '@tarojs/components';
import { useState } from 'react';
import Taro from '@tarojs/taro';
import './index.scss';

export default function Index() {
  const [playerCount, setPlayerCount] = useState(2);
  const [playerNames, setPlayerNames] = useState(['玩家1', '玩家2']);
  const [weatherMode, setWeatherMode] = useState<'prosperity' | 'chaos'>('prosperity');
  const [selectedLegendary, setSelectedLegendary] = useState({
    guanxingtai: true,     // 观星台（必备）
    dayunhe: true,         // 大运河（必备）
    leyouyuan: false,      // 乐游原（可选0-1）
    damminggong: false,    // 大明宫（可选0-1）
    tiancefu: false,       // 天策府（可选0-1）
    wanguolaizhao: true,   // 万国来朝（二选一）
    jiudingshenmiao: false // 九鼎神庙（二选一）
  });

  const handlePlayerCountChange = (count: number) => {
    setPlayerCount(count);
    const newNames = Array.from({ length: count }, (_, i) => 
      playerNames[i] || `玩家${i + 1}`
    );
    setPlayerNames(newNames);
  };

  const handleNameChange = (index: number, name: string) => {
    const newNames = [...playerNames];
    newNames[index] = name;
    setPlayerNames(newNames);
  };

  const toggleLegendary = (key: string) => {
    const newSelected = { ...selectedLegendary };
    
    if (key === 'leyouyuan' || key === 'damminggong' || key === 'tiancefu') {
      // 乐游原、大明宫、天策府：0-1个（三选一）
      if (key === 'leyouyuan') {
        if (newSelected.leyouyuan) {
          newSelected.leyouyuan = false;
        } else {
          newSelected.leyouyuan = true;
          newSelected.damminggong = false;
          newSelected.tiancefu = false;
        }
      } else if (key === 'damminggong') {
        if (newSelected.damminggong) {
          newSelected.damminggong = false;
        } else {
          newSelected.damminggong = true;
          newSelected.leyouyuan = false;
          newSelected.tiancefu = false;
        }
      } else if (key === 'tiancefu') {
        if (newSelected.tiancefu) {
          newSelected.tiancefu = false;
        } else {
          newSelected.tiancefu = true;
          newSelected.leyouyuan = false;
          newSelected.damminggong = false;
        }
      }
    } else if (key === 'wanguolaizhao' || key === 'jiudingshenmiao') {
      // 万国来朝和九鼎神庙：二选一
      newSelected.wanguolaizhao = key === 'wanguolaizhao';
      newSelected.jiudingshenmiao = key === 'jiudingshenmiao';
    }
    
    setSelectedLegendary(newSelected);
  };

  const startGame = () => {
    // 计算传奇建筑数量（3-4个）
    const legendaryCount = Object.values(selectedLegendary).filter(Boolean).length;
    if (legendaryCount < 3 || legendaryCount > 4) {
      Taro.showToast({
        title: '请选择3-4个传奇建筑',
        icon: 'none'
      });
      return;
    }
    
    Taro.navigateTo({
      url: `/pages/game/game?players=${encodeURIComponent(JSON.stringify(playerNames))}&weather=${weatherMode}&legendary=${encodeURIComponent(JSON.stringify(selectedLegendary))}`,
    });
  };

  return (
    <View className="index-container">
      {/* 标题区 */}
      <View className="title-section">
        <View className="title-decoration top" />
        <Text className="main-title">盛世长安</Text>
        <Text className="subtitle">五行经济策略桌游</Text>
        <View className="title-decoration bottom" />
      </View>

      {/* 游戏设置 */}
      <View className="settings-section">
        <View className="setting-card">
          <Text className="setting-label">玩家人数</Text>
          <View className="player-count-selector">
            {[2, 3, 4].map(count => (
              <View
                key={count}
                className={`count-option ${playerCount === count ? 'active' : ''}`}
                onClick={() => handlePlayerCountChange(count)}
              >
                <Text className="count-text">{count}人</Text>
              </View>
            ))}
          </View>
        </View>

        <View className="setting-card">
          <Text className="setting-label">玩家名称</Text>
          <View className="name-inputs">
            {playerNames.map((name, index) => (
              <View key={index} className="name-input-row">
                <Text className="name-index">第{index + 1}位：</Text>
                <Input
                  className="name-input"
                  value={name}
                  onInput={(e) => handleNameChange(index, e.detail.value)}
                  maxlength={8}
                  placeholderClass="name-placeholder"
                  placeholder={`玩家${index + 1}`}
                />
              </View>
            ))}
          </View>
        </View>

        <View className="setting-card">
          <Text className="setting-label">天时系统</Text>
          <View className="weather-selector">
            <View
              className={`weather-option ${weatherMode === 'prosperity' ? 'active' : ''}`}
              onClick={() => setWeatherMode('prosperity')}
            >
              <Text className="weather-name">贞观盛世</Text>
              <Text className="weather-desc">简单收益模式</Text>
            </View>
            <View
              className={`weather-option ${weatherMode === 'chaos' ? 'active' : ''}`}
              onClick={() => setWeatherMode('chaos')}
            >
              <Text className="weather-name">乾坤变色</Text>
              <Text className="weather-desc">复杂博弈模式</Text>
            </View>
          </View>
        </View>

        <View className="setting-card">
          <Text className="setting-label">传奇建筑（选择3-4个）</Text>
          <View className="legendary-selector">
            <View className="legendary-group">
              <Text className="group-title">必备建筑</Text>
              <View className="legendary-item disabled">
                <Text className="legendary-name">✓ 观星台</Text>
                <Text className="legendary-desc">解锁双骰</Text>
              </View>
              <View className="legendary-item disabled">
                <Text className="legendary-name">✓ 大运河</Text>
                <Text className="legendary-desc">水木相生</Text>
              </View>
            </View>

            <View className="legendary-group">
              <Text className="group-title">可选建筑（0-1个）</Text>
              <View 
                className={`legendary-item ${selectedLegendary.leyouyuan ? 'active' : ''}`}
                onClick={() => toggleLegendary('leyouyuan')}
              >
                <Text className="legendary-name">
                  {selectedLegendary.leyouyuan ? '✓' : '○'} 乐游原
                </Text>
                <Text className="legendary-desc">双骰收益提升</Text>
              </View>
              <View 
                className={`legendary-item ${selectedLegendary.damminggong ? 'active' : ''}`}
                onClick={() => toggleLegendary('damminggong')}
              >
                <Text className="legendary-name">
                  {selectedLegendary.damminggong ? '✓' : '○'} 大明宫
                </Text>
                <Text className="legendary-desc">翻转骰子</Text>
              </View>
              <View 
                className={`legendary-item ${selectedLegendary.tiancefu ? 'active' : ''}`}
                onClick={() => toggleLegendary('tiancefu')}
              >
                <Text className="legendary-name">
                  {selectedLegendary.tiancefu ? '✓' : '○'} 天策府
                </Text>
                <Text className="legendary-desc">火金联动</Text>
              </View>
            </View>

            <View className="legendary-group">
              <Text className="group-title">胜利条件（二选一）</Text>
              <View 
                className={`legendary-item ${selectedLegendary.wanguolaizhao ? 'active' : ''}`}
                onClick={() => toggleLegendary('wanguolaizhao')}
              >
                <Text className="legendary-name">
                  {selectedLegendary.wanguolaizhao ? '✓' : '○'} 万国来朝
                </Text>
                <Text className="legendary-desc">建造后积累99金资产获胜</Text>
              </View>
              <View 
                className={`legendary-item ${selectedLegendary.jiudingshenmiao ? 'active' : ''}`}
                onClick={() => toggleLegendary('jiudingshenmiao')}
              >
                <Text className="legendary-name">
                  {selectedLegendary.jiudingshenmiao ? '✓' : '○'} 九鼎神庙
                </Text>
                <Text className="legendary-desc">99金建造完成即时获胜</Text>
              </View>
            </View>
          </View>
        </View>

        <View className="setting-card rules-card">
          <Text className="setting-label">游戏说明</Text>
          <View className="rules-content">
            <Text className="rule-item">• 初始：每人5金，1颗骰子</Text>
            <Text className="rule-item">• 建造观星台后可投掷2颗骰子</Text>
            <Text className="rule-item">• 双骰且点数相同时触发天时系统</Text>
            <Text className="rule-item">• 五行相生相克，策略布局</Text>
            <Text className="rule-item">• 建造传奇建筑达成胜利条件</Text>
          </View>
        </View>
      </View>

      {/* 开始按钮 */}
      <View className="start-button-container">
        <Button className="start-button" onClick={startGame}>
          <Text className="button-text">开始游戏</Text>
        </Button>
      </View>

      {/* 底部装饰 */}
      <View className="footer-decoration">
        <Text className="footer-text">长安街市繁华盛 · 五行生财论英雄</Text>
      </View>
    </View>
  );
}
