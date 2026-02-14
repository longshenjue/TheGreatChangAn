// 云函数：加入房间
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { roomCode } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  
  try {
    // 查找房间
    const roomRes = await db.collection('rooms').where({
      code: roomCode,
      status: 'waiting'
    }).get();
    
    if (roomRes.data.length === 0) {
      return { success: false, error: '房间不存在或已开始' };
    }
    
    const room = roomRes.data[0];
    
    // 检查房间是否已满
    if (room.players.length >= 4) {
      return { success: false, error: '房间已满' };
    }
    
    // 检查是否已在房间中
    if (room.players.some(p => p.userId === openid)) {
      return { success: false, error: '您已在房间中' };
    }
    
    // 获取用户信息
    const userRes = await db.collection('users').where({
      _openid: openid
    }).get();
    
    const user = userRes.data[0];
    
    // 加入房间
    await db.collection('rooms').doc(room._id).update({
      data: {
        players: _.push({
          userId: openid,
          nickname: user.nickname,
          avatar: user.avatar,
          ready: false
        })
      }
    });
    
    return {
      success: true,
      roomId: room._id
    };
  } catch (error) {
    console.error('加入房间失败:', error);
    return { success: false, error: error.message };
  }
};
