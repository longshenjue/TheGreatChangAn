/**
 * 服务器端游戏引擎
 * 处理所有游戏逻辑和状态管理
 */

const fs = require('fs');
const path = require('path');

// 加载配置文件
const buildingsConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../src/config/buildings.json'), 'utf-8')
);

const weatherConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../src/config/weather.json'), 'utf-8')
);

/**
 * 初始化游戏
 */
function initializeGame(playerNames, weatherMode = 'prosperity', legendaryConfig = null) {
  const allBuildings = [
    ...buildingsConfig.basicBuildings,
    ...buildingsConfig.legendaryBuildings,
  ];

  // 初始建筑ID
  const initialBuildingIds = [
    'water_basic_yuliang',
    'wood_basic_sangyuan',
    'metal_basic_tiejiangpu',
    'earth_basic_caishichang'
  ];

  // 创建玩家
  const players = playerNames.map((name, index) => ({
    id: `player_${index}`,
    name,
    gold: 5,
    buildings: initialBuildingIds.map(configId => ({
      configId,
      ownerId: `player_${index}`,
    })),
    diceCount: 1,
    taxReductionCards: 0,
    canBuyExtra: false,
    canFreeBuilding: false,
    grandCanalTriggered: false,
  }));

  // 初始化可用建筑（按玩家数量比例调整）
  const playerCount = players.length;
  const availableBuildings = {};
  
  console.log('[游戏初始化] 传奇建筑配置类型:', Array.isArray(legendaryConfig) ? '数组' : typeof legendaryConfig);
  console.log('[游戏初始化] 传奇建筑配置内容:', legendaryConfig);
  
  // 必备传奇建筑（无论如何都应该启用）
  const requiredLegendary = ['guanxingtai', 'dayunhe', 'dayanta', 'kunmingchi', 'tiancefu'];
  
  allBuildings.forEach((building) => {
    // 传奇建筑：根据配置决定是否可用
    if (building.level === 'legendary') {
      const buildingKey = getLegendaryKey(building.id);
      
      // 必备建筑总是启用
      if (requiredLegendary.includes(buildingKey)) {
        availableBuildings[building.id] = playerCount;
        console.log(`  ✅ 必备传奇建筑: ${building.id}`);
        return;
      }
      
      // 处理传奇建筑配置
      if (legendaryConfig) {
        // 如果是数组格式：['leyouyuan', 'wanguolaizhao'] - 只启用数组中的建筑
        if (Array.isArray(legendaryConfig)) {
          if (legendaryConfig.includes(buildingKey)) {
            availableBuildings[building.id] = playerCount; // 启用
            console.log(`  ✅ 可选传奇建筑（已选）: ${building.id}`);
          } else {
            availableBuildings[building.id] = 0; // 不在列表中，禁用
            console.log(`  ❌ 可选传奇建筑（未选）: ${building.id}`);
          }
          return;
        }
        
        // 如果是对象格式：{leyouyuan: true, wanguolaizhao: false} - 根据 true/false 决定
        if (typeof legendaryConfig === 'object') {
          if (buildingKey && legendaryConfig[buildingKey] === false) {
            availableBuildings[building.id] = 0; // 明确禁用
            console.log(`  ❌ 可选传奇建筑（禁用）: ${building.id}`);
            return;
          }
          if (buildingKey && legendaryConfig[buildingKey] === true) {
            availableBuildings[building.id] = playerCount; // 明确启用
            console.log(`  ✅ 可选传奇建筑（启用）: ${building.id}`);
            return;
          }
        }
      }
      
      // 可选建筑默认不启用（如果没有在配置中）
      availableBuildings[building.id] = 0;
      console.log(`  ❌ 可选传奇建筑（默认不启用）: ${building.id}`);
    } else {
      // 普通建筑：按玩家数量比例调整（基准4人）
      const scaledQuantity = Math.ceil(building.quantity * (playerCount / 4));
      // 减去玩家初始建筑的数量
      const initialCount = initialBuildingIds.filter(id => id === building.id).length * playerCount;
      availableBuildings[building.id] = scaledQuantity - initialCount;
    }
  });

  const gameState = {
    players,
    currentPlayerIndex: 0,
    round: 1,
    treasury: 0,
    availableBuildings,
    weatherMode,
    allBuildings,
    legendaryConfig: legendaryConfig || buildingsConfig.legendaryBuildings.map(b => b.id),
    gameLog: ['游戏开始！'],
    gameEnded: false,
  };

  return gameState;
}

