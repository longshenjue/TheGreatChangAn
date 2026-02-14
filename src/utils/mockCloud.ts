/**
 * 云函数 Mock 层
 * 用于本地H5开发时模拟云函数调用
 */

import { getAvatarByUserId } from './avatarHelper';

// Mock 数据库
class MockDatabase {
  private data: Map<string, any[]> = new Map();
  private mockUser = {
    _openid: 'mock_user_123',
    nickName: '测试用户',
    avatarUrl: getAvatarByUserId('mock_user_123'),
    score: 1000
  };

  constructor() {
    // 初始化 mock 数据
    this.initMockData();
  }

  private initMockData() {
    // Mock users 集合
    this.data.set('users', [
      { 
        _id: '1',
        _openid: 'mock_user_123',
        nickName: '李白',
        avatarUrl: getAvatarByUserId('mock_user_123'),
        score: 1000,
        totalGames: 10,
        wins: 5
      },
      {
        _id: '2',
        _openid: 'mock_user_456',
        nickName: '杜甫',
        avatarUrl: getAvatarByUserId('mock_user_456'),
        score: 950,
        totalGames: 8,
        wins: 4
      },
      {
        _id: '3',
        _openid: 'mock_user_789',
        nickName: '白居易',
        avatarUrl: getAvatarByUserId('mock_user_789'),
        score: 900,
        totalGames: 12,
        wins: 3
      }
    ]);

    // Mock rooms 集合
    this.data.set('rooms', []);

    // Mock game_states 集合
    this.data.set('game_states', []);

    // Mock game_records 集合
    this.data.set('game_records', []);
  }

