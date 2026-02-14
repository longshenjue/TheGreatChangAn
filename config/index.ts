import path from 'path';

const config = {
  projectName: 'the-great-changan',
  date: '2026-1-21',
  designWidth: 750,
  deviceRatio: {
    640: 2.34 / 2,
    750: 1,
    828: 1.81 / 2
  },
  sourceRoot: 'src',
  outputRoot: 'dist',
  plugins: [],
  defineConstants: {},
  copy: {
    patterns: [],
    options: {}
  },
  framework: 'react',
  compiler: {
    type: 'webpack5',
    prebundle: {
      enable: false
    }
  },
  cache: {
    enable: true,  // 开启持久化缓存
    buildDependencies: {
      config: [__filename]  // 当配置文件改变时重新缓存
    }
  },
  logger: {
    quiet: false,
    stats: true
  },
  mini: {
    postcss: {
      pxtransform: {
        enable: true,
        config: {}
      },
      url: {
        enable: true,
        config: {
          limit: 1024
        }
      },
      cssModules: {
        enable: false,
        config: {
          namingPattern: 'module',
          generateScopedName: '[name]__[local]___[hash:base64:5]'
        }
      }
    }
  },
  h5: {
    publicPath: '/',
    staticDirectory: 'static',
    postcss: {
      autoprefixer: {
        enable: true,
        config: {}
      },
      cssModules: {
        enable: false,
        config: {
          namingPattern: 'module',
          generateScopedName: '[name]__[local]___[hash:base64:5]'
        }
      }
    },
    devServer: {
      client: {
        overlay: {
          errors: true,
          warnings: false, // 不在页面上显示警告弹窗
        },
      },
    },
    webpackChain(chain) {
      // 隐藏特定的警告
      chain.module
        .rule('mjs')
        .test(/\.mjs$/)
        .include
        .add(/node_modules/)
        .end()
        .type('javascript/auto');
    }
  }
};

export default function (merge) {
  if (process.env.NODE_ENV === 'development') {
    return merge({}, config, require('./dev'));
  }
  return merge({}, config, require('./prod'));
}