/**
 * 获取传奇建筑的配置键名
 */
function getLegendaryKey(buildingId) {
  const keyMap = {
    'legendary_guanxingtai': 'guanxingtai',
    'legendary_dayunhe': 'dayunhe',
    'legendary_leyouyuan': 'leyouyuan',
    'legendary_damminggong': 'damminggong',
    'legendary_tiancefu': 'tiancefu',
    'legendary_wanguolaizhao': 'wanguolaizhao',
    'legendary_jiudingshenmiao': 'jiudingshenmiao',
    'legendary_dayanta': 'dayanta',
    'legendary_kunmingchi': 'kunmingchi',
  };
  return keyMap[buildingId] || null;
}

/**
 * 投骰子
 */
function rollDice(count) {
  const dice = [];
  for (let i = 0; i < count; i++) {
    dice.push(Math.floor(Math.random() * 6) + 1);
  }

  const isDouble = count === 2 && dice[0] === dice[1];
  const total = dice.reduce((sum, d) => sum + d, 0);

  return {
    dice,
    dice1: dice[0],
    dice2: dice[1] || null,
    count,
    isDouble,
    total,
    timestamp: Date.now()
  };
}

/**
 * 翻转骰子
 */
function flipDice(diceValue) {
  return 7 - diceValue;
}

/**
 * 获取建筑配置
 */
function getBuildingConfig(buildingId) {
  const allBuildings = [
    ...buildingsConfig.basicBuildings,
    ...buildingsConfig.legendaryBuildings,
  ];
  return allBuildings.find(b => b.id === buildingId);
}

/**
 * 检查玩家是否拥有建筑
 */
function playerHasBuilding(player, buildingId) {
  return player.buildings.some(b => b.configId === buildingId);
}

/**
 * 获取玩家某属性建筑数量
 */
function getPlayerBuildingCountByElement(player, element) {
  return player.buildings.filter(building => {
    const config = getBuildingConfig(building.configId);
    return config && config.element === element;
  }).length;
}

/**
 * 获取全场某属性建筑数量
 */
function getAllBuildingCountByElement(players, element) {
  return players.reduce((sum, player) => sum + getPlayerBuildingCountByElement(player, element), 0);
}

/**
 * 检查玩家是否拥有金光罩（矿冶所）
 */
function hasGoldShield(player) {
  return playerHasBuilding(player, 'metal_intermediate_kuangyesuo');
}

/**
 * 检查玩家是否拥有大运河
 */
function hasGrandCanal(player) {
  return playerHasBuilding(player, 'legendary_dayunhe');
}

/**
 * 计算火系费用（考虑金光罩）
 */
function calculateFireCost(payer, baseCost) {
  if (hasGoldShield(payer)) {
    return Math.ceil(baseCost / 2);
  }
  return baseCost;
}

/**
 * 转移金币
 */
function transferGold(from, to, amount, gameState) {
  const actualAmount = Math.min(amount, from.gold);
  from.gold -= actualAmount;

  if (to === 'treasury') {
    gameState.treasury += actualAmount;
    return {
      actualAmount,
      description: `${from.name} 向国库支付了 ${actualAmount} 金`,
    };
  } else {
    to.gold += actualAmount;
    return {
      actualAmount,
      description: `${from.name} 向 ${to.name} 支付了 ${actualAmount} 金`,
    };
  }
}

/**
 * 处理结算（完整版 - 移植自客户端）
 */
