# 联机双人模式 — 自动化测试设计

> 日期：2026-07-19 | 目标：消除手动测试，实现一键验证联机全流程

---

## 1. 动机

当前联机功能的验证完全依赖手动操作：启动两个浏览器、分别点击、手动输入、观察结果。每个改动需要 5-10 分钟手动验证，效率极低且容易遗漏边界情况。

**目标**：`npm test` 一键运行，3 秒内验证所有联机路径。

---

## 2. 架构：依赖注入解耦

### 2.1 问题

`src/containers/index.js` 直接引用全局单例 `gameClient`：

```js
import { gameClient } from '../network/client';
// ...
gameClient.createRoom();
gameClient.on('room_created', (msg) => { ... });
```

这种硬编码导致：
- 无法替换网络层
- 无法模拟延迟/丢包/断连
- 测试必须启动真实 WS 服务端

### 2.2 方案：Transport 接口 + 依赖注入

将 `gameClient` 作为可注入的依赖，默认使用真实 WebSocket，测试时注入 MockTransport。

**Transport 接口**（即 `gameClient` 已有的公开方法）：

```
createRoom()
joinRoom(hostIp, port)
on(type, handler) → this
onDisconnect(handler) → this
sendInput(action)
broadcastState(state)
sendStartGame()
close()
```

**两个实现**：
- `GameClient`（已有，`src/network/client.js`）—— 真实 WebSocket
- `MockTransport`（新增）—— 内存模拟，完全可控

### 2.3 改动范围

| 文件 | 改动 |
|------|------|
| `src/containers/index.js` | `gameClient` 引用改为可注入的 `this.transport` |
| `src/network/MockTransport.js` | **新增** — 模拟网络层 |
| `src/components/room/index.js` | `gameClient` 引用改为 props 传入（已支持） |

**向后兼容**：不传 transport 时默认使用 `gameClient`，生产代码路径零改动。

---

## 3. MockTransport 设计

```js
class MockTransport {
  handlers = {}        // 消息处理器注册表
  sent = []            // 发出的消息记录
  _latency = 0         // 模拟延迟（ms）
  _dropRate = 0        // 丢包率 0-1
  _autoRespond = true  // 是否自动回复

  // === 测试专用 API ===
  setLatency(ms)           // 设置消息延迟
  setDropRate(rate)        // 设置丢包率
  simulateDisconnect()     // 模拟断连
  emitServer(message)      // 模拟服务端发消息
  getSent()                // 获取所有已发消息
  wasSent(type)            // 检查是否发过某类型消息
  getLastSent()            // 获取最后一条消息
  clearSent()              // 清空消息记录

  // === Transport 接口 ===
  createRoom()             // 记录 'create_room'
  joinRoom(hostIp, port)   // 记录 'join_room'
  on(type, handler)        // 注册处理器
  onDisconnect(handler)    // 注册断连处理器
  sendInput(action)        // 记录 'input'
  broadcastState(state)    // 记录 'state'
  sendStartGame()          // 记录 'start_game'
  close()                  // 触发断连处理器
}
```

### 关键行为

**延迟模拟**：`emitServer(msg)` 不立即投递，按 `_latency` 延迟后投递：

```js
emitServer(msg) {
  const deliver = () => {
    if (Math.random() < this._dropRate) return; // 丢包
    const handler = this.handlers[msg.type];
    if (handler) handler(msg);
  };
  if (this._latency > 0) {
    setTimeout(deliver, this._latency);
  } else {
    deliver();
  }
}
```

**消息记录**：每次 `_send` 调用都推入 `sent` 数组，包含 `{ type, data, time }`。测试可断言：

```js
expect(transport.wasSent('create_room')).toBe(true);
expect(transport.getLastSent().type).toBe('input');
```

---

## 4. 测试分层

### 4.1 现有（100 tests）

| 层 | 文件 | 数量 | 说明 |
|----|------|------|------|
| 单元 | `unit/const.test.js` | 11 | 棋盘参数化 |
| 单元 | `unit/index.test.js` | 21 | 碰撞/消行/结束检测 |
| 单元 | `unit/block.test.js` | 17 | Block spawn + 移动 |
| 单元 | `network/protocol.test.js` | 9 | 消息协议常量 |
| 单元 | `reducers/multiplayer.test.js` | 25 | Redux 状态转换 |
| 组件 | `components/mode-select/` | 5 | 模式选择 UI |
| 组件 | `components/room/` | 12 | 房间 UI + QR |

