import React from 'react';
import propTypes from 'prop-types';
import cn from 'classnames';
import style from './dialog.module.less';

class SettingsDialog extends React.Component {
  constructor(props) {
    super(props);
    this.lastTap = 0;
    this.state = {
      pendingMusic: props.music,
      pendingGhost: props.ghost,
    };
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.music !== this.props.music || nextProps.ghost !== this.props.ghost) {
      this.setState({
        pendingMusic: nextProps.music,
        pendingGhost: nextProps.ghost,
      });
    }
  }

  render() {
    const { onConfirm, onClose } = this.props;
    const { pendingMusic, pendingGhost } = this.state;

    const tap = (fn) => (e) => {
      e.preventDefault();
      const now = Date.now();
      if (now - this.lastTap < 300) return;
      this.lastTap = now;
      fn();
    };

    return (
      <div className={style.overlay} onMouseDown={onClose}>
        <div className={style.dialog} onMouseDown={(e) => e.stopPropagation()}>
          <button className={style.closeBtn} onClick={onClose}>×</button>
          <div className={style.list}>
            <div className={style.row}>
              <span className={style.label}>音效</span>
              <button
                className={cn(style.switch, { [style.on]: pendingMusic })}
                onMouseDown={tap(() => this.setState({ pendingMusic: !pendingMusic }))}
              >
                <span className={style.knob} />
              </button>
            </div>
            <div className={style.row}>
              <span className={style.label}>影子方块</span>
              <button
                className={cn(style.switch, { [style.on]: pendingGhost })}
                onMouseDown={tap(() => this.setState({ pendingGhost: !pendingGhost }))}
              >
                <span className={style.knob} />
              </button>
            </div>
          </div>
          <button
            className={style.confirmBtn}
            onMouseDown={tap(() => onConfirm(pendingMusic, pendingGhost))}
          >
            确定
          </button>
        </div>
      </div>
    );
  }
}

SettingsDialog.propTypes = {
  music: propTypes.bool.isRequired,
  ghost: propTypes.bool.isRequired,
  onConfirm: propTypes.func.isRequired,
  onClose: propTypes.func.isRequired,
};

export default SettingsDialog;
