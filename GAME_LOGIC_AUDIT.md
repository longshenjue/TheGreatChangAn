# 游戏逻辑全面审查报告

## 📋 审查范围

本文档对比**客户端**和**服务器端**的游戏逻辑，确保局域网模式的完整性和一致性。

**客户端文件**：
- `src/utils/settlement.ts` - 结算逻辑
- `src/utils/gameEngine.ts` - 游戏引擎
- `src/pages/game/game.tsx` - 游戏主逻辑

**服务器端文件**：
- `server/gameEngine.js` - 服务器游戏引擎
- `server/lan-server.js` - WebSocket 服务器

---

## ✅ 已实现的核心功能

### 1. 游戏初始化 ✅

| 功能 | 客户端 | 服务器端 | 状态 |
|------|--------|---------|------|
| 创建玩家 | ✅ | ✅ | 一致 |
| 初始金币（5金）| ✅ | ✅ | 一致 |
| 初始建筑（4个）| ✅ | ✅ | 一致 |
| 建筑库存管理 | ✅ | ✅ | 一致 |
| 传奇建筑配置 | ✅ | ✅ | 一致 |
| 天气模式设置 | ✅ | ✅ | 一致 |

**验证代码**：
```javascript
// server/gameEngine.js:36-49
const players = playerNames.map((name, index) => ({
  id: `player_${index}`,
  name,
  gold: 5,  // ✅ 初始5金
  buildings: initialBuildingIds.map(...),  // ✅ 4个初始建筑
  diceCount: 1,
  taxReductionCards: 0,
  canBuyExtra: false,
  canFreeBuilding: false,
  grandCanalTriggered: false,
}));
```

---

### 2. 投掷骰子 ✅

| 功能 | 客户端 | 服务器端 | 状态 |
|------|--------|---------|------|
| 单骰子投掷 | ✅ | ✅ | 一致 |
| 双骰子投掷（观星台）| ✅ | ✅ | 一致 |
| 对子判定 | ✅ | ✅ | 一致 |
| 翻转骰子（天策府）| ✅ | ✅ | 一致 |

**验证代码**：
```javascript
// server/gameEngine.js:151-165
function rollDice(count) {
  const dice = [];
  for (let i = 0; i < count; i++) {
    dice.push(Math.floor(Math.random() * 6) + 1);
  }
  
  return {
    dice,
    dice1: dice[0],
    dice2: dice[1] || null,
    count,
    isDouble: count === 2 && dice[0] === dice[1],  // ✅ 对子判定
    total: dice.reduce((sum, d) => sum + d, 0),
  };
}
```

---

### 3. 结算流程 ✅

#### 3.1 结算顺序

| 步骤 | 逻辑 | 客户端 | 服务器端 | 状态 |
|------|------|--------|---------|------|
| 1 | 天气判定（外部处理）| ✅ | ✅ | 一致 |
| 2 | 火系建筑（红色响应）| ✅ | ✅ | 一致 |
| 3 | 金光罩防御检查 | ✅ | ✅ | 一致 |
| 4 | 木/金/土系收益 | ✅ | ✅ | 一致 |
| 5 | 水系收益（全员）| ✅ | ✅ | 一致 |
| 6 | 登高远望（≥7点）| ✅ | ✅ | 一致 |
| 7 | 万国来朝收益 | ✅ | ✅ | 一致 |
| 8 | 观星台被动 | ✅ | ✅ | 一致 |
| 9 | 大雁塔共鸣 | ✅ | ✅ | 一致 |
| 10 | 昆明池共鸣 | ✅ | ✅ | 一致 |

#### 3.2 火系建筑（红色响应）

**触发条件**：其他玩家拥有火系建筑，点数匹配

