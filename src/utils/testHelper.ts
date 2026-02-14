/**
 * 测试辅助工具
 * 提供各种测试和调试功能
 */

import Taro from '@tarojs/taro';

/**
 * 测试工具类
 */
export class TestHelper {
  private static logs: string[] = [];
  
  /**
   * 记录日志
   */
  static log(category: string, message: string, data?: any) {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] [${category}] ${message}`;
    console.log(logMessage, data || '');
    this.logs.push(logMessage);
    
    // 只保留最近100条日志
    if (this.logs.length > 100) {
      this.logs.shift();
    }
  }
  
  /**
   * 获取所有日志
   */
  static getLogs(): string[] {
    return [...this.logs];
  }
  
  /**
   * 清空日志
   */
  static clearLogs() {
    this.logs = [];
  }
  
  /**
   * 导出日志到剪贴板
   */
  static async exportLogs() {
    const logsText = this.logs.join('\n');
    try {
      await Taro.setClipboardData({
        data: logsText
      });
      Taro.showToast({
        title: '日志已复制到剪贴板',
        icon: 'success'
      });
    } catch (error) {
      console.error('导出日志失败:', error);
    }
  }
  
  /**
   * 测试云函数
   */
  static async testCloudFunction(name: string, data?: any) {
    this.log('测试', `调用云函数: ${name}`, data);
    
    try {
      const startTime = Date.now();
      const result = await Taro.cloud.callFunction({
        name,
        data
      });
      const duration = Date.now() - startTime;
      
      this.log('成功', `云函数响应 (${duration}ms)`, result);
      
      return {
        success: true,
        result,
        duration
      };
    } catch (error) {
      this.log('错误', `云函数调用失败: ${name}`, error);
      return {
        success: false,
        error
      };
    }
  }
  
  /**
   * 测试数据库连接
   */
  static async testDatabase() {
    this.log('测试', '测试数据库连接');
    
    try {
      const db = Taro.cloud.database();
      const result = await db.collection('users').limit(1).get();
      
      this.log('成功', '数据库连接正常', result);
      return { success: true, result };
    } catch (error) {
      this.log('错误', '数据库连接失败', error);
      return { success: false, error };
    }
  }
  
  /**
   * 显示环境信息
   */
  static showEnvironment() {
    const env = process.env.TARO_ENV;
    const info = {
      环境: env,
      是否Mock: env === 'h5',
      Taro版本: Taro.version || 'Unknown',
      云开发: Taro.cloud ? '已加载' : '未加载'
    };
    
    console.table(info);
    this.log('环境', '环境信息', info);
    
    return info;
  }
  
  /**
   * 模拟多玩家场景
   */
  static async simulateMultiPlayer(playerCount: number = 4) {
    this.log('测试', `模拟${playerCount}人游戏`);
    
    const players = [];
    const names = ['李白', '杜甫', '白居易', '王维', '孟浩然', '杜牧'];
    
    for (let i = 0; i < playerCount; i++) {
      players.push({
        userId: `mock_user_${i + 1}`,
        nickName: names[i] || `玩家${i + 1}`,
        avatarUrl: `https://via.placeholder.com/100?text=${names[i] || `P${i + 1}`}`,
        gold: 200,
        buildings: [],
        totalAssets: 200
      });
    }
    
    this.log('成功', '模拟玩家生成', players);
    return players;
  }
  
  /**
   * 性能测试
   */
  static async performanceTest(testName: string, fn: () => Promise<any>, iterations: number = 10) {
    this.log('测试', `性能测试开始: ${testName} (${iterations}次)`);
    
    const times: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      try {
        await fn();
        const duration = Date.now() - startTime;
        times.push(duration);
      } catch (error) {
        this.log('错误', `测试失败 (第${i + 1}次)`, error);
      }
    }
    
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    const result = {
      测试名称: testName,
      总次数: iterations,
      平均耗时: `${avgTime.toFixed(2)}ms`,
      最短耗时: `${minTime}ms`,
      最长耗时: `${maxTime}ms`
    };
    
    console.table(result);
    this.log('完成', '性能测试结果', result);
    
    return result;
  }
}

/**
 * 在开发环境下挂载到全局，方便控制台调试
 */
if (process.env.NODE_ENV === 'development') {
  (window as any).TestHelper = TestHelper;
  console.log('💡 测试工具已加载，在控制台输入 TestHelper 查看可用方法');
}

export default TestHelper;
