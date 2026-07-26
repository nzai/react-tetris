# 局域网双人模式 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 react-tetris 增加局域网双人联机模式——房主 WebSocket 架构，12×20 共享棋盘，二维码房间发现。

**Architecture:** 新增 `server/index.js`（WS 中继），新增 `src/network/`（客户端协议），参数化棋盘宽度（10→12），Redux 扩展双 Block 状态（curA/curB），复用现有状态机改为双方块驱动。单机模式代码路径完全不变。

**Tech Stack:** React 18, Redux 4, Immutable.js, Vite 6, Less, ws (Node.js), qrcode (browser)

---

## 文件结构

```
新增:
  server/index.js                          # WS 中继 + 生产静态服务
  src/network/
    protocol.js                            # 消息类型常量 + 序列化
    client.js                              # WebSocket 客户端封装
  src/components/mode-select/
    index.js                               # 模式选择页
    index.module.less
  src/components/room/
    index.js                               # 创建/加入房间页
    index.module.less

修改:
  package.json                             # 依赖 + 脚本
  vite.config.js                           # /ws 代理
  src/unit/const.js                        # 导出 COLS，参数化矩阵生成
  src/unit/block.js                        # spawn 位置适配 cols
  src/unit/index.js                        # want()/isClear()/isOver() 接受 cols
  src/unit/reducerType.js                  # 新增 action types
  src/actions/index.js                     # 新增联机 actions
  src/reducers/index.js                    # 新增 mode/role/playerId/curA/curB/nextA/nextB
  src/control/states.js                    # curA + curB 双方块状态机
  src/control/todo/left.js                 # playerId 路由
  src/control/todo/right.js                # playerId 路由
  src/control/todo/rotate.js               # playerId 路由
  src/control/todo/down.js                 # playerId 路由
  src/control/todo/space.js                # playerId 路由
  src/control/index.js                     # 键盘事件 playerId 路由
  src/components/matrix/index.js           # 可变列数 + 双 Block 渲染
  src/components/matrix/index.module.less  # 动态宽度
  src/components/next/index.js             # playerId 区分渲染
  src/containers/index.js                  # 模式路由 + 双人布局 + WS 生命周期
  src/containers/index.module.less         # 12 列 CSS + 双人 topBar
```

---

### Task 1: 安装依赖 + 服务端搭建

**Files:**
- Modify: `package.json`
- Create: `server/index.js`
- Modify: `vite.config.js`

- [ ] **Step 1: 安装新依赖**

```bash
cd /c/pp/react-tetris && npm install ws@^8 qrcode@^1
```

- [ ] **Step 2: 创建 `server/index.js`**

