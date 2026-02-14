// 云端游戏引擎 - 纯JavaScript版本
// 移植自 src/utils/gameEngine.ts

// 天时配置数据（从weather.json复制）
const weatherData = {
  prosperity: [
    { doubleNumber: 1, name: '甘霖', effect: 'gainGoldPerWater_2' },
    { doubleNumber: 2, name: '回春', effect: 'gainGoldPerWood_2' },
    { doubleNumber: 3, name: '地灵', effect: 'gainGoldPerEarth_2' },
    { doubleNumber: 4, name: '烛照', effect: 'gainGoldPerFire_2' },
    { doubleNumber: 5, name: '瑞雪', effect: 'gainGoldPerMetal_2' },
    { doubleNumber: 6, name: '盛世', effect: 'gainGold_10' }
  ],
  chaos: [
    { doubleNumber: 1, name: '洪涝', effect: 'waterSettlement_x3' },
    { doubleNumber: 2, name: '大风', effect: 'woodSettlement_x3' },
    { doubleNumber: 3, name: '地动', effect: 'earthSettlement_x3' },
    { doubleNumber: 4, name: '大旱', effect: 'fireSettlement_x3' },
    { doubleNumber: 5, name: '霜降', effect: 'metalSettlement_x3' },
    { doubleNumber: 6, name: '日食', effect: 'eclipse' }
  ]
};

// 建筑配置数据（从buildings.json复制）
const buildingsData = {
  basicBuildings: [
    { id: 'water_basic_yuliang', name: '渔梁', element: 'water', level: 'basic', cost: 2, quantity: 8 },
    { id: 'water_basic_yanghang', name: '盐行', element: 'water', level: 'basic', cost: 3, quantity: 6 },
    { id: 'water_basic_biaoju', name: '镖局', element: 'water', level: 'basic', cost: 6, quantity: 4 },
    { id: 'wood_basic_sangyuan', name: '桑园', element: 'wood', level: 'basic', cost: 2, quantity: 8 },
    { id: 'wood_basic_chafang', name: '茶坊', element: 'wood', level: 'basic', cost: 3, quantity: 6 },
    { id: 'wood_basic_shuyuan', name: '书院', element: 'wood', level: 'basic', cost: 6, quantity: 4 },
    { id: 'fire_basic_ciqi', name: '瓷器坊', element: 'fire', level: 'basic', cost: 2, quantity: 8 },
    { id: 'fire_basic_jiulou', name: '酒楼', element: 'fire', level: 'basic', cost: 3, quantity: 6 },
    { id: 'fire_basic_hongxiuzhao', name: '红袖招', element: 'fire', level: 'basic', cost: 6, quantity: 4 },
    { id: 'metal_basic_tiejiangpu', name: '铁匠铺', element: 'metal', level: 'basic', cost: 2, quantity: 8 },
    { id: 'metal_basic_yinzhuang', name: '银庄', element: 'metal', level: 'basic', cost: 3, quantity: 6 },
    { id: 'metal_basic_bingqiku', name: '兵器库', element: 'metal', level: 'basic', cost: 6, quantity: 4 },
    { id: 'earth_basic_caishichang', name: '采石场', element: 'earth', level: 'basic', cost: 2, quantity: 8 },
    { id: 'earth_basic_yingzaosi', name: '营造司', element: 'earth', level: 'basic', cost: 3, quantity: 6 },
    { id: 'earth_basic_jitiantan', name: '祭天坛', element: 'earth', level: 'basic', cost: 6, quantity: 4 }
  ],
  legendaryBuildings: [
    { id: 'legendary_guanxingtai', name: '观星台', element: 'none', level: 'legendary', cost: 12, quantity: 4 },
    { id: 'legendary_dayunhe', name: '大运河', element: 'none', level: 'legendary', cost: 12, quantity: 4 },
    { id: 'legendary_leyouyuan', name: '乐游原', element: 'none', level: 'legendary', cost: 12, quantity: 4 },
    { id: 'legendary_damminggong', name: '大明宫', element: 'none', level: 'legendary', cost: 12, quantity: 4 },
    { id: 'legendary_tiancefu', name: '天策府', element: 'none', level: 'legendary', cost: 12, quantity: 4 },
    { id: 'legendary_wanguolaizhao', name: '万国来朝', element: 'none', level: 'legendary', cost: 30, quantity: 4 },
    { id: 'legendary_jiudingshenmiao', name: '九鼎神庙', element: 'none', level: 'legendary', cost: 30, quantity: 4 }
  ]
};