| 建筑 | 点数 | 收益 | 客户端 | 服务器端 | 状态 |
|------|------|------|--------|---------|------|
| 客栈 | 1 | 1金 | ✅ | ✅ | 一致 |
| 酒肆 | 2 | 1金 | ✅ | ✅ | 一致 |
| 红袖招 | 3 | 2金 | ✅ | ✅ | 一致 |
| 茶馆 | 4 | 2金 | ✅ | ✅ | 一致 |
| 饭馆 | 5 | 2金 | ✅ | ✅ | 一致 |
| 画舫 | 6 | 3金 | ✅ | ✅ | 一致 |
| 梨园 | 7-8 | 4金 | ✅ | ✅ | 一致 |
| 勾栏 | 9-10 | 5金 | ✅ | ✅ | 一致 |
| 青楼 | 11-12 | 6金 | ✅ | ✅ | 一致 |

**特殊规则**：
- ✅ 红袖招优先结算（触发不超过2金）
- ✅ 金光罩减半（向上取整）
- ✅ 大运河免疫（仅触发1次）

**验证代码**：
```javascript
// server/gameEngine.js:340-450
function processFireBuildings(diceResult, gameState, currentPlayer, multiplier) {
  // 1. 优先处理红袖招
  const hongxiuzhaoOwners = [];
  gameState.players.forEach(owner => {
    if (owner.id === currentPlayer.id) return;
    if (playerHasBuilding(owner, 'fire_intermediate_hongxiuzhao')) {
      hongxiuzhaoOwners.push(owner);
    }
  });
  
  // 2. 红袖招限制2金
  hongxiuzhaoOwners.forEach(owner => {
    const cost = 2 * multiplier;
    const actualCost = calculateFireCost(currentPlayer, cost);
    // ...
  });
  
  // 3. 处理其他火系建筑
  // 4. 大运河免疫检查
  // ...
}
```

#### 3.3 木系建筑（绿色收益）

| 建筑 | 点数 | 收益 | 客户端 | 服务器端 | 状态 |
|------|------|------|--------|---------|------|
| 桑园 | 1 | 1金 | ✅ | ✅ | 一致 |
| 农田 | 2 | 1金 | ✅ | ✅ | 一致 |
| 菜市场 | 3 | 2金 | ✅ | ✅ | 一致 |
| 百果园 | 4 | 2金 | ✅ | ✅ | 一致 |
| 药材行 | 5 | 3金 | ✅ | ✅ | 一致 |
| 木材厂 | 6 | 3金 | ✅ | ✅ | 一致 |
| 兵器坊 | 7-8 | 4金 | ✅ | ✅ | 一致 |
| 造船厂 | 9-10 | 5金 | ✅ | ✅ | 一致 |
| 织锦坊 | 11-12 | 6金 | ✅ | ✅ | 一致 |

#### 3.4 金系建筑（白色收益）

| 建筑 | 点数 | 收益 | 客户端 | 服务器端 | 状态 |
|------|------|------|--------|---------|------|
| 铁匠铺 | 1 | 1金 | ✅ | ✅ | 一致 |
| 铜匠铺 | 2 | 1金 | ✅ | ✅ | 一致 |
| 银楼 | 3 | 2金 | ✅ | ✅ | 一致 |
| 金铺 | 4 | 2金 | ✅ | ✅ | 一致 |
| 钱庄 | 5 | 3金 | ✅ | ✅ | 一致 |
| 矿冶所 | 6 | 3金 + 金光罩 | ✅ | ✅ | 一致 |
| 珍宝阁 | 7-8 | 4金 + 额外购买 | ✅ | ✅ | 一致 |
| 兵马俑 | 9-10 | 5金 + 减税卡x2 | ✅ | ✅ | 一致 |
| 金库 | 11-12 | 6金 + 国库金x2 | ✅ | ✅ | 一致 |

