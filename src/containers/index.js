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

import { transform, lastRecord, speeds, i18n, lan } from '../unit/const';
import { visibilityChangeEvent, isFocus } from '../unit/';
import store from '../store';
import actions from '../actions';
import states from '../control/states';
import todo from '../control/todo';
import { music } from '../unit/music';

const DRAG_THRESHOLD = 20;
const HARD_DROP_THRESHOLD = 60;
const TAP_COOLDOWN = 160;

class App extends React.Component {
  constructor() {
    super();
    this.state = {
      w: window.innerWidth,
      h: window.innerHeight,
    };
    this.dragState = null;
    this.lastActionTime = 0;
    this.lastAdjTime = 0;
    this.onResize = this.onResize.bind(this);
    this.onDragStart = this.onDragStart.bind(this);
    this.onDragMove = this.onDragMove.bind(this);
    this.onDragEnd = this.onDragEnd.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
  }
  componentWillMount() {
    window.addEventListener('resize', this.onResize, true);
  }
  componentDidMount() {
    if (visibilityChangeEvent) {
      document.addEventListener(visibilityChangeEvent, () => {
        states.focus(isFocus());
      }, false);
    }

    if (lastRecord) {
      if (lastRecord.cur && !lastRecord.pause) {
        const speedRun = this.props.speedRun;
        let timeout = speeds[speedRun - 1] / 2;
        timeout = speedRun < speeds[speeds.length - 1]
          ? speeds[speeds.length - 1] : speedRun;
        states.auto(timeout);
      }
      if (!lastRecord.cur) {
        states.overStart();
      }
    } else {
      states.overStart();
    }

    if (this.dragRef) {
      this.dragRef.addEventListener('touchmove', (e) => {
        e.preventDefault();
      }, { passive: false });
    }
    document.addEventListener('touchmove', (e) => {
      e.preventDefault();
    }, { passive: false });
  }
  componentWillUnmount() {
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
  }
  onResize() {
    this.setState({
      w: window.innerWidth,
      h: window.innerHeight,
    });
  }
  onDragStart(e) {
    if (!this.props.cur || this.props.pause || this.props.reset) return;
    const c = this.getDragCoords(e);
    if (!c) return;
    e.stopPropagation();
    if (e.type === 'mousedown') {
      window.addEventListener('mousemove', this.onMouseMove);
      window.addEventListener('mouseup', this.onMouseUp);
    }
    this.dragState = {
      lastX: c.x,
      lastY: c.y,
      moved: false,
      dirLock: null,
    };
  }
  onDragMove(e) {
    if (!this.dragState) return;
    e.preventDefault();
    e.stopPropagation();
    const c = this.getDragCoords(e);
    if (!c) return;
    const dx = c.x - this.dragState.lastX;
    const dy = c.y - this.dragState.lastY;

    if (!this.dragState.dirLock) {
      if (Math.abs(dx) > DRAG_THRESHOLD) {
        this.dragState.dirLock = 'h';
      } else if (dy > DRAG_THRESHOLD) {
        this.dragState.dirLock = 'v';
      }
    }

    if (this.dragState.dirLock !== 'v' && Math.abs(dx) > DRAG_THRESHOLD) {
      const key = dx > 0 ? 'right' : 'left';
      todo[key].down(store);
      todo[key].up(store);
      this.dragState.lastX = c.x;
      this.dragState.lastY = c.y;
      this.dragState.moved = true;
    }

    if (this.dragState.dirLock !== 'h' && dy > DRAG_THRESHOLD) {
      this.dragState.totalDY = (this.dragState.totalDY || 0) + dy;
      if (this.dragState.totalDY >= HARD_DROP_THRESHOLD) {
        if (!this.dragState.hardDropped) {
          todo.space.down(store);
          this.dragState.hardDropped = true;
        }
      } else {
        todo.down.down(store);
        todo.down.up(store);
      }
      this.dragState.lastY = c.y;
      this.dragState.moved = true;
    }
  }
  onDragEnd(e) {
    if (!this.dragState) return;
    if (e.type === 'mouseup') {
      window.removeEventListener('mousemove', this.onMouseMove);
      window.removeEventListener('mouseup', this.onMouseUp);
    }
    if (!this.dragState.moved) {
      const now = Date.now();
      if (now - this.lastActionTime > TAP_COOLDOWN) {
        todo.rotate.down(store);
        this.lastActionTime = now;
      }
    }
    this.dragState = null;
  }
  onMouseMove(e) {
    if (!this.dragState) return;
    e.preventDefault();
    const el = this.dragRef;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const dx = x - this.dragState.lastX;
    const dy = y - this.dragState.lastY;

    if (!this.dragState.dirLock) {
      if (Math.abs(dx) > DRAG_THRESHOLD) {
        this.dragState.dirLock = 'h';
      } else if (dy > DRAG_THRESHOLD) {
        this.dragState.dirLock = 'v';
      }
    }

    if (this.dragState.dirLock !== 'v' && Math.abs(dx) > DRAG_THRESHOLD) {
      const key = dx > 0 ? 'right' : 'left';
      todo[key].down(store);
      todo[key].up(store);
      this.dragState.lastX = x;
      this.dragState.lastY = y;
      this.dragState.moved = true;
    }

    if (this.dragState.dirLock !== 'h' && dy > DRAG_THRESHOLD) {
      this.dragState.totalDY = (this.dragState.totalDY || 0) + dy;
      if (this.dragState.totalDY >= HARD_DROP_THRESHOLD) {
        if (!this.dragState.hardDropped) {
          todo.space.down(store);
          this.dragState.hardDropped = true;
        }
      } else {
        todo.down.down(store);
        todo.down.up(store);
      }
      this.dragState.lastY = y;
      this.dragState.moved = true;
    }
  }
  onMouseUp(e) {
    this.onDragEnd(e);
  }
  getDragCoords(e) {
    const el = this.dragRef;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const c = e.touches ? e.touches[0] : e;
    return {
      x: c.clientX - rect.left,
      y: c.clientY - rect.top,
      w: rect.width,
    };
  }
  render() {
    const size = (() => {
      const w = this.state.w;
      const h = this.state.h;
      const baseW = 500;
      const baseH = 1040;
      let scale = Math.min(w / baseW, h / baseH);
      if (scale > 1) scale = 1;
      const css = {};
      css[transform] = `translate(-50%, -50%) scale(${scale})`;
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
                    <div className={style.preGameStats}>
                      <div className={style.topStatCol}>
                        <span>{i18n.highestScore[lan]}</span>
                        <div className={style.numScale}>
                          <Number number={this.props.max} />
                        </div>
                      </div>
                      <div
                        className={style.topStatCol}
                        onMouseDown={() => {
                          const now = Date.now();
                          if (now - this.lastAdjTime < 200) return;
                          this.lastAdjTime = now;
                          let next = this.props.startLines + 1;
                          if (next > 10) next = 0;
                          store.dispatch(actions.startLines(next));
                          music.click();
                        }}
                        onTouchStart={() => {
                          const now = Date.now();
                          if (now - this.lastAdjTime < 200) return;
                          this.lastAdjTime = now;
                          let next = this.props.startLines + 1;
                          if (next > 10) next = 0;
                          store.dispatch(actions.startLines(next));
                          music.click();
                        }}
                      >
                        <span>{i18n.startLine[lan]}</span>
                        <div className={style.numScale}>
                          <Number number={this.props.startLines} length={1} />
                        </div>
                      </div>
                      <div
                        className={style.topStatCol}
                        onMouseDown={() => {
                          const now = Date.now();
                          if (now - this.lastAdjTime < 200) return;
                          this.lastAdjTime = now;
                          let next = this.props.speedStart + 1;
                          if (next > 6) next = 1;
                          store.dispatch(actions.speedStart(next));
                          music.click();
                        }}
                        onTouchStart={() => {
                          const now = Date.now();
                          if (now - this.lastAdjTime < 200) return;
                          this.lastAdjTime = now;
                          let next = this.props.speedStart + 1;
                          if (next > 6) next = 1;
                          store.dispatch(actions.speedStart(next));
                          music.click();
                        }}
                      >
                        <span>{i18n.level[lan]}</span>
                        <div className={style.numScale}>
                          <Number number={this.props.speedStart} length={1} />
                        </div>
                      </div>
                    </div>
                    <div
                      className={style.preMusic}
                      onMouseDown={() => {
                        store.dispatch(actions.music(!store.getState().get('music')));
                      }}
                      onTouchStart={() => {
                        store.dispatch(actions.music(!store.getState().get('music')));
                      }}
                    >
                      <Music data={this.props.music} />
                    </div>
                  </div>
                ) : (
                  <div className={style.inGame}>
                    <div className={style.topLeft}>
                      <div className={style.topScoreBox}>
                        <Point
                          cur={!!this.props.cur}
                          point={this.props.points}
                          max={this.props.max}
                        />
                      </div>
                      <span>{i18n.cleans[lan]}</span>
                      <Number number={this.props.clearLines} />
                    </div>
                    <div className={style.topCenter}>
                      <Next data={this.props.next} />
                    </div>
                    <div className={style.topRight}>
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
                )}
              </div>
              <div
                className={style.boardArea}
                ref={(c) => { this.dragRef = c; }}
                onTouchStart={this.onDragStart}
                onTouchMove={this.onDragMove}
                onTouchEnd={this.onDragEnd}
                onMouseDown={this.onDragStart}
              >
                <Matrix
                  matrix={this.props.matrix}
                  cur={this.props.cur}
                  reset={this.props.reset}
                />
                <Logo cur={!!this.props.cur} reset={this.props.reset} />
                {!this.props.cur && (
                  <div>
                    <div
                      className={style.startButton}
                      onMouseDown={() => states.start()}
                      onTouchStart={() => states.start()}
                    >
                      {i18n.start[lan]}
                    </div>
                    <div className={style.hint}>
                      滑动=移动/下落 · 点击=旋转
                    </div>
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
});

export default connect(mapStateToProps)(App);