```js
const { WebSocketServer } = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3456;

// 尝试提供静态文件（生产环境），失败则仅作 WS 中继（开发环境）
const distPath = path.join(__dirname, '..', 'dist');
const hasDist = fs.existsSync(distPath);

const server = http.createServer((req, res) => {
  if (!hasDist) { res.writeHead(404); res.end(); return; }
  // 简易静态服务
  let filePath = path.join(distPath, req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath);
  const mime = { '.html':'text/html','.js':'text/javascript','.css':'text/css',
    '.png':'image/png','.jpg':'image/jpeg','.mp3':'audio/mpeg','.svg':'image/svg+xml' };
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime[ext] || 'text/plain' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });

let room = null; // { host: ws, client: ws | null, roomId: string }

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }

    switch (msg.type) {
      case 'create_room': {
        const roomId = Math.random().toString(36).slice(2, 8);
        room = { host: ws, client: null, roomId };
        ws.playerId = 'A';
        ws.send(JSON.stringify({ type: 'room_created', roomId, playerId: 'A' }));
        break;
      }
      case 'join_room': {
        if (!room || room.client) {
          ws.send(JSON.stringify({ type: 'error', code: 'ROOM_UNAVAILABLE', message: '房间不存在或已满' }));
          return;
        }
        room.client = ws;
        ws.playerId = 'B';
        ws.send(JSON.stringify({ type: 'joined', roomId: room.roomId, playerId: 'B' }));
        room.host.send(JSON.stringify({ type: 'client_joined' }));
        break;
      }
      case 'input': {
        const target = ws.playerId === 'A' ? room?.client : room?.host;
        if (target) target.send(JSON.stringify({ type: 'input', action: msg.action, playerId: ws.playerId }));
        break;
      }
      case 'state': {
        // Host broadcasts state to client
        if (room?.client && ws.playerId === 'A') {
          room.client.send(JSON.stringify({ type: 'state', ...msg }));
        }
        break;
      }
      case 'start_game': {
        if (room?.client) room.client.send(JSON.stringify({ type: 'start_game' }));
        break;
      }
    }
  });

  ws.on('close', () => {
    if (room?.host === ws) {
      if (room.client) room.client.send(JSON.stringify({ type: 'peer_disconnected' }));
      room = null;
    } else if (room?.client === ws) {
      if (room.host) room.host.send(JSON.stringify({ type: 'peer_disconnected' }));
      room.client = null;
    }
  });
});

server.listen(PORT, () => {
  console.log(`[tetris-server] WS + static on http://localhost:${PORT}`);
});
```

- [ ] **Step 3: 修改 `package.json` — 添加 server 脚本**

在 `package.json` 的 `scripts` 中增加：

```json
"server": "node server/index.js",
```

同时修改 `start` 脚本，让 dev 时并行启动 Vite + WS server。安装 `concurrently`：

```bash
npm install -D concurrently@^8
```

然后修改 `start`：

```json
"start": "concurrently \"vite\" \"node server/index.js\"",
```

- [ ] **Step 4: 修改 `vite.config.js` — 开发代理**

在 `vite.config.js` 的 `defineConfig` 返回对象中，已有 `plugins` 和 `esbuild`。添加 `server.proxy`：

```js
export default defineConfig({
  define: {
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  plugins: [react({ include: '**/*.{js,jsx}' })],
  esbuild: {
    loader: 'jsx',
    include: /.*\.js$/,
    exclude: [],
  },
  server: {
    proxy: {
      '/ws': {
        target: 'ws://localhost:3456',
        ws: true,
      },
    },
  },
  // ... 其余不变
});
```

- [ ] **Step 5: 测试服务端启动**

```bash
node server/index.js
# 预期输出: [tetris-server] WS + static on http://localhost:3456
# Ctrl+C 停止
```

- [ ] **Step 6: 提交**

```bash
git add package.json package-lock.json server/ vite.config.js
git commit -m "feat: add WebSocket server + ws/qrcode deps"
```

---

### Task 2: 参数化棋盘宽度

**Files:**
- Modify: `src/unit/const.js`
- Modify: `src/unit/index.js`
- Modify: `src/unit/block.js`

- [ ] **Step 1: 修改 `src/unit/const.js` — 导出 COLS 常量**

在文件顶部（`blankLine` / `blankMatrix` 定义之前）添加：

```js
// 棋盘尺寸
export const SINGLE_COLS = 10;
export const MULTI_COLS = 12;
export const ROWS = 20;
```

然后修改 `blankLine` 和 `blankMatrix` 为函数形式：

```js
// 原有: export const blankLine = [0,0,0,0,0,0,0,0,0,0];
// 改为:
export const blankLine = (cols = SINGLE_COLS) => new Array(cols).fill(0);

// 原有: export const blankMatrix = ... (Immutable List of 20 blankLines)
// 改为:
export const blankMatrix = (cols = SINGLE_COLS) => {
  const line = blankLine(cols);
  return Immutable.List(Array(ROWS).fill(null).map(() => Immutable.List(line)));
};
```

同时修改 `fillLine`：

```js
// 原有: export const fillLine = [1,1,1,1,1,1,1,1,1,1];
// 改为:
export const fillLine = (cols = SINGLE_COLS) => new Array(cols).fill(1);
```

**重要：** 现有代码中所有引用 `blankMatrix`（无参数调用）的地方保持兼容——默认 `SINGLE_COLS=10`。

- [ ] **Step 2: 修改 `src/unit/index.js` — want() 参数化**

`want` 函数硬编码了 `10`（右边界）和 `20`（底部）。修改为接受 `cols` 参数：

```js
// 原函数签名: export const want = (next, matrix) => {
// 改为:
export const want = (next, matrix, cols = 10) => {
  const xy = next.xy;
  const shape = next.shape;
  const w = shape[0].length;     // 方块自身宽度
  const h = shape.length;        // 方块自身高度

  // 左边界
  if (xy[1] < 0) return false;
  // 右边界 — 用 cols 替代 10
  if (xy[1] + w > cols) return false;

  // 行检查
  for (let r = 0; r < h; r++) {
    const row = xy[0] + r;
    // 顶部（允许负行）
    if (row < 0) continue;
    // 底部 — 用 ROWS 替代 20 (需要从 const 导入或使用 matrix.size)
    if (row >= matrix.size) return false;
    for (let c = 0; c < w; c++) {
      if (shape[r][c] && matrix.get(row).get(xy[1] + c)) {
        return false;
      }
    }
  }
  return true;
};
```

同样修改 `isClear`（行满判断依赖行宽）和 `isOver`：

```js
// isClear: 需要知道行宽来判断是否满行
export const isClear = (matrix, cols = 10) => {
  const clearLines = [];
  matrix.forEach((row, idx) => {
    if (row.every(cell => cell !== 0)) clearLines.push(idx);
  });
  return clearLines.length ? clearLines : false;
};
// isOver 逻辑不变（只检查 row 0 是否有方块，不依赖列数）
```

> **注意：** 文件顶部需从 `const.js` 导入 `ROWS`（如果还没导入的话）。

- [ ] **Step 3: 修改 `src/unit/block.js` — spawn 位置适配 cols**

`Block` 类的 spawn 位置目前硬编码 `xy: [0, 3]`（I）和 `xy: [0, 4]`（其他）。改为根据 `cols` 居中：

```js
class Block {
  constructor(option) {
    this.type = option.type;
    // 根据类型计算初始列偏移，使方块在 cols 宽度中居中
    const cols = option.cols || 10;
    const shapeWidth = blockShape[option.type][0].length;
    const colOffset = Math.floor((cols - shapeWidth) / 2);
    this.xy = option.xy || [0, colOffset];  // 允许 option.xy 覆盖
    // ... 其余不变
  }
}
```

- [ ] **Step 4: 验证 — 启动单机模式确保未破坏现有功能**

```bash
npm start
# 打开浏览器，确认 10×20 单机游戏正常运行：方块居中、碰撞正常、消行正常
```

- [ ] **Step 5: 提交**

```bash
git add src/unit/const.js src/unit/index.js src/unit/block.js
git commit -m "refactor: parameterize board width for multiplayer support"
```

---

### Task 3: Matrix 组件支持可变列数

**Files:**
- Modify: `src/components/matrix/index.js`
- Modify: `src/components/matrix/index.module.less`

- [ ] **Step 1: 修改 `src/components/matrix/index.js` — 接受 cols prop**

```js
// 添加 propTypes
Matrix.propTypes = {
  matrix: propTypes.object.isRequired,
  cur: propTypes.object,          // 单人模式仍用 cur
  curA: propTypes.object,         // 双人模式 — 玩家A
  curB: propTypes.object,         // 双人模式 — 玩家B
  reset: propTypes.bool.isRequired,
  ghost: propTypes.bool,
  cols: propTypes.number,         // 新增：列数（默认 10）
};

Matrix.defaultProps = {
  cols: 10,
};
```

修改 `getResult()` 方法，同时处理 `cur`（单人）和 `curA`/`curB`（双人）：

在 getResult 中，当前逻辑是遍历 `cur.shape` 并映射到 matrix。改为：

```js
getResult() {
  const { matrix, cur, curA, curB, cols } = this.props;
  // ... clearLines 动画逻辑不变 ...

  // 收集需要叠加的方块列表
  const blocks = [];
  if (cur) blocks.push({ block: cur, color: 1 });           // 单人 — 黑色
  if (curA) blocks.push({ block: curA, color: 4 });          // 玩家A — 颜色值4（CSS class区分）
  if (curB) blocks.push({ block: curB, color: 5 });          // 玩家B — 颜色值5

  // 复制 matrix
  let result = matrix.toJS().map(row => [...row]);

  blocks.forEach(({ block, color }) => {
    const xy = block.xy;
    block.shape.forEach((row, ri) => {
      row.forEach((cell, ci) => {
        if (cell) {
          const mr = xy[0] + ri;
          const mc = xy[1] + ci;
          if (mr >= 0 && mr < 20 && mc >= 0 && mc < cols) {
            result[mr][mc] = result[mr][mc] ? 2 : color;  // 重叠为2(红色)
          }
        }
      });
    });
  });

  // ghost 逻辑：分别处理单人 cur 和双人 curA/curB 的 ghost
  // ... (类似上述)

  return result;
}
```

渲染时使用 `cols` prop 控制 `<p>` 标签宽度：

```js
// 每个 <p> 行: width = cols * 42
const rowStyle = { width: cols * 42, height: 42 };
```

- [ ] **Step 2: 修改 `src/components/matrix/index.module.less` — 动态宽度**

不再硬编码 `width: 428px`，改为通过 inline style 控制。保留 border/padding：

```less
.matrix {
  border: 2px solid #000;
  padding: 3px 1px 1px 3px;
  // width 由 inline style 控制
  p {
    height: 42px;
    // width 由 inline style 控制
  }
}
```

- [ ] **Step 3: 添加 CSS 类支持玩家A/B 颜色**

在 `src/containers/index.module.less` 的 `b` 样式中，新增两种颜色：

```less
&.p1 {  // 玩家A — 红色系
  border-color: #c0392b;
  &:after { background: #e74c3c; }
}
&.p2 {  // 玩家B — 蓝色系
  border-color: #2980b9;
  &:after { background: #3498db; }
}
```

Matrix 组件中根据 color 值 (4→`p1`, 5→`p2`) 添加对应的 CSS class。

- [ ] **Step 4: 验证 10 列单机渲染**

```bash
npm start
# 确认单机模式下 Matrix 正常渲染 10 列
```

- [ ] **Step 5: 提交**

```bash
git add src/components/matrix/ src/containers/index.module.less
git commit -m "feat: Matrix component supports variable columns + dual block rendering"
```

---

### Task 4: Redux 双人状态扩展

**Files:**
- Modify: `src/unit/reducerType.js`
- Modify: `src/actions/index.js`
- Create: `src/reducers/mode.js`
- Create: `src/reducers/role.js`
- Create: `src/reducers/connected.js`
- Create: `src/reducers/playerId.js`
- Create: `src/reducers/curA.js`
- Create: `src/reducers/curB.js`
- Create: `src/reducers/nextA.js`
- Create: `src/reducers/nextB.js`
- Modify: `src/reducers/index.js`

- [ ] **Step 1: 添加 action types — `src/unit/reducerType.js`**

在现有常量后追加：

```js
export const MODE = 'MODE';
export const ROLE = 'ROLE';
export const CONNECTED = 'CONNECTED';
export const PLAYER_ID = 'PLAYER_ID';
export const MOVE_BLOCK_A = 'MOVE_BLOCK_A';
export const MOVE_BLOCK_B = 'MOVE_BLOCK_B';
export const NEXT_BLOCK_A = 'NEXT_BLOCK_A';
export const NEXT_BLOCK_B = 'NEXT_BLOCK_B';
```

- [ ] **Step 2: 添加 actions — `src/actions/index.js`**

在现有 action 对象中追加：

```js
mode: (data) => ({ type: reducerType.MODE, data }),
role: (data) => ({ type: reducerType.ROLE, data }),
connected: (data) => ({ type: reducerType.CONNECTED, data }),
playerId: (data) => ({ type: reducerType.PLAYER_ID, data }),
moveBlockA: (option) => ({ type: reducerType.MOVE_BLOCK_A, data: option }),
moveBlockB: (option) => ({ type: reducerType.MOVE_BLOCK_B, data: option }),
nextBlockA: (data) => ({ type: reducerType.NEXT_BLOCK_A, data }),
nextBlockB: (data) => ({ type: reducerType.NEXT_BLOCK_B, data }),
```

- [ ] **Step 3: 创建新 reducers**

每个文件都是标准 Immutable reducer 模式。以 `src/reducers/mode.js` 为例：

```js
import { MODE } from '../unit/reducerType';
import { Map } from 'immutable';

const initialState = 'single';  // 默认单机

export default function mode(state = initialState, action) {
  switch (action.type) {
    case MODE:
      return action.data;
    default:
      return state;
  }
}
```

类似创建 `role.js`（初始 `null`）、`connected.js`（初始 `false`）、`playerId.js`（初始 `null`）。

`curA.js` 和 `curB.js` 复用现有 `cur.js` 的逻辑，只是 action type 不同：

```js
// src/reducers/curA.js
import { MOVE_BLOCK_A } from '../unit/reducerType';
import Block from '../unit/block';
import { Map } from 'immutable';

const initialState = null;

export default function curA(state = initialState, action) {
  switch (action.type) {
    case MOVE_BLOCK_A:
      return action.data.reset ? null : new Block(action.data);
    default:
      return state;
  }
}
```

`curB.js` 同理（使用 `MOVE_BLOCK_B`）。

`nextA.js` 和 `nextB.js`：

```js
// src/reducers/nextA.js
import { NEXT_BLOCK_A } from '../unit/reducerType';
import { getNextType } from '../unit';
import { Map } from 'immutable';

const initialState = getNextType();

export default function nextA(state = initialState, action) {
  switch (action.type) {
    case NEXT_BLOCK_A:
      return action.data;
    default:
      return state;
  }
}
```

- [ ] **Step 4: 修改 `src/reducers/index.js` — 组合新 reducers**

在 `combineReducers` 中追加：

```js
import mode from './mode';
import role from './role';
import connected from './connected';
import playerId from './playerId';
import curA from './curA';
import curB from './curB';
import nextA from './nextA';
import nextB from './nextB';

// 在 combineReducers 对象中添加:
mode,
role,
connected,
playerId,
curA,
curB,
nextA,
nextB,
```

- [ ] **Step 5: 更新 matrix reducer 支持 12 列初始值**

`src/reducers/matrix/index.js` 中，初始状态从 `blankMatrix` 改为根据 mode 决定：

```js
// 初始状态: 使用默认 10 列（单机），双人模式下由 action 设置
import { blankMatrix } from '../../unit/const';

const initialState = blankMatrix(); // 默认 10 列
```

新增处理 `MATRIX` action 时支持不同尺寸。但当前 `MATRIX` action 的 data 就是完整的 Immutable List，所以不需要改 reducer 逻辑——调用方在 dispatch 时传入正确尺寸的 matrix 即可。

- [ ] **Step 6: 验证 Redux DevTools 显示新字段**

```bash
npm start
# 打开 Redux DevTools，确认 mode/role/connected/playerId/curA/curB/nextA/nextB 字段存在
# mode 默认值为 "single"，其余为 null/false
```

- [ ] **Step 7: 提交**

```bash
git add src/unit/reducerType.js src/actions/index.js src/reducers/
git commit -m "feat: add multiplayer Redux state fields (mode/role/curA/curB/nextA/nextB)"
```

---

### Task 5: 网络协议 + WebSocket 客户端

**Files:**
- Create: `src/network/protocol.js`
- Create: `src/network/client.js`

- [ ] **Step 1: 创建 `src/network/protocol.js`**

```js
// 消息类型常量
export const MSG_TYPES = {
  // Host → Server
  CREATE_ROOM: 'create_room',
  START_GAME: 'start_game',
  STATE: 'state',

  // Client → Server
  JOIN_ROOM: 'join_room',
  INPUT: 'input',

  // Server → Client
  ROOM_CREATED: 'room_created',
  JOINED: 'joined',
  CLIENT_JOINED: 'client_joined',
  START_GAME: 'start_game',
  STATE: 'state',
  ERROR: 'error',
  PEER_DISCONNECTED: 'peer_disconnected',
};

// 错误码
export const ERROR_CODES = {
  ROOM_UNAVAILABLE: 'ROOM_UNAVAILABLE',
  VERSION_MISMATCH: 'VERSION_MISMATCH',
  CONNECTION_TIMEOUT: 'CONNECTION_TIMEOUT',
};

export const GAME_VERSION = '1.4.0';
```

- [ ] **Step 2: 创建 `src/network/client.js`**

```js
import { MSG_TYPES, GAME_VERSION } from './protocol';

const WS_URL_DEV = `ws://${window.location.hostname}:3456`;
const WS_URL_PROD = `ws://${window.location.hostname}:${window.location.port || 3456}`;

class GameClient {
  constructor() {
    this.ws = null;
    this.handlers = {};
    this.reconnectTimer = null;
    this.isHost = false;
  }

  // 创建房间（Host 调用）
  createRoom() {
    this.isHost = true;
    this._connect(() => {
      this._send({ type: MSG_TYPES.CREATE_ROOM });
    });
  }

  // 加入房间（Client 调用）
  joinRoom(hostIp, port = '3456') {
    this.isHost = false;
    this._connect(() => {
      this._send({ type: MSG_TYPES.JOIN_ROOM, version: GAME_VERSION });
    }, hostIp, port);
  }

  _connect(onOpen, hostIp, port) {
    const url = hostIp
      ? `ws://${hostIp}:${port}`
      : (import.meta.env.DEV ? WS_URL_DEV : WS_URL_PROD);
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      if (onOpen) onOpen();
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const handler = this.handlers[msg.type];
        if (handler) handler(msg);
        // 通用处理器（所有消息）
        if (this.handlers['*']) this.handlers['*'](msg);
      } catch (e) {
        console.warn('[game-client] invalid message', event.data);
      }
    };

    this.ws.onclose = () => {
      if (this.handlers['__disconnect']) this.handlers['__disconnect']();
    };

    this.ws.onerror = () => {
      if (this.handlers['__error']) this.handlers['__error']('Connection error');
    };
  }

  // 注册消息处理器
  on(type, handler) {
    this.handlers[type] = handler;
    return this; // 链式调用
  }

  // 注册断开处理器
  onDisconnect(handler) {
    this.handlers['__disconnect'] = handler;
    return this;
  }

  // 注册错误处理器
  onError(handler) {
    this.handlers['__error'] = handler;
    return this;
  }

  // 发送输入（客机调用）
  sendInput(action) {
    this._send({ type: MSG_TYPES.INPUT, action });
  }

  // 广播状态（房主调用）
  broadcastState(state) {
    this._send({
      type: MSG_TYPES.STATE,
      matrix: state.matrix,
      curA: state.curA,
      curB: state.curB,
      nextA: state.nextA,
      nextB: state.nextB,
      score: state.points,
      clearLines: state.clearLines,
      speed: state.speedRun,
      gameStatus: state.gameStatus,
    });
  }

  // 通知开始游戏（房主调用）
  sendStartGame() {
    this._send({ type: MSG_TYPES.START_GAME });
  }

  _send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  close() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) this.ws.close();
    this.ws = null;
  }
}

