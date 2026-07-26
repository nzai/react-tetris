# 局域网双人模式 — 设计文档

> 日期：2026-07-18 | 版本：v1 | 目标版本：v1.4.0

---

## 1. 概述

为 react-tetris 增加局域网双人联机功能。两个玩家在同一局域网内，通过 WebSocket 房主模式连接，在 **12×20** 的共享棋盘上同时操控各自的方块，协作消行。

单机模式完全保留不变，启动时新增模式选择页面。

---

## 2. 启动流程

```
[启动页面]
  ├── 🖥️ 单机模式 → 现有游戏流程（10×20，不变）
  └── 🌐 联机模式
        ├── 🏠 创建房间（Host）
        │     ├── 启动本地 WebSocket 服务
        │     ├── 显示二维码 + 加入链接
        │     └── 等待客机连接 → 开始游戏
        └── 🎮 加入房间（Client）
              ├── 扫描房主二维码 / 手动输入链接
              ├── 连接房主 WebSocket
              └── 连接成功 → 开始游戏
```

---

## 3. 网络架构

### 3.1 拓扑

```
┌─────────────────────┐         ┌─────────────────────┐
│   🏠 房主 (Host)     │         │   🎮 客机 (Client)   │
│                     │   WS    │                     │
│  浏览器 ←→ WS Client │◄───────►│  浏览器 ←→ WS Client │
│            │        │         │                     │
│   Vite/Node Server  │         │  (无需服务端)        │
│   (WS Relay +       │         │                     │
│    静态文件服务)      │         │                     │
└─────────────────────┘         └─────────────────────┘
```

### 3.2 服务端

新增 `server/index.js`，使用 `ws` 库：

- **开发环境**：Vite（:5173） + WS Server（:3456），Vite 代理 `/ws` → `:3456`
- **生产环境**：`node server/index.js` 同时服务静态文件 + WebSocket
- **职责**：配对两个玩家、转发消息、不涉游戏逻辑

### 3.3 消息协议

| 方向 | 类型 | 内容 | 说明 |
|------|------|------|------|
| Host → Client | `state` | 完整游戏状态 | matrix, curA, curB, nextA, nextB, score, clearLines, speed, gameStatus |
| Host → Client | `assign` | `{ playerId: 'B' }` | 分配玩家身份 |
| Host → Client | `start` | `{}` | 游戏开始 |
| Host → Client | `error` | `{ code, message }` | 错误通知 |
| Client → Host | `input` | `{ action, timestamp }` | 玩家操作（left/right/rotate/down/drop） |
| Client → Host | `ready` | `{}` | 客机准备就绪 |

### 3.4 房间发现

- **二维码**：使用 `qrcode` 库（~5KB），编码完整加入 URL
  - 开发环境：`http://{房主IP}:5173?join={roomId}`（Vite dev server 端口）
  - 生产环境：`http://{房主IP}:3456?join={roomId}`（Express + WS 统一端口）
- **手动链接**：显示完整地址作为兜底
- 客机打开链接 → 页面检测 `?join=` 参数，自动进入"加入房间"模式并向 `ws://{IP}:3456` 发起 WebSocket 连接
- 房主 IP 获取：前端通过 WebRTC ICE candidate 或用户手动确认（LAN 内通常为 192.168.x.x）

---

## 4. 游戏规则

| 维度 | 规则 |
|------|------|
| **棋盘** | 12 列 × 20 行，格子 40×40px 不变 |
| **操控** | 两人同时各有一个活动方块，独立操控 |
| **分数** | 共享总分 + 共享消行数 |
| **死亡** | 任意一人的方块触顶（row 0 有方块）→ 双人游戏结束 |
| **Next** | 各自独立的随机队列 |
| **速度** | 统一下落速度，共享速度等级 |
| **消行** | 任意行填满 12 格即消除，计入共享消行数 |

---

## 5. 状态管理（Redux）

### 5.1 新增/变更字段