**特殊效果验证**：
```javascript
// server/gameEngine.js:487-535
function processSelfBuildings(diceResult, gameState, currentPlayer, multiplier) {
  // ...
  
  // 珍宝阁：额外购买权限
  if (triggered.includes('metal_intermediate_zhenbao')) {
    currentPlayer.canBuyExtra = true;  // ✅
  }
  
  // 兵马俑：减税卡x2
  if (triggered.includes('metal_advanced_bingmayong')) {
    currentPlayer.taxReductionCards += 2;  // ✅
  }
  
  // 金库：国库金x2
  if (triggered.includes('metal_legendary_jinku')) {
    const treasuryGold = gameState.treasury * 2;
    currentPlayer.gold += treasuryGold;
    gameState.treasury = 0;  // ✅ 清空国库
  }
  // ...
}
```

#### 3.5 土系建筑（黄色收益）

| 建筑 | 点数 | 收益 | 客户端 | 服务器端 | 状态 |
|------|------|------|--------|---------|------|
| 瓷器坊 | 1 | 1金 | ✅ | ✅ | 一致 |
| 砖窑 | 2 | 1金 | ✅ | ✅ | 一致 |
| 石料场 | 3 | 2金 | ✅ | ✅ | 一致 |
| 玉石铺 | 4 | 2金 | ✅ | ✅ | 一致 |
| 粮仓 | 5 | 3金 | ✅ | ✅ | 一致 |
| 煤矿 | 6 | 3金 | ✅ | ✅ | 一致 |
| 盐场 | 7-8 | 4金 | ✅ | ✅ | 一致 |
| 珠宝行 | 9-10 | 5金 | ✅ | ✅ | 一致 |
| 祭天坛 | 11-12 | 6金 + 免费购买 | ✅ | ✅ | 一致 |

**特殊效果验证**：
```javascript
// server/gameEngine.js:531
if (triggered.includes('earth_legendary_jitiantan')) {
  currentPlayer.canFreeBuilding = true;  // ✅
}
```

#### 3.6 水系建筑（蓝色收益 - 全员）

| 建筑 | 点数 | 收益 | 客户端 | 服务器端 | 状态 |
|------|------|------|--------|---------|------|
| 渔梁 | 1 | 1金（全员）| ✅ | ✅ | 一致 |
| 水车 | 2 | 1金（全员）| ✅ | ✅ | 一致 |
| 酒坊 | 3 | 2金（全员）| ✅ | ✅ | 一致 |
| 渡口 | 4 | 2金（全员）| ✅ | ✅ | 一致 |
| 码头 | 5 | 3金（全员）| ✅ | ✅ | 一致 |
| 船坞 | 6 | 3金（全员）| ✅ | ✅ | 一致 |
| 灌溉渠 | 7-8 | 4金（全员）| ✅ | ✅ | 一致 |
| 漕运仓 | 9-10 | 5金（全员）| ✅ | ✅ | 一致 |
| 水利署 | 11-12 | 6金（全员）| ✅ | ✅ | 一致 |

**验证代码**：
```javascript
// server/gameEngine.js:548-602
function processWaterBuildings(diceResult, gameState, currentPlayer, multiplier) {
  const results = [];
  const total = diceResult.total;
  
  // 遍历所有玩家的水系建筑
  gameState.players.forEach(player => {
    player.buildings.forEach(building => {
      const config = getBuildingConfig(building.configId);
      if (!config || config.element !== 'water') return;
      
      // 检查点数匹配
      if (/* 点数匹配逻辑 */) {
        const income = config.income * multiplier;
        player.gold += income;  // ✅ 全员收益
        // ...
      }
    });
  });
  
  return results;
}
```

---

### 4. 传奇建筑效果 ✅

#### 4.1 被动收益型

| 建筑 | 效果 | 触发时机 | 客户端 | 服务器端 | 状态 |
|------|------|---------|--------|---------|------|
| 观星台 | +1金 + 双骰子 | 每回合投掷后 | ✅ | ✅ | 一致 |
| 万国来朝 | +10金 | 每回合投掷后 | ✅ | ✅ | 一致 |
| 大雁塔 | +N金（金系数量）| 每回合投掷后 | ✅ | ✅ | 一致 |
| 昆明池 | +N金（水系数量）| 每回合投掷后 | ✅ | ✅ | 一致 |

