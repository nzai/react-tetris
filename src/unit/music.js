import store from '../store';

// 使用 Web Audio API
const AudioContext = (
  window.AudioContext ||
  window.webkitAudioContext ||
  window.mozAudioContext ||
  window.oAudioContext ||
  window.msAudioContext
);

const hasWebAudioAPI = {
  data: !!AudioContext && location.protocol.indexOf('http') !== -1,
};


const music = {};
let bgmBuffer = null;
let bgmSource = null;

(() => {
  if (!hasWebAudioAPI.data) {
    return;
  }
  const url = './music.mp3';
  const bgmUrl = './bgm.mp3';
  const context = new AudioContext();
  const req = new XMLHttpRequest();
  req.open('GET', url, true);
  req.responseType = 'arraybuffer';

  const bgmReq = new XMLHttpRequest();
  bgmReq.open('GET', bgmUrl, true);
  bgmReq.responseType = 'arraybuffer';

  req.onload = () => {
    context.decodeAudioData(req.response, (buf) => { // 将拿到的audio解码转为buffer
      const getSource = () => { // 创建source源。
        const source = context.createBufferSource();
        source.buffer = buf;
        source.connect(context.destination);
        return source;
      };

      music.killStart = () => { // 游戏开始的音乐只播放一次
        music.start = () => {};
      };

      music.start = () => { // 游戏开始
        music.killStart();
        if (!store.getState().get('music')) {
          return;
        }
        getSource().start(0, 3.7202, 3.6224);
      };

      music.clear = () => { // 消除方块
        if (!store.getState().get('music')) {
          return;
        }
        getSource().start(0, 0, 0.7675);
      };

      music.fall = () => { // 立即下落
        if (!store.getState().get('music')) {
          return;
        }
        getSource().start(0, 1.2558, 0.3546);
      };

      music.gameover = () => { // 游戏结束
        if (!store.getState().get('music')) {
          return;
        }
        getSource().start(0, 8.1276, 1.1437);
      };

      music.rotate = () => { // 旋转
        if (!store.getState().get('music')) {
          return;
        }
        getSource().start(0, 2.2471, 0.0807);
      };

      music.move = () => { // 移动
        if (!store.getState().get('music')) {
          return;
        }
        getSource().start(0, 2.9088, 0.1437);
      };
    },
    (error) => {
      if (window.console && window.console.error) {
        window.console.error(`音频: ${url} 读取错误`, error);
        hasWebAudioAPI.data = false;
      }
    });
  };

  const resumeContext = () => {
    if (context.state === 'suspended') {
      context.resume();
    }
  };

  // 移动端浏览器需要用户交互才能恢复 AudioContext
  const firstInteraction = () => {
    resumeContext();
    document.removeEventListener('touchstart', firstInteraction, true);
    document.removeEventListener('mousedown', firstInteraction, true);
    document.removeEventListener('keydown', firstInteraction, true);
  };
  document.addEventListener('touchstart', firstInteraction, true);
  document.addEventListener('mousedown', firstInteraction, true);
  document.addEventListener('keydown', firstInteraction, true);

  bgmReq.onload = () => {
    context.decodeAudioData(bgmReq.response, (buf) => {
      bgmBuffer = buf;
    },
    (error) => {
      if (window.console && window.console.error) {
        window.console.error(`音频: ${bgmUrl} 读取错误`, error);
      }
    });
  };

  music.bgmStart = () => {
    if (!store.getState().get('music') || !bgmBuffer) {
      return;
    }
    resumeContext();
    if (bgmSource) {
      try { bgmSource.stop(); } catch (e) {} // eslint-disable-line
    }
    const source = context.createBufferSource();
    source.buffer = bgmBuffer;
    source.loop = true;
    source.connect(context.destination);
    source.start(0);
    bgmSource = source;
  };

  music.bgmStop = () => {
    if (bgmSource) {
      try { bgmSource.stop(); } catch (e) {} // eslint-disable-line
      bgmSource = null;
    }
  };

  req.send();
  bgmReq.send();
})();

module.exports = {
  hasWebAudioAPI,
  music,
};