```
mode:      'single' | 'multi'     // 游戏模式
role:      'host' | 'client' | null  // 联机角色
connected: boolean                 // WebSocket 连接状态
playerId:  'A' | 'B' | null       // 玩家身份

// 双人模式（替代单人的 cur / next）
curA:      Block | null            // 玩家A 活动方块
curB:      Block | null            // 玩家B 活动方块
nextA:     string                  // 玩家A 下一个方块类型
nextB:     string                  // 玩家B 下一个方块类型

// matrix 在联机模式下为 12×20
// 单人模式保持 10×20
```

### 5.2 状态同步策略

- **房主权威**：房主运行完整游戏逻辑，状态变更后广播 `state` 给客机
- **客机渲染**：客机接收 `state`，直接覆盖本地 Redux store，仅做渲染
- **客机输入**：客机只发送自己的操作，不修改本地游戏状态（等房主回传）
- **游戏引擎常驻**：客机浏览器同样加载了完整游戏引擎代码（同一份 JS bundle），只是处于"休眠"状态不运行。当网络断开时，客机可立即激活引擎、接管游戏逻辑（见第 8 节）

---

## 6. 游戏逻辑改造

### 6.1 参数化棋盘宽度

`src/unit/const.js`：

```js
// 单机
export const SINGLE_COLS = 10;
// 联机
export const MULTI_COLS = 12;
export const ROWS = 20;
```

所有硬编码的 `10`（碰撞检测、矩阵生成、消行判断）改为参数传入。

### 6.2 碰撞检测 `want()`

`src/unit/index.js`：增加 `cols` 参数：

```js
export const want = (next, matrix, cols = 10) => { ... }
```

### 6.3 双方块状态机 `states.js`

- `auto()` 同时管理 curA 和 curB 的下落计时
- `nextAround()` 处理任意方块落地后的逻辑
- `isOver()` 检查 row 0 是否有方块（两个玩家共用棋盘）
- 消行逻辑不变（只是行宽从 10 变 12）

### 6.4 输入路由

- 房主本地输入 → 直接处理（curA）
- 客机输入 → 通过 WS 发送到房主 → 房主处理（curB）
- 房主也需要将自己的操作广播出去（或者客机不需要知道房主操作，因为 state 已经包含）

---

## 7. UI 改造

### 7.1 模式选择页（新增）

`src/components/mode-select/`

- 两个大按钮：单机模式 / 联机模式
- 点击联机 → 展开子选项：创建房间 / 加入房间
- 加入房间：显示二维码扫描提示 + 手动输入框

### 7.2 双人游戏布局（改造）

延续现有 `.app` 容器 + CSS scale 缩放策略。12×20 棋盘宽度约 **512px**（12×42 + border/padding），容器约 **580px**。

顶部信息栏（`.topBar`）布局：

```
┌──────────────────────────────────────────┐
│  [玩家A Next]  │  🏆 12,400分 / 消行15  │  [玩家B Next]  │
│  [🔴 预览块]   │     ⚡ Lv.3           │  [🔵 预览块]   │
│    操控：键盘  │     🔊👻🎨⚙️         │   操控：触屏   │
└──────────────────────────────────────────┘
│               12×20 棋盘                   │
```

- 左侧：玩家A 的 Next 预览 + 操控方式提示
- 中间：共享分数、消行数、速度等级、功能图标
- 右侧：玩家B 的 Next 预览 + 操控方式提示

### 7.3 Matrix 组件（改造）

`src/components/matrix/index.js`：

- 接受 `cols` prop（10 或 12）
- CSS 宽度动态计算
- 同时渲染 curA 和 curB 的活动方块（不同颜色区分）
- Ghost 方块分别渲染（可选：不同透明度/颜色区分）

### 7.4 容器缩放

- 联机容器基准宽度：`580px`（vs 单机 `500px`）
- 缩放公式：`min(w / 580, h / 1040)`，上限 1
- 手机适配：375px 宽 → scale ≈ 0.65，仍可操作

---

## 8. 异常处理

