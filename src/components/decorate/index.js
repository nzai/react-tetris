import React from 'react';
import cn from 'classnames';

import { i18n, lan } from '../../unit/const';
import style from './index.less';

export default class Decorate extends React.Component {
  shouldComponentUpdate() {
    return false;
  }
  render() {
    return (
      <div className={style.decorate}>
        <div className={style.topBorder}>
          <span className={cn(['l', style.mr])} style={{ width: 40 }} />
          <span className={cn(['l', style.mr])} />
          <span className={cn(['l', style.mr])} />
          <span className={cn(['l', style.mr])} />
          <span className={cn(['l', style.mr])} />
          <span className={cn(['r', style.ml])} style={{ width: 40 }} />
          <span className={cn(['r', style.ml])} />
          <span className={cn(['r', style.ml])} />
          <span className={cn(['r', style.ml])} />
          <span className={cn(['r', style.ml])} />
        </div>
        <h1>{i18n.title[lan]}</h1>
      </div>
    );
  }
}
