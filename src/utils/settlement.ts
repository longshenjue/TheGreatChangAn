import {
  GameState,
  Player,
  DiceResult,
  SettlementResult,
  BuildingConfig,
  TriggerType,
  BuildingLevel,
  ElementType,
  WeatherMode,
} from '../types/game';
import {
  getBuildingConfig,
  transferGold,
  calculateFireCost,
  hasGoldShield,
  hasGrandCanal,
  getPlayerBuildingCountByElement,
  getAllBuildingCountByElement,
  playerHasBuilding,
} from './gameEngine';

// 结算流程主函数（按照规则优先级）
export function processSettlement(
  diceResult: DiceResult,
  gameState: GameState,
  currentPlayer: Player,
  isWeatherTriggered: boolean = false
): SettlementResult[] {
  const allResults: SettlementResult[] = [];
  // 只有乾坤变色模式下，双子点数才会有x2倍数（降低后期收益避免过于变态）
  const weatherMultiplier = isWeatherTriggered && diceResult.isDouble && gameState.weatherMode === WeatherMode.CHAOS ? 2 : 1;

  // 1. 天气判定已在外部处理
  
  // 2. 红色响应（火系建筑）- 掷骰者向别人支付
  const fireResults = processFireBuildings(diceResult, gameState, currentPlayer, weatherMultiplier);
  allResults.push(...fireResults);

  // 3. 防御检查（金光罩）已在calculateFireCost中处理

  // 4. 绿色/白色/黄色收益（木、金、土）
  const selfResults = processSelfBuildings(diceResult, gameState, currentPlayer, weatherMultiplier);
  allResults.push(...selfResults);

  // 5. 蓝色收益（水系建筑）- 所有人结算
  const waterResults = processWaterBuildings(diceResult, gameState, currentPlayer, weatherMultiplier);
  allResults.push(...waterResults);

  // 6. 检查登高远望（乐游原）
  if (diceResult.total >= 7) {
    const prestigeResults = processPrestige(gameState, currentPlayer);
    allResults.push(...prestigeResults);
  }

  // 7. 万国来朝收益
  if (playerHasBuilding(currentPlayer, 'legendary_wanguolaizhao')) {
    currentPlayer.gold += 10;
    allResults.push({
      playerId: currentPlayer.id,
      goldChange: 10,
      description: `【万国来朝】${currentPlayer.name} 获得 10 金`,
    });
  }

  // 8. 观星台收益
  if (playerHasBuilding(currentPlayer, 'legendary_guanxingtai')) {
    currentPlayer.gold += 1;
    allResults.push({
      playerId: currentPlayer.id,
      goldChange: 1,
      description: `【观星台】${currentPlayer.name} 观星收益获得 1 金`,
    });
  }

  // 9. 大雁塔被动（金系共鸣）
  if (playerHasBuilding(currentPlayer, 'legendary_dayanta')) {
    const metalCount = getPlayerBuildingCountByElement(currentPlayer, ElementType.METAL);
    if (metalCount > 0) {
      currentPlayer.gold += metalCount;
      allResults.push({
        playerId: currentPlayer.id,
        goldChange: metalCount,
        description: `【大雁塔】${currentPlayer.name} 金系共鸣获得 ${metalCount} 金`,
      });
    }
  }

  // 10. 昆明池被动（水系共鸣）
  if (playerHasBuilding(currentPlayer, 'legendary_kunmingchi')) {
    const waterCount = getPlayerBuildingCountByElement(currentPlayer, ElementType.WATER);
    if (waterCount > 0) {
      currentPlayer.gold += waterCount;
      allResults.push({
        playerId: currentPlayer.id,
        goldChange: waterCount,
        description: `【昆明池】${currentPlayer.name} 碧波荡漾获得 ${waterCount} 金`,
      });
    }
  }

  return allResults;
}

