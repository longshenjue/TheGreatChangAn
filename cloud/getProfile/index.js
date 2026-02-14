// 云函数：获取个人信息
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

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
        message: '用户不存在，请先登录'
      };
    }
    
    const user = userRes.data[0];
    
    // 获取最近游戏记录（最多10条）
    const gamesRes = await db.collection('game_records')
      .where({
        'players.userId': openid
      })
      .orderBy('finishedAt', 'desc')
      .limit(10)
      .get();
    
    // 组装返回数据
    return {
      success: true,
      profile: {
        _id: user._id,
        _openid: user._openid,
        nickname: user.nickname,
        avatar: user.avatar,
        score: user.score || 0,
        winCount: user.winCount || 0,
        totalGames: user.totalGames || 0,
        createTime: user.createTime,
        updateTime: user.updateTime
      },
      gameRecords: gamesRes.data.map(game => ({
        _id: game._id,
        roomId: game.roomId,
        players: game.players,
        winner: game.winner,
        finishedAt: game.finishedAt
      }))
    };
  } catch (error) {
    console.error('获取个人信息失败:', error);
    return { 
      success: false, 
      message: error.message || '获取失败'
    };
  }
};
