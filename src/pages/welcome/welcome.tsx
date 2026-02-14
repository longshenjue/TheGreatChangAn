import { View, Button, Image, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useEffect, useState } from 'react';
import { TestHelper } from '../../utils/testHelper';
import DebugPanel from '../../components/DebugPanel';
import { getAvatarUrl } from '../../utils/avatarHelper';
import './welcome.scss';

interface UserInfo {
  _id: string;
  nickname: string;
  avatar: string;
  score: number;
}

export default function Welcome() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 云开发初始化后会在app.ts中完成
    // 这里延迟检查，如果未开通云开发则跳过登录
    TestHelper.log('欢迎页', '开始初始化');
    
    setTimeout(() => {
      if (Taro.cloud) {
        TestHelper.log('欢迎页', '云开发已加载，开始登录');
        autoLogin();
      } else {
        console.log('云开发未初始化，跳过登录');
        TestHelper.log('欢迎页', '云开发未初始化，使用测试模式');
        setLoading(false);
        // 设置一个默认用户信息用于测试
        const testUser = {
          _id: 'test',
          nickname: '测试玩家',
          avatar: getAvatarUrl(undefined, 'test'),
          score: 0
        };
        setUserInfo(testUser);
        Taro.setStorageSync('userInfo', testUser);
      }
    }, 500);
  }, []);

  const autoLogin = async () => {
    try {
      Taro.showLoading({ title: '登录中...' });
      
      // 调用云函数登录
      const res = await Taro.cloud.callFunction({
        name: 'login',
        data: {}
      });
      
      console.log('登录结果:', res);
      
      if (res.result && res.result.success) {
        // 兼容不同的数据格式
        let user: UserInfo;
        
        if (res.result.isNewUser) {
          // 新用户，获取用户信息
          const userRes = await Taro.cloud.database()
            .collection('users')
            .doc(res.result.userId)
            .get();
          user = userRes.data as UserInfo;
        } else if (res.result.user) {
          // 直接返回用户信息（新格式）
          user = res.result.user as UserInfo;
        } else if (res.result.userInfo) {
          // 兼容旧格式
          const userInfo = res.result.userInfo;
          user = {
            _id: userInfo._id,
            nickname: userInfo.nickName || userInfo.nickname,
            avatar: getAvatarUrl(userInfo.avatarUrl || userInfo.avatar, userInfo._id),
            score: userInfo.score || 0
          };
        } else {
          throw new Error('无效的用户数据格式');
        }
        
        // 确保头像URL有效
        if (!user.avatar) {
          user.avatar = getAvatarUrl(undefined, user._id);
        }
        
        setUserInfo(user);
        
        // 保存到全局存储
        Taro.setStorageSync('userInfo', user);
        
        Taro.showToast({ 
          title: '登录成功', 
          icon: 'success',
          duration: 1500
        });
      } else {
        throw new Error('登录失败');
      }
    } catch (error) {
      console.error('登录失败:', error);
      
      // 尝试从缓存加载
      const cachedUser = Taro.getStorageSync('userInfo');
      if (cachedUser) {
        console.log('使用缓存的用户信息');
        setUserInfo(cachedUser);
        Taro.showToast({ 
          title: '已加载缓存', 
          icon: 'success',
          duration: 1500
        });
      } else {
        Taro.showToast({ 
          title: '登录失败，使用访客模式', 
          icon: 'none',
          duration: 2000
        });
        // 访客模式
        const guestUser = {
          _id: 'guest',
          nickname: '访客玩家',
          avatar: getAvatarUrl(undefined, 'guest'),
          score: 0
        };
        setUserInfo(guestUser);
        Taro.setStorageSync('userInfo', guestUser);
      }
    } finally {
      Taro.hideLoading();
      setLoading(false);
    }
  };

  const goToOfflineMode = () => {
    Taro.navigateTo({ url: '/pages/index/index' });
  };

  const goToOnlineMode = () => {
    if (!userInfo) {
      Taro.showToast({ 
        title: '请先登录', 
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    // 检查云开发是否初始化
    if (!Taro.cloud) {
      Taro.showModal({
        title: '提示',
        content: '在线模式需要开通云开发，请参考部署指南配置云开发环境',
        showCancel: false
      });
      return;
    }
    
    // 跳转到在线大厅
    Taro.navigateTo({ url: '/pages/online/lobby/lobby' });
  };

  const goToLANMode = () => {
    // 直接跳转到连接页面，让用户输入昵称
    Taro.navigateTo({ url: '/pages/lan/connect/connect' });
  };

  const goToProfile = () => {
    if (!userInfo) {
      Taro.showToast({ 
        title: '请先登录', 
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    // 检查云开发是否初始化
    if (!Taro.cloud) {
      Taro.showModal({
        title: '提示',
        content: '个人中心需要开通云开发，请参考部署指南配置云开发环境',
        showCancel: false
      });
      return;
    }
    
    // 跳转到个人中心
    Taro.navigateTo({ url: '/pages/profile/profile' });
  };

  if (loading) {
    return (
      <View className="welcome-container loading-state">
        <View className="loading-box">
          <Text className="loading-text">正在登录...</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="welcome-container">
      <View className="title-section">
        <Text className="main-title">盛世长安</Text>
        <Text className="subtitle">唐风桌游</Text>
      </View>

      {userInfo && (
        <View className="user-info-card">
          <View className="avatar-box">
            {userInfo.avatar ? (
              <Image 
                className="avatar" 
                src={userInfo.avatar}
                mode="aspectFill"
              />
            ) : (
              <View className="avatar-placeholder">👤</View>
            )}
          </View>
          <Text className="nickname">{userInfo.nickname}</Text>
          <View className="score-box">
            <Text className="score-label">积分</Text>
            <Text className="score-value">{userInfo.score}</Text>
          </View>
        </View>
      )}

      <View className="mode-selection">
        <View className="mode-card offline-card" onClick={goToOfflineMode}>
          <View className="mode-icon">🎮</View>
          <Text className="mode-title">单机模式</Text>
          <Text className="mode-desc">本地多人同屏游玩</Text>
        </View>

        <View className="mode-card lan-card" onClick={goToLANMode}>
          <View className="mode-icon">📡</View>
          <Text className="mode-title">局域网联机</Text>
          <Text className="mode-desc">同Wi-Fi下多设备联机</Text>
          <View className="recommend-tag">推荐</View>
        </View>

        <View className="mode-card online-card" onClick={goToOnlineMode}>
          <View className="mode-icon">🌐</View>
          <Text className="mode-title">在线模式</Text>
          <Text className="mode-desc">跨网络云端对战</Text>
          {!Taro.cloud && <View className="coming-soon-tag">需配置云开发</View>}
        </View>
      </View>

      <Button className="profile-btn" onClick={goToProfile}>
        个人中心
      </Button>

      <View className="footer">
        <Text className="version">v1.0.0</Text>
      </View>
      
      {/* 调试面板 */}
      <DebugPanel />
    </View>
  );
}