// 处理火系建筑（别人向掷骰者的火系建筑支付）
function processFireBuildings(
  diceResult: DiceResult,
  gameState: GameState,
  currentPlayer: Player,
  multiplier: number
): SettlementResult[] {
  const results: SettlementResult[] = [];
  const total = diceResult.total;
  
  // 【关键修复】记录掷骰者的初始金币，用于红袖招计算
  const initialGold = currentPlayer.gold;

  // 【优先处理红袖招】先处理所有红袖招，确保每个红袖招计算时使用相同的金币基数
  const hongxiuzhaoOwners: Player[] = [];
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
    // 红袖招：收其现金的 1/3（上限 20金），无视金光罩
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
      const metalCount = getPlayerBuildingCountByElement(owner, ElementType.METAL);
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
      if (!config || config.element !== ElementType.FIRE) return;
      
      // 跳过红袖招和镖局
      if (config.id === 'fire_advanced_hongxiuzhao' || config.id === 'fire_intermediate_biaoju') return;

      const triggered = config.triggerNumbers.includes(total);
      
      const shouldTrigger =
        owner.id !== currentPlayer.id && 
        config.triggerType === TriggerType.OTHERS_ROLL && 
        triggered;

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
          const metalCount = getPlayerBuildingCountByElement(owner, ElementType.METAL);
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
        let totalBiaojuIncome = 0; // 记录镖局总收益，用于天策府效果
        
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
            // 现金不足，先收取所有现金，然后按差额烧毁建筑
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

            // 根据差额随机烧毁对应价值的建筑
            if (shortage > 0) {
              // 找到所有价值小于等于差额的建筑（排除传奇建筑）
              const affordableBuildings = target.buildings.filter(b => {
                const cfg = getBuildingConfig(b.configId);
                return cfg && cfg.level !== BuildingLevel.LEGENDARY && cfg.cost <= shortage;
              });

              if (affordableBuildings.length > 0) {
                // 随机选择一个烧毁
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
                // 建筑返回牌库
                gameState.availableBuildings[toBurn.configId]++;
              }
            }
          }
        });
        
        // 天策府效果：镖局触发掠夺后，每张金建筑额外赏3金
        if (totalBiaojuIncome > 0 && playerHasBuilding(currentPlayer, 'legendary_tiancefu')) {
          const metalCount = getPlayerBuildingCountByElement(currentPlayer, ElementType.METAL);
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

// 处理自己触发的建筑（木、金、土）
function processSelfBuildings(
  diceResult: DiceResult,
  gameState: GameState,
  currentPlayer: Player,
  multiplier: number
): SettlementResult[] {
  const results: SettlementResult[] = [];
  const total = diceResult.total;
  const dice1 = diceResult.dice1;
  const dice2 = diceResult.dice2;

  currentPlayer.buildings.forEach(pb => {
    const config = getBuildingConfig(pb.configId);
    if (!config || config.triggerType !== TriggerType.SELF_ROLL) return;
    
    // 检查是否触发：只检查总点数
    const triggered = config.triggerNumbers.includes(total);
    if (!triggered) return;

    let goldGain = 0;
    let extraEffect = '';

    // 根据不同建筑处理效果
    switch (config.id) {
      case 'wood_basic_sangyuan':
        goldGain = 1 * multiplier;
        break;
      case 'wood_intermediate_caoyaopu':
        goldGain = 2 * multiplier;
        break;
      case 'wood_advanced_hanlin':
        const woodCount = getPlayerBuildingCountByElement(currentPlayer, ElementType.WOOD);
        goldGain = (5 + woodCount * 2) * multiplier; // 基础5金 + 每张木建筑2金
        break;
      case 'metal_basic_tiejiangpu':
        goldGain = 2 * multiplier;
        break;
      case 'metal_intermediate_kuangyesuo':
        goldGain = 5 * multiplier;
        break;
      case 'metal_advanced_datangqianzhuang':
        // 新效果：现金增加30%(上限25金) + 从国库获得5金
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
        // 新效果：本回合可免费购买一张非传奇建筑 + 获得8金
        goldGain = 8 * multiplier;
        currentPlayer.canFreeBuilding = true;
        extraEffect = '，本回合可免费购买一张非传奇建筑';
        break;
    }

    if (goldGain > 0) {
      // 【修复】检查大运河加成 - 每回合只触发一次
      if (config.element === ElementType.WOOD && hasGrandCanal(currentPlayer) && !currentPlayer.grandCanalTriggered) {
        const waterBonus = getPlayerBuildingCountByElement(currentPlayer, ElementType.WATER) * 2;
        goldGain += waterBonus;
        extraEffect += `，【大运河】水木相生额外获得 ${waterBonus} 金`;
        currentPlayer.grandCanalTriggered = true; // 标记已触发
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

// 处理水系建筑（所有人都可能获得收益）
function processWaterBuildings(
  diceResult: DiceResult,
  gameState: GameState,
  roller: Player,
  multiplier: number
): SettlementResult[] {
  const results: SettlementResult[] = [];
  const total = diceResult.total;
  const dice1 = diceResult.dice1;
  const dice2 = diceResult.dice2;

  gameState.players.forEach(player => {
    player.buildings.forEach(pb => {
      const config = getBuildingConfig(pb.configId);
      if (!config || config.element !== ElementType.WATER) return;
      
      // 检查是否触发：只检查总点数
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
          const allWaterCount = getAllBuildingCountByElement(gameState.players, ElementType.WATER);
          goldGain = (5 + allWaterCount * 1) * multiplier; // 基础5金 + 全场每张水建筑1金
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

// 处理威望（乐游原）
function processPrestige(gameState: GameState, roller: Player): SettlementResult[] {
  const results: SettlementResult[] = [];

  gameState.players.forEach(player => {
    if (playerHasBuilding(player, 'legendary_leyouyuan')) {
      // 所有人（包括自己）投出7点以上，该玩家获得2金
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

// 购买建筑
export function purchaseBuilding(
  player: Player,
  buildingId: string,
  gameState: GameState
): { success: boolean; message: string } {
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

  // 【新增】检查升级要求
  let upgradeSourceConfig: BuildingConfig | undefined = undefined;
  let isUpgrade = false;
  if (config.requiresUpgrade && config.upgradeFrom) {
    // 检查玩家是否拥有对应的中级建筑
    const sourceBuilding = player.buildings.find(pb => pb.configId === config.upgradeFrom);
    if (!sourceBuilding) {
      upgradeSourceConfig = getBuildingConfig(config.upgradeFrom);
      return { success: false, message: `需要先拥有【${upgradeSourceConfig?.name}】才能升级为【${config.name}】` };
    }
    upgradeSourceConfig = getBuildingConfig(config.upgradeFrom);
    isUpgrade = true;
  }

  // 检查祭天坛免费购买（仅限非传奇建筑）
  const isFree = player.canFreeBuilding && config.level !== BuildingLevel.LEGENDARY;
  
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

  // 【新增】如果是升级，消耗源建筑
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

  // 【新增】国库税金：每次购买建筑（包括升级）时，国库+1金
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
    message: `成功建造【${config.name}】${upgradeInfo}，花费 ${cost} 金${taxInfo}${treasuryTax}`,
  };
}