// 初始化游戏
function initializeGame(playerInfos, weatherMode = 'prosperity', legendaryConfig = {}) {
  const allBuildings = [
    ...buildingsData.basicBuildings,
    ...buildingsData.legendaryBuildings
  ];

  // 初始建筑ID
  const initialBuildingIds = [
    'water_basic_yuliang',
    'wood_basic_sangyuan',
    'metal_basic_tiejiangpu',
    'earth_basic_caishichang'
  ];

  // 创建玩家
  const players = playerInfos.map((info, index) => ({
    id: info.userId,
    nickname: info.nickname,
    avatar: info.avatar || '',
    gold: 5,
    buildings: initialBuildingIds.map(configId => ({
      configId,
      ownerId: info.userId
    })),
    diceCount: 1,
    taxReductionCards: 0,
    canBuyExtra: false,
    canFreeBuilding: false,
    protectionCount: 0
  }));

  // 初始化可用建筑
  const playerCount = players.length;
  const availableBuildings = {};
  
  allBuildings.forEach(building => {
    if (building.level === 'legendary') {
      const buildingKey = getLegendaryKey(building.id);
      if (legendaryConfig && buildingKey && !legendaryConfig[buildingKey]) {
        availableBuildings[building.id] = 0;
        return;
      }
      availableBuildings[building.id] = playerCount;
    } else {
      const scaledQuantity = Math.ceil(building.quantity * (playerCount / 4));
      const initialCount = initialBuildingIds.filter(id => id === building.id).length * playerCount;
      availableBuildings[building.id] = scaledQuantity - initialCount;
    }
  });

  return {
    players,
    currentPlayerIndex: 0,
    turn: 1,
    treasury: 0,
    availableBuildings,
    weatherMode,
    gameEnded: false,
    turnHistory: []
  };
}

// 获取传奇建筑的配置键名
function getLegendaryKey(buildingId) {
  const keyMap = {
    'legendary_guanxingtai': 'guanxingtai',
    'legendary_dayunhe': 'dayunhe',
    'legendary_leyouyuan': 'leyouyuan',
    'legendary_damminggong': 'damminggong',
    'legendary_tiancefu': 'tiancefu',
    'legendary_wanguolaizhao': 'wanguolaizhao',
    'legendary_jiudingshenmiao': 'jiudingshenmiao'
  };
  return keyMap[buildingId] || null;
}

// 投掷骰子
function rollDice(diceCount = 1) {
  const dice1 = Math.floor(Math.random() * 6) + 1;
  const dice2 = diceCount === 2 ? Math.floor(Math.random() * 6) + 1 : undefined;
  const dice = dice2 !== undefined ? [dice1, dice2] : [dice1];
  const total = dice2 !== undefined ? dice1 + dice2 : dice1;
  const isDouble = dice2 !== undefined && dice1 === dice2;

  return { dice, total, isDouble };
}

// 翻转骰子（大明宫效果）
function flipDice(value) {
  const pairs = {
    1: 6, 6: 1,
    2: 5, 5: 2,
    3: 4, 4: 3
  };
  return pairs[value] || value;
}

// 获取建筑配置
function getBuildingConfig(buildingId) {
  const allBuildings = [
    ...buildingsData.basicBuildings,
    ...buildingsData.legendaryBuildings
  ];
  return allBuildings.find(b => b.id === buildingId);
}

// 获取玩家的某个属性建筑数量
function getPlayerBuildingCountByElement(player, element) {
  return player.buildings.filter(pb => {
    const config = getBuildingConfig(pb.configId);
    return config && config.element === element;
  }).length;
}

// 检查玩家是否拥有某个建筑
function playerHasBuilding(player, buildingId) {
  return player.buildings.some(pb => pb.configId === buildingId);
}

// 计算玩家总资产
function calculateTotalAssets(player) {
  let totalValue = player.gold;
  
  player.buildings.forEach(building => {
    const config = getBuildingConfig(building.configId);
    if (config) {
      totalValue += config.cost;
    }
  });
  
  return totalValue;
}