function processSettlement(diceResult, gameState, currentPlayer, isWeatherTriggered = false) {
  const allResults = [];
  // 只有乾坤变色模式下，双子点数才会有x2倍数
  const weatherMultiplier = isWeatherTriggered && diceResult.isDouble && gameState.weatherMode === 'chaos' ? 2 : 1;

  console.log(`[结算] 骰子: ${diceResult.dice.join(', ')}, 总点数: ${diceResult.total}, 倍率: ${weatherMultiplier}x`);

  // 1. 红色响应（火系建筑）- 掷骰者向别人支付
  const fireResults = processFireBuildings(diceResult, gameState, currentPlayer, weatherMultiplier);
  allResults.push(...fireResults);

  // 2. 绿色/白色/黄色收益（木、金、土）
  const selfResults = processSelfBuildings(diceResult, gameState, currentPlayer, weatherMultiplier);
  allResults.push(...selfResults);

  // 3. 蓝色收益（水系建筑）- 所有人结算
  const waterResults = processWaterBuildings(diceResult, gameState, currentPlayer, weatherMultiplier);
  allResults.push(...waterResults);

  // 4. 检查登高远望（乐游原）
  if (diceResult.total >= 7) {
    const prestigeResults = processPrestige(gameState, currentPlayer);
    allResults.push(...prestigeResults);
  }

  // 5. 万国来朝收益
  if (playerHasBuilding(currentPlayer, 'legendary_wanguolaizhao')) {
    currentPlayer.gold += 10;
    allResults.push({
      playerId: currentPlayer.id,
      goldChange: 10,
      description: `【万国来朝】${currentPlayer.name} 获得 10 金`,
    });
  }

  // 6. 观星台收益
  if (playerHasBuilding(currentPlayer, 'legendary_guanxingtai')) {
    currentPlayer.gold += 1;
    allResults.push({
      playerId: currentPlayer.id,
      goldChange: 1,
      description: `【观星台】${currentPlayer.name} 观星收益获得 1 金`,
    });
  }

  // 7. 大雁塔被动（金系共鸣）
  if (playerHasBuilding(currentPlayer, 'legendary_dayanta')) {
    const metalCount = getPlayerBuildingCountByElement(currentPlayer, 'metal');
    if (metalCount > 0) {
      currentPlayer.gold += metalCount;
      allResults.push({
        playerId: currentPlayer.id,
        goldChange: metalCount,
        description: `【大雁塔】${currentPlayer.name} 金系共鸣获得 ${metalCount} 金`,
      });
    }
  }

  // 8. 昆明池被动（水系共鸣）
  if (playerHasBuilding(currentPlayer, 'legendary_kunmingchi')) {
    const waterCount = getPlayerBuildingCountByElement(currentPlayer, 'water');
    if (waterCount > 0) {
      currentPlayer.gold += waterCount;
      allResults.push({
        playerId: currentPlayer.id,
        goldChange: waterCount,
        description: `【昆明池】${currentPlayer.name} 碧波荡漾获得 ${waterCount} 金`,
      });
    }
  }

  console.log(`[结算] 完成，共 ${allResults.length} 条结算结果`);
  return allResults;
}

/**
 * 处理火系建筑（别人向掷骰者的火系建筑支付）
 */