| 场景 | 检测方式 | 处理 |
|------|---------|------|
| **加入房间失败** | WS 连接超时/拒绝 | Toast 提示具体原因（超时 / 房间不存在 / 房间已满 / 版本不匹配），提供重试按钮 |
| **游戏中网络断开** | WS `onclose` 事件 | **双方自动转单机模式**：当前棋盘保留，对方的活动方块直接固化到矩阵中，本方继续操控自己的方块下落。顶部提示"网络已断开，已切换为单机模式" |
| **房主关闭页面** | WS 断开（客机检测） | 客机收到断开事件 → 弹窗提示"房主已离开" → 自动转单机（同网络断开逻辑） |
| **客机断开** | WS 断开（房主检测） | 房主弹窗提示"对手已离开" → 可选"继续单机"或"等待新玩家"。继续单机则对方方块固化到矩阵 |
| **端口被占用** | 创建房间时 `EADDRINUSE` | 提示"端口被占用"，自动尝试 +1 端口（3456→3457→3458），或让用户手动指定 |
| **版本不匹配** | 连接握手时交换版本号 | 拒绝连接，提示双方需要相同版本 |

### 8.1 网络断开 → 单机过渡逻辑

```
断开检测
  │
  ├── 本方活动方块：保持不变，继续下落
  │
  ├── 对方活动方块：以当前位置直接固化到 matrix
  │   （相当于对方"硬降"了最后一次）
  │
  └── 游戏继续：12×20 棋盘、单人规则、自己的 Next 队列不变
```

---

## 9. 文件清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `server/index.js` | WebSocket 中继 + 静态文件服务 |
| `src/components/mode-select/index.js` | 模式选择页面 |
| `src/components/mode-select/index.module.less` | 模式选择样式 |
| `src/components/room/index.js` | 创建/加入房间界面 |
| `src/components/room/index.module.less` | 房间界面样式 |
| `src/network/client.js` | WebSocket 客户端封装 |
| `src/network/protocol.js` | 消息类型定义和序列化 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `src/unit/const.js` | 新增 `MULTI_COLS=12`、`ROWS=20`，参数化矩阵生成 |
| `src/unit/block.js` | spawn 位置根据 cols 自适应居中 |
| `src/unit/index.js` | `want()` 增加 cols 参数；`isClear()`/`isOver()` 参数化 |
| `src/control/states.js` | 双方块状态机（curA + curB） |
| `src/control/todo/*.js` | 输入增加 playerId 参数路由 |
| `src/control/index.js` | 键盘事件绑定增加玩家标识 |
| `src/reducers/index.js` | 新增 mode/role/connected/playerId/curA/curB/nextA/nextB |
| `src/actions/index.js` | 新增联机相关 action |
| `src/containers/index.js` | 模式路由、双人布局、WS 生命周期 |
| `src/containers/index.module.less` | 12 列棋盘 CSS、双人 topBar 布局 |
| `src/components/matrix/index.js` | 可变列数渲染、双 Block 显示 |
| `src/components/matrix/index.module.less` | 动态宽度 |
| `package.json` | 新增 `ws`、`qrcode` 依赖，`server` 脚本 |
| `vite.config.js` | 新增 `/ws` 代理配置 |

---

## 10. 依赖

```json
{
  "ws": "^8.x",        // WebSocket 服务端（Node.js）
  "qrcode": "^1.x"     // 二维码生成（浏览器端）
}
```

均为轻量库，`ws` ~20KB（仅服务端），`qrcode` ~5KB（浏览器端 canvas 渲染）。

---

## 11. ABANDONED 备选方案

- **WebRTC P2P**：浏览器直连无需服务端，但需要 STUN/信令辅助，局域网优势发挥不出来，且 ICE 连接建立复杂、调试困难。
- **20×20 大棋盘**：屏幕适配困难，手机端体验差；12×20 在保留协作感的同时不需要缩小格子。
- **房间号 + 中继服务器**：需要额外部署公网中继，增加运维成本；二维码方案零配置即可完成 LAN 发现。
- **各自计分**：引入竞争不利于合作；共享分数强化团队目标。
- **共享 Next 队列**：交替分配时等待对方落块；独立队列两人可并行操作，节奏更流畅。
