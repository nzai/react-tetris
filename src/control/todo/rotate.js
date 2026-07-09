import { want } from '../../unit/';
import event from '../../unit/event';
import actions from '../../actions';
import states from '../states';
import { music } from '../../unit/music';

const down = (store) => {
  store.dispatch(actions.keyboard.rotate(true));
  if (store.getState().get('cur') !== null) {
    event.down({
      key: 'rotate',
      once: true,
      callback: () => {
        const state = store.getState();
        if (state.get('lock')) {
          return;
        }
        if (state.get('pause')) {
          states.pause(false);
        }
        const cur = state.get('cur');
        if (cur === null) {
          return;
        }
        if (music.rotate) {
          music.rotate();
        }
        const next = cur.rotate();
        if (want(next, state.get('matrix'))) {
          store.dispatch(actions.moveBlock(next));
        } else {
          // 旋转后直接放置会越界，尝试向左右微调（wall kick）
          // 1. 方块靠右墙时旋转可能超出右边界，试左移 1~2 格让方块"弹"进棋盘
          for (let shift = 1; shift <= 2; shift++) {
            const kicked = Object.assign({}, next, {
              xy: [next.xy[0], next.xy[1] - shift],
            });
            if (want(kicked, state.get('matrix'))) {
              store.dispatch(actions.moveBlock(kicked));
              return;
            }
          }
          // 2. 方块靠左墙时旋转可能超出左边界，试右移 1~2 格避免"吸住"不动
          for (let shift = 1; shift <= 2; shift++) {
            const kicked = Object.assign({}, next, {
              xy: [next.xy[0], next.xy[1] + shift],
            });
            if (want(kicked, state.get('matrix'))) {
              store.dispatch(actions.moveBlock(kicked));
              return;
            }
          }
        }
      },
    });
  } else {
    event.down({
      key: 'rotate',
      begin: 200,
      interval: 100,
      callback: () => {
        if (store.getState().get('lock')) {
          return;
        }
        if (music.move) {
          music.move();
        }
        const state = store.getState();
        const cur = state.get('cur');
        if (cur) {
          return;
        }
        let startLines = state.get('startLines');
        startLines = startLines + 1 > 10 ? 0 : startLines + 1;
        store.dispatch(actions.startLines(startLines));
      },
    });
  }
};

const up = (store) => {
  store.dispatch(actions.keyboard.rotate(false));
  event.up({
    key: 'rotate',
  });
};

export default {
  down,
  up,
};
