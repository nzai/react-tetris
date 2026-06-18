# react-tetris

React 俄罗斯方块，响应式布局，支持 PC 键盘和移动端触摸操作。

----
### 运行效果

游戏前顶部栏显示最高分、起始行（0-10）、速度（1-6）；游戏开始后显示消除行、下一个方块预览、得分，以及重玩/音效开关。

- 40px 格子，420×840px 棋盘（10×20）
- 十字方向键 + 旋转/掉落触屏按钮，位于棋盘下方
- 暂停遮罩显示"继续"按钮
- 幽灵方块（落点预览）和背景音乐（BGM）
- 游戏开始前方向键和操作按钮无作用，避免误触

----
### Fork 新增功能

本 Fork 在 [原版](https://github.com/chvin/react-tetris) 基础上增加了以下功能：

1. **幽灵方块** — 方块下落过程中在底部显示灰色落点预览，便于预判摆放位置。
2. **后台 BGM** — 游戏中循环播放 `bgm.mp3`，音效开关同时控制 BGM。
3. **移动端触摸操作** — 十字方向键 + 旋转/掉落按钮，去除多余文字标签。
4. **条件顶部栏** — 游戏前显示最高分/起始行/速度；游戏中显示消除行/下一个/得分+操作开关。
5. **紧凑布局** — 500px 容器、40px 格子、收窄边框间距，减少水平方向留白。
6. **"开始游戏"按钮** — Logo 下方居中，点击/触摸启动游戏。
7. **暂停继续遮罩** — 暂停时半透明遮罩覆盖棋盘，点击"继续"恢复。
8. **游戏前按钮锁定** — 方向键和旋转/掉落按钮在游戏未开始时无效，防止误触修改起始参数。

----
### 开发

#### 安装
```
npm install
```
#### 运行
```
npm start
```
浏览自动打开 [http://127.0.0.1:8080/](http://127.0.0.1:8080/)

#### 多语言
在 [i18n.json](https://github.com/chvin/react-tetris/blob/master/i18n.json) 配置多语言环境，使用"lan"参数匹配语言如：`https://chvin.github.io/react-tetris/?lan=en`

#### Windows 打包编译
```
npm run build
```
> Windows 下 `rm -rf` 和 `cp` 命令不可用，请直接运行 `npx webpack --config webpack.production.config.js` 然后将 `src/resource/music/*.mp3` 复制到 `docs/`。

#### 技术栈
- React 15 + Redux
- Immutable.js
- Webpack
- Less (CSS 预处理器)