// 单例
export const gameClient = new GameClient();
```

- [ ] **Step 3: 验证 WebSocket 连接**

（需先有 Task 1 的 server 运行）

在浏览器 console 中临时测试：

```js
// 启动 server 后，在浏览器中:
const ws = new WebSocket('ws://localhost:3456');
ws.onopen = () => { ws.send(JSON.stringify({type:'create_room'})); };
ws.onmessage = (e) => console.log(JSON.parse(e.data));
// 预期收到: { type: 'room_created', roomId: '...', playerId: 'A' }
```

- [ ] **Step 4: 提交**

```bash
git add src/network/
git commit -m "feat: add WebSocket client + message protocol"
```

---

### Task 6: 双方块游戏逻辑

**Files:**
- Modify: `src/control/states.js`
- Modify: `src/control/todo/left.js`
- Modify: `src/control/todo/right.js`
- Modify: `src/control/todo/down.js`
- Modify: `src/control/todo/rotate.js`
- Modify: `src/control/todo/space.js`
- Modify: `src/control/index.js`

- [ ] **Step 1: 修改 `src/control/states.js` — 双方块状态机**

现有 `auto()` 管理单个 `cur`。改为同时管理 `curA` 和 `curB`。

在 states 对象中新增 `autoMulti()` 方法（保留原 `auto()` 给单机用）：

```js
// 双人模式自动下落
autoMulti: (timeout) => {
  clearInterval(states.fallInterval);
  states.fallInterval = setInterval(() => {
    const state = store.getState();
    if (state.get('lock') || state.get('pause') || state.get('reset')) return;

    const curA = state.get('curA');
    const curB = state.get('curB');
    const matrix = state.get('matrix');
    const cols = state.get('mode') === 'multi' ? MULTI_COLS : SINGLE_COLS;

    let matrixAfter = matrix;
    let needNext = false;

    // 处理 curA
    if (curA) {
      const nextA = curA.fall(1);
      if (want(nextA, matrixAfter, cols)) {
        store.dispatch(actions.moveBlockA(nextA));
      } else {
        // 方块A 落地
        matrixAfter = _stampBlock(curA, matrixAfter, cols);
        const newCurA = new Block({ type: state.get('nextA'), cols });
        store.dispatch(actions.moveBlockA(newCurA));
        store.dispatch(actions.nextBlockA(getNextType()));
        needNext = true;
      }
    }

    // 处理 curB
    if (curB) {
      const nextB = curB.fall(1);
      if (want(nextB, matrixAfter, cols)) {
        store.dispatch(actions.moveBlockB(nextB));
      } else {
        matrixAfter = _stampBlock(curB, matrixAfter, cols);
        const newCurB = new Block({ type: state.get('nextB'), cols });
        store.dispatch(actions.moveBlockB(newCurB));
        store.dispatch(actions.nextBlockB(getNextType()));
        needNext = true;
      }
    }

    if (needNext) {
      store.dispatch(actions.matrix(matrixAfter));
      states.nextAroundMulti(matrixAfter);
    }
  }, timeout);
},
```

新增辅助函数 `_stampBlock`：

```js
function _stampBlock(block, matrix, cols) {
  let m = matrix;
  const xy = block.xy;
  block.shape.forEach((row, ri) => {
    row.forEach((cell, ci) => {
      if (cell) {
        const mr = xy[0] + ri;
        const mc = xy[1] + ci;
        if (mr >= 0 && mr < 20 && mc >= 0 && mc < cols) {
          m = m.setIn([mr, mc], 1);
        }
      }
    });
  });
  return m;
}
```

新增 `nextAroundMulti()`（消行 + 游戏结束检查，类似现有 `nextAround()`）：

```js
nextAroundMulti: (matrix) => {
  clearInterval(states.fallInterval);
  store.dispatch(actions.lock(true));
  store.dispatch(actions.matrix(matrix));

  const points = state.get('points') + 10 + (state.get('speedRun') - 1) * 2;
  store.dispatch(actions.points(points > maxPoint ? maxPoint : points));

  const cleared = isClear(matrix, MULTI_COLS);
  if (cleared) {
    // 由 Matrix 组件动画 → states.clearLines() 处理
    store.dispatch(actions.clearLines(cleared.length));
    return;
  }

  if (isOver(matrix)) {
    states.overStart();
    return;
  }

  setTimeout(() => {
    store.dispatch(actions.lock(false));
    const speed = speeds[state.get('speedRun') - 1];
    states.autoMulti(speed);
  }, 100);
},
```

> **注意：** 这些是核心逻辑块，实际编码时需要仔细处理 Immutable.js 的 setIn 和状态顺序。`nextAroundMulti` 中的 state 引用需要从最新 store 获取。

- [ ] **Step 2: 修改 todo actions — 增加 playerId 路由**

现有 `left.js`、`right.js`、`down.js`、`rotate.js`、`space.js` 直接操作 `cur`。联机模式下需要知道是操作 `curA` 还是 `curB`。

方案：`down()` 和 `up()` 接受可选的 `playerId` 参数。默认无参时为单人模式（操作 `cur`），传 `'A'` 或 `'B'` 时操作对应的 `curA`/`curB`。

以 `left.js` 为例，修改 `down` 函数：

```js
// 原: down(store) { ... store.getState().get('cur') ... }
// 改:
down(store, playerId) {
  const state = store.getState();
  const isMulti = state.get('mode') === 'multi';
  const curKey = isMulti ? (playerId === 'A' ? 'curA' : 'curB') : 'cur';
  const cur = state.get(curKey);
  // ... 其余逻辑将 cur 改为使用 curKey 访问 ...
}
```

类似修改 `right.js`、`rotate.js`、`down.js`。`space.js` 同理。

> 由于改动模式相同，实际编码时可以在 `todo` 目录下提取公共逻辑，避免大量重复。但先保持每个文件独立修改以降低风险。

- [ ] **Step 3: 修改 `src/control/index.js` — 键盘路由**

每个玩家绑定不同的键位以避免冲突：

```js
// 玩家A（房主）: 方向键
// 玩家B（客机，同机器调试）: WASD
// 单机模式: 方向键 + 空格（不变）

