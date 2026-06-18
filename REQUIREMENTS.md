# 需求文档

## 概述

React 俄罗斯方块游戏，移动端优先的响应式布局，支持键盘和触摸双模式操作。

## 功能列表

### 核心游戏
- [x] 10×20 标准俄罗斯方块棋盘
- [x] 7 种标准方块 (I/L/J/Z/S/O/T)
- [x] 键盘操作：方向键移动、↑旋转、空格硬降、P 暂停、R 重来、S 音效
- [x] 自动下落，消除行后加速
- [x] 得分系统：消除行越多加分越多
- [x] 最高分本地存储

### 幽灵方块 (Ghost Piece)
- [x] 方块下落过程中在底部显示半透明落点位置
- [x] 幽灵方块颜色为 #555（灰色），CSS 类 `.e`

### 背景音乐 (BGM)
- [x] 游戏开始时播放 `bgm.mp3`，循环播放
- [x] 音效开关同时控制 BGM 启停
- [x] 暂停时停止 BGM，继续时恢复

### 移动端触摸操作
- [x] 十字方向键（左/右/下），无文字标签，位于棋盘左下方
- [x] 旋转按钮 + 掉落按钮，位于棋盘右下方，间距 16px
- [x] 按钮尺寸 52×52px，圆形，蓝色渐变
- [x] 使用 `onMouseDown` + `onTouchStart` 替代 `onClick`（因 Keyboard 组件在 document 上注册了 `touchstart preventDefault`）

### 布局
- [x] 容器宽度 500px
- [x] 格子尺寸 40×40px，间距 2px
- [x] 棋盘 420×840px (10×20)
- [x] 黄色底板 `.rect` 470px，边框 6px
- [x] 金属边框 `.screen` 450px，边框 3px
- [x] 绿色内板 `.panel` 442px，内边距 5px，边框 2px
- [x] Board 自适应缩放：`scale(min(w/500, h/1140))`，最大 scale=1
- [x] 无水平滚动，body 居中 flexbox

### 顶部栏（条件渲染）
- [x] **游戏前**：最高分（6 位数字）、起始行（1 位，0-10）、速度（1 位，1-6），标签在上/数字在下
- [x] **游戏中**：左侧消除行数、中间下一个方块预览（168×84px）、右侧得分 + 重玩/音效开关组
- [x] 固定最小高度 96px，防止游戏前/后高度切换导致棋盘跳动

### 棋盘区域
- [x] Logo（龙形图案 + "TETRIS" 文字）居中，`top: 330px`
- [x] "开始游戏"按钮居中，`top: 580px`，尺寸 160×48px
- [x] 暂停时半透明遮罩覆盖棋盘，居中显示"继续"按钮
- [x] 幽灵方块在棋盘上以灰色渲染

### 键盘组件
- [x] 保留隐藏的暂停/音效/重来按钮（`display:none`），确保 Keyboard 组件中 `this.dom_p/s/r` ref 存在，`componentDidMount` 遍历不崩溃
- [x] 游戏开始前，方向键和旋转/掉落按钮无作用（检查 `store.getState().get('cur')`）

## 禁止修改的文件
- `src/control/states.js` — 游戏状态机
- `src/control/todo/*.js` — 键盘动作分发
- `src/unit/music.js` — 音频控制
- `src/unit/block.js` — 方块逻辑
- `reducers/`、`actions/`、`store/` — Redux 状态管理

## 多语言
- 支持中/英/法/波斯语，配置文件 `i18n.json`
- 新增键值：`start`（开始游戏）、`continue`（继续）
- `level` 中文改为"速度"

## 浏览器兼容
- 移动端 WebKit/Blink
- 桌面端 Chrome/Firefox/Edge
- iOS Safari（需 AudioContext 用户交互恢复）
