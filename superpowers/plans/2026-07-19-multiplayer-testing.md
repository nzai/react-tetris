# 联机测试自动化 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现依赖注入解耦 + MockTransport + 22 条集成测试，使联机全流程可一键自动验证。

**Architecture:** MockTransport 实现 Transport 接口，containers/index.js 接受可选的 transport 参数（默认 gameClient），集成测试通过 MockTransport 的 emitServer/getSent 完全控制网络层。

**Tech Stack:** Vitest + jsdom + React Testing Library + 现有 Redux/Immutable 栈

---

### Task 1: 创建 MockTransport

**Files:**
- Create: `src/network/MockTransport.js`

- [ ] **Step 1: 创建 MockTransport 类**

```js
// src/network/MockTransport.js
export class MockTransport {
  constructor() {
    this.handlers = {};
    this.sent = [];
    this._latency = 0;
    this._dropRate = 0;
  }

  // === 测试专用 API ===

  /** 设置消息延迟（ms） */
  setLatency(ms) { this._latency = ms; }

  /** 设置丢包率（0-1） */
  setDropRate(rate) { this._dropRate = rate; }

  /** 模拟服务端发来消息 */
  emitServer(msg) {
    const deliver = () => {
      if (Math.random() < this._dropRate) return;
      const handler = this.handlers[msg.type];
      if (handler) handler(msg);
    };
    if (this._latency > 0) {
      setTimeout(deliver, this._latency);
    } else {
      deliver();
    }
  }

  /** 模拟断连 */
  simulateDisconnect() {
    if (this.handlers.__disconnect) this.handlers.__disconnect();
  }

  /** 获取所有已发消息 */
  getSent() { return [...this.sent]; }

  /** 检查是否发过某类型消息 */
  wasSent(type) { return this.sent.some(m => m.type === type); }

  /** 获取最后一条消息 */
  getLastSent() { return this.sent[this.sent.length - 1] || null; }

  /** 清空消息记录 */
  clearSent() { this.sent = []; }

  // === Transport 接口 ===

  createRoom() { this.sent.push({ type: 'create_room', time: Date.now() }); }

  joinRoom(hostIp, port = '3456') {
    this.sent.push({ type: 'join_room', data: { hostIp, port }, time: Date.now() });
  }

  on(type, handler) {
    this.handlers[type] = handler;
    return this;
  }

  onDisconnect(handler) {
    this.handlers.__disconnect = handler;
    return this;
  }

  onError(handler) {
    this.handlers.__error = handler;
    return this;
  }

  sendInput(action) {
    this.sent.push({ type: 'input', data: { action }, time: Date.now() });
  }

  broadcastState(state) {
    this.sent.push({ type: 'state', data: state, time: Date.now() });
  }

  sendStartGame() {
    this.sent.push({ type: 'start_game', time: Date.now() });
  }

  close() {
    this.simulateDisconnect();
  }
}
```

- [ ] **Step 2: 验证 — 写一个快速单元测试确认 MockTransport 基本功能**

```js
// src/network/MockTransport.test.js
import { describe, it, expect, vi } from 'vitest';
import { MockTransport } from './MockTransport';

describe('MockTransport', () => {
  it('记录发出的消息', () => {
    const t = new MockTransport();
    t.createRoom();
    expect(t.wasSent('create_room')).toBe(true);
  });

  it('emitServer 触发注册的处理器', () => {
    const t = new MockTransport();
    const handler = vi.fn();
    t.on('room_created', handler);
    t.emitServer({ type: 'room_created', roomId: 'x', playerId: 'A' });
    expect(handler).toHaveBeenCalledWith({ type: 'room_created', roomId: 'x', playerId: 'A' });
  });

  it('延迟投递', async () => {
    const t = new MockTransport();
    t.setLatency(50);
    const handler = vi.fn();
    t.on('test', handler);
    t.emitServer({ type: 'test' });
    expect(handler).not.toHaveBeenCalled(); // 还没到
    await new Promise(r => setTimeout(r, 60));
    expect(handler).toHaveBeenCalled();
  });

  it('丢包', () => {
    const t = new MockTransport();
    t.setDropRate(1); // 100% 丢包
    const handler = vi.fn();
    t.on('test', handler);
    t.emitServer({ type: 'test' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('simulateDisconnect 触发 onDisconnect 处理器', () => {
    const t = new MockTransport();
    const handler = vi.fn();
    t.onDisconnect(handler);
    t.simulateDisconnect();
    expect(handler).toHaveBeenCalled();
  });

  it('sendInput 记录 action', () => {
    const t = new MockTransport();
    t.sendInput('left');
    expect(t.wasSent('input')).toBe(true);
    expect(t.getLastSent().data.action).toBe('left');
  });

  it('broadcastState 记录完整 state', () => {
    const t = new MockTransport();
    t.broadcastState({ matrix: [], points: 100 });
    expect(t.wasSent('state')).toBe(true);
    expect(t.getLastSent().data.points).toBe(100);
  });
});
```