const keyMapSingle = {
  37: 'left', 38: 'rotate', 39: 'right', 40: 'down', 32: 'space',
  83: 's', 82: 'r', 80: 'p',
};

const keyMapA = {
  37: 'left',   // ←
  38: 'rotate', // ↑
  39: 'right',  // →
  40: 'down',   // ↓
  32: 'space',  // Space = hard drop
};

const keyMapB = {
  65: 'left',   // A
  87: 'rotate', // W
  68: 'right',  // D
  83: 'down',   // S (注意: 和音效冲突，联机时 s 键改为 B 的下落)
  81: 'space',  // Q = hard drop
};
```

在 `keyDown` 中根据 `mode` 选择路由：

```js
const mode = store.getState().get('mode');
if (mode === 'multi') {
  // 玩家A（房主）操作
  const actionA = keyMapA[keyCode];
  if (actionA && todo[actionA]) {
    todo[actionA].down(store, 'A');
    return;
  }
  // 玩家B（客机 — 同机调试用，实际客机通过 WS 发输入）
  const actionB = keyMapB[keyCode];
  if (actionB && todo[actionB]) {
    todo[actionB].down(store, 'B');
    return;
  }
} else {
  // 单机模式 — 原有逻辑
}
```

- [ ] **Step 4: 验证 — 控制台手动 dispatch 测试双 Block**

```bash
npm start
# 在 Redux DevTools 中手动 dispatch:
# { type: 'MODE', data: 'multi' }
# { type: 'MOVE_BLOCK_A', data: { type: 'T', cols: 12, xy: [0,4] } }
# { type: 'MOVE_BLOCK_B', data: { type: 'L', cols: 12, xy: [0,5] } }
# 确认 Matrix 能显示两个方块
```

- [ ] **Step 5: 提交**

```bash
git add src/control/
git commit -m "feat: dual-block game logic with player-specific input routing"
```

---

### Task 7: 模式选择 + 房间界面

**Files:**
- Create: `src/components/mode-select/index.js`
- Create: `src/components/mode-select/index.module.less`
- Create: `src/components/room/index.js`
- Create: `src/components/room/index.module.less`

- [ ] **Step 1: 创建 `src/components/mode-select/index.js`**

```jsx
import React from 'react';
import style from './index.module.less';

