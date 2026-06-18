import event from '../../unit/event';
import actions from '../../actions';
import { music } from '../../unit/music';

const down = (store) => {
  store.dispatch(actions.keyboard.music(true));
  if (store.getState().get('lock')) {
    return;
  }
  event.down({
    key: 's',
    once: true,
    callback: () => {
      if (store.getState().get('lock')) {
        return;
      }
      const newMusic = !store.getState().get('music');
      store.dispatch(actions.music(newMusic));
      if (newMusic) {
        const state = store.getState();
        if (state.get('cur') && !state.get('reset') && !state.get('pause')) {
          if (music.bgmStart) {
            music.bgmStart();
          }
        }
      } else if (music.bgmStop) {
        music.bgmStop();
      }
    },
  });
};

const up = (store) => {
  store.dispatch(actions.keyboard.music(false));
  event.up({
    key: 's',
  });
};


export default {
  down,
  up,
};