function processFireBuildings(diceResult, gameState, currentPlayer, multiplier) {
  const results = [];
  const total = diceResult.total;
  
  const initialGold = currentPlayer.gold;

  // 优先处理红袖招
  const hongxiuzhaoOwners = [];
  gameState.players.forEach(owner => {
    if (owner.id === currentPlayer.id) return;
    
    owner.buildings.forEach(pb => {
      const config = getBuildingConfig(pb.configId);
      if (config?.id === 'fire_advanced_hongxiuzhao' && config.triggerNumbers.includes(total)) {
        hongxiuzhaoOwners.push(owner);
      }
    });
  });

  // 处理所有红袖招（使用初始金币计算）
  hongxiuzhaoOwners.forEach(owner => {
    const baseCost = Math.min(Math.floor(initialGold / 3), 20);
    const cost = baseCost * multiplier;
    const { actualAmount } = transferGold(currentPlayer, owner, cost, gameState);
    results.push({
      playerId: currentPlayer.id,
      goldChange: -actualAmount,
      description: `${currentPlayer.name} 向 ${owner.name} 的【红袖招】支付 ${actualAmount} 金（无视金光罩）`,
    });
    results.push({
      playerId: owner.id,
      goldChange: actualAmount,
      description: `${owner.name} 从【红袖招】收取 ${actualAmount} 金`,
    });
    
    // 天策府效果
    if (playerHasBuilding(owner, 'legendary_tiancefu')) {
      const metalCount = getPlayerBuildingCountByElement(owner, 'metal');
      const bonus = metalCount * 3;
      if (bonus > 0) {
        owner.gold += bonus;
        results.push({
          playerId: owner.id,
          goldChange: bonus,
          description: `【天策府】${owner.name} 因 ${metalCount} 个金建筑额外获得 ${bonus} 金`,
        });
      }
    }
  });

  // 处理其他火系建筑（酒肆）
  gameState.players.forEach(owner => {
    owner.buildings.forEach(pb => {
      const config = getBuildingConfig(pb.configId);
      if (!config || config.element !== 'fire') return;
      
      if (config.id === 'fire_advanced_hongxiuzhao' || config.id === 'fire_intermediate_biaoju') return;

      const triggered = config.triggerNumbers.includes(total);
      const shouldTrigger = owner.id !== currentPlayer.id && config.triggerType === 'others_roll' && triggered;

      if (!shouldTrigger) return;

      // 处理酒肆
      if (config.id === 'fire_basic_jiusi') {
        const cost = calculateFireCost(currentPlayer, 2 * multiplier);
        const { actualAmount } = transferGold(currentPlayer, owner, cost, gameState);
        results.push({
          playerId: currentPlayer.id,
          goldChange: -actualAmount,
          description: `${currentPlayer.name} 向 ${owner.name} 的【酒肆】支付 ${actualAmount} 金`,
        });
        results.push({
          playerId: owner.id,
          goldChange: actualAmount,
          description: `${owner.name} 从【酒肆】收取 ${actualAmount} 金`,
        });
        
        // 天策府效果
        if (playerHasBuilding(owner, 'legendary_tiancefu')) {
          const metalCount = getPlayerBuildingCountByElement(owner, 'metal');
          const bonus = metalCount * 3;
          if (bonus > 0) {
            owner.gold += bonus;
            results.push({
              playerId: owner.id,
              goldChange: bonus,
              description: `【天策府】${owner.name} 因 ${metalCount} 个金建筑额外获得 ${bonus} 金`,
            });
          }
        }
      }
    });
  });

  // 处理镖局（自己掷4或8）
  if (diceResult.total === 4 || diceResult.total === 8) {
    currentPlayer.buildings.forEach(pb => {
      const config = getBuildingConfig(pb.configId);
      if (config?.id === 'fire_intermediate_biaoju') {
        let totalBiaojuIncome = 0;
        
        gameState.players.forEach(target => {
          if (target.id === currentPlayer.id) return;

          const cost = 3 * multiplier;
          if (target.gold >= cost) {
            const { actualAmount } = transferGold(target, currentPlayer, cost, gameState);
            totalBiaojuIncome += actualAmount;
            results.push({
              playerId: target.id,
              goldChange: -actualAmount,
              description: `${target.name} 向 ${currentPlayer.name} 的【镖局】支付 ${actualAmount} 金`,
            });
            results.push({
              playerId: currentPlayer.id,
              goldChange: actualAmount,
              description: `${currentPlayer.name} 从【镖局】收取 ${actualAmount} 金`,
            });
          } else {
            const { actualAmount } = transferGold(target, currentPlayer, target.gold, gameState);
            totalBiaojuIncome += actualAmount;
            const shortage = cost - actualAmount;
            
            results.push({
              playerId: target.id,
              goldChange: -actualAmount,
              description: `${target.name} 向 ${currentPlayer.name} 的【镖局】支付 ${actualAmount} 金`,
            });
            results.push({
              playerId: currentPlayer.id,
              goldChange: actualAmount,
              description: `${currentPlayer.name} 从【镖局】收取 ${actualAmount} 金`,
            });

            // 烧毁建筑
            if (shortage > 0) {
              const affordableBuildings = target.buildings.filter(b => {
                const cfg = getBuildingConfig(b.configId);
                return cfg && cfg.level !== 'legendary' && cfg.cost <= shortage;
              });

              if (affordableBuildings.length > 0) {
                const randomIndex = Math.floor(Math.random() * affordableBuildings.length);
                const toBurn = affordableBuildings[randomIndex];
                const index = target.buildings.indexOf(toBurn);
                target.buildings.splice(index, 1);
                const cfg = getBuildingConfig(toBurn.configId);
                
                results.push({
                  playerId: target.id,
                  goldChange: 0,
                  description: `${target.name} 现金不足 ${shortage} 金，【${cfg?.name}】被破坏（返回牌库）`,
                });
                gameState.availableBuildings[toBurn.configId]++;
              }
            }
          }
        });
        
        // 天策府效果
        if (totalBiaojuIncome > 0 && playerHasBuilding(currentPlayer, 'legendary_tiancefu')) {
          const metalCount = getPlayerBuildingCountByElement(currentPlayer, 'metal');
          const bonus = metalCount * 3;
          if (bonus > 0) {
            currentPlayer.gold += bonus;
            results.push({
              playerId: currentPlayer.id,
              goldChange: bonus,
              description: `【天策府】${currentPlayer.name} 因 ${metalCount} 个金建筑额外获得 ${bonus} 金`,
            });
          }
        }
      }
    });
  }

  return results;
}

