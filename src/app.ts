import { Component, PropsWithChildren } from 'react';
import Taro from '@tarojs/taro';
import { createMockCloud, shouldUseMock } from './utils/mockCloud';
import './app.scss';

class App extends Component<PropsWithChildren> {
  componentDidMount() {
    // 判断是否使用 Mock 云开发
    if (shouldUseMock()) {
      // H5 环境：使用 Mock 云开发
      console.log('========================================');
      console.log('🔧 使用 Mock 云开发环境（本地测试模式）');
      console.log('========================================');
      
      const mockCloud = createMockCloud();
      mockCloud.init({
        env: 'mock-env',
        traceUser: true
      });
      
      // 替换 Taro.cloud
      (Taro as any).cloud = mockCloud;
      
      console.log('✅ Mock 云开发初始化成功');
      console.log('📝 您现在可以在 H5 模式下测试在线功能');
      console.log('========================================');
    } else {
      // 小程序环境：使用真实云开发
      if (Taro.cloud) {
        try {
          Taro.cloud.init({
            // TODO: 替换为您的云环境ID
            // env: 'your-cloud-env-id',
            traceUser: true
          });
          console.log('云开发初始化成功');
        } catch (error) {
          console.log('云开发初始化失败（可能未开通）:', error);
        }
      } else {
        console.log('当前环境不支持云开发');
      }
    }
  }

  componentDidShow() {}

  componentDidHide() {}

  render() {
    return this.props.children;
  }
}

export default App;
