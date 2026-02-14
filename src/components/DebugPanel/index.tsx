/**
 * 调试面板组件
 * 仅在开发模式下显示
 */

import { View, Text, ScrollView, Button } from '@tarojs/components';
import { useState, useEffect } from 'react';
import Taro from '@tarojs/taro';
import { TestHelper } from '../../utils/testHelper';
import './index.scss';

const DebugPanel = () => {
  const [visible, setVisible] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [envInfo, setEnvInfo] = useState<any>(null);
  
  // 仅在开发环境显示
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }
  
  useEffect(() => {
    // 定期更新日志
    const timer = setInterval(() => {
      setLogs(TestHelper.getLogs());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);
  
  const handleShowEnv = () => {
    const info = TestHelper.showEnvironment();
    setEnvInfo(info);
    Taro.showToast({
      title: '环境信息已输出到控制台',
      icon: 'none'
    });
  };
  
  const handleTestLogin = async () => {
    Taro.showLoading({ title: '测试中...' });
    const result = await TestHelper.testCloudFunction('login');
    Taro.hideLoading();
    
    if (result.success) {
      Taro.showToast({
        title: '登录测试成功',
        icon: 'success'
      });
    } else {
      Taro.showToast({
        title: '登录测试失败',
        icon: 'error'
      });
    }
  };
  
  const handleTestDatabase = async () => {
    Taro.showLoading({ title: '测试中...' });
    const result = await TestHelper.testDatabase();
    Taro.hideLoading();
    
    if (result.success) {
      Taro.showToast({
        title: '数据库连接正常',
        icon: 'success'
      });
    } else {
      Taro.showToast({
        title: '数据库连接失败',
        icon: 'error'
      });
    }
  };
  
  const handleClearLogs = () => {
    TestHelper.clearLogs();
    setLogs([]);
    Taro.showToast({
      title: '日志已清空',
      icon: 'success'
    });
  };
  
  const handleExportLogs = () => {
    TestHelper.exportLogs();
  };
  
  return (
    <View className="debug-panel">
      {/* 悬浮按钮 */}
      <View 
        className="debug-toggle"
        onClick={() => setVisible(!visible)}
      >
        <Text className="debug-toggle-text">
          {visible ? '✕' : '🔧'}
        </Text>
      </View>
      
      {/* 调试面板 */}
      {visible && (
        <View className="debug-content">
          <View className="debug-header">
            <Text className="debug-title">🔧 调试面板</Text>
            <Text className="debug-subtitle">
              {process.env.TARO_ENV === 'h5' ? 'Mock模式' : '真实环境'}
            </Text>
          </View>
          
          {/* 环境信息 */}
          {envInfo && (
            <View className="debug-section">
              <Text className="debug-section-title">环境信息</Text>
              <View className="env-info">
                {Object.entries(envInfo).map(([key, value]) => (
                  <View key={key} className="env-item">
                    <Text className="env-key">{key}:</Text>
                    <Text className="env-value">{String(value)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          
          {/* 快速测试 */}
          <View className="debug-section">
            <Text className="debug-section-title">快速测试</Text>
            <View className="debug-actions">
              <Button 
                className="debug-btn"
                size="mini"
                onClick={handleShowEnv}
              >
                查看环境
              </Button>
              <Button 
                className="debug-btn"
                size="mini"
                onClick={handleTestLogin}
              >
                测试登录
              </Button>
              <Button 
                className="debug-btn"
                size="mini"
                onClick={handleTestDatabase}
              >
                测试数据库
              </Button>
            </View>
          </View>
          
          {/* 日志 */}
          <View className="debug-section">
            <View className="debug-section-header">
              <Text className="debug-section-title">
                日志 ({logs.length})
              </Text>
              <View className="log-actions">
                <Text 
                  className="log-action"
                  onClick={handleExportLogs}
                >
                  导出
                </Text>
                <Text 
                  className="log-action"
                  onClick={handleClearLogs}
                >
                  清空
                </Text>
              </View>
            </View>
            <ScrollView 
              className="debug-logs"
              scrollY
              scrollTop={logs.length * 30}
            >
              {logs.length === 0 ? (
                <Text className="log-empty">暂无日志</Text>
              ) : (
                logs.map((log, index) => (
                  <View key={index} className="log-item">
                    <Text className="log-text">{log}</Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
          
          {/* 说明 */}
          <View className="debug-tips">
            <Text className="tip-text">
              💡 提示：打开浏览器控制台查看详细日志
            </Text>
            <Text className="tip-text">
              💡 输入 TestHelper 使用更多测试功能
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

export default DebugPanel;