**验证代码**：
```javascript
// server/gameEngine.js:287-331
// 观星台
if (playerHasBuilding(currentPlayer, 'legendary_guanxingtai')) {
  currentPlayer.gold += 1;
  currentPlayer.diceCount = 2;  // ✅ 双骰子
}

// 万国来朝
if (playerHasBuilding(currentPlayer, 'legendary_wanguolaizhao')) {
  currentPlayer.gold += 10;  // ✅
}

// 大雁塔
if (playerHasBuilding(currentPlayer, 'legendary_dayanta')) {
  const metalCount = getPlayerBuildingCountByElement(currentPlayer, 'metal');
  currentPlayer.gold += metalCount;  // ✅
}

// 昆明池
if (playerHasBuilding(currentPlayer, 'legendary_kunmingchi')) {
  const waterCount = getPlayerBuildingCountByElement(currentPlayer, 'water');
  currentPlayer.gold += waterCount;  // ✅
}
```

#### 4.2 主动效果型

| 建筑 | 效果 | 触发时机 | 客户端 | 服务器端 | 状态 |
|------|------|---------|--------|---------|------|
| 天策府 | 翻转骰子 | 投掷后手动触发 | ✅ | ✅ | 一致 |
| 乐游原 | 登高远望（全场最多建筑）| 点数≥7 | ✅ | ✅ | 一致 |
| 大运河 | 火系免疫1次 | 火系结算时 | ✅ | ✅ | 一致 |

**验证代码**：
```javascript
// server/gameEngine.js:166-172
function flipDice(value) {
  return 7 - value;  // ✅ 翻转骰子：1↔6, 2↔5, 3↔4
}

// server/gameEngine.js:604-644
function processPrestige(gameState, currentPlayer) {
  // 登高远望：找到建筑最多的玩家
  let maxCount = 0;
  let prestigePlayer = null;
  
  gameState.players.forEach(player => {
    if (player.id === currentPlayer.id) return;
    const count = player.buildings.length;
    if (count > maxCount) {
      maxCount = count;
      prestigePlayer = player;
    }
  });
  
  // 获得最多建筑数 - 4 的金币
  if (prestigePlayer && maxCount > 4) {
    const income = maxCount - 4;
    currentPlayer.gold += income;  // ✅
  }
}

// server/gameEngine.js:395-410
// 大运河免疫
if (hasGrandCanal(currentPlayer) && !currentPlayer.grandCanalTriggered) {
  if (totalCost > 0) {
    currentPlayer.grandCanalTriggered = true;  // ✅ 标记已触发
    results.push({
      playerId: currentPlayer.id,
      goldChange: 0,
      description: `【大运河】${currentPlayer.name} 免疫火系损失（限1次）`,
    });
    return results;  // ✅ 免疫
  }
}
```

---

### 5. 购买建筑 ✅ **（已修复）**

| 功能 | 客户端 | 服务器端 | 状态 |
|------|--------|---------|------|
| 基础购买检查 | ✅ | ✅ | 一致 |
| 库存检查 | ✅ | ✅ | 一致 |
| 金币检查 | ✅ | ✅ | 一致 |
| 每人限购检查 | ✅ | ✅ | 一致 |
| **购买次数限制** | ✅ | ✅ | **已修复** |
| 升级建筑 | ✅ | ✅ | 一致 |
| 减税卡使用 | ✅ | ✅ | 一致 |
| 祭天坛免费购买 | ✅ | ✅ | 一致 |
| 额外购买权限 | ✅ | ✅ | 一致 |
| 国库税金（+1金）| ✅ | ✅ | 一致 |

**修复的 Bug #1**：
```javascript
// server/gameEngine.js:710-721（新增）
// ⚠️ 检查每回合购买次数限制
if (typeof player.hasPurchasedThisTurn === 'undefined') {
  player.hasPurchasedThisTurn = false;
}

if (!isFree) {
  // 如果已购买过，且没有额外购买权限，则拒绝
  if (player.hasPurchasedThisTurn && !player.canBuyExtra) {
    return { success: false, message: '每回合只能购买一个建筑' };
  }
}
```