/**
 * 处理自己触发的建筑（木、金、土）
 */
function processSelfBuildings(diceResult, gameState, currentPlayer, multiplier) {
  const results = [];
  const total = diceResult.total;

  currentPlayer.buildings.forEach(pb => {
    const config = getBuildingConfig(pb.configId);
    if (!config || config.triggerType !== 'self_roll') return;
    
    const triggered = config.triggerNumbers.includes(total);
    if (!triggered) return;

    let goldGain = 0;
    let extraEffect = '';

    switch (config.id) {
      case 'wood_basic_sangyuan':
        goldGain = 1 * multiplier;
        break;
      case 'wood_intermediate_caoyaopu':
        goldGain = 2 * multiplier;
        break;
      case 'wood_advanced_hanlin':
        const woodCount = getPlayerBuildingCountByElement(currentPlayer, 'wood');
        goldGain = (5 + woodCount * 2) * multiplier;
        break;
      case 'metal_basic_tiejiangpu':
        goldGain = 2 * multiplier;
        break;
      case 'metal_intermediate_kuangyesuo':
        goldGain = 5 * multiplier;
        break;
      case 'metal_advanced_datangqianzhuang':
        goldGain = Math.min(Math.floor(currentPlayer.gold * 0.3), 25) * multiplier;
        const treasuryGain = Math.min(gameState.treasury, 5);
        if (treasuryGain > 0) {
          gameState.treasury -= treasuryGain;
          goldGain += treasuryGain;
          extraEffect = `，从国库获得 ${treasuryGain} 金`;
        }
        break;
      case 'earth_basic_caishichang':
        goldGain = 1 * multiplier;
        currentPlayer.taxReductionCards += 1;
        extraEffect = '，获得 1 张减税卡';
        break;
      case 'earth_intermediate_yingzaosi':
        goldGain = 3 * multiplier;
        currentPlayer.canBuyExtra = true;
        extraEffect = '，本回合可额外购买一张建筑';
        break;
      case 'earth_advanced_jitiantan':
        goldGain = 8 * multiplier;
        currentPlayer.canFreeBuilding = true;
        extraEffect = '，本回合可免费购买一张非传奇建筑';
        break;
    }

    if (goldGain > 0) {
      // 检查大运河加成 - 每回合只触发一次
      if (config.element === 'wood' && hasGrandCanal(currentPlayer) && !currentPlayer.grandCanalTriggered) {
        const waterBonus = getPlayerBuildingCountByElement(currentPlayer, 'water') * 2;
        goldGain += waterBonus;
        extraEffect += `，【大运河】水木相生额外获得 ${waterBonus} 金`;
        currentPlayer.grandCanalTriggered = true;
      }

      currentPlayer.gold += goldGain;
      results.push({
        playerId: currentPlayer.id,
        goldChange: goldGain,
        description: `${currentPlayer.name} 的【${config.name}】触发，获得 ${goldGain} 金${extraEffect}`,
      });
    } else if (extraEffect) {
      results.push({
        playerId: currentPlayer.id,
        goldChange: 0,
        description: `${currentPlayer.name} 的【${config.name}】触发${extraEffect}`,
      });
    }
  });

  return results;
}

