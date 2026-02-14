/**
 * 局域网服务管理类
 * 用于替代云开发，实现局域网联机
 */

import Taro from '@tarojs/taro';

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
  hostNickname: string;
  players: Player[];
  settings: {
    weatherMode: 'prosperity' | 'chaos';
    legendaryBuildings: string[];
  };
  status: 'waiting' | 'playing' | 'finished';
  gameState?: any;
  createTime: string;
}

interface ServerInfo {
  serverIP: string;
  wsPort: number;
  wsUrl: string;
}

class LANService {
  private ws: WebSocket | null = null;
  private serverUrl: string = '';
  private serverIP: string = '';
  private serverPort: number = 8888;
  private playerId: string = '';
  private connected: boolean = false;
  private messageHandlers: Map<string, Function[]> = new Map();
  private reconnectTimer: any = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private heartbeatTimer: any = null;

  /**
   * 连接到局域网服务器
   * @param ip 服务器IP地址
   * @param port 服务器端口
   */
  async connect(ip: string, port: number = 8888): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        // 暂存连接的IP（注册成功后会用服务器返回的局域网IP更新）
        const connectIP = ip;
        const connectPort = port;
        
        // 根据页面协议自动选择 ws:// 或 wss://
        const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss' : 'ws';
        this.serverUrl = `${protocol}://${ip}:${port}`;
        console.log('🔌 正在连接到局域网服务器:', this.serverUrl);

        // 恢复重连次数限制
        this.maxReconnectAttempts = 5;
        
        this.ws = new WebSocket(this.serverUrl);

        this.ws.onopen = () => {
          console.log('✅ 局域网服务器连接成功');
          this.connected = true;
          this.reconnectAttempts = 0;

          // 开始心跳
          this.startHeartbeat();

          // 注册玩家
          this.register().then(() => {
            // 注册成功后，服务器会返回局域网IP，此时serverIP和serverPort已经更新
            console.log('✅ 注册完成，服务器信息:', { ip: this.serverIP, port: this.serverPort });
            
            // 保存服务器信息到localStorage
            Taro.setStorageSync('lan_server_ip', this.serverIP);
            Taro.setStorageSync('lan_server_port', this.serverPort.toString());
            
            resolve(true);
          }).catch((error) => {
            console.error('注册失败:', error);
            reject(error);
          });
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            
            // 处理注册响应（可能包含重连信息）
            if (message.type === 'registered' && message.data.isReconnect && message.data.room) {
              console.log('🔄 检测到断线重连，自动恢复房间');
              // 保存重连信息，稍后触发
              setTimeout(() => {
                this.emit('autoReconnectRoom', message.data.room);
              }, 100);
            }
            
            this.handleMessage(message);
          } catch (error) {
            console.error('解析消息失败:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket错误:', error);
          reject(new Error('连接失败'));
        };

        this.ws.onclose = () => {
          console.log('🔌 与服务器断开连接');
          this.connected = false;
          this.stopHeartbeat();

          // 只有在maxReconnectAttempts > 0时才尝试重连（非主动断开）
          if (this.maxReconnectAttempts > 0 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          } else if (this.maxReconnectAttempts > 0) {
            this.emit('disconnected', { reason: '连接断开' });
          }
        };

