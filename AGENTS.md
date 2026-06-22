# AGENTS.md

## 构建命令

```powershell
# 安装依赖
npm install

# 开发模式 (Vite)
npm start

# 生产构建
npm run build
```

## 项目结构

```
src/
  components/
    logo/           # Logo 和"开始游戏"按钮
    matrix/         # 棋盘渲染 + 幽灵方块
    music/          # 音效图标
    ghost/          # 影子方块开关图标
    theme/          # 主题选择对话框
    settings/       # 设置面板
    next/           # 下一个方块预览
    number/         # 数字精灵组件
    point/          # 得分/最高分显示
    decorate/       # 装饰元素
  containers/       # 主布局容器 (App) + 手势拖拽逻辑
  control/          # 游戏控制
    states.js       # 状态机（开始/暂停/结束/消除）
    todo/           # 动作分发（被手势系统作为黑盒调用）
  unit/             # 工具函数、常量、音频合成、主题定义
    music.js        # Web Audio 音效 + BGM 合成器
    themes.js       # 预设配色 + import.meta.glob 自动发现 bg 图片
  store/            # Redux store
  actions/          # Redux actions
  reducers/         # Redux reducers
  resource/
    music/          # 音频文件 (music.mp3)
    bg/             # 自定义背景图目录（放入图片即可）
public/             # 静态资源（loader.css, music.mp3）
i18n.json           # 多语言配置
```

## 输入输出模型

手势操作通过调用 `todo[key].down(store)` + `todo[key].up(store)` 模拟单次按键，不修改 todo 内部计算逻辑。

| 层 | 可修改 | 文件 |
|----|--------|------|
| 输入（手势捕获） | ✓ | `containers/index.js`（onDragStart/Move/End） |
| 输出（UI 布局） | ✓ | `containers/`、`components/`、`i18n.json` |
| 计算（游戏逻辑） | ✗ | `control/`、`unit/block.js`、`reducers/`、`actions/`、`store/` |

## 布局尺寸

- 容器 `.app`：500px，`position: absolute; top:50%; left:50%; translate(-50%,-50%) scale()`
- 格子 `b`：40×40px + 2px margin
- 棋盘：420×840px（10×20），matrix 428px 宽
- 缩放：`min(innerWidth/500, innerHeight/1040)`，capped at 1
- 视口：`width=device-width, initial-scale=1.0`

## 关键陷阱

### `transform: scale()` 不改变盒模型
用 `position: absolute` + `translate(-50%,-50%)` 居中缩放元素，避免 flexbox 居中未缩放盒模型导致的偏移。

### React 18 注意
- 入口使用 `createRoot` 而非 `ReactDOM.render`
- CSS Modules 文件需 `.module.less` 后缀

### 移动端滚动阻止
- CSS: `touch-action: none; overflow: hidden`
- JS: `document.addEventListener('touchmove', e.preventDefault, {passive:false})`
- Viewport: `user-scalable=no`

### AudioContext 挂起恢复
移动端浏览器需用户交互后 `context.resume()`，已通过 `touchstart/mousedown/keydown` 首次交互恢复。

### Number 默认位数
`Number.defaultProps.length = 7`，如需不同位数显式传 `length` prop。

### CSS Modules (Vite)
所有 `.less` 文件使用 `.module.less` 后缀，import 为 `import style from './index.module.less'`。

### 自定义背景图
放入 `src/resource/bg/`，构建时 `import.meta.glob` 自动发现并打包。

## 技术栈
- React 18 + Redux 4
- Immutable.js 3.x
- Vite 6
- Less 4 (CSS Modules)
- Web Audio API（音效播放 + BGM 方波合成）
- CSS `transform: scale()` 响应式缩放
