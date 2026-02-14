// 云函数：用户登录
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  
  try {
    // 查询用户是否存在
    const userRes = await db.collection('users').where({
      _openid: openid
    }).get();
    
    if (userRes.data.length === 0) {
      // 新用户，创建记录
      const createRes = await db.collection('users').add({
        data: {
          _openid: openid,
          nickname: `玩家${Date.now().toString().slice(-6)}`,
          avatar: 'cloud://default-avatar.png',
          score: 0,
          winCount: 0,
          totalGames: 0,
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        }
      });
      
      // 获取刚创建的用户信息
      const newUserRes = await db.collection('users').doc(createRes._id).get();
      
      return {
        success: true,
        isNewUser: true,
        user: newUserRes.data
      };
    } else {
      // 老用户，更新最后登录时间
      await db.collection('users').where({
        _openid: openid
      }).update({
        data: {
          updateTime: db.serverDate()
        }
      });
      
      return {
        success: true,
        isNewUser: false,
        user: userRes.data[0]
      };
    }
  } catch (error) {
    console.error('登录失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
