# AGENTS.md

## 构建命令

```powershell
# 安装依赖
npm install

# 开发模式（webpack-dev-server）
npm start

# 生产构建（Windows 下 rm/cp 不可用，只运行 webpack）
npx webpack --config webpack.production.config.js
# 构建产物在 docs/ 目录，需手动复制 mp3 文件：
# Copy-Item src/resource/music/*.mp3 docs/
```

> 注意：`npm run build` 在 Windows 下会失败，因为脚本使用了 Unix `rm -rf` 和 `cp` 命令。

## 项目结构

```
src/
  components/
    keyboard/       # 触屏按钮组件（方向键 + 旋转/掉落）
      button/       # 按钮子组件
    logo/           # Logo 和"开始游戏"按钮
    matrix/         # 棋盘渲染 + 幽灵方块
    music/          # 音效图标
    next/           # 下一个方块预览
    number/         # 数字精灵组件
    point/          # 得分/最高分显示
  containers/       # 主布局容器 (App)
  control/          # 游戏控制逻辑
    states.js       # 状态机（开始/暂停/结束/消除）
    todo/           # 键盘/按钮动作分发
  unit/             # 工具函数、常量、音乐
  store/            # Redux store
  actions/          # Redux actions
  reducers/         # Redux reducers
  resource/music/   # 音频文件 (bgm.mp3, etc.)
i18n.json           # 多语言配置
```

## 禁止修改的文件

以下文件包含核心游戏逻辑，修改可能导致游戏无法正常游玩：

- `src/control/states.js`
- `src/control/todo/*.js`
- `src/unit/music.js`
- `src/unit/block.js`
- `src/reducers/`
- `src/actions/`
- `src/store/`

仅修改 UI 层文件：`src/containers/`、`src/components/`（除上述禁止文件）、`i18n.json`。

## 关键陷阱

### 移动端点击不触发
Keyboard 组件在 `componentDidMount` 中执行了：
```js
document.addEventListener('touchstart', (e) => { e.preventDefault(); }, true);
```
捕获阶段的 `preventDefault` 阻止了浏览器合成 `click` 事件。UI 按钮必须使用 `onMouseDown` + `onTouchStart` 替代 `onClick`。

### 隐藏按钮 ref 不可删除
Keyboard 组件遍历 `todo` 对象的 key，为每个按钮注册事件时依赖 `this.dom_p`、`this.dom_s`、`this.dom_r` 等 ref。这些按钮即使不显示也必须存在于 DOM 中（`display:none`），否则会触发 `TypeError`。

### React 15 不支持 Fragment
使用 `<div>` 包裹多个元素，不能使用 `<>...</>` Fragment 简写。

## 技术栈
- React 15 + Redux
- Immutable.js
- Webpack 3
- Less
- CSS `transform: scale()` 实现响应式缩放
