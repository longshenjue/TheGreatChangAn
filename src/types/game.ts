// 五行属性
export enum ElementType {
  WOOD = 'wood',    // 木
  WATER = 'water',  // 水
  FIRE = 'fire',    // 火
  METAL = 'metal',  // 金
  EARTH = 'earth'   // 土
}

// 建筑等级
export enum BuildingLevel {
  BASIC = 'basic',       // 初级
  INTERMEDIATE = 'intermediate', // 中级
  ADVANCED = 'advanced', // 高级
  LEGENDARY = 'legendary' // 传奇
}

// 触发时机
export enum TriggerType {
  SELF_ROLL = 'self_roll',      // 自己掷出
  ANY_ROLL = 'any_roll',        // 任何人掷出
  OTHERS_ROLL = 'others_roll',  // 别人掷出
  SPECIAL = 'special'           // 特殊触发
}

// 建筑配置接口
export interface BuildingConfig {
  id: string;
  name: string;
  element: ElementType | null;
  level: BuildingLevel;
  triggerNumbers: number[];  // 触发点数
  cost: number;             // 建造费用
  quantity: number;         // 数量
  triggerType: TriggerType;
  effect: string;           // 效果描述
  effectFunction?: string;  // 效果函数名
  maxPerPlayer?: number;    // 每人最多可建造数量
  passive?: boolean;        // 是否有被动效果
  requiresUpgrade?: boolean; // 是否需要升级获得
  upgradeFrom?: string;     // 升级所需的中级建筑ID
  requiresUpgradeCards?: number; // 升级所需的升级卡数量
}

// 玩家建筑
export interface PlayerBuilding {
  configId: string;
  ownerId: string;
}

// 玩家数据
export interface Player {
  id: string;
  name: string;
  gold: number;
  buildings: PlayerBuilding[];
  diceCount: number;
  taxReductionCards: number; // 减税卡数量（已废弃，保留兼容）
  upgradeCards?: number;     // 升级卡数量
  canBuyExtra: boolean;      // 本回合是否可额外购买建筑
  canFreeBuilding: boolean;  // 本回合是否可免费购买建筑（祭天坛）
  canDirectBuyAdvanced?: boolean; // 本回合是否可直接购买高级建筑（祭天坛触发）
  grandCanalTriggered?: boolean; // 大运河本回合是否已触发
}

// 天气系统模式
export enum WeatherMode {
  PROSPERITY = 'prosperity',  // 贞观盛世
  CHAOS = 'chaos'            // 乾坤变色
}

// 天气效果
export interface WeatherEffect {
  doubleNumber: number;  // 双子点数 (1-6)
  name: string;
  description: string;
  effect: string;
  punishmentDescription?: string; // 劫难描述
}

// 游戏配置
export interface GameConfig {
  initialGold: number;
  initialDiceCount: number;
  weatherMode: WeatherMode;
  buildings: BuildingConfig[];
  weatherEffects: WeatherEffect[];
  initialBuildings: string[]; // 初始建筑ID列表
}

// 游戏状态
export interface GameState {
  players: Player[];
  currentPlayerIndex: number;
  treasury: number;  // 国库金币
  availableBuildings: { [key: string]: number }; // 可用建筑及其剩余数量
  gameLog: string[];
  weatherMode: WeatherMode;
  gameEnded: boolean;
  winner?: string;
}

// 结算结果
export interface SettlementResult {
  playerId: string;
  goldChange: number;
  description: string;
}

// 骰子结果
export interface DiceResult {
  dice: number[];
  dice1: number;
  dice2?: number | null;
  count: number;
  total: number;
  isDouble: boolean;
  timestamp?: number;
}
