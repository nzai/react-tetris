import store from '../store';

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

(() => {
  if (!hasWebAudioAPI.data) {
    return;
  }
  const url = './music.mp3';
  const context = new AudioContext();

  const masterGain = context.createGain();
  masterGain.gain.value = 0.7;
  masterGain.connect(context.destination);

  const req = new XMLHttpRequest();
  req.open('GET', url, true);
  req.responseType = 'arraybuffer';

  req.onload = () => {
    context.decodeAudioData(req.response, (buf) => {
      const getSource = () => {
        const source = context.createBufferSource();
        source.buffer = buf;
        source.connect(masterGain);
        return source;
      };

      music.killStart = () => {
        music.start = () => {};
      };

      music.start = () => {
        music.killStart();
        if (!store.getState().get('music')) {
          return;
        }
        getSource().start(0, 3.7202, 3.6224);
      };

      music.clear = () => {
        if (!store.getState().get('music')) {
          return;
        }
        getSource().start(0, 0, 0.7675);
      };

      music.fall = () => {
        if (!store.getState().get('music')) {
          return;
        }
        getSource().start(0, 1.2558, 0.3546);
      };

      music.gameover = () => {
        if (!store.getState().get('music')) {
          return;
        }
        getSource().start(0, 8.1276, 1.1437);
      };

      music.rotate = () => {
        if (!store.getState().get('music')) {
          return;
        }
        getSource().start(0, 2.2471, 0.0807);
      };

      music.move = () => {
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

  const firstInteraction = () => {
    resumeContext();
    document.removeEventListener('touchstart', firstInteraction, true);
    document.removeEventListener('mousedown', firstInteraction, true);
    document.removeEventListener('keydown', firstInteraction, true);
  };
  document.addEventListener('touchstart', firstInteraction, true);
  document.addEventListener('mousedown', firstInteraction, true);
  document.addEventListener('keydown', firstInteraction, true);

  music.bgmStart = () => {};
  music.bgmStop = () => {};

  music.click = () => {
    if (!store.getState().get('music')) return;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = 'square';
    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.08, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.04);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start();
    osc.stop(context.currentTime + 0.04);
  };

  req.send();
})();

export {
  hasWebAudioAPI,
  music,
};