// 检查胜利条件
function checkWinCondition(gameState) {
  for (const player of gameState.players) {
    // 九鼎神庙：即时胜利
    if (playerHasBuilding(player, 'legendary_jiudingshenmiao')) {
      return {
        hasWinner: true,
        winner: player.id,
        winType: 'jiudingshenmiao'
      };
    }
    
    // 万国来朝：当前存款≥99金
    if (playerHasBuilding(player, 'legendary_wanguolaizhao') && player.gold >= 99) {
      return {
        hasWinner: true,
        winner: player.id,
        winType: 'wanguolaizhao'
      };
    }
  }
  
  return { hasWinner: false };
}

// 金币转移辅助函数
function transferGold(from, to, amount, gameState) {
  const actualAmount = Math.min(amount, from.gold);
  from.gold -= actualAmount;
  to.gold += actualAmount;
  return { actualAmount };
}

// 计算火系费用（考虑金光罩）
function calculateFireCost(player, baseCost) {
  // 检查是否有金光罩（金系建筑保护）
  const metalCount = getPlayerBuildingCountByElement(player, 'metal');
  if (metalCount > 0) {
    return Math.floor(baseCost / 2); // 金光罩效果：火系费用减半
  }
  return baseCost;
}

// 处理结算（完整版）
function processSettlement(diceResult, gameState, currentPlayer) {
  const settlements = [];
  const total = diceResult.total;
  const isDouble = diceResult.isDouble;
  
  // 1. 处理火系建筑（其他玩家向当前玩家的火系建筑支付）
  gameState.players.forEach(owner => {
    owner.buildings.forEach(building => {
      const config = getBuildingConfig(building.configId);
      if (!config || config.element !== 'fire') return;
      
      // 只处理费用匹配的火系建筑
      if (config.cost !== total) return;
      
      // 别人的火系建筑被触发
      if (owner.id !== currentPlayer.id) {
        let cost = config.cost;
        
        // 红袖招特殊处理：收取现金的1/2，无视金光罩
        if (config.id === 'fire_basic_hongxiuzhao') {
          cost = Math.min(Math.floor(currentPlayer.gold / 2), 30);
        } else {
          // 其他火系建筑考虑金光罩
          cost = calculateFireCost(currentPlayer, config.cost);
        }
        
        // 双骰加成
        if (isDouble) {
          cost *= 2;
        }
        
        const { actualAmount } = transferGold(currentPlayer, owner, cost, gameState);
        
        if (actualAmount > 0) {
          settlements.push({
            playerId: currentPlayer.id,
            playerNickname: currentPlayer.nickname,
            buildingId: building.configId,
            buildingName: config.name,
            type: 'expense',
            amount: -actualAmount,
            reason: `支付给${owner.nickname}的${config.name}`
          });
          
          settlements.push({
            playerId: owner.id,
            playerNickname: owner.nickname,
            buildingId: building.configId,
            buildingName: config.name,
            type: 'income',
            amount: actualAmount,
            reason: `${config.name}收益`
          });
          
          // 天策府效果：火建筑触发时，每个金建筑额外获得3金
          if (playerHasBuilding(owner, 'legendary_tiancefu')) {
            const metalCount = getPlayerBuildingCountByElement(owner, 'metal');
            const bonus = metalCount * 3;
            if (bonus > 0) {
              owner.gold += bonus;
              settlements.push({
                playerId: owner.id,
                playerNickname: owner.nickname,
                buildingId: 'legendary_tiancefu',
                buildingName: '天策府',
                type: 'income',
                amount: bonus,
                reason: `天策府联动效果`
              });
            }
          }
        }
      }
    });
  });
  
  // 2. 处理木、金、土系建筑（自己的建筑收益）
  gameState.players.forEach(player => {
    player.buildings.forEach(building => {
      const config = getBuildingConfig(building.configId);
      if (!config) return;
      
      // 只处理费用匹配的非火系建筑
      if (config.cost !== total) return;
      if (config.element === 'fire') return;
      
      // 基础收益 = 该属性建筑数量
      let income = getPlayerBuildingCountByElement(player, config.element);
      
      // 双骰加成
      if (isDouble) {
        income *= 2;
      }
      
      // 大运河效果：水木联动
      if (playerHasBuilding(player, 'legendary_dayunhe')) {
        if (config.element === 'water') {
          const woodCount = getPlayerBuildingCountByElement(player, 'wood');
          income += woodCount;
        } else if (config.element === 'wood') {
          const waterCount = getPlayerBuildingCountByElement(player, 'water');
          income += waterCount;
        }
      }
      
      player.gold += income;
      
      settlements.push({
        playerId: player.id,
        playerNickname: player.nickname,
        buildingId: building.configId,
        buildingName: config.name,
        type: 'income',
        amount: income,
        reason: `${config.name}收益`
      });
      
      // 营造司特殊效果：获得额外购买机会
      if (config.id === 'earth_basic_yingzaosi') {
        player.canBuyExtra = true;
        settlements.push({
          playerId: player.id,
          playerNickname: player.nickname,
          buildingId: building.configId,
          buildingName: config.name,
          type: 'special',
          amount: 0,
          reason: '营造司：获得额外购买机会'
        });
      }
      
      // 祭天坛特殊效果：获得免费建筑机会
      if (config.id === 'earth_basic_jitiantan') {
        player.canFreeBuilding = true;
        settlements.push({
          playerId: player.id,
          playerNickname: player.nickname,
          buildingId: building.configId,
          buildingName: config.name,
          type: 'special',
          amount: 0,
          reason: '祭天坛：获得免费建筑机会'
        });
      }
    });
  });
  
  // 3. 万国来朝收益（每回合固定收益）
  if (playerHasBuilding(currentPlayer, 'legendary_wanguolaizhao')) {
    currentPlayer.gold += 10;
    settlements.push({
      playerId: currentPlayer.id,
      playerNickname: currentPlayer.nickname,
      buildingId: 'legendary_wanguolaizhao',
      buildingName: '万国来朝',
      type: 'income',
      amount: 10,
      reason: '万国来朝固定收益'
    });
  }
  
  return settlements;
}

