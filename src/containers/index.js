import React from 'react';
import { connect } from 'react-redux';
import classnames from 'classnames';
import propTypes from 'prop-types';

import style from './index.less';

import Matrix from '../components/matrix';
import Decorate from '../components/decorate';
import Number from '../components/number';
import Next from '../components/next';
import Music from '../components/music';
import Point from '../components/point';
import Logo from '../components/logo';
import Keyboard from '../components/keyboard';

import { transform, lastRecord, speeds, i18n, lan } from '../unit/const';
import { visibilityChangeEvent, isFocus } from '../unit/';
import store from '../store';
import actions from '../actions';
import states from '../control/states';
import { music } from '../unit/music';

class App extends React.Component {
  constructor() {
    super();
    this.state = {
      w: document.documentElement.clientWidth,
      h: document.documentElement.clientHeight,
    };
  }
  componentWillMount() {
    window.addEventListener('resize', this.resize.bind(this), true);
  }
  componentDidMount() {
    if (visibilityChangeEvent) { // 将页面的焦点变换写入store
      document.addEventListener(visibilityChangeEvent, () => {
        states.focus(isFocus());
      }, false);
    }

    if (lastRecord) { // 读取记录
      if (lastRecord.cur && !lastRecord.pause) { // 拿到上一次游戏的状态, 如果在游戏中且没有暂停, 游戏继续
        const speedRun = this.props.speedRun;
        let timeout = speeds[speedRun - 1] / 2; // 继续时, 给予当前下落速度一半的停留时间
        // 停留时间不小于最快速的速度
        timeout = speedRun < speeds[speeds.length - 1] ? speeds[speeds.length - 1] : speedRun;
        states.auto(timeout);
      }
      if (!lastRecord.cur) {
        states.overStart();
      }
    } else {
      states.overStart();
    }
  }
  resize() {
    this.setState({
      w: document.documentElement.clientWidth,
      h: document.documentElement.clientHeight,
    });
  }
  render() {
    const filling = 0;
    const size = (() => {
      const w = this.state.w;
      const h = this.state.h;
      const baseW = 500;
      const baseH = 1140;
      let scale = Math.min(w / baseW, h / baseH);
      if (scale > 1) scale = 1;
      const css = {};
      css[transform] = `scale(${scale})`;
      return css;
    })();

    return (
      <div
        className={style.app}
        style={size}
      >
        <div className={classnames({ [style.rect]: true, [style.drop]: this.props.drop })}>
          <Decorate />
          <div className={style.screen}>
            <div className={style.panel}>
              <div className={style.topBar}>
                {!this.props.cur ? (
                  <div className={style.preGame}>
                    <div className={style.topStatCol}>
                      <span>{i18n.highestScore[lan]}</span>
                      <Number number={this.props.max} />
                    </div>
                    <div className={style.topStatCol}>
                      <span>{i18n.startLine[lan]}</span>
                      <Number number={this.props.startLines} length={1} />
                    </div>
                    <div className={style.topStatCol}>
                      <span>{i18n.level[lan]}</span>
                      <Number number={this.props.speedStart} length={1} />
                    </div>
                  </div>
                ) : (
                  <div className={style.inGame}>
                    <div className={style.topLeft}>
                      <span>{i18n.cleans[lan]}</span>
                      <Number number={this.props.clearLines} />
                    </div>
                    <div className={style.topCenter}>
                      <Next data={this.props.next} />
                    </div>
                    <div className={style.topRight}>
                      <div className={style.topScoreBox}>
                        <Point
                          cur={!!this.props.cur}
                          point={this.props.points}
                          max={this.props.max}
                        />
                      </div>
                      <div className={style.switchGroup}>
                        <div
                          className={style.topRestart}
                          onMouseDown={() => {
                            states.overStart();
                            setTimeout(() => states.start(), 500);
                          }}
                          onTouchStart={() => {
                            states.overStart();
                            setTimeout(() => states.start(), 500);
                          }}
                        >
                          {i18n.reset[lan]}
                        </div>
                        <div
                          className={style.topMusic}
                          onMouseDown={() => {
                            const on = !store.getState().get('music');
                            store.dispatch(actions.music(on));
                            if (on) {
                              const s = store.getState();
                              if (s.get('cur') && !s.get('reset') && !s.get('pause')) {
                                if (music.bgmStart) music.bgmStart();
                              }
                            } else if (music.bgmStop) {
                              music.bgmStop();
                            }
                          }}
                          onTouchStart={() => {
                            const on = !store.getState().get('music');
                            store.dispatch(actions.music(on));
                            if (on) {
                              const s = store.getState();
                              if (s.get('cur') && !s.get('reset') && !s.get('pause')) {
                                if (music.bgmStart) music.bgmStart();
                              }
                            } else if (music.bgmStop) {
                              music.bgmStop();
                            }
                          }}
                        >
                          <Music data={this.props.music} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className={style.boardArea}>
                <Matrix
                  matrix={this.props.matrix}
                  cur={this.props.cur}
                  reset={this.props.reset}
                />
                <Logo cur={!!this.props.cur} reset={this.props.reset} />
                {!this.props.cur && (
                  <div
                    className={style.startButton}
                    onMouseDown={() => states.start()}
                    onTouchStart={() => states.start()}
                  >
                    {i18n.start[lan]}
                  </div>
                )}
                {this.props.pause && this.props.cur && (
                  <div
                    className={style.continueOverlay}
                    onMouseDown={() => states.pause(false)}
                    onTouchStart={() => states.pause(false)}
                  >
                    <span>{i18n.continue[lan]}</span>
                  </div>
                )}
              </div>
              <Keyboard filling={filling} keyboard={this.props.keyboard} />
            </div>
          </div>
        </div>
      </div>
    );
  }
}

App.propTypes = {
  music: propTypes.bool.isRequired,
  pause: propTypes.bool.isRequired,
  matrix: propTypes.object.isRequired,
  next: propTypes.string.isRequired,
  cur: propTypes.object,
  dispatch: propTypes.func.isRequired,
  speedStart: propTypes.number.isRequired,
  speedRun: propTypes.number.isRequired,
  startLines: propTypes.number.isRequired,
  clearLines: propTypes.number.isRequired,
  points: propTypes.number.isRequired,
  max: propTypes.number.isRequired,
  reset: propTypes.bool.isRequired,
  drop: propTypes.bool.isRequired,
  keyboard: propTypes.object.isRequired,
};

const mapStateToProps = (state) => ({
  pause: state.get('pause'),
  music: state.get('music'),
  matrix: state.get('matrix'),
  next: state.get('next'),
  cur: state.get('cur'),
  speedStart: state.get('speedStart'),
  speedRun: state.get('speedRun'),
  startLines: state.get('startLines'),
  clearLines: state.get('clearLines'),
  points: state.get('points'),
  max: state.get('max'),
  reset: state.get('reset'),
  drop: state.get('drop'),
  keyboard: state.get('keyboard'),
});

export default connect(mapStateToProps)(App);