/**
 * 处理水系建筑（所有人都可能获得收益）
 */
function processWaterBuildings(diceResult, gameState, roller, multiplier) {
  const results = [];
  const total = diceResult.total;

  gameState.players.forEach(player => {
    player.buildings.forEach(pb => {
      const config = getBuildingConfig(pb.configId);
      if (!config || config.triggerType !== 'any_roll') return;
      
      const triggered = config.triggerNumbers.includes(total);
      if (!triggered) return;

      let goldGain = 0;

      switch (config.id) {
        case 'water_basic_yuliang':
          goldGain = 1 * multiplier;
          break;
        case 'water_intermediate_yantian':
          goldGain = 2 * multiplier;
          break;
        case 'water_advanced_caoyun':
          const allWaterCount = getAllBuildingCountByElement(gameState.players, 'water');
          goldGain = (5 + allWaterCount * 1) * multiplier;
          break;
      }

      if (goldGain > 0) {
        player.gold += goldGain;
        results.push({
          playerId: player.id,
          goldChange: goldGain,
          description: `${player.name} 的【${config.name}】触发，获得 ${goldGain} 金`,
        });
      }
    });
  });

  return results;
}

/**
 * 处理威望（乐游原）
 */
function processPrestige(gameState, roller) {
  const results = [];

  gameState.players.forEach(player => {
    if (playerHasBuilding(player, 'legendary_leyouyuan')) {
      player.gold += 2;
      results.push({
        playerId: player.id,
        goldChange: 2,
        description: `【乐游原】${player.name} 因登高远望获得 2 金`,
      });
    }
  });

  return results;
}

/**
 * 购买建筑（完整版 - 移植自客户端）
 */
