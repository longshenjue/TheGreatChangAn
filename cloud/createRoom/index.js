// 云函数：创建房间
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

// 生成6位房间号
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  
  try {
    // 获取用户信息
    const userRes = await db.collection('users').where({
      _openid: openid
    }).get();
    
    if (userRes.data.length === 0) {
      return {
        success: false,
        error: '用户不存在'
      };
    }
    
    const user = userRes.data[0];
    
    // 生成唯一房间号
    let roomCode;
    let codeExists = true;
    while (codeExists) {
      roomCode = generateRoomCode();
      const existingRoom = await db.collection('rooms').where({
        code: roomCode
      }).get();
      codeExists = existingRoom.data.length > 0;
    }
    
    // 创建房间
    const roomRes = await db.collection('rooms').add({
      data: {
        code: roomCode,
        hostId: openid,
        players: [{
          userId: openid,
          nickname: user.nickname,
          avatar: user.avatar,
          ready: false
        }],
        settings: {
          weatherMode: 'prosperity',
          legendaryBuildings: ['legendary_guanxingtai', 'legendary_dayunhe']
        },
        status: 'waiting',
        createTime: db.serverDate(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24小时后过期
      }
    });
    
    return {
      success: true,
      roomId: roomRes._id,
      code: roomCode
    };
  } catch (error) {
    console.error('创建房间失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