### 4.2 新增集成测试（22 tests）

**文件**：`src/containers/multiplayer.integration.test.js`

使用 `MockTransport` + 真实 Redux store + states 状态机，**无需浏览器**。

#### 房间生命周期（5）

| # | 测试 | 验证点 |
|---|------|--------|
| R1 | 房主创建房间 | `transport.wasSent('create_room')`，收到 `room_created` 后 mode='multi', role='host' |
| R2 | 客机加入房间 | `transport.wasSent('join_room')`，收到 `joined` 后 role='client', playerId='B' |
| R3 | 房间已满拒绝 | 收到 `error(ROOM_UNAVAILABLE)`，状态保持不进入游戏 |
| R4 | client_joined → 进入游戏 | 房主收到 `client_joined` → startMulti → 12×20 matrix 生成 |
| R5 | peer_disconnected → 转单机 | 客机收到 `peer_disconnected` → mode='single'，对手方块固化 |

#### 游戏同步（8）

| # | 测试 | 验证点 |
|---|------|--------|
| G1 | 游戏初始化 | matrix 12×20 全零，curA/curB 在居中位置，nextA/nextB 已生成 |
| G2 | 房主操作 curA 左移 | transport 发出 `input`，然后 emit state 中 curA.xy[1] -= 1 |
| G3 | curA 自动下落 | states.autoMulti tick 后 curA.xy[0] += 1 |
| G4 | curA 落底 → stamp | matrix 对应 cell 变 1，新 curA 从 nextA 生成，nextA 更新 |
| G5 | 消行 | 填满一行 12 格 → clearLines += 1，分数增加 |
| G6 | 消多行 | 同时填满 3 行 → clearLines += 3，分数按 clearPoints[2]=700 |
| G7 | 一方触顶 → Game Over | isOver(matrix) true → reset=true，双方停止 |
| G8 | 速度升级 | 消行达到 eachLines(20) → speedRun += 1 |

#### 网络异常（6）

| # | 测试 | 验证点 |
|---|------|--------|
| N1 | 断连（房主侧） | transport.onDisconnect 触发 → curB 固化到 matrix，mode='single' |
| N2 | 断连（客机侧） | curA 固化，客机转 single 继续 12×20 |
| N3 | 500ms 延迟 | `transport.setLatency(500)` → 操作到 state 回传 ≥ 500ms，最终一致 |
| N4 | 30% 丢包 | `transport.setDropRate(0.3)` → 部分 state 丢失，下一条到达后恢复一致 |
| N5 | 竞态：双方同时消行 | 两个 stamp 后 matrix 合并正确，clearLines 累计 |
| N6 | 竞态：一方落底时另一方操作 | lock=true 期间操作被忽略，lock 释放后操作生效 |

#### 组件交互（3）

| # | 测试 | 验证点 |
|---|------|--------|
| C1 | Room host 收到 room_created | canvas 渲染二维码，joinUrl 显示 |
| C2 | Room client 收到 joined | onStart('B') 被调用 |
| C3 | 断开 toast | 断连后显示 toast，3 秒后消失 |

---

## 5. Playwright E2E（可选，后续迭代）

集成测试覆盖了所有逻辑路径。Playwright E2E 作为**补充**，验证真实浏览器中的完整流程（双标签页 + 真实 WS）：

- 两个 browser context 模拟两个玩家
- Page 1 创建房间 → 获取 joinUrl
- Page 2 导航到 joinUrl → 自动加入
- 双方操作、验证渲染一致性

Playwright E2E 属于"锦上添花"，22 条集成测试已覆盖 90% 的手动测试场景。**Playwright 不在当前交付范围内。**

---

## 6. 文件清单

| 文件 | 操作 |
|------|------|
| `src/network/MockTransport.js` | **新增** |
| `src/containers/index.js` | **修改**：gameClient → transport 可注入 |
| `src/containers/multiplayer.integration.test.js` | **新增**：22 条集成测试 |
| `package.json` | vitest 配置已就绪，无需改动 |
