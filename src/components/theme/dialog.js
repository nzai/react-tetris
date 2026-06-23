import React from 'react';
import propTypes from 'prop-types';
import cn from 'classnames';
import style from './dialog.module.less';

// 预览用棋盘数据：模拟一个有方块残局的棋盘
const previewGrid = [
  [0, 0, 0, 0, 0, 1, 1, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 1, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
  [1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
  [0, 0, 0, 0, 0, 0, 1, 1, 1, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
];

class ThemeDialog extends React.Component {
  constructor(props) {
    super(props);
    this.lastTap = 0;
    this.state = {
      pending: props.active,
    };
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.active !== this.props.active) {
      this.setState({ pending: nextProps.active });
    }
  }

  render() {
    const { themes, onSelect, onClose } = this.props;
    const { pending } = this.state;
    const selected = themes.find((t) => t.id === pending) || themes[0];

    const bgStyle = selected.type === 'color'
      ? { background: selected.value }
      : { backgroundImage: `url(${selected.src})` };

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
          <div className={style.body}>
            <div className={style.list}>
              {themes.map((t) => (
                <div
                  key={t.id}
                  className={cn(style.item, { [style.active]: t.id === pending })}
                  onMouseDown={tap(() => this.setState({ pending: t.id }))}
                >
                  {t.type === 'color' ? (
                    <span className={style.swatch} style={{ background: t.value }} />
                  ) : (
                    <span className={style.thumb} style={{ backgroundImage: `url(${t.src})` }} />
                  )}
                  {t.name}
                </div>
              ))}
            </div>
            <div className={style.preview}>
              <div
                className={cn(style.bg, { [style.imageBg]: selected.type === 'image' })}
                style={bgStyle}
              />
              <div className={style.grid}>
                {previewGrid.map((row, ri) => (
                  <div className={style.row} key={ri}>
                    {row.map((cell, ci) => (
                      <div
                        className={cn(style.cell, { [style.filled]: cell === 1 })}
                        key={ci}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <button className={style.confirmBtn} onMouseDown={tap(() => onSelect(pending))}>
            确定
          </button>
        </div>
      </div>
    );
  }
}

ThemeDialog.propTypes = {
  themes: propTypes.array.isRequired,
  active: propTypes.string.isRequired,
  onSelect: propTypes.func.isRequired,
  onClose: propTypes.func.isRequired,
};

export default ThemeDialog;