function purchaseBuilding(player, buildingId, gameState) {
  const config = getBuildingConfig(buildingId);
  
  if (!config) {
    return { success: false, message: '建筑不存在' };
  }

  // 检查是否有库存
  if (gameState.availableBuildings[buildingId] <= 0) {
    return { success: false, message: '该建筑已售罄' };
  }

  // 检查每人限购
  if (config.maxPerPlayer) {
    const ownedCount = player.buildings.filter(pb => pb.configId === buildingId).length;
    if (ownedCount >= config.maxPerPlayer) {
      return { success: false, message: `每人最多只能建造 ${config.maxPerPlayer} 个【${config.name}】` };
    }
  }

  // 检查升级要求
  let upgradeSourceConfig = undefined;
  let isUpgrade = false;
  if (config.requiresUpgrade && config.upgradeFrom) {
    const sourceBuilding = player.buildings.find(pb => pb.configId === config.upgradeFrom);
    if (!sourceBuilding) {
      upgradeSourceConfig = getBuildingConfig(config.upgradeFrom);
      return { success: false, message: `需要先拥有【${upgradeSourceConfig?.name}】才能升级为【${config.name}】` };
    }
    upgradeSourceConfig = getBuildingConfig(config.upgradeFrom);
    isUpgrade = true;
  }

  // 检查祭天坛免费购买（仅限非传奇建筑）
  const isFree = player.canFreeBuilding && config.level !== 'legendary';
  
  let cost = 0;
  let taxCardsToUse = 0;
  
  if (!isFree) {
    // 计算费用（考虑减税卡和升级折扣）
    cost = config.cost;
    if (isUpgrade && upgradeSourceConfig) {
      // 升级：只需支付差价
      cost -= upgradeSourceConfig.cost;
    }
    
    taxCardsToUse = Math.min(player.taxReductionCards, cost);
    cost -= taxCardsToUse;

    if (player.gold < cost) {
      return { success: false, message: `金币不足，需要 ${cost} 金` };
    }

    // 扣除金币和减税卡
    player.gold -= cost;
    player.taxReductionCards -= taxCardsToUse;
  } else {
    // 使用祭天坛免费购买，重置标记
    player.canFreeBuilding = false;
  }

  // 如果是升级，消耗源建筑
  if (isUpgrade && config.upgradeFrom) {
    const sourceIndex = player.buildings.findIndex(pb => pb.configId === config.upgradeFrom);
    if (sourceIndex !== -1) {
      player.buildings.splice(sourceIndex, 1);
      // 源建筑返回牌库
      gameState.availableBuildings[config.upgradeFrom]++;
    }
  }

  // 添加建筑
  player.buildings.push({
    configId: buildingId,
    ownerId: player.id,
  });

  // 减少库存
  gameState.availableBuildings[buildingId]--;

  // 国库税金：每次购买建筑（包括升级）时，国库+1金
  gameState.treasury += 1;

  // 特殊效果
  if (buildingId === 'legendary_guanxingtai') {
    player.diceCount = 2;
  }

  const taxInfo = taxCardsToUse > 0 ? `（使用了 ${taxCardsToUse} 张减税卡）` : '';
  const upgradeInfo = isUpgrade && upgradeSourceConfig ? `（升级自【${upgradeSourceConfig.name}】）` : '';
  const treasuryTax = '（国库+1金）';
  
  return {
    success: true,
    building: config,
    message: `成功建造【${config.name}】${upgradeInfo}，花费 ${cost} 金${taxInfo}${treasuryTax}`,
  };
}

/**
 * 计算总资产
 */
function calculateTotalAssets(player, allBuildings) {
  let total = player.gold;
  
  player.buildings.forEach(building => {
    const config = allBuildings.find(b => b.id === building.configId);
    if (config) {
      total += config.cost;
    }
  });

  return total;
}

/**
 * 检查胜利条件
 */
function checkWinCondition(gameState) {
  const targetAssets = 100; // 100金胜利

  for (const player of gameState.players) {
    const totalAssets = calculateTotalAssets(player, gameState.allBuildings);
    if (totalAssets >= targetAssets) {
      return {
        hasWinner: true,
        winner: player,
        totalAssets
      };
    }
  }

  return { hasWinner: false };
}

/**
 * 结束回合
 */
function endTurn(gameState) {
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  
  // 重置回合标记
  currentPlayer.canBuyExtra = false;
  currentPlayer.canFreeBuilding = false;
  currentPlayer.grandCanalTriggered = false;

  // 切换玩家
  const nextIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
  gameState.currentPlayerIndex = nextIndex;

  // 更新回合数
  if (nextIndex === 0) {
    gameState.round++;
  }

  return gameState;
}

module.exports = {
  initializeGame,
  rollDice,
  flipDice,
  getBuildingConfig,
  playerHasBuilding,
  getPlayerBuildingCountByElement,
  processSettlement,
  purchaseBuilding,
  calculateTotalAssets,
  checkWinCondition,
  endTurn,
};