// 购买建筑
function purchaseBuilding(buildingId, gameState, player) {
  const config = getBuildingConfig(buildingId);
  if (!config) {
    return { success: false, message: '建筑不存在' };
  }
  
  // 检查是否有库存
  if (!gameState.availableBuildings[buildingId] || gameState.availableBuildings[buildingId] <= 0) {
    return { success: false, message: '建筑已售罄' };
  }
  
  // 检查金币是否足够
  if (player.gold < config.cost) {
    return { success: false, message: '金币不足' };
  }
  
  // 扣除金币
  player.gold -= config.cost;
  
  // 添加建筑到玩家
  player.buildings.push({
    configId: buildingId,
    ownerId: player.id
  });
  
  // 减少库存
  gameState.availableBuildings[buildingId]--;
  
  return { 
    success: true, 
    message: '购买成功',
    building: config
  };
}

// 结束回合
function endTurn(gameState) {
  // 切换到下一个玩家
  gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
  
  // 如果回到第一个玩家，回合数+1
  if (gameState.currentPlayerIndex === 0) {
    gameState.turn++;
  }
  
  return gameState;
}

// 处理天时效果
function processWeatherEffect(diceResult, gameState, currentPlayer) {
  if (!diceResult.isDouble) return [];
  
  const settlements = [];
  const diceValue = diceResult.dice[0]; // 双骰的点数
  const weatherMode = gameState.weatherMode;
  
  // 获取对应的天时效果
  const weatherEffects = weatherData[weatherMode] || [];
  const weather = weatherEffects.find(w => w.doubleNumber === diceValue);
  
  if (!weather) return settlements;
  
  // 处理贞观盛世效果
  if (weatherMode === 'prosperity') {
    let bonus = 0;
    let elementName = '';
    
    switch (weather.effect) {
      case 'gainGoldPerWater_2':
        bonus = getPlayerBuildingCountByElement(currentPlayer, 'water') * 2;
        elementName = '水';
        break;
      case 'gainGoldPerWood_2':
        bonus = getPlayerBuildingCountByElement(currentPlayer, 'wood') * 2;
        elementName = '木';
        break;
      case 'gainGoldPerEarth_2':
        bonus = getPlayerBuildingCountByElement(currentPlayer, 'earth') * 2;
        elementName = '土';
        break;
      case 'gainGoldPerFire_2':
        bonus = getPlayerBuildingCountByElement(currentPlayer, 'fire') * 2;
        elementName = '火';
        break;
      case 'gainGoldPerMetal_2':
        bonus = getPlayerBuildingCountByElement(currentPlayer, 'metal') * 2;
        elementName = '金';
        break;
      case 'gainGold_10':
        bonus = 10;
        elementName = '盛世';
        break;
    }
    
    if (bonus > 0) {
      currentPlayer.gold += bonus;
      settlements.push({
        playerId: currentPlayer.id,
        playerNickname: currentPlayer.nickname,
        buildingId: 'weather_' + weather.name,
        buildingName: `天时:${weather.name}`,
        type: 'income',
        amount: bonus,
        reason: `天时${weather.name}效果：${elementName}建筑加成`
      });
    }
  }
  
  // 处理乾坤变色效果
  if (weatherMode === 'chaos') {
    // 乾坤变色：强制所有该属性建筑结算（收益x3）+ 惩罚
    const elementMap = {
      'waterSettlement_x3': { element: 'water', punish: 'fire', name: '洪涝' },
      'woodSettlement_x3': { element: 'wood', punish: 'earth', name: '大风' },
      'earthSettlement_x3': { element: 'earth', punish: 'metal', name: '地动' },
      'fireSettlement_x3': { element: 'fire', punish: 'water', name: '大旱' },
      'metalSettlement_x3': { element: 'metal', punish: 'wood', name: '霜降' }
    };
    
    const effectInfo = elementMap[weather.effect];
    
    if (effectInfo) {
      // 所有玩家的对应属性建筑结算，收益x3
      gameState.players.forEach(player => {
        const count = getPlayerBuildingCountByElement(player, effectInfo.element);
        if (count > 0) {
          const income = count * count * 3; // 基础收益x3
          player.gold += income;
          settlements.push({
            playerId: player.id,
            playerNickname: player.nickname,
            buildingId: 'weather_' + weather.name,
            buildingName: `天时:${effectInfo.name}`,
            type: 'income',
            amount: income,
            reason: `${effectInfo.name}：${effectInfo.element}建筑x3收益`
          });
        }
        
        // 惩罚：拥有被克制属性建筑的玩家向国库交税
        const punishCount = getPlayerBuildingCountByElement(player, effectInfo.punish);
        if (punishCount > 0) {
          const tax = punishCount * 3;
          const actualTax = Math.min(tax, player.gold);
          player.gold -= actualTax;
          gameState.treasury += actualTax;
          settlements.push({
            playerId: player.id,
            playerNickname: player.nickname,
            buildingId: 'weather_punishment',
            buildingName: `天时惩罚`,
            type: 'expense',
            amount: -actualTax,
            reason: `${effectInfo.name}惩罚：${effectInfo.punish}建筑向国库交税`
          });
        }
      });
    }
    
    // 日食特殊处理
    if (weather.effect === 'eclipse') {
      // 天坛共鸣
      if (playerHasBuilding(currentPlayer, 'earth_basic_jitiantan')) {
        const treasuryGold = gameState.treasury;
        currentPlayer.gold += treasuryGold;
        gameState.treasury = 0;
        settlements.push({
          playerId: currentPlayer.id,
          playerNickname: currentPlayer.nickname,
          buildingId: 'weather_eclipse',
          buildingName: `天时:日食`,
          type: 'income',
          amount: treasuryGold,
          reason: `日食+祭天坛：获得国库全部${treasuryGold}金`
        });
      } else {
        const halfTreasury = Math.floor(gameState.treasury / 2);
        currentPlayer.gold += halfTreasury + 10;
        gameState.treasury -= halfTreasury;
        settlements.push({
          playerId: currentPlayer.id,
          playerNickname: currentPlayer.nickname,
          buildingId: 'weather_eclipse',
          buildingName: `天时:日食`,
          type: 'income',
          amount: halfTreasury + 10,
          reason: `日食：获得10金+国库一半${halfTreasury}金`
        });
      }
      
      // 国祭：其他玩家向国库缴纳建筑总数x1金
      gameState.players.forEach(player => {
        if (player.id !== currentPlayer.id) {
          const tax = player.buildings.length;
          const actualTax = Math.min(tax, player.gold);
          player.gold -= actualTax;
          gameState.treasury += actualTax;
          settlements.push({
            playerId: player.id,
            playerNickname: player.nickname,
            buildingId: 'weather_national_sacrifice',
            buildingName: `国祭`,
            type: 'expense',
            amount: -actualTax,
            reason: `日食国祭：向国库缴纳${actualTax}金`
          });
        }
      });
    }
  }
  
  return settlements;
}

// 导出所有函数
module.exports = {
  initializeGame,
  rollDice,
  flipDice,
  getBuildingConfig,
  getPlayerBuildingCountByElement,
  playerHasBuilding,
  calculateTotalAssets,
  checkWinCondition,
  processSettlement,
  processWeatherEffect,
  purchaseBuilding,
  endTurn
};
