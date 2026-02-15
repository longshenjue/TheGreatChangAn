import { View, Button, Input, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState, useEffect } from 'react';
import lanService from '../../../services/lanService';
import { getServerConfig } from '../../../config/server';
import './connect.scss';

export default function LANConnect() {
  const [serverIP, setServerIP] = useState('');
  const [serverPort, setServerPort] = useState('8888');
  const [nickname, setNickname] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [isWeapp, setIsWeapp] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false); // 是否显示高级选项

  useEffect(() => {
    // ⚠️ 【修复 Bug #2】页面加载时清理可能的残留状态
    // 如果从大厅返回，确保清理连接状态和 DOM
    console.log('🔄 [连接页面] 页面加载，检查连接状态');
    
    // 检查环境
    setIsWeapp(process.env.TARO_ENV === 'weapp');
    
    // 从URL参数获取连接信息（二维码扫描或链接打开）
    const instance = Taro.getCurrentInstance();
    const params = instance.router?.params;
    
    console.log('📋 [连接页面] URL参数:', params);
    
    // 加载默认服务器配置
    const defaultConfig = getServerConfig();
    
    // 加载上次连接信息
    const lastIP = Taro.getStorageSync('lan_last_ip');
    const lastPort = Taro.getStorageSync('lan_last_port');
    const lastNickname = Taro.getStorageSync('lan_nickname');

    // 优先级：URL参数 > localStorage > 默认配置
    // IP地址
    if (params?.ip) {
      const urlIP = decodeURIComponent(params.ip);
      console.log('  从URL获取IP:', urlIP);
      setServerIP(urlIP);
    } else {
      setServerIP(lastIP || defaultConfig.host);
    }
    
    // 端口
    if (params?.port) {
      const urlPort = decodeURIComponent(params.port);
      console.log('  从URL获取端口:', urlPort);
      setServerPort(urlPort);
    } else {
      setServerPort(lastPort || defaultConfig.port);
    }
    
    // 昵称：优先使用缓存，如果没有则生成随机昵称
    let finalNickname = '';
    if (params?.nickname) {
      finalNickname = decodeURIComponent(params.nickname);
    } else if (lastNickname) {
      finalNickname = lastNickname;
    } else {
      // 生成随机4位数字昵称
      finalNickname = `玩家${Math.floor(1000 + Math.random() * 9000)}`;
      console.log('🎲 自动生成随机昵称:', finalNickname);
      // 保存到localStorage
      Taro.setStorageSync('lan_nickname', finalNickname);
    }
    setNickname(finalNickname);
    
    // 如果有roomCode，说明是通过二维码直接加入房间
    if (params?.roomCode) {
      const roomCode = decodeURIComponent(params.roomCode);
      console.log('  从URL获取房间号:', roomCode);
      console.log('🎯 [连接页面] 检测到房间号，将自动连接并加入房间');
      // 保存到state，稍后在连接成功后自动加入
      (window as any).__autoJoinRoomCode = roomCode;
      
      // ✨ 自动连接：如果有昵称和房间号，直接触发连接
      setTimeout(() => {
        if (finalNickname) {
          console.log('🚀 自动触发快速连接');
          autoConnectAndJoin(urlIP || lastIP || defaultConfig.host, urlPort || lastPort || defaultConfig.port, finalNickname, roomCode);
        }
      }, 500);
    }
    
    // 监听自动重连房间事件
    const handleAutoReconnect = (room: any) => {
      console.log('🔄 自动重连到房间:', room.code, '状态:', room.status);
      
      Taro.showToast({
        title: `重连成功！正在恢复...`,
        icon: 'success',
        duration: 2000
      });
      
      // 根据房间状态跳转到相应页面
      if (room.status === 'playing') {
        // 游戏进行中，跳转到游戏页面
        const playerNames = room.players.map((p: any) => p.nickname);
        const weatherMode = room.settings.weatherMode;
        const legendaryBuildings = room.settings.legendaryBuildings || [];
        
        // 获取当前玩家ID并查找昵称
        const myPlayerId = lanService.getPlayerId();
        const currentPlayer = room.players.find((p: any) => p.userId === myPlayerId);
        const myNickname = currentPlayer?.nickname || nickname; // 使用重连时输入的昵称
        
        let gameUrl = `/pages/game/game?mode=lan&roomId=${room._id}&players=${encodeURIComponent(JSON.stringify(playerNames))}&myNickname=${encodeURIComponent(myNickname)}&weather=${weatherMode}`;
        
        if (legendaryBuildings.length > 0) {
          gameUrl += `&legendary=${encodeURIComponent(JSON.stringify(legendaryBuildings))}`;
        }
        
        console.log('🎮 重连游戏URL:', gameUrl);
        
        setTimeout(() => {
          Taro.redirectTo({ url: gameUrl });
        }, 1000);
      } else {
        // 等待中，跳转到房间页面
        setTimeout(() => {
          Taro.redirectTo({ 
            url: `/pages/lan/room/room?roomId=${room._id}` 
          });
        }, 1000);
      }
    };
    
    lanService.on('autoReconnectRoom', handleAutoReconnect);
    
    return () => {
      lanService.off('autoReconnectRoom', handleAutoReconnect);
    };
  }, []);

  // 扫描二维码
  const scanQRCode = () => {
    // 微信小程序环境
    if (process.env.TARO_ENV === 'weapp') {
      Taro.scanCode({
        onlyFromCamera: false,
        scanType: ['qrCode'],
        success: async (res) => {
          try {
            await connectFromQR(res.result);
          } catch (error: any) {
            Taro.showToast({
              title: error.message || '连接失败',
              icon: 'none',
              duration: 2000
            });
          }
        },
        fail: () => {
          Taro.showToast({
            title: '扫码失败',
            icon: 'none',
            duration: 2000
          });
        }
      });
    } else {
      // H5环境，提示使用手动输入
      Taro.showModal({
        title: '提示',
        content: 'H5环境暂不支持扫码，请使用下方手动输入IP地址的方式连接',
        showCancel: false
      });
    }
  };

  // 从二维码连接
  const connectFromQR = async (qrData: string) => {
    if (connecting) return;

    if (!nickname.trim()) {
      Taro.showToast({
        title: '请输入昵称',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    setConnecting(true);
    Taro.showLoading({ title: '连接中...' });

    try {
      let qrInfo: any;
      
      // 尝试解析URL格式或JSON格式
      if (qrData.startsWith('http') || qrData.startsWith('taro://')) {
        // URL格式：解析查询参数
        const url = new URL(qrData);
        qrInfo = {
          type: 'lan_game',
          ip: url.searchParams.get('ip') || '',
          port: url.searchParams.get('port') || '',
          roomCode: url.searchParams.get('roomCode') || '',
          game: url.searchParams.get('game') || ''
        };
      } else {
        // JSON格式（兼容旧版本）
        qrInfo = JSON.parse(qrData);
      }
      
      console.log('📱 扫码信息:', qrInfo);

      // 设置玩家信息
      lanService.setPlayerInfo(nickname.trim());

      // 连接服务器
      const port = parseInt(qrInfo.port) || 8888;
      await lanService.connect(qrInfo.ip, port);

      console.log('✅ 已连接到服务器');

      // 如果有房间号，直接加入房间
      if (qrInfo.roomCode) {
        console.log('🚪 准备加入房间:', qrInfo.roomCode);
        
        // 通过房间号查找房间ID
        const rooms = await lanService.getRooms();
        const targetRoom = rooms.find((r: any) => r.code === qrInfo.roomCode);
        
        if (targetRoom) {
          await lanService.joinRoom(targetRoom._id);
          
          Taro.hideLoading();
          Taro.showToast({
            title: '加入成功',
            icon: 'success',
            duration: 1500
          });

          // 直接跳转到房间页面
          setTimeout(() => {
            Taro.redirectTo({
              url: `/pages/lan/room/room?roomId=${targetRoom._id}`
            });
          }, 1500);
        } else {
          throw new Error('房间不存在或已关闭');
        }
      } else {
        // 没有房间号，跳转到大厅
        Taro.hideLoading();
        Taro.showToast({
          title: '连接成功',
          icon: 'success',
          duration: 1500
        });

        setTimeout(() => {
          Taro.navigateTo({
            url: '/pages/lan/lobby/lobby'
          });
        }, 1500);
      }
    } catch (error: any) {
      Taro.hideLoading();
      console.error('连接失败:', error);
      throw error;
    } finally {
      setConnecting(false);
    }
  };

  // 自动连接并加入房间（二维码扫描时使用）
  const autoConnectAndJoin = async (ip: string, port: string, nickName: string, roomCode: string) => {
    if (connecting) return;
    
    setConnecting(true);
    console.log('🚀 [自动连接] 开始自动连接并加入房间');
    console.log('  IP:', ip);
    console.log('  端口:', port);
    console.log('  昵称:', nickName);
    console.log('  房间号:', roomCode);
    
    Taro.showLoading({ title: '正在加入房间...' });

    try {
      // 设置玩家信息
      lanService.setPlayerInfo(nickName);
      
      // 保存连接信息
      Taro.setStorageSync('lan_nickname', nickName);
      Taro.setStorageSync('lan_last_ip', ip);
      Taro.setStorageSync('lan_last_port', port);

      // 连接到服务器
      await lanService.connect(ip, parseInt(port));
      console.log('✅ 已连接到服务器');

      // 查找并加入房间
      const rooms = await lanService.getRooms();
      const targetRoom = rooms.find((r: any) => r.code === roomCode);
      
      if (targetRoom) {
        await lanService.joinRoom(targetRoom._id);
        
        Taro.hideLoading();
        Taro.showToast({
          title: '加入成功！',
          icon: 'success',
          duration: 1500
        });

        // 清除自动加入标记
        delete (window as any).__autoJoinRoomCode;

        // 跳转到房间页面
        setTimeout(() => {
          Taro.redirectTo({
            url: `/pages/lan/room/room?roomId=${targetRoom._id}`
          });
        }, 1500);
      } else {
        throw new Error(`房间 ${roomCode} 不存在或已关闭`);
      }
    } catch (error: any) {
      Taro.hideLoading();
      console.error('自动连接失败:', error);
      Taro.showModal({
        title: '加入房间失败',
        content: error.message || '无法加入指定房间',
        showCancel: false
      });
    } finally {
      setConnecting(false);
    }
  };

  // 快速连接（使用默认服务器配置或URL参数）
  const quickConnect = async () => {
    if (!nickname.trim()) {
      Taro.showToast({
        title: '请先输入昵称',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    if (connecting) return;

    setConnecting(true);
    
    // 如果URL中有IP参数，使用URL参数；否则使用配置的服务器地址
    const connectIP = serverIP || getServerConfig().host;
    const connectPort = serverPort || getServerConfig().port;
    
    console.log('🚀 [快速连接] 开始连接');
    console.log('  连接地址:', connectIP);
    console.log('  端口:', connectPort);
    console.log('  昵称:', nickname.trim());
    
    Taro.showLoading({ title: `连接中...` });

    try {
      // 设置玩家信息
      lanService.setPlayerInfo(nickname.trim());
      
      // 保存昵称
      Taro.setStorageSync('lan_nickname', nickname.trim());

      // 连接到服务器
      await lanService.connect(connectIP, parseInt(connectPort));

      console.log('✅ 已连接到服务器:', connectIP);
      console.log('  实际serverInfo:', lanService.getServerInfo());

      Taro.hideLoading();
      
      // 检查是否需要自动加入房间（二维码扫描）
      const autoJoinRoomCode = (window as any).__autoJoinRoomCode;
      if (autoJoinRoomCode) {
        console.log('🎯 [自动加入] 房间号:', autoJoinRoomCode);
        Taro.showLoading({ title: '正在加入房间...' });
        
        try {
          // 获取房间列表
          const rooms = await lanService.getRooms();
          const targetRoom = rooms.find((r: any) => r.code === autoJoinRoomCode);
          
          if (targetRoom) {
            console.log('✅ 找到目标房间:', targetRoom.code);
            await lanService.joinRoom(targetRoom._id);
            
            Taro.hideLoading();
            Taro.showToast({
              title: '加入成功！',
              icon: 'success',
              duration: 1500
            });
            
            // 清除标记
            delete (window as any).__autoJoinRoomCode;
            
            // 跳转到房间页面
            setTimeout(() => {
              Taro.redirectTo({
                url: `/pages/lan/room/room?roomId=${targetRoom._id}`
              });
            }, 1500);
          } else {
            Taro.hideLoading();
            Taro.showToast({
              title: `房间 ${autoJoinRoomCode} 不存在`,
              icon: 'none',
              duration: 2000
            });
            
            // 跳转到大厅
            setTimeout(() => {
              Taro.navigateTo({
                url: '/pages/lan/lobby/lobby'
              });
            }, 2000);
          }
        } catch (error: any) {
          Taro.hideLoading();
          console.error('自动加入房间失败:', error);
          Taro.showToast({
            title: '加入房间失败',
            icon: 'none',
            duration: 2000
          });
          
          // 跳转到大厅
          setTimeout(() => {
            Taro.navigateTo({
              url: '/pages/lan/lobby/lobby'
            });
          }, 2000);
        }
      } else {
        // 没有房间号，正常跳转到大厅
        Taro.showToast({
          title: '连接成功',
          icon: 'success',
          duration: 1500
        });
        
        setTimeout(() => {
          Taro.navigateTo({
            url: '/pages/lan/lobby/lobby'
          });
        }, 1500);
      }
    } catch (error: any) {
      Taro.hideLoading();
      console.error('连接失败:', error);

      Taro.showToast({
        title: error.message || '连接失败，请检查服务器配置',
        icon: 'none',
        duration: 2000
      });
    } finally {
      setConnecting(false);
    }
  };

  // 手动连接
  const manualConnect = async () => {
    if (connecting) return;

    if (!nickname.trim()) {
      Taro.showToast({
        title: '请输入昵称',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    if (!serverIP.trim()) {
      Taro.showToast({
        title: '请输入服务器IP',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    // 验证IP或域名格式（localhost除外）
    if (serverIP.trim().toLowerCase() !== 'localhost') {
      const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;  // IP格式：192.168.1.1
      const domainPattern = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;  // 域名格式
      
      if (!ipPattern.test(serverIP.trim()) && !domainPattern.test(serverIP.trim())) {
        Taro.showToast({
          title: 'IP地址或域名格式不正确',
          icon: 'none',
          duration: 2000
        });
        return;
      }
    }

    setConnecting(true);

    try {
      // 设置玩家信息
      lanService.setPlayerInfo(nickname.trim());

      // 连接服务器
      const port = parseInt(serverPort) || 8888;
      await lanService.connect(serverIP.trim(), port);

      Taro.showToast({
        title: '连接成功',
        icon: 'success',
        duration: 1500
      });

      // 保存连接信息
      Taro.setStorageSync('lan_last_ip', serverIP.trim());
      Taro.setStorageSync('lan_last_port', port.toString());

      // 跳转到大厅
      setTimeout(() => {
        Taro.navigateTo({
          url: '/pages/lan/lobby/lobby'
        });
      }, 1500);
    } catch (error: any) {
      console.error('连接失败:', error);
      Taro.showToast({
        title: error.message || '连接失败',
        icon: 'none',
        duration: 2000
      });
    } finally {
      setConnecting(false);
    }
  };

  return (
    <View className="lan-connect-container">
      {/* 标题 */}
      <View className="header">
        <Text className="title">局域网联机</Text>
        <Text className="subtitle">连接到局域网游戏服务器</Text>
      </View>

      {/* 玩家信息 */}
      <View className="section">
        <Text className="section-title">玩家信息</Text>
        <View className="input-group">
          <Text className="input-label">昵称</Text>
          <Input
            className="input"
            placeholder="请输入你的昵称"
            maxlength={10}
            value={nickname}
            onInput={(e) => setNickname(e.detail.value)}
            disabled={connecting}
          />
        </View>
        
        {/* 快速连接按钮 */}
        <Button
          className="quick-connect-btn"
          onClick={quickConnect}
          disabled={connecting || !nickname.trim()}
        >
          {connecting ? '连接中...' : '🚀 开始游戏'}
        </Button>
        <Text className="quick-hint">连接到：{getServerConfig().host}:{getServerConfig().port}</Text>
      </View>

      {/* 高级选项（可折叠） */}
      <View className="section advanced-section">
        <View 
          className="advanced-toggle"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <Text className="toggle-icon">{showAdvanced ? '▼' : '▶'}</Text>
          <Text className="toggle-text">高级选项（自定义服务器）</Text>
        </View>
        
        {showAdvanced && (
          <View className="advanced-content">
            {/* 扫码连接 - 仅微信小程序显示 */}
            {isWeapp && (
              <View className="connect-method">
                <View className="method-icon">📱</View>
                <View className="method-content">
                  <Text className="method-title">扫描二维码</Text>
                  <Text className="method-desc">扫描服务器显示的二维码快速连接</Text>
                </View>
                <Button
                  className="method-btn scan-btn"
                  onClick={scanQRCode}
                  disabled={connecting || !nickname.trim()}
                >
                  扫码
                </Button>
              </View>
            )}

            {/* 手动输入 */}
            <View className="connect-method-title">
              <View className="method-icon-large">⌨️</View>
              <Text className="method-title-text">手动输入IP地址</Text>
            </View>

            <View className="manual-input-area">
              <View className="input-row">
                <Text className="input-label-small">IP地址</Text>
                <Input
                  className="input-inline"
                  placeholder="192.168.1.100"
                  value={serverIP}
                  onInput={(e) => setServerIP(e.detail.value)}
                  disabled={connecting}
                />
              </View>
              <View className="input-row">
                <Text className="input-label-small">端口</Text>
                <Input
                  className="input-inline short"
                  placeholder="8888"
                  type="number"
                  value={serverPort}
                  onInput={(e) => setServerPort(e.detail.value)}
                  disabled={connecting}
                />
              </View>
              <Button
                className="connect-btn"
                onClick={manualConnect}
                disabled={connecting || !nickname.trim() || !serverIP.trim()}
              >
                {connecting ? '连接中...' : '连接'}
              </Button>
            </View>
          </View>
        )}
      </View>

      {/* 使用说明 */}
      <View className="section tips">
        <Text className="tips-title">💡 使用说明</Text>
        <View className="tips-list">
          <Text className="tip-item">1. 确保所有设备连接到同一Wi-Fi</Text>
          <Text className="tip-item">2. 在电脑上运行：npm run lan:dev</Text>
          <Text className="tip-item">3. 查看终端显示的局域网IP地址</Text>
          <Text className="tip-item">4. 在上方输入IP地址和端口连接</Text>
          <Text className="tip-item">5. 默认端口是8888，通常不需要修改</Text>
        </View>
      </View>

      {/* 返回按钮 */}
      <View className="footer">
        <Button
          className="back-btn"
          onClick={() => Taro.navigateBack()}
          disabled={connecting}
        >
          返回
        </Button>
      </View>
    </View>
  );
}