        // 超时处理
        setTimeout(() => {
          if (!this.connected) {
            reject(new Error('连接超时'));
          }
        }, 10000);
      } catch (error) {
        console.error('连接错误:', error);
        reject(error);
      }
    });
  }

  /**
   * 从二维码数据连接
   */
  async connectFromQR(qrData: string): Promise<boolean> {
    try {
      const data = JSON.parse(qrData);
      return await this.connect(data.ip, data.port);
    } catch (error) {
      console.error('解析二维码失败:', error);
      throw new Error('二维码格式错误');
    }
  }

  /**
   * 断开连接
   */
  disconnect() {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    // 设置标记，阻止自动重连
    this.maxReconnectAttempts = 0;
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.connected = false;
    console.log('👋 已断开连接');
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.connected && this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * 获取玩家ID
   */
  getPlayerId(): string {
    return this.playerId;
  }

  /**
   * 注册玩家
   */
  private async register(): Promise<void> {
    return new Promise((resolve, reject) => {
      // 获取存储的昵称和头像
      const nickname = Taro.getStorageSync('lan_nickname') || `玩家${Math.floor(Math.random() * 1000)}`;
      const avatar = Taro.getStorageSync('lan_avatar') || '';

      // 监听注册响应
      const handler = (data: any) => {
        this.playerId = data.playerId;
        Taro.setStorageSync('lan_playerId', this.playerId);
        
        // 保存服务器返回的局域网IP（关键！）
        if (data.serverInfo) {
          this.serverIP = data.serverInfo.ip;
          this.serverPort = data.serverInfo.port;
          console.log('✅ 玩家注册成功:', this.playerId);
          console.log('📡 服务器局域网IP:', data.serverInfo.ip);
        } else {
          console.log('✅ 玩家注册成功:', this.playerId);
        }
        
        this.off('registered', handler);
        resolve();
      };

      this.on('registered', handler);

      // 发送注册请求
      this.send({
        type: 'register',
        data: { nickname, avatar }
      });

      // 超时处理
      setTimeout(() => {
        this.off('registered', handler);
        reject(new Error('注册超时'));
      }, 5000);
    });
  }

  /**
   * 创建房间
   */
  async createRoom(): Promise<Room> {
    return new Promise((resolve, reject) => {
      const handler = (data: any) => {
        this.off('roomCreated', handler);
        this.off('error', errorHandler);
        resolve(data.room);
      };

      const errorHandler = (data: any) => {
        this.off('roomCreated', handler);
        this.off('error', errorHandler);
        reject(new Error(data.message));
      };

      this.on('roomCreated', handler);
      this.on('error', errorHandler);

      this.send({
        type: 'createRoom',
        data: { playerId: this.playerId }
      });

      setTimeout(() => {
        this.off('roomCreated', handler);
        this.off('error', errorHandler);
        reject(new Error('创建房间超时'));
      }, 5000);
    });
  }

  /**
   * 加入房间
   */
  async joinRoom(roomIdOrCode: string): Promise<Room> {
    return new Promise((resolve, reject) => {
      const handler = (data: any) => {
        this.off('roomJoined', handler);
        this.off('error', errorHandler);
        resolve(data.room);
      };

      const errorHandler = (data: any) => {
        this.off('roomJoined', handler);
        this.off('error', errorHandler);
        reject(new Error(data.message));
      };

      this.on('roomJoined', handler);
      this.on('error', errorHandler);

      // 判断是房间ID还是房间号
      const data: any = { playerId: this.playerId };
      if (roomIdOrCode.length === 6) {
        data.roomCode = roomIdOrCode;
      } else {
        data.roomId = roomIdOrCode;
      }

      this.send({
        type: 'joinRoom',
        data
      });

      setTimeout(() => {
        this.off('roomJoined', handler);
        this.off('error', errorHandler);
        reject(new Error('加入房间超时'));
      }, 5000);
    });
  }

  /**
   * 离开房间
   */
  leaveRoom(roomId: string): void {
    this.send({
      type: 'leaveRoom',
      data: {
        playerId: this.playerId,
        roomId
      }
    });
  }

  /**
   * 切换准备状态
   */
  toggleReady(roomId: string): void {
    this.send({
      type: 'toggleReady',
      data: {
        playerId: this.playerId,
        roomId
      }
    });
  }

  /**
   * 更新房间设置
   */
  updateSettings(roomId: string, settings: any): void {
    this.send({
      type: 'updateSettings',
      data: {
        playerId: this.playerId,
        roomId,
        settings
      }
    });
  }

  /**
   * 开始游戏
   */
  startGame(roomId: string): void {
    this.send({
      type: 'startGame',
      data: {
        playerId: this.playerId,
        roomId
      }
    });
  }

  /**
   * 发送游戏操作（服务器权威模式 - 只发送指令）
   */
  sendGameAction(roomId: string, action: string, data: any = {}): void {
    this.send({
      type: 'gameAction',
      data: {
        playerId: this.playerId,
        roomId,
        action,
        ...data
      }
    });
  }

  /**
   * 获取房间列表
   */
  async getRooms(): Promise<Room[]> {
    return new Promise((resolve, reject) => {
      const handler = (data: any) => {
        this.off('roomList', handler);
        resolve(data.rooms);
      };

      this.on('roomList', handler);

      this.send({
        type: 'getRooms',
        data: {}
      });

      setTimeout(() => {
        this.off('roomList', handler);
        reject(new Error('获取房间列表超时'));
      }, 5000);
    });
  }

  /**
   * 监听事件
   */
  on(event: string, handler: Function): void {
    if (!this.messageHandlers.has(event)) {
      this.messageHandlers.set(event, []);
    }
    this.messageHandlers.get(event)!.push(handler);
  }

  /**
   * 取消监听事件
   */
  off(event: string, handler: Function): void {
    const handlers = this.messageHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * 触发事件
   */
  private emit(event: string, data: any): void {
    const handlers = this.messageHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error('事件处理错误:', error);
        }
      });
    }
  }

  /**
   * 发送消息
   */
  private send(message: any): void {
    if (!this.isConnected()) {
      console.error('未连接到服务器');
      return;
    }

    try {
      this.ws!.send(JSON.stringify(message));
    } catch (error) {
      console.error('发送消息失败:', error);
    }
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(message: any): void {
    console.log('📨 收到消息:', message.type);
    
    // 触发对应的事件
    this.emit(message.type, message.data || message);
  }

  /**
   * 开始心跳
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected()) {
        this.send({ type: 'ping' });
      }
    }, 30000); // 每30秒发送一次心跳
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * 安排重连
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    console.log(`⏳ ${delay/1000}秒后尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      const [, ip, port] = this.serverUrl.match(/wss?:\/\/(.+):(\d+)/) || [];
      if (ip && port) {
        this.connect(ip, parseInt(port)).catch(() => {
          // 重连失败会自动再次安排重连
        });
      }
    }, delay);
  }

  /**
   * 设置玩家信息
   */
  setPlayerInfo(nickname: string, avatar?: string): void {
    Taro.setStorageSync('lan_nickname', nickname);
    if (avatar) {
      Taro.setStorageSync('lan_avatar', avatar);
    }
  }

  /**
   * 获取玩家信息
   */
  getPlayerInfo(): { nickname: string; avatar: string } {
    return {
      nickname: Taro.getStorageSync('lan_nickname') || '',
      avatar: Taro.getStorageSync('lan_avatar') || ''
    };
  }

  /**
   * 获取当前连接的服务器信息
   */
  getServerInfo(): { ip: string; port: string } {
    return {
      ip: this.serverIP || Taro.getStorageSync('lan_server_ip') || 'localhost',
      port: this.serverPort?.toString() || Taro.getStorageSync('lan_server_port') || '8888'
    };
  }
}

// 导出单例
export const lanService = new LANService();
export default lanService;