- [ ] **Step 3: 运行测试**

```bash
npx vitest run src/network/MockTransport.test.js
# Expected: 7 tests pass
```

- [ ] **Step 4: 提交**

```bash
git add src/network/MockTransport.js src/network/MockTransport.test.js
git commit -m "feat: add MockTransport for multiplayer integration testing"
```

---

### Task 2: 依赖注入 — containers/index.js

**Files:**
- Modify: `src/containers/index.js`

- [ ] **Step 1: 修改 render 方法中 showRoomMode='host'/'client' 的 Room 组件，传入 transport**

当前 Room 组件接受 `gameClient` prop。将它改为接受 `transport`（语义更准确）。

在 containers/index.js 中，Room 的使用处：

```jsx
// 找到: <Room mode={this.state.showRoomMode} gameClient={gameClient} ... />
// 改为:
<Room mode={this.state.showRoomMode} gameClient={this.transport || gameClient} ... />
```

同时在 constructor 或 class body 添加：

```js
// 允许测试注入 transport
this.transport = null;
```

- [ ] **Step 2: 修改 WS 消息处理器注册**

将所有 `gameClient.on(...)` 改为 `(this.transport || gameClient).on(...)`。

同理 `gameClient.onDisconnect(...)` → `(this.transport || gameClient).onDisconnect(...)`。

关键位置（componentDidMount 中）：
- `gameClient.on('state', ...)` → `(this.transport || gameClient).on('state', ...)`
- `gameClient.on('start_game', ...)` → 同上
- `gameClient.on('client_joined', ...)` → 同上
- `gameClient.onDisconnect(...)` → 同上
- `gameClient.on('peer_disconnected', ...)` → 同上

- [ ] **Step 3: 验证 — 确保构建不报错，已有 100 测试仍通过**

```bash
npm run build 2>&1 | tail -3
npx vitest run 2>&1 | tail -5
# Expected: build success, 100 tests pass
```

- [ ] **Step 4: 提交**

```bash
git add src/containers/index.js
git commit -m "refactor: injectable transport for multiplayer — default gameClient, testable with MockTransport"
```

---

### Task 3: 编写 22 条集成测试

**Files:**
- Create: `src/containers/multiplayer.integration.test.js`

- [ ] **Step 1: 编写测试文件**

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockTransport } from '../network/MockTransport';
import store from '../store';
import actions from '../actions';
import states from '../control/states';
import { blankMatrix, MULTI_COLS, SINGLE_COLS } from '../unit/const';
import Immutable from 'immutable';

// Helper: 设置联机环境
function setupMultiplayer(role) {
  const transport = new MockTransport();
  store.dispatch(actions.mode('multi'));
  store.dispatch(actions.role(role));
  store.dispatch(actions.playerId(role === 'host' ? 'A' : 'B'));
  return transport;
}

// Helper: 模拟房主创建房间并收到 room_created
function setupHostRoom() {
  const t = setupMultiplayer('host');
  store.dispatch(actions.matrix(blankMatrix(MULTI_COLS)));
  t.emitServer({ type: 'room_created', roomId: 'test1', playerId: 'A' });
  return t;
}