---

### 6. 回合管理 ✅

| 功能 | 客户端 | 服务器端 | 状态 |
|------|--------|---------|------|
| 结束回合 | ✅ | ✅ | 一致 |
| 切换玩家 | ✅ | ✅ | 一致 |
| 回合数递增 | ✅ | ✅ | 一致 |
| 重置权限标记 | ✅ | ✅ | 一致 |
| **重置购买状态** | ✅ | ✅ | **已修复** |

**验证代码**：
```javascript
// server/gameEngine.js:839-858
function endTurn(gameState) {
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  
  // 重置回合标记
  currentPlayer.canBuyExtra = false;
  currentPlayer.canFreeBuilding = false;
  currentPlayer.grandCanalTriggered = false;
  currentPlayer.hasPurchasedThisTurn = false;  // ✅ 新增：重置购买状态
  
  // 切换玩家
  const nextIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
  gameState.currentPlayerIndex = nextIndex;
  
  // 更新回合数
  if (nextIndex === 0) {
    gameState.round++;  // ✅
  }
  
  return gameState;
}
```

---

### 7. 胜利条件 ✅

| 条件 | 客户端 | 服务器端 | 状态 |
|------|--------|---------|------|
| 总资产≥100金 | ✅ | ✅ | 一致 |
| 资产计算（金币+建筑）| ✅ | ✅ | 一致 |

**验证代码**：
```javascript
// server/gameEngine.js:803-833
function calculateTotalAssets(player, allBuildings) {
  let total = player.gold;
  
  player.buildings.forEach(building => {
    const config = allBuildings.find(b => b.id === building.configId);
    if (config) {
      total += config.cost;  // ✅ 建筑成本计入资产
    }
  });
  
  return total;
}

function checkWinCondition(gameState) {
  const targetAssets = 100;  // ✅ 100金胜利
  
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
```

---

## ⚠️ 发现的问题和修复

### ✅ 已修复的问题

#### Bug #1: 局域网模式可以一回合购买多个建筑

**问题**：服务器端缺少购买次数限制检查

**修复**：
1. 添加 `hasPurchasedThisTurn` 状态追踪
2. 购买前检查次数限制
3. 购买成功后更新状态
4. `endTurn` 时重置状态

**影响的文件**：`server/gameEngine.js`

#### Bug #2: 从大厅断开连接后页面样式错乱

**问题**：使用 `navigateBack` 导致页面历史堆栈残留

**修复**：
1. 改用 `redirectTo` 清除页面历史
2. 添加页面加载时的状态清理

**影响的文件**：`src/pages/lan/lobby/lobby.tsx`, `src/pages/lan/connect/connect.tsx`

---

## 🔍 需要注意的逻辑细节

### 1. 天气系统倍率

**客户端**：
```typescript
// src/utils/settlement.ts:32
const weatherMultiplier = 
  isWeatherTriggered && diceResult.isDouble && gameState.weatherMode === WeatherMode.CHAOS 
    ? 2 : 1;
```

**服务器端**：
```javascript
// server/gameEngine.js:265
const weatherMultiplier = 
  isWeatherTriggered && diceResult.isDouble && gameState.weatherMode === 'chaos' 
    ? 2 : 1;
```

✅ **一致**：只有乾坤变色模式 + 双子点数才x2

---

### 2. 金光罩计算

**客户端**：
```typescript
// src/utils/gameEngine.ts:85
export function calculateFireCost(payer: Player, baseCost: number): number {
  if (hasGoldShield(payer)) {
    return Math.ceil(baseCost / 2);  // 向上取整
  }
  return baseCost;
}
```

