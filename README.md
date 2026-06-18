
----
### 效果预览
![效果预览](https://img.alicdn.com/tps/TB1Ag7CNXXXXXaoXXXXXXXXXXXX-320-483.gif)

正常速度的录制，体验流畅。

----
### Fork 新增功能

本 Fork 在 [原版](https://github.com/chvin/react-tetris) 基础上增加了以下功能：

1. **影子方块** — 方块下落过程中在底部显示浅灰色落点预览，便于预判摆放位置。
2. **后台 BGM** — 游戏过程中循环播放背景音乐 `bgm.mp3`，开始和结束音效不受影响。

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

#### 打包编译
```
npm run build
```

在 docs 文件夹下生成结果。