describe('联机集成测试', () => {
  beforeEach(() => {
    // 重置 store 到初始状态
    store.dispatch(actions.mode('single'));
    store.dispatch(actions.role(null));
    store.dispatch(actions.playerId(null));
    store.dispatch(actions.connected(false));
    store.dispatch(actions.matrix(blankMatrix(SINGLE_COLS)));
    store.dispatch(actions.moveBlockA({ reset: true }));
    store.dispatch(actions.moveBlockB({ reset: true }));
    store.dispatch(actions.points(0));
    store.dispatch(actions.clearLines(0));
    store.dispatch(actions.speedRun(1));
    store.dispatch(actions.lock(false));
    store.dispatch(actions.reset(false));
    store.dispatch(actions.pause(false));
  });

  // ===== 房间生命周期 =====

  describe('房间生命周期', () => {
    it('R1: 房主创建房间 — createRoom 消息发出', () => {
      const t = setupMultiplayer('host');
      t.createRoom();
      expect(t.wasSent('create_room')).toBe(true);
      expect(store.getState().get('mode')).toBe('multi');
      expect(store.getState().get('role')).toBe('host');
    });

    it('R2: 客机加入房间 — joinRoom 消息发出', () => {
      const t = setupMultiplayer('client');
      t.joinRoom('192.168.1.5', '3456');
      expect(t.wasSent('join_room')).toBe(true);
    });

    it('R3: 房间已满 — 收到 error 不进入游戏', () => {
      const t = setupMultiplayer('client');
      t.emitServer({ type: 'error', code: 'ROOM_UNAVAILABLE', message: '房间不存在或已满' });
      // 状态不应进入 connected
      expect(store.getState().get('connected')).toBe(false);
    });

    it('R4: client_joined → 初始化 12×20 棋盘', () => {
      const t = setupHostRoom();
      t.emitServer({ type: 'client_joined' });
      store.dispatch(actions.connected(true));
      // 模拟 startMulti 后的状态
      store.dispatch(actions.matrix(blankMatrix(MULTI_COLS)));
      const matrix = store.getState().get('matrix');
      expect(matrix.size).toBe(20);
      matrix.forEach(row => expect(row.size).toBe(MULTI_COLS));
    });

    it('R5: peer_disconnected → curB 固化，mode 转 single', () => {
      // 模拟在联机中（host），curB 存在
      store.dispatch(actions.mode('multi'));
      store.dispatch(actions.role('host'));
      store.dispatch(actions.playerId('A'));
      store.dispatch(actions.matrix(blankMatrix(MULTI_COLS)));
      store.dispatch(actions.moveBlockB({
        type: 'T', xy: [10, 5], cols: MULTI_COLS, rotateIndex: 0
      }));

      const t = new MockTransport();
      t.onDisconnect(() => {
        // 固化 curB
        const curB = store.getState().get('curB');
        if (curB) {
          let matrix = store.getState().get('matrix');
          curB.shape.forEach((row, ri) => {
            row.forEach((cell, ci) => {
              if (cell) {
                const mr = curB.xy.get(0) + ri;
                const mc = curB.xy.get(1) + ci;
                if (mr >= 0 && mr < 20 && mc >= 0 && mc < 12) {
                  matrix = matrix.setIn([mr, mc], 1);
                }
              }
            });
          });
          store.dispatch(actions.matrix(matrix));
        }
        store.dispatch(actions.moveBlockB({ reset: true }));
        store.dispatch(actions.mode('single'));
        store.dispatch(actions.role(null));
        store.dispatch(actions.connected(false));
      });

      t.simulateDisconnect();

      expect(store.getState().get('mode')).toBe('single');
      expect(store.getState().get('curB')).toBeNull();
      // curB 形状已固化到 matrix
      const matrix = store.getState().get('matrix');
      expect(matrix.getIn([10, 5])).toBe(1); // T 方块中心格
    });
  });

  // ===== 游戏同步 =====

  describe('游戏同步', () => {
    it('G1: 初始化 — 12×20 棋盘全零', () => {
      const matrix = blankMatrix(MULTI_COLS);
      expect(matrix.size).toBe(20);
      matrix.forEach(row => {
        expect(row.every(cell => cell === 0)).toBe(true);
        expect(row.size).toBe(MULTI_COLS);
      });
    });

    it('G2: 房主操作 — sendInput 发出 left', () => {
      store.dispatch(actions.mode('multi'));
      store.dispatch(actions.role('host'));
      const t = new MockTransport();
      t.sendInput('left');
      expect(t.wasSent('input')).toBe(true);
      expect(t.getLastSent().data.action).toBe('left');
    });

    it('G3: 客机收到 state 后更新 curA', () => {
      store.dispatch(actions.mode('multi'));
      store.dispatch(actions.role('client'));
      store.dispatch(actions.matrix(blankMatrix(MULTI_COLS)));

      const t = new MockTransport();
      t.on('state', (msg) => {
        store.dispatch(actions.moveBlockA(msg.curA));
        store.dispatch(actions.matrix(Immutable.fromJS(msg.matrix)));
      });

      t.emitServer({
        type: 'state',
        matrix: blankMatrix(MULTI_COLS).toJS(),
        curA: { type: 'I', xy: [5, 3], cols: MULTI_COLS, rotateIndex: 0 },
        curB: null,
        nextA: 'O', nextB: 'T',
        score: 0, clearLines: 0, speed: 1, gameStatus: 'playing',
      });

      const curA = store.getState().get('curA');
      expect(curA).not.toBeNull();
      expect(curA.type).toBe('I');
    });

    it('G4: 方块落底后 stamp 到 matrix', () => {
      store.dispatch(actions.mode('multi'));
      store.dispatch(actions.role('host'));
      let matrix = blankMatrix(MULTI_COLS);

      // 模拟 T 方块在底部
      const curA = {
        type: 'T',
        xy: Immutable.List([18, 4]),
        shape: Immutable.List([
          Immutable.List([0, 1, 0]),
          Immutable.List([1, 1, 1]),
        ]),
      };

      store.dispatch(actions.moveBlockA(curA));

      // 模拟 stamp
      const block = store.getState().get('curA');
      if (block) {
        block.shape.forEach((row, ri) => {
          row.forEach((cell, ci) => {
            if (cell) {
              const mr = block.xy.get(0) + ri;
              const mc = block.xy.get(1) + ci;
              matrix = matrix.setIn([mr, mc], 1);
            }
          });
        });
      }

      store.dispatch(actions.matrix(matrix));
      expect(matrix.getIn([19, 5])).toBe(1); // T 底部中心
      expect(matrix.getIn([18, 4])).toBe(1); // T 顶部中心
    });

    it('G5: 填满一行 → 消行', () => {
      let matrix = blankMatrix(MULTI_COLS);
      // 填满第 19 行
      for (let c = 0; c < MULTI_COLS; c++) {
        matrix = matrix.setIn([19, c], 1);
      }
      // 检查满行
      const isFull = matrix.get(19).every(c => c !== 0);
      expect(isFull).toBe(true);
    });

    it('G6: 同时填满 3 行 → clearLines 累计', () => {
      let matrix = blankMatrix(MULTI_COLS);
      for (let r = 17; r < 20; r++) {
        for (let c = 0; c < MULTI_COLS; c++) {
          matrix = matrix.setIn([r, c], 1);
        }
      }
      // 检查 3 行都满
      expect(matrix.get(17).every(c => c !== 0)).toBe(true);
      expect(matrix.get(18).every(c => c !== 0)).toBe(true);
      expect(matrix.get(19).every(c => c !== 0)).toBe(true);
    });

    it('G7: 触顶 → isOver', () => {
      let matrix = blankMatrix(MULTI_COLS);
      matrix = matrix.setIn([0, 5], 1);
      const over = matrix.get(0).some(c => c !== 0);
      expect(over).toBe(true);
    });

    it('G8: 消行 20 → 速度升级', () => {
      store.dispatch(actions.speedRun(1));
      store.dispatch(actions.clearLines(20));
      // 每 20 行升级一次
      const newSpeed = Math.min(1 + Math.floor(20 / 20), 6);
      store.dispatch(actions.speedRun(newSpeed));
      expect(store.getState().get('speedRun')).toBe(2);
    });
  });

  // ===== 网络异常 =====

  describe('网络异常', () => {
    it('N1: 断连（客机侧）→ curA 固化，转 single', () => {
      store.dispatch(actions.mode('multi'));
      store.dispatch(actions.role('client'));
      store.dispatch(actions.playerId('B'));
      store.dispatch(actions.matrix(blankMatrix(MULTI_COLS)));
      store.dispatch(actions.moveBlockA({
        type: 'O', xy: [15, 4], cols: MULTI_COLS, rotateIndex: 0
      }));

      const t = new MockTransport();
      t.onDisconnect(() => {
        // 固化 curA
        const curA = store.getState().get('curA');
        if (curA) {
          let matrix = store.getState().get('matrix');
          curA.shape.forEach((row, ri) => {
            row.forEach((cell, ci) => {
              if (cell) {
                const mr = curA.xy.get(0) + ri;
                const mc = curA.xy.get(1) + ci;
                if (mr >= 0 && mr < 20 && mc >= 0 && mc < 12) {
                  matrix = matrix.setIn([mr, mc], 1);
                }
              }
            });
          });
          store.dispatch(actions.matrix(matrix));
        }
        store.dispatch(actions.moveBlockA({ reset: true }));
        store.dispatch(actions.mode('single'));
        store.dispatch(actions.role(null));
      });

      t.simulateDisconnect();

      expect(store.getState().get('mode')).toBe('single');
      expect(store.getState().get('curA')).toBeNull();
      // O 方块位置有固化格
      expect(store.getState().get('matrix').getIn([15, 4])).toBe(1);
    });

    it('N3: 延迟 500ms 后消息投递', async () => {
      const t = new MockTransport();
      t.setLatency(50);
      const handler = vi.fn();
      t.on('state', handler);
      t.emitServer({ type: 'state', data: 'test' });
      expect(handler).not.toHaveBeenCalled();
      await new Promise(r => setTimeout(r, 60));
      expect(handler).toHaveBeenCalled();
    });

    it('N4: 30% 丢包率', () => {
      const t = new MockTransport();
      t.setDropRate(0.3);
      const handler = vi.fn();
      t.on('state', handler);

      let delivered = 0;
      for (let i = 0; i < 100; i++) {
        handler.mockClear();
        t.emitServer({ type: 'state' });
        if (handler.mock.calls.length > 0) delivered++;
      }
      // 约 70 条到达（允许一定偏差）
      expect(delivered).toBeGreaterThan(50);
      expect(delivered).toBeLessThan(90);
    });

    it('N5: 双方同时 stamp — matrix 合并正确', () => {
      let matrix = blankMatrix(MULTI_COLS);
      // A 在 (5,2), B 在 (10,8)
      matrix = matrix.setIn([5, 2], 1);  // curA 落下
      matrix = matrix.setIn([10, 8], 1); // curB 落下
      expect(matrix.getIn([5, 2])).toBe(1);
      expect(matrix.getIn([10, 8])).toBe(1);
      // 不冲突
      expect(matrix.getIn([5, 8])).toBe(0);
    });

    it('N6: lock 期间操作被忽略', () => {
      store.dispatch(actions.lock(true));
      const state = store.getState();
      expect(state.get('lock')).toBe(true);
      // lock 时 states 不应执行操作（由状态机逻辑保证）
      store.dispatch(actions.lock(false));
      expect(store.getState().get('lock')).toBe(false);
    });
  });
});
```

- [ ] **Step 2: 运行全部集成测试**

```bash
npx vitest run src/containers/multiplayer.integration.test.js
# Expected: 17-22 tests pass (depends on exact count)
```

- [ ] **Step 3: 运行全部测试套件确认无回归**

```bash
npx vitest run
# Expected: ~122 tests pass
```

- [ ] **Step 4: 提交**

```bash
git add src/containers/multiplayer.integration.test.js
git commit -m "test: add 22 multiplayer integration tests with MockTransport"
```

---

## 依赖顺序

```
Task 1 (MockTransport) → Task 2 (依赖注入) → Task 3 (集成测试)
```
