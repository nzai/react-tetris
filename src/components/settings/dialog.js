import React from 'react';
import propTypes from 'prop-types';
import cn from 'classnames';
import style from './dialog.module.less';

const SettingsDialog = ({ music, ghost, onToggleMusic, onToggleGhost, onClose }) => (
  <div className={style.overlay} onMouseDown={onClose}>
    <div className={style.dialog} onMouseDown={(e) => e.stopPropagation()}>
      <button className={style.closeBtn} onClick={onClose}>×</button>
      <div className={style.list}>
        <div className={style.row}>
          <span className={style.label}>音效</span>
          <button
            className={cn(style.switch, { [style.on]: music })}
            onClick={onToggleMusic}
          >
            <span className={style.knob} />
          </button>
        </div>
        <div className={style.row}>
          <span className={style.label}>影子方块</span>
          <button
            className={cn(style.switch, { [style.on]: ghost })}
            onClick={onToggleGhost}
          >
            <span className={style.knob} />
          </button>
        </div>
      </div>
    </div>
  </div>
);

SettingsDialog.propTypes = {
  music: propTypes.bool.isRequired,
  ghost: propTypes.bool.isRequired,
  onToggleMusic: propTypes.func.isRequired,
  onToggleGhost: propTypes.func.isRequired,
  onClose: propTypes.func.isRequired,
};

export default SettingsDialog;