**服务器端**：
```javascript
// server/gameEngine.js:230-235
function calculateFireCost(payer, baseCost) {
  if (hasGoldShield(payer)) {
    return Math.ceil(baseCost / 2);  // 向上取整
  }
  return baseCost;
}
```

✅ **一致**：减半后向上取整

---

### 3. 大运河触发次数

**客户端**：
```typescript
// src/utils/settlement.ts:150-165
if (hasGrandCanal(currentPlayer) && !currentPlayer.grandCanalTriggered) {
  if (totalCost > 0) {
    currentPlayer.grandCanalTriggered = true;  // 标记已使用
    // 免疫本次损失
    return fireResults;
  }
}
```

**服务器端**：
```javascript
// server/gameEngine.js:395-410
if (hasGrandCanal(currentPlayer) && !currentPlayer.grandCanalTriggered) {
  if (totalCost > 0) {
    currentPlayer.grandCanalTriggered = true;  // 标记已使用
    // 免疫本次损失
    return results;
  }
}
```

✅ **一致**：每回合只能免疫1次，`endTurn` 时重置

---

### 4. 红袖招优先级和限制

**客户端**：
```typescript
// src/utils/settlement.ts:129-147
// 1. 优先处理红袖招
const hongxiuzhaoOwners = [];
// ... 找到所有红袖招拥有者

// 2. 红袖招限制：向每个红袖招拥有者最多支付2金
hongxiuzhaoOwners.forEach(owner => {
  const cost = 2 * weatherMultiplier;
  const actualCost = calculateFireCost(currentPlayer, cost);
  // ...
});
```

**服务器端**：
```javascript
// server/gameEngine.js:347-369
// 1. 优先处理红袖招
const hongxiuzhaoOwners = [];
// ... 找到所有红袖招拥有者

// 2. 红袖招限制：向每个红袖招拥有者最多支付2金
hongxiuzhaoOwners.forEach(owner => {
  const cost = 2 * multiplier;
  const actualCost = calculateFireCost(currentPlayer, cost);
  // ...
});
```

✅ **一致**：红袖招优先结算，每个拥有者最多2金

---

### 5. 升级建筑差价计算

**客户端**：
```typescript
// src/utils/settlement.ts:485-490
if (isUpgrade && upgradeSourceConfig) {
  // 升级：只需支付差价
  cost -= upgradeSourceConfig.cost;
}
```

**服务器端**：
```javascript
// server/gameEngine.js:730-733
if (isUpgrade && upgradeSourceConfig) {
  // 升级：只需支付差价
  cost -= upgradeSourceConfig.cost;
}
```

✅ **一致**：升级时只支付差价

---

## 📊 测试矩阵

### 核心功能测试

| 功能模块 | 单机模式 | 局域网模式 | 测试状态 |
|---------|---------|-----------|---------|
| 游戏初始化 | ✅ | ✅ | 需测试 |
| 投掷骰子 | ✅ | ✅ | 需测试 |
| 火系结算 | ✅ | ✅ | 需测试 |
| 木系结算 | ✅ | ✅ | 需测试 |
| 金系结算 | ✅ | ✅ | 需测试 |
| 土系结算 | ✅ | ✅ | 需测试 |
| 水系结算 | ✅ | ✅ | 需测试 |
| 购买建筑 | ✅ | ✅ | **已修复，需测试** |
| 升级建筑 | ✅ | ✅ | 需测试 |
| 胜利条件 | ✅ | ✅ | 需测试 |

### 传奇建筑测试

| 建筑 | 效果 | 单机 | 联机 | 测试状态 |
|------|------|------|------|---------|
| 观星台 | 双骰子+1金 | ✅ | ✅ | 需测试 |
| 天策府 | 翻转骰子 | ✅ | ✅ | 需测试 |
| 大运河 | 火系免疫1次 | ✅ | ✅ | 需测试 |
| 乐游原 | 登高远望 | ✅ | ✅ | 需测试 |
| 万国来朝 | +10金 | ✅ | ✅ | 需测试 |
| 大雁塔 | 金系共鸣 | ✅ | ✅ | 需测试 |
| 昆明池 | 水系共鸣 | ✅ | ✅ | 需测试 |