  collection(name: string) {
    return {
      get: async () => {
        const data = this.data.get(name) || [];
        return { data };
      },
      
      doc: (id: string) => ({
        get: async () => {
          const data = this.data.get(name) || [];
          const item = data.find((d: any) => d._id === id);
          return { data: item ? [item] : [] };
        },
        
        set: async (newData: any) => {
          const data = this.data.get(name) || [];
          const index = data.findIndex((d: any) => d._id === id);
          if (index >= 0) {
            data[index] = { ...data[index], ...newData };
          } else {
            data.push({ _id: id, ...newData });
          }
          this.data.set(name, data);
          return { success: true };
        },
        
        update: async (updates: any) => {
          const data = this.data.get(name) || [];
          const index = data.findIndex((d: any) => d._id === id);
          if (index >= 0) {
            data[index] = { ...data[index], ...updates };
          }
          this.data.set(name, data);
          return { success: true };
        },
        
        remove: async () => {
          const data = this.data.get(name) || [];
          const newData = data.filter((d: any) => d._id !== id);
          this.data.set(name, newData);
          return { success: true };
        },
        
        watch: (options: any) => {
          // Mock watch: 返回一个假的 watcher
          console.log('[Mock] Watch collection:', name, 'doc:', id);
          return {
            close: () => {
              console.log('[Mock] Close watcher');
            }
          };
        }
      }),
      
      where: (condition: any) => {
        // 过滤数据的通用逻辑
        const filterData = () => {
          const data = this.data.get(name) || [];
          let filtered = data;
          if (condition.status) {
            filtered = data.filter((d: any) => d.status === condition.status);
          }
          return filtered;
        };

        return {
          get: async () => {
            return { data: filterData() };
          },
          
          orderBy: (field: string, order: 'asc' | 'desc' = 'asc') => ({
            get: async () => {
              const filtered = filterData();
              // 排序
              filtered.sort((a: any, b: any) => {
                if (order === 'asc') {
                  return a[field] > b[field] ? 1 : -1;
                } else {
                  return a[field] < b[field] ? 1 : -1;
                }
              });
              return { data: filtered };
            },
            
            limit: (count: number) => ({
              get: async () => {
                const filtered = filterData();
                // 排序
                filtered.sort((a: any, b: any) => {
                  if (order === 'asc') {
                    return a[field] > b[field] ? 1 : -1;
                  } else {
                    return a[field] < b[field] ? 1 : -1;
                  }
                });
                // 限制数量
                return { data: filtered.slice(0, count) };
              }
            })
          })
        };
      },
      
      add: async (newData: any) => {
        const data = this.data.get(name) || [];
        const id = `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const item = { _id: id, ...newData };
        data.push(item);
        this.data.set(name, data);
        return { _id: id };
      },
      
      watch: (options: any) => {
        console.log('[Mock] Watch collection:', name);
        return {
          close: () => {
            console.log('[Mock] Close watcher');
          }
        };
      }
    };
  }
}

// Mock 云函数
const mockDatabase = new MockDatabase();

export const mockCloudFunctions = {
  // 登录
  login: async () => {
    console.log('[Mock] 调用云函数: login');
    await new Promise(resolve => setTimeout(resolve, 300)); // 模拟网络延迟
    const avatarUrl = getAvatarByUserId('mock_user_123');
    return {
      result: {
        success: true,
        isNewUser: false,
        userId: '1',
        user: {
          _id: '1',
          _openid: 'mock_user_123',
          nickname: '李白',
          avatar: avatarUrl,
          score: 1000,
          totalGames: 10,
          wins: 5
        },
        // 兼容旧格式
        userInfo: {
          _id: '1',
          _openid: 'mock_user_123',
          nickName: '李白',
          nickname: '李白',
          avatarUrl: avatarUrl,
          avatar: avatarUrl,
          score: 1000,
          totalGames: 10,
          wins: 5
        }
      }
    };
  },

  // 创建房间
  createRoom: async (data: any) => {
    console.log('[Mock] 调用云函数: createRoom', data);
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const roomCode = Math.floor(100000 + Math.random() * 900000).toString();
    const roomId = `room_${Date.now()}`;
    
    const room = {
      _id: roomId,
      code: roomCode,
      hostId: 'mock_user_123',
      hostName: '李白',
      hostNickname: '李白',
      status: 'waiting',
      maxPlayers: data.maxPlayers || 4,
      players: [{
        userId: 'mock_user_123',
        nickname: '李白',
        nickName: '李白',
        avatar: getAvatarByUserId('mock_user_123'),
        avatarUrl: getAvatarByUserId('mock_user_123'),
        ready: false,
        isReady: false,
        isHost: true
      }],
      settings: {
        weatherMode: 'prosperity',
        legendaryBuildings: ['guanxingtai', 'dayunhe']  // 默认包含必选建筑
      },
      createTime: new Date().toISOString()
    };
    
    // 保存到 mock 数据库
    const rooms = mockDatabase.collection('rooms');
    await rooms.add(room);
    
    return {
      result: {
        success: true,
        roomId: roomId,
        roomCode: roomCode,
        room: room  // 返回完整的房间信息
      }
    };
  },

  // 加入房间
  joinRoom: async (data: any) => {
    console.log('[Mock] 调用云函数: joinRoom', data);
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // 模拟加入房间
    return {
      result: {
        success: true,
        room: {
          _id: 'room_mock',
          code: data.code || '123456',
          hostId: 'mock_user_123',
          hostName: '李白',
          status: 'waiting',
          maxPlayers: 4,
          players: [
            {
              userId: 'mock_user_123',
              nickName: '李白',
              avatarUrl: 'https://via.placeholder.com/100/FFD700/FFFFFF?text=李白',
              isReady: true,
              isHost: true
            },
            {
              userId: 'mock_user_456',
              nickName: '杜甫',
              avatarUrl: 'https://via.placeholder.com/100/C0C0C0/FFFFFF?text=杜甫',
              isReady: false,
              isHost: false
            }
          ],
          createTime: new Date()
        }
      }
    };
  },

  // 游戏操作
  gameAction: async (data: any) => {
    console.log('[Mock] 调用云函数: gameAction', data);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const { action, gameStateId } = data;
    
    // 根据不同操作返回不同结果
    switch (action) {
      case 'rollDice':
        return {
          result: {
            success: true,
            gameState: mockGameState,
            diceResult: {
              dice: [3, 4],
              total: 7,
              isDouble: false
            },
            settlements: [
              {
                type: 'self',
                element: 'wood',
                gold: 50,
                buildings: ['酒楼'],
                message: '木系建筑结算：+50金币'
              }
            ],
            weatherTriggered: false
          }
        };
      
      case 'buyBuilding':
        return {
          result: {
            success: true,
            gameState: mockGameState,
            message: '购买成功'
          }
        };
      
      case 'skipBuy':
        return {
          result: {
            success: true,
            gameState: mockGameState
          }
        };
      
      default:
        return {
          result: {
            success: true,
            gameState: mockGameState
          }
        };
    }
  },

  // 获取用户信息
  getProfile: async () => {
    console.log('[Mock] 调用云函数: getProfile');
    await new Promise(resolve => setTimeout(resolve, 200));
    const avatarUrl = getAvatarByUserId('mock_user_123');
    
    return {
      result: {
        success: true,
        profile: {
          _id: '1',
          _openid: 'mock_user_123',
          nickName: '李白',
          nickname: '李白',
          avatarUrl: avatarUrl,
          avatar: avatarUrl,
          score: 1000,
          totalGames: 10,
          wins: 5,
          winCount: 5,
          winRate: 50,
          createTime: new Date().toISOString(),
          updateTime: new Date().toISOString()
        },
        gameRecords: []
      }
    };
  }
};

// Mock 游戏状态
const mockGameState = {
  currentPlayer: 0,
  round: 1,
  phase: 'rolling' as const,
  players: [
    {
      userId: 'mock_user_123',
      nickName: '李白',
      avatarUrl: 'https://via.placeholder.com/100/FFD700/FFFFFF?text=李白',
      gold: 200,
      buildings: ['酒楼', '茶馆'],
      totalAssets: 250
    },
    {
      userId: 'mock_user_456',
      nickName: '杜甫',
      avatarUrl: 'https://via.placeholder.com/100/C0C0C0/FFFFFF?text=杜甫',
      gold: 180,
      buildings: ['书院'],
      totalAssets: 220
    }
  ],
  buildingStock: {
    '酒楼': 2,
    '茶馆': 3,
    '书院': 3
  },
  weather: null,
  lastDiceResult: null,
  history: []
};

/**
 * Mock 云开发实例
 */
export const createMockCloud = () => {
  console.log('[Mock] 使用 Mock 云开发环境');
  
  return {
    init: (config: any) => {
      console.log('[Mock] 初始化云开发:', config);
    },
    
    callFunction: async (options: any) => {
      const { name, data } = options;
      console.log(`[Mock] 调用云函数: ${name}`, data);
      
      // 调用对应的 mock 函数
      const mockFn = mockCloudFunctions[name as keyof typeof mockCloudFunctions];
      if (mockFn) {
        return await mockFn(data);
      }
      
      // 未找到对应的 mock 函数
      console.warn(`[Mock] 未找到云函数: ${name}`);
      return {
        result: {
          success: false,
          error: `Mock function ${name} not found`
        }
      };
    },
    
    database: () => mockDatabase
  };
};

/**
 * 判断是否使用 Mock
 */
export const shouldUseMock = (): boolean => {
  // H5 环境下使用 Mock
  return process.env.TARO_ENV === 'h5';
};
