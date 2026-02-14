import {
  GameState,
  Player,
  DiceResult,
  BuildingConfig,
  ElementType,
  SettlementResult,
  WeatherMode,
  PlayerBuilding,
} from '../types/game';
import buildingsData from '../config/buildings.json';
import weatherData from '../config/weather.json';

// 初始化游戏
export function initializeGame(
  playerNames: string[],
  weatherMode: WeatherMode = WeatherMode.PROSPERITY,
  legendaryConfig?: any
): GameState {
  const allBuildings = [
    ...buildingsData.basicBuildings,
    ...buildingsData.legendaryBuildings,
  ];

  // 初始建筑ID
  const initialBuildingIds = [
    'water_basic_yuliang',    // 渔梁
    'wood_basic_sangyuan',    // 桑园
    'metal_basic_tiejiangpu', // 铁匠铺
    'earth_basic_caishichang' // 采石场
  ];

  // 创建玩家（支持2-4人）
  const players: Player[] = playerNames.map((name, index) => ({
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
  const availableBuildings: { [key: string]: number } = {};
  allBuildings.forEach((building: any) => {
    // 传奇建筑：根据配置决定是否可用
    if (building.level === 'legendary') {
      const buildingKey = getLegendaryKey(building.id);
      if (legendaryConfig && buildingKey && !legendaryConfig[buildingKey]) {
        availableBuildings[building.id] = 0; // 不启用
        return;
      }
      // 传奇建筑数量等于玩家数量（每人最多一个）
      availableBuildings[building.id] = playerCount;
    } else {
      // 普通建筑：按玩家数量比例调整（基准4人）
      const scaledQuantity = Math.ceil(building.quantity * (playerCount / 4));
      // 减去玩家初始建筑的数量
      const initialCount = initialBuildingIds.filter(id => id === building.id).length * playerCount;
      availableBuildings[building.id] = scaledQuantity - initialCount;
    }
  });

  return {
    players,
    currentPlayerIndex: 0,
    treasury: 0,
    availableBuildings,
    gameLog: ['游戏开始！'],
    weatherMode,
    gameEnded: false,
  };
}

// 获取传奇建筑的配置键名
function getLegendaryKey(buildingId: string): string | null {
  const keyMap: { [key: string]: string } = {
    'legendary_guanxingtai': 'guanxingtai',
    'legendary_dayunhe': 'dayunhe',
    'legendary_leyouyuan': 'leyouyuan',
    'legendary_damminggong': 'damminggong',
    'legendary_tiancefu': 'tiancefu',
    'legendary_wanguolaizhao': 'wanguolaizhao',
    'legendary_jiudingshenmiao': 'jiudingshenmiao',
  };
  return keyMap[buildingId] || null;
}

// 投掷骰子
export function rollDice(diceCount: 1 | 2 = 1): DiceResult {
  const dice1 = Math.floor(Math.random() * 6) + 1;
  const dice2 = diceCount === 2 ? Math.floor(Math.random() * 6) + 1 : null;
  const dice = diceCount === 2 && dice2 !== null ? [dice1, dice2] : [dice1];
  const total = diceCount === 2 && dice2 !== null ? dice1 + dice2 : dice1;
  const isDouble = diceCount === 2 && dice1 === dice2;

  return { 
    dice,
    dice1, 
    dice2, 
    count: diceCount,
    total, 
    isDouble, 
    timestamp: Date.now() 
  };
}

// 翻转骰子（大明宫效果）
export function flipDice(value: number): number {
  const pairs: { [key: number]: number } = {
    1: 6, 6: 1,
    2: 5, 5: 2,
    3: 4, 4: 3,
  };
  return pairs[value] || value;
}

// 获取建筑配置
export function getBuildingConfig(buildingId: string): BuildingConfig | undefined {
  const allBuildings = [
    ...buildingsData.basicBuildings,
    ...buildingsData.legendaryBuildings,
  ];
  return allBuildings.find((b: any) => b.id === buildingId) as BuildingConfig | undefined;
}

// 获取玩家的某个属性建筑数量
export function getPlayerBuildingCountByElement(
  player: Player,
  element: ElementType
): number {
  return player.buildings.filter(pb => {
    const config = getBuildingConfig(pb.configId);
    return config?.element === element;
  }).length;
}

// 获取所有玩家的某个属性建筑总数
export function getAllBuildingCountByElement(
  players: Player[],
  element: ElementType
): number {
  return players.reduce(
    (sum, player) => sum + getPlayerBuildingCountByElement(player, element),
    0
  );
}

// 检查玩家是否拥有某个建筑
export function playerHasBuilding(player: Player, buildingId: string): boolean {
  return player.buildings.some(pb => pb.configId === buildingId);
}

// 检查玩家是否拥有金光罩（矿冶所）
export function hasGoldShield(player: Player): boolean {
  return playerHasBuilding(player, 'metal_intermediate_kuangyesuo');
}

// 检查玩家是否拥有大运河
export function hasGrandCanal(player: Player): boolean {
  return playerHasBuilding(player, 'legendary_dayunhe');
}

// 检查玩家是否拥有祭天坛
export function hasAltarOfHeaven(player: Player): boolean {
  return playerHasBuilding(player, 'earth_advanced_jitiantan');
}

// 计算火系费用（考虑金光罩）
export function calculateFireCost(payer: Player, baseCost: number): number {
  if (hasGoldShield(payer)) {
    return Math.ceil(baseCost / 2);
  }
  return baseCost;
}

// 转移金币
export function transferGold(
  from: Player,
  to: Player | 'treasury',
  amount: number,
  gameState: GameState
): { actualAmount: number; description: string } {
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

// 处理天气效果
export function processWeatherEffect(
  diceResult: DiceResult,
  gameState: GameState,
  currentPlayer: Player
): SettlementResult[] {
  const results: SettlementResult[] = [];

  if (!diceResult.isDouble || !diceResult.dice1) {
    return results;
  }

  const doubleNumber = diceResult.dice1;
  const weatherEffects =
    gameState.weatherMode === WeatherMode.PROSPERITY
      ? weatherData.prosperity
      : weatherData.chaos;

  const effect = weatherEffects.find((w: any) => w.doubleNumber === doubleNumber);
  if (!effect) return results;

  if (gameState.weatherMode === WeatherMode.PROSPERITY) {
    // 贞观盛世模式 - 基础5金 + 每张对应建筑1金
    let goldGain = 0;
    switch (doubleNumber) {
      case 1: // 甘霖
        goldGain = 5 + getPlayerBuildingCountByElement(currentPlayer, ElementType.WATER) * 1;
        break;
      case 2: // 回春
        goldGain = 5 + getPlayerBuildingCountByElement(currentPlayer, ElementType.WOOD) * 1;
        break;
      case 3: // 地灵
        goldGain = 5 + getPlayerBuildingCountByElement(currentPlayer, ElementType.EARTH) * 1;
        break;
      case 4: // 烛照
        goldGain = 5 + getPlayerBuildingCountByElement(currentPlayer, ElementType.FIRE) * 1;
        break;
      case 5: // 瑞雪
        goldGain = 5 + getPlayerBuildingCountByElement(currentPlayer, ElementType.METAL) * 1;
        break;
      case 6: // 盛世
        goldGain = 12;
        break;
    }
    currentPlayer.gold += goldGain;
    results.push({
      playerId: currentPlayer.id,
      goldChange: goldGain,
      description: `【天时·${effect.name}】${currentPlayer.name} 获得 ${goldGain} 金`,
    });
  } else {
    // 乾坤变色模式
    if (doubleNumber === 6) {
      // 日食特殊处理
      let goldGain = 10;
      if (hasAltarOfHeaven(currentPlayer)) {
        goldGain += gameState.treasury;
        gameState.treasury = 0;
        results.push({
          playerId: currentPlayer.id,
          goldChange: goldGain,
          description: `【天时·${effect.name}】${currentPlayer.name} 拥有祭天坛，获得国库全部金币！总计 ${goldGain} 金`,
        });
      } else {
        const treasuryHalf = Math.floor(gameState.treasury / 2);
        goldGain += treasuryHalf;
        gameState.treasury -= treasuryHalf;
        results.push({
          playerId: currentPlayer.id,
          goldChange: goldGain,
          description: `【天时·${effect.name}】${currentPlayer.name} 获得国库一半金币！总计 ${goldGain} 金`,
        });
      }
      currentPlayer.gold += goldGain;

      // 国祭惩罚
      gameState.players.forEach(player => {
        if (player.id !== currentPlayer.id) {
          const penalty = player.buildings.length * 1;
          const { actualAmount } = transferGold(player, 'treasury', penalty, gameState);
          results.push({
            playerId: player.id,
            goldChange: -actualAmount,
            description: `【国祭】${player.name} 向国库缴纳祭天税 ${actualAmount} 金`,
          });
        }
      });
    } else {
      // 乾坤变色：强制结算对应属性的建筑，收益x2（降低后期收益）
      const elementPairs: { [key: number]: [ElementType, ElementType] } = {
        1: [ElementType.WATER, ElementType.FIRE],
        2: [ElementType.WOOD, ElementType.EARTH],
        3: [ElementType.EARTH, ElementType.METAL],
        4: [ElementType.FIRE, ElementType.WATER],
        5: [ElementType.METAL, ElementType.WOOD],
      };

      const [resonanceElement, punishElement] = elementPairs[doubleNumber] || [];
      
      // 1. 强制结算掷骰者的对应属性建筑（x2收益）
      if (resonanceElement) {
        let totalGoldGain = 0;
        const settledBuildings: string[] = [];
        
        currentPlayer.buildings.forEach(pb => {
          const config = getBuildingConfig(pb.configId);
          if (!config || config.element !== resonanceElement.toString()) return;
          
          // 根据建筑类型计算收益（基础收益，会在后面x2）
          let baseGold = 0;
          let fireGoldAlreadyX2 = 0; // 火系建筑已经x2的收益（直接转账）
          
          switch (config.id) {
            // 水属性
            case 'water_basic_yuliang':
              baseGold = 1;
              break;
            case 'water_intermediate_yantian':
              baseGold = 2;
              break;
            case 'water_advanced_caoyun':
              baseGold = 5 + getAllBuildingCountByElement(gameState.players, ElementType.WATER) * 1; // 基础5金 + 全场每张水建筑1金
              break;
            // 木属性
            case 'wood_basic_sangyuan':
              baseGold = 1;
              break;
            case 'wood_intermediate_caoyaopu':
              baseGold = 2;
              break;
            case 'wood_advanced_hanlin':
              baseGold = 5 + getPlayerBuildingCountByElement(currentPlayer, ElementType.WOOD) * 2; // 基础5金 + 每张木建筑2金
              break;
            // 土属性
            case 'earth_basic_caishichang':
              baseGold = 1;
              // 减税卡在这里不额外处理
              break;
            case 'earth_intermediate_yingzaosi':
              baseGold = 3;
              // 额外购买权在这里不处理
              break;
            case 'earth_advanced_jitiantan':
              // 祭天坛：8金 + 免费购买（这里只计算金币，免费购买权在此不处理）
              baseGold = 8;
              break;
            // 火属性（收取别人的钱，已经包含x2倍数）
            case 'fire_basic_jiusi':
              // 酒肆：向每个别人收取 2金 * 2
              gameState.players.forEach(target => {
                if (target.id !== currentPlayer.id) {
                  const cost = calculateFireCost(target, 2 * 2);
                  const { actualAmount } = transferGold(target, currentPlayer, cost, gameState);
                  fireGoldAlreadyX2 += actualAmount;
                }
              });
              break;
            case 'fire_intermediate_biaoju':
              // 镖局：向全场每人收 3金 * 2 = 6金
              gameState.players.forEach(target => {
                if (target.id !== currentPlayer.id) {
                  const cost = 3 * 2;
                  const { actualAmount } = transferGold(target, currentPlayer, Math.min(cost, target.gold), gameState);
                  fireGoldAlreadyX2 += actualAmount;
                  // 建筑破坏逻辑暂不在这里实现，保持简单
                }
              });
              break;
            case 'fire_advanced_hongxiuzhao':
              // 红袖招：收其现金的 1/3（上限 20金）* 2，无视金光罩
              gameState.players.forEach(target => {
                if (target.id !== currentPlayer.id) {
                  const baseCost = Math.min(Math.floor(target.gold / 3), 20); // 新平衡：1/3上限20
                  const cost = baseCost * 2;
                  const { actualAmount } = transferGold(target, currentPlayer, cost, gameState);
                  fireGoldAlreadyX2 += actualAmount;
                }
              });
              break;
            // 金属性
            case 'metal_basic_tiejiangpu':
              baseGold = 2;
              break;
            case 'metal_intermediate_kuangyesuo':
              baseGold = 5;
              break;
            case 'metal_advanced_datangqianzhuang':
              // 新平衡：30%现金(上限25金)+国库5金
              baseGold = Math.min(Math.floor(currentPlayer.gold * 0.3), 25);
              const treasuryGold = Math.min(gameState.treasury, 5);
              if (treasuryGold > 0) {
                gameState.treasury -= treasuryGold;
                baseGold += treasuryGold;
              }
              break;
          }
          
          // 非火系建筑：基础收益 * 2
          if (baseGold > 0) {
            const goldGain = baseGold * 2;
            currentPlayer.gold += goldGain;
            totalGoldGain += goldGain;
            settledBuildings.push(`${config.name}(+${goldGain})`);
          }
          
          // 火系建筑：已经包含x2的收益
          if (fireGoldAlreadyX2 > 0) {
            totalGoldGain += fireGoldAlreadyX2;
            settledBuildings.push(`${config.name}(+${fireGoldAlreadyX2})`);
          }
        });
        
        if (totalGoldGain > 0) {
          results.push({
            playerId: currentPlayer.id,
            goldChange: totalGoldGain,
            description: `【天时·${effect.name}】${currentPlayer.name} 的${getElementName(resonanceElement)}建筑强制结算x2：${settledBuildings.join('、')}，共获得 ${totalGoldGain} 金`,
          });
        } else {
          results.push({
            playerId: currentPlayer.id,
            goldChange: 0,
            description: `【天时·${effect.name}】触发！但 ${currentPlayer.name} 没有${getElementName(resonanceElement)}属性建筑`,
          });
        }
      }

      // 2. 处理劫难惩罚（调整为3金/张）
      if (punishElement) {
        gameState.players.forEach(player => {
          if (player.id !== currentPlayer.id) {
            const count = getPlayerBuildingCountByElement(player, punishElement);
            if (count > 0) {
              const penalty = count * 3; // 劫难惩罚3金/张
              const { actualAmount } = transferGold(player, 'treasury', penalty, gameState);
              results.push({
                playerId: player.id,
                goldChange: -actualAmount,
                description: `【劫难】${player.name} 拥有 ${count} 张${getElementName(punishElement)}建筑，向国库缴纳 ${actualAmount} 金`,
              });
            }
          }
        });
      }
    }
  }

  return results;
}

// 获取属性中文名
export function getElementName(element: ElementType): string {
  const names = {
    [ElementType.WOOD]: '木',
    [ElementType.WATER]: '水',
    [ElementType.FIRE]: '火',
    [ElementType.METAL]: '金',
    [ElementType.EARTH]: '土',
  };
  return names[element] || '';
}

// 获取属性颜色
export function getElementColor(element: ElementType | null): string {
  if (!element) return '#999999';
  const colors = {
    [ElementType.WOOD]: '#52c41a',   // 绿色
    [ElementType.WATER]: '#1890ff',  // 蓝色
    [ElementType.FIRE]: '#f5222d',   // 红色
    [ElementType.METAL]: '#faad14',  // 金色/白色
    [ElementType.EARTH]: '#fa8c16',  // 黄色
  };
  return colors[element] || '#999999';
}

// 计算玩家总资产
export function calculateTotalAssets(player: Player): number {
  let total = player.gold;
  player.buildings.forEach(pb => {
    const config = getBuildingConfig(pb.configId);
    if (config) {
      total += config.cost;
    }
  });
  return total;
}

// 检查胜利条件
export function checkWinCondition(gameState: GameState): { hasWinner: boolean; winner?: Player } {
  for (const player of gameState.players) {
    // 九鼎神庙胜利
    if (playerHasBuilding(player, 'legendary_jiudingshenmiao')) {
      return { hasWinner: true, winner: player };
    }

    // 万国来朝胜利（当前存款99金）
    if (playerHasBuilding(player, 'legendary_wanguolaizhao')) {
      if (player.gold >= 99) {
        return { hasWinner: true, winner: player };
      }
    }
  }

  return { hasWinner: false };
}