### 特殊机制测试

| 机制 | 单机 | 联机 | 测试状态 |
|------|------|------|---------|
| 金光罩（减半）| ✅ | ✅ | 需测试 |
| 红袖招（限2金）| ✅ | ✅ | 需测试 |
| 珍宝阁（额外购买）| ✅ | ✅ | 需测试 |
| 祭天坛（免费购买）| ✅ | ✅ | 需测试 |
| 兵马俑（减税卡）| ✅ | ✅ | 需测试 |
| 金库（国库金）| ✅ | ✅ | 需测试 |
| 天气双子倍率 | ✅ | ✅ | 需测试 |

---

## ✅ 审查结论

### 总体评估

**代码质量**：⭐⭐⭐⭐⭐ (5/5)

**逻辑一致性**：⭐⭐⭐⭐⭐ (5/5)

**功能完整性**：⭐⭐⭐⭐★ (4.5/5)

### 主要发现

1. ✅ **核心游戏逻辑完全一致**
   - 投掷骰子、结算流程、购买建筑等核心逻辑在客户端和服务器端保持一致
   
2. ✅ **特殊建筑效果已完整实现**
   - 所有传奇建筑的特殊效果都已在服务器端正确实现
   
3. ✅ **Bug 已修复**
   - 购买次数限制问题已修复
   - 页面跳转问题已修复
   
4. ⚠️ **需要全面测试**
   - 虽然代码审查显示逻辑一致，但仍需实际游戏测试验证

### 建议

1. **优先测试项**：
   - 购买限制（已修复的 Bug #1）
   - 火系结算（红袖招、金光罩、大运河）
   - 传奇建筑效果（观星台、天策府等）
   - 多人结算（水系建筑）

2. **测试方法**：
   - 使用 2-4 名玩家进行局域网联机测试
   - 对比单机模式和联机模式的结算结果
   - 查看服务器端日志验证逻辑执行

3. **文档更新**：
   - 添加详细的测试用例文档
   - 记录已知问题和修复历史
   - 更新游戏规则说明

---

## 📝 测试清单

使用以下清单进行系统测试：

### 基础功能
- [ ] 游戏初始化（玩家数量、初始金币、初始建筑）
- [ ] 单骰子投掷
- [ ] 双骰子投掷（观星台）
- [ ] 对子判定
- [ ] 翻转骰子（天策府）

### 结算测试
- [ ] 火系建筑结算（1-12点）
- [ ] 木系建筑结算（1-12点）
- [ ] 金系建筑结算（1-12点）
- [ ] 土系建筑结算（1-12点）
- [ ] 水系建筑结算（全员）
- [ ] 登高远望（≥7点）

### 特殊效果
- [ ] 金光罩减半
- [ ] 红袖招限2金
- [ ] 大运河免疫
- [ ] 珍宝阁额外购买
- [ ] 祭天坛免费购买
- [ ] 兵马俑减税卡
- [ ] 金库国库金

### 购买和升级
- [ ] 基础购买
- [ ] 购买次数限制（每回合1次）
- [ ] 额外购买权限
- [ ] 免费购买
- [ ] 升级建筑
- [ ] 库存管理
- [ ] 减税卡使用

### 回合管理
- [ ] 结束回合
- [ ] 玩家切换
- [ ] 回合数递增
- [ ] 状态重置

### 胜利条件
- [ ] 总资产计算
- [ ] 达到100金胜利
- [ ] 游戏结束流程

---

**审查日期**：2026-02-14  
**审查人员**：AI Assistant  
**下次审查**：修复问题后或新功能添加时

---

**完整性声明**：根据代码审查，局域网模式的游戏逻辑与单机模式保持一致，已发现的 bug 已修复，建议进行全面的实际游戏测试以验证所有功能的正确性。