const ModeSelect = ({ onSelect }) => (
  <div className={style.overlay}>
    <div className={style.dialog}>
      <h2>选择游戏模式</h2>
      <div className={style.buttons}>
        <button
          className={style.btn}
          onClick={() => onSelect('single')}
          onTouchStart={(e) => { e.preventDefault(); onSelect('single'); }}
        >
          <span className={style.icon}>🖥️</span>
          <span className={style.label}>单机模式</span>
          <span className={style.desc}>10×20 经典玩法</span>
        </button>
        <button
          className={style.btn}
          onClick={() => onSelect('multi')}
          onTouchStart={(e) => { e.preventDefault(); onSelect('multi'); }}
        >
          <span className={style.icon}>🌐</span>
          <span className={style.label}>联机模式</span>
          <span className={style.desc}>12×20 双人协作</span>
        </button>
      </div>
    </div>
  </div>
);

export default ModeSelect;
```

- [ ] **Step 2: 创建 `src/components/mode-select/index.module.less`**

```less
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.dialog {
  background: #efcc19;
  border-radius: 16px;
  padding: 32px 24px;
  text-align: center;
  box-shadow: 0 8px 32px rgba(0,0,0,.4);
  h2 {
    font-size: 24px;
    margin: 0 0 24px;
    color: #333;
  }
}
.buttons {
  display: flex;
  gap: 16px;
  flex-direction: column;
  @media (min-width: 500px) {
    flex-direction: row;
  }
}
.btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px 32px;
  border: 2px solid #333;
  border-radius: 12px;
  background: #fff;
  cursor: pointer;
  transition: transform .15s, box-shadow .15s;
  &:hover { transform: scale(1.03); box-shadow: 0 4px 16px rgba(0,0,0,.2); }
  &:active { transform: scale(.97); }
}
.icon { font-size: 36px; }
.label { font-size: 18px; font-weight: 700; color: #333; }
.desc { font-size: 13px; color: #666; }
```

- [ ] **Step 3: 创建 `src/components/room/index.js`**

```jsx
import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import style from './index.module.less';

const Room = ({ mode, onBack, gameClient, onStart }) => {
  // mode: 'host' | 'client'
  const [roomId, setRoomId] = useState('');
  const [status, setStatus] = useState('idle'); // idle|waiting|connecting|connected|error
  const [errorMsg, setErrorMsg] = useState('');
  const [playerId, setPlayerId] = useState(null);
  const [joinUrl, setJoinUrl] = useState('');
  const canvasRef = useRef(null);

  useEffect(() => {
    if (mode === 'host') {
      gameClient.on('room_created', (msg) => {
        setRoomId(msg.roomId);
        setPlayerId(msg.playerId);
        setStatus('waiting');
        const hostIp = window.location.hostname;
        const port = import.meta.env.DEV ? '5173' : '3456';
        const url = `http://${hostIp}:${port}?join=${msg.roomId}`;
        setJoinUrl(url);
        // 生成二维码
        if (canvasRef.current) {
          QRCode.toCanvas(canvasRef.current, url, { width: 180 });
        }
      });

      gameClient.on('client_joined', () => {
        setStatus('connected');
        // 短暂延迟后开始
        setTimeout(() => onStart && onStart('A'), 500);
      });

      gameClient.on('__error', (err) => {
        setStatus('error');
        setErrorMsg(typeof err === 'string' ? err : '连接失败');
      });

      gameClient.createRoom();
    } else {
      // Client mode
      gameClient.on('joined', (msg) => {
        setPlayerId(msg.playerId);
        setStatus('connected');
        setTimeout(() => onStart && onStart(msg.playerId), 500);
      });

      gameClient.on('error', (msg) => {
        setStatus('error');
        setErrorMsg(msg.message || '加入失败');
      });

      gameClient.on('__error', () => {
        setStatus('error');
        setErrorMsg('无法连接到房主');
      });
    }

    return () => { /* cleanup via onBack */ };
  }, []);

  return (
    <div className={style.overlay}>
      <div className={style.dialog}>
        {mode === 'host' && status === 'waiting' && (
          <>
            <h3>等待对手加入...</h3>
            <canvas ref={canvasRef} className={style.qr} />
            <p className={style.url}>{joinUrl}</p>
            <p className={style.hint}>扫描二维码或输入上方链接加入</p>
          </>
        )}
        {mode === 'client' && status === 'connecting' && (
          <h3>正在连接房主...</h3>
        )}
        {status === 'connected' && (
          <h3>已连接！准备开始...</h3>
        )}
        {status === 'error' && (
          <>
            <h3>⚠️ {errorMsg}</h3>
            <button className={style.btn} onClick={onBack}>返回</button>
          </>
        )}
      </div>
    </div>
  );
};

export default Room;
```

- [ ] **Step 4: 创建 `src/components/room/index.module.less`**

```less
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.dialog {
  background: #efcc19;
  border-radius: 16px;
  padding: 32px 24px;
  text-align: center;
  max-width: 360px;
  width: 90%;
  h3 { font-size: 20px; color: #333; margin: 0 0 16px; }
}
.qr {
  display: block;
  margin: 0 auto 12px;
  border-radius: 8px;
  background: #fff;
  padding: 8px;
}
.url {
  font-size: 12px;
  color: #555;
  word-break: break-all;
  margin: 0 0 8px;
}
.hint {
  font-size: 13px;
  color: #777;
}
.btn {
  padding: 8px 24px;
  border: 1px solid #333;
  border-radius: 6px;
  background: #fff;
  font-size: 16px;
  cursor: pointer;
}
```

- [ ] **Step 5: 提交**

```bash
git add src/components/mode-select/ src/components/room/
git commit -m "feat: mode selection + room create/join UI with QR code"
```

---

### Task 8: 双人游戏容器 + 布局整合

**Files:**
- Modify: `src/containers/index.js`
- Modify: `src/containers/index.module.less`
- Modify: `src/components/next/index.js`

- [ ] **Step 1: 修改 `src/containers/index.js` — 模式路由**

在 `render()` 开头增加模式判断：

```jsx
render() {
  const { mode, role, connected, playerId, curA, curB, nextA, nextB } = this.props;

  // 模式选择（尚未选择时 mode 为初始值 'single'，通过 state.showModeSelect 控制）
  if (this.state.showModeSelect) {
    return (
      <ModeSelect onSelect={(m) => {
        if (m === 'single') {
          store.dispatch(actions.mode('single'));
          this.setState({ showModeSelect: false });
          states.overStart();
        } else {
          store.dispatch(actions.mode('multi'));
          this.setState({ showModeSelect: false, showRoomSelect: true });
        }
      }} />
    );
  }

  // 联机-房间选择
  if (this.state.showRoomSelect) {
    return (
      <div>
        <button onClick={() => {
          store.dispatch(actions.role('host'));
          this.setState({ showRoomSelect: false, showRoom: 'host' });
        }}>创建房间</button>
        <button onClick={() => {
          store.dispatch(actions.role('client'));
          this.setState({ showRoomSelect: false, showRoom: 'client' });
        }}>加入房间</button>
      </div>
    );
  }

  // 联机-房间等待/连接
  if (this.state.showRoom) {
    return (
      <Room
        mode={this.state.showRoom}
        gameClient={gameClient}
        onBack={() => this.setState({ showRoom: null, showRoomSelect: true })}
        onStart={(pid) => {
          store.dispatch(actions.playerId(pid));
          store.dispatch(actions.connected(true));
          this.setState({ showRoom: null });
          // 初始化矩阵（12×20）
          store.dispatch(actions.matrix(blankMatrix(12)));
          if (pid === 'A') {
            // 房主启动游戏
            const initCurA = new Block({ type: nextA, cols: 12 });
            store.dispatch(actions.moveBlockA(initCurA));
            store.dispatch(actions.nextBlockA(getNextType()));
            // 等待客机 ready，然后 start
          }
        }}
      />
    );
  }

  // ... 原有 size 计算 + 渲染逻辑

  const isMulti = mode === 'multi';
  const cols = isMulti ? 12 : 10;
```

在 return 的 JSX 中，`topBar` 部分根据 `mode` 渲染不同内容：

```jsx
{isMulti ? (
  // 双人信息栏
  <div className={style.multiTopBar}>
    <div className={style.playerInfo}>
      <span className={style.playerLabel}>🔴 玩家A</span>
      <Next data={nextA} />
    </div>
    <div className={style.sharedStats}>
      <span className={style.sharedScore}>{this.props.points.toLocaleString()}</span>
      <span className={style.sharedLines}>消行 {this.props.clearLines}</span>
      <span className={style.sharedSpeed}>Lv.{this.props.speedRun}</span>
    </div>
    <div className={style.playerInfo}>
      <span className={style.playerLabel}>🔵 玩家B</span>
      <Next data={nextB} />
    </div>
  </div>
) : (
  // 原有单机 topBar 逻辑不变
)}
```

Matrix 组件传入 `cols` 和双 Block：

```jsx
<Matrix
  matrix={this.props.matrix}
  cur={isMulti ? null : this.props.cur}
  curA={isMulti ? curA : null}
  curB={isMulti ? curB : null}
  reset={this.props.reset}
  ghost={this.props.ghost}
  cols={cols}
/>
```

- [ ] **Step 2: 修改 `src/containers/index.module.less` — 12 列 + 双人 topBar**

新增样式：

```less
// 联机容器更宽
.appMulti {
  width: 580px;  // 原 500px → 580px
}

.multiTopBar {
  width: 100%;
  min-height: 96px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 2px solid rgba(0,0,0,.15);
}

.playerInfo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 80px;
}

.playerLabel {
  font-size: 13px;
  font-weight: 700;
}

.sharedStats {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.sharedScore {
  font-size: 24px;
  font-weight: 700;
  color: #333;
}

.sharedLines {
  font-size: 14px;
  color: #555;
}

.sharedSpeed {
  font-size: 13px;
  color: #888;
}
```

- [ ] **Step 3: 修改规模缩放计算**

```js
const size = (() => {
  const w = this.state.w;
  const h = this.state.h;
  const baseW = isMulti ? 580 : 500;
  const baseH = 1040;
  let scale = Math.min(w / baseW, h / baseH);
  if (scale > 1) scale = 1;
  const css = {};
  css[transform] = `translate(-50%, -50%) scale(${scale})`;
  return css;
})();
```

- [ ] **Step 4: 修改 `src/components/next/index.js` — 支持 playerId 区分显示**

现有 Next 组件渲染单个预览方块。无需大改——双人模式下顶部信息栏各渲染一个 `<Next>` 即可（Step 1 已做）。

- [ ] **Step 5: 集成 WebSocket 生命周期**

在 `componentDidMount` 中检测 URL 参数 `?join=roomId`：

```js
const params = new URLSearchParams(window.location.search);
const joinRoomId = params.get('join');
if (joinRoomId) {
  // 直接进入加入房间模式
  store.dispatch(actions.mode('multi'));
  store.dispatch(actions.role('client'));
  gameClient.joinRoom(window.location.hostname);
  // 状态处理同 Room 组件
}
```

当房主状态变更时（states 中 dispatch 了新的 matrix/curA/curB），在 states 中增加 `broadcastToClient` 调用：

在 `states.js` 的关键状态变更点（`autoMulti` tick、`nextAroundMulti` 等末尾）调用：

```js
if (state.get('mode') === 'multi' && state.get('role') === 'host') {
  gameClient.broadcastState({
    matrix: state.get('matrix'),
    curA: state.get('curA'),
    curB: state.get('curB'),
    nextA: state.get('nextA'),
    nextB: state.get('nextB'),
    points: state.get('points'),
    clearLines: state.get('clearLines'),
    speedRun: state.get('speedRun'),
    gameStatus: state.get('reset') ? 'over' : (state.get('pause') ? 'paused' : 'playing'),
  });
}
```

客机在 `componentDidMount` 中注册状态接收器：

```js
gameClient.on('state', (msg) => {
  store.dispatch(actions.matrix(Immutable.fromJS(msg.matrix)));
  if (msg.curA) store.dispatch(actions.moveBlockA(msg.curA));
  if (msg.curB) store.dispatch(actions.moveBlockB(msg.curB));
  store.dispatch(actions.nextBlockA(msg.nextA));
  store.dispatch(actions.nextBlockB(msg.nextB));
  store.dispatch(actions.points(msg.points));
  store.dispatch(actions.clearLines(msg.clearLines));
  store.dispatch(actions.speedRun(msg.speed));
});
```

客机的触摸/键盘输入发送到房主：

```js
// 在 onDragMove / onDragEnd 等输入处理中:
if (isMulti && role === 'client') {
  gameClient.sendInput(actionName);
  return;  // 不执行本地 todo 逻辑
}
```

- [ ] **Step 6: 验证 — 完整联机流程**

```bash
# 终端1: 启动 server + vite
npm start

# 浏览器1 (房主): http://localhost:5173
# → 选择"联机模式" → "创建房间"
# → 应显示二维码和等待界面

# 浏览器2 (客机): 打开房主显示的链接
# → 自动连接 → 两方进入 12×20 游戏

# 手动操作验证:
# - 房主用方向键操控 curA 正常下落下
# - 客机操作通过 WS 到达房主，curB 同步下落
# - 消行正常触发
```

- [ ] **Step 7: 提交**

```bash
git add src/containers/ src/components/next/ src/components/matrix/
git commit -m "feat: multiplayer game container + 12x20 layout + WS integration"
```

---

### Task 9: 异常处理 + 网络断开恢复

**Files:**
- Modify: `src/network/client.js`
- Modify: `src/containers/index.js`

- [ ] **Step 1: 修改 `src/network/client.js` — 断开检测**

在 `_connect()` 中的 `onclose` 处理增加重连逻辑（可选）和状态上报：

```js
this.ws.onclose = () => {
  this.connected = false;
  if (this.handlers['__disconnect']) {
    this.handlers['__disconnect']({ wasHost: this.isHost });
  }
};
```

添加 `connected` 属性暴露：

```js
get isConnected() { return this.ws && this.ws.readyState === WebSocket.OPEN; }
```

- [ ] **Step 2: 修改 `src/containers/index.js` — 断开恢复 UI**

在 componentDidMount 或 useEffect 等价位置：

```js
gameClient.onDisconnect(({ wasHost }) => {
  // 游戏中网络断开
  if (this.props.curA || this.props.curB) {
    // 对方的活动方块固化到 matrix
    const otherCur = this.props.playerId === 'A' ? this.props.curB : this.props.curA;
    if (otherCur) {
      const cols = 12;
      let matrix = this.props.matrix;
      otherCur.shape.forEach((row, ri) => {
        row.forEach((cell, ci) => {
          if (cell) {
            const mr = otherCur.xy[0] + ri;
            const mc = otherCur.xy[1] + ci;
            if (mr >= 0 && mr < 20 && mc >= 0 && mc < cols) {
              matrix = matrix.setIn([mr, mc], 1);
            }
          }
        });
      });
      store.dispatch(actions.matrix(matrix));
    }

    // 清除对方 cur
    if (this.props.playerId === 'A') {
      store.dispatch(actions.moveBlockB({ reset: true }));
    } else {
      store.dispatch(actions.moveBlockA({ reset: true }));
    }

    // 切换为单机模式
    store.dispatch(actions.mode('single'));
    store.dispatch(actions.role(null));
    store.dispatch(actions.connected(false));

    // 提示
    alert('网络已断开，已切换为单机模式');
    // 重启单人下落逻辑
    const speed = speeds[this.props.speedRun - 1];
    states.auto(speed);
  }
});
```

- [ ] **Step 3: 添加连接错误提示**

在 Room 组件中已有 error 状态处理（Task 7 Step 3）。在 container 层面补充 toast 风格提示：

```jsx
{this.state.errorToast && (
  <div className={style.toast}>{this.state.errorToast}</div>
)}
```

对应 CSS：

```less
.toast {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: #e74c3c;
  color: #fff;
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 14px;
  z-index: 200;
  animation: toastIn .3s ease;
}
@keyframes toastIn {
  from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}
```

- [ ] **Step 4: 提交**

```bash
git add src/network/client.js src/containers/
git commit -m "feat: error handling + disconnect recovery with auto single-player fallback"
```

---

### Task 10: 集成测试 + 调优

**Files:**
- Modify: `src/containers/index.module.less`
- Modify: `src/components/matrix/index.js`

- [ ] **Step 1: 端到端联机测试清单**

在双浏览器窗口下验证：

- [ ] 单机模式启动 → 10×20 棋盘 → 正常游戏
- [ ] 联机模式 → 创建房间 → 二维码生成 → 显示正确 URL
- [ ] 第二个浏览器打开加入链接 → 双方看到 12×20 棋盘
- [ ] 房主方向键操控 curA → 正常移动/旋转/下落/硬降
- [ ] 客机 WASD 操控 curB（如果同机调试）→ 正常
- [ ] 消行：填满 12 格的行被消除 → 双方同步看到消除动画
- [ ] 分数：消行后双方显示的分数一致
- [ ] 游戏结束：一方方块触顶 → 双方显示 game over 动画
- [ ] 断开恢复：关闭客机标签 → 房主收到断开提示 → 切换为单机
- [ ] 断开恢复：关闭房主标签 → 客机切换为单机 → 继续游戏
- [ ] 手机扫码加入：手机扫二维码 → 进入游戏 → 触屏手势操控正常

- [ ] **Step 2: CSS 微调 — 移动端适配**

在 `index.module.less` 中确保联机模式的 `.app` 缩放正确：

```less
// 联机模式容器
.appMulti {
  width: 580px;
  // 继承原有 .app 的 position/box-shadow/background 等
}
```

由于容器从 500→580，确保 safe-area 和对齐正常。可复用 `.app` 样式，仅覆盖 `width`。

- [ ] **Step 3: 性能检查**

- [ ] 房主 `broadcastState` 频率控制：不在每个 `autoMulti` tick 都广播，改为 100ms 节流或仅在状态变更时广播
- [ ] 客机状态覆盖使用 `requestAnimationFrame` 包裹，避免渲染抖动

在 `src/network/client.js` 中增加简单节流：

```js
broadcastState(state) {
  if (!this._lastBroadcast || Date.now() - this._lastBroadcast >= 50) {
    this._send({ type: MSG_TYPES.STATE, ...state });
    this._lastBroadcast = Date.now();
  }
}
```

- [ ] **Step 4: 最终提交**

```bash
git add -A
git commit -m "feat: LAN multiplayer integration complete + polish"
```

---

## 依赖关系

```
Task 1 (server) ─────────────────────────────┐
Task 2 (parameterize) ── Task 3 (matrix) ────┤
Task 4 (Redux) ──────────────── Task 6 (logic) ── Task 8 (container) ── Task 9 (errors) ── Task 10 (polish)
Task 5 (network) ────────────────────────────┘
Task 7 (mode/room UI) ───────────────────────┘
```

- Task 1-5 可并行
- Task 6 依赖 Task 2+4
- Task 7 独立，可与 Task 2-6 并行
- Task 8 依赖 Task 3+5+6+7
- Task 9 依赖 Task 5+8
- Task 10 依赖全部
