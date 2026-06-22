import React from 'react';
import Immutable from 'immutable';
import propTypes from 'prop-types';
import classnames from 'classnames';

import style from './index.module.less';
import Button from './button';
import store from '../../store';
import todo from '../../control/todo';
import { i18n, lan } from '../../unit/const';

export default class Keyboard extends React.Component {
  constructor() {
    super();
    this.state = {
      leftHanded: false,
    };
  }
  componentDidMount() {
    const touchEventCatch = {};
    const mouseDownEventCatch = {};
    document.addEventListener('touchstart', (e) => {
      if (e.preventDefault) {
        e.preventDefault();
      }
    }, true);

    document.addEventListener('touchend', (e) => {
      if (e.preventDefault) {
        e.preventDefault();
      }
    }, true);

    document.addEventListener('gesturestart', (e) => {
      if (e.preventDefault) {
        event.preventDefault();
      }
    });

    document.addEventListener('mousedown', (e) => {
      if (e.preventDefault) {
        e.preventDefault();
      }
    }, true);

    const gameActions = ['left', 'right', 'down', 'rotate', 'space'];
    Object.keys(todo).forEach((key) => {
      this[`dom_${key}`].dom.addEventListener('mousedown', () => {
        if (touchEventCatch[key] === true) {
          return;
        }
        if (gameActions.indexOf(key) !== -1 && !store.getState().get('cur')) {
          return;
        }
        todo[key].down(store);
        mouseDownEventCatch[key] = true;
      }, true);
      this[`dom_${key}`].dom.addEventListener('mouseup', () => {
        if (touchEventCatch[key] === true) {
          touchEventCatch[key] = false;
          return;
        }
        todo[key].up(store);
        mouseDownEventCatch[key] = false;
      }, true);
      this[`dom_${key}`].dom.addEventListener('mouseout', () => {
        if (mouseDownEventCatch[key] === true) {
          todo[key].up(store);
        }
      }, true);
      this[`dom_${key}`].dom.addEventListener('touchstart', () => {
        if (gameActions.indexOf(key) !== -1 && !store.getState().get('cur')) {
          return;
        }
        touchEventCatch[key] = true;
        todo[key].down(store);
      }, true);
      this[`dom_${key}`].dom.addEventListener('touchend', () => {
        todo[key].up(store);
      }, true);
    });
  }
  shouldComponentUpdate({ keyboard, filling }, nextState) {
    return !Immutable.is(keyboard, this.props.keyboard) || filling !== this.props.filling
      || (nextState && nextState.leftHanded !== this.state.leftHanded);
  }
  render() {
    const keyboard = this.props.keyboard;
    const leftHanded = this.state.leftHanded;
    const swap = () => {
      if (!store.getState().get('cur')) {
        this.setState({ leftHanded: !leftHanded });
      }
    };
    return (
      <div className={classnames(style.keyboard, { [style.swap]: leftHanded })}>
        <div className={style.dpad}>
          <div className={style.dpadRow}>
            <Button
              color="blue" size="s2" staticPos label=""
              active={keyboard.get('left')}
              ref={(c) => { this.dom_left = c; }}
            />
            <span />
            <Button
              color="blue" size="s2" staticPos label=""
              active={keyboard.get('right')}
              ref={(c) => { this.dom_right = c; }}
            />
          </div>
          <div className={style.dpadRow}>
            <span />
            <Button
              color="blue" size="s2" staticPos label=""
              active={keyboard.get('down')}
              ref={(c) => { this.dom_down = c; }}
            />
            <span />
          </div>
        </div>
        <div
          className={classnames(style.swapBtn, {
            [style.swapBtnDisabled]: !!store.getState().get('cur'),
          })}
          onMouseDown={swap}
          onTouchStart={swap}
        >
          ⇄
        </div>
        <div className={style.actions}>
          <Button
            color="blue" size="s2" staticPos label={i18n.drop[lan]}
            active={keyboard.get('drop')}
            ref={(c) => { this.dom_space = c; }}
          />
          <Button
            color="blue" size="s2" staticPos label={i18n.rotation[lan]}
            active={keyboard.get('rotate')}
            ref={(c) => { this.dom_rotate = c; }}
          />
        </div>
        <div style={{ display: 'none' }}>
          <Button
            color="green" size="s2" staticPos label=""
            active={keyboard.get('pause')}
            ref={(c) => { this.dom_p = c; }}
          />
          <Button
            color="green" size="s2" staticPos label=""
            active={keyboard.get('music')}
            ref={(c) => { this.dom_s = c; }}
          />
          <Button
            color="red" size="s2" staticPos label=""
            active={keyboard.get('reset')}
            ref={(c) => { this.dom_r = c; }}
          />
        </div>
      </div>
    );
  }
}

Keyboard.propTypes = {
  filling: propTypes.number,
  keyboard: propTypes.object.isRequired,
};
