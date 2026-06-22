import React from 'react';
import cn from 'classnames';
import propTypes from 'prop-types';

import style from './index.module.less';

export default class Ghost extends React.Component {
  shouldComponentUpdate({ data }) {
    return data !== this.props.data;
  }
  render() {
    return (
      <div
        className={cn(
          {
            [style.ghost]: true,
            [style.c]: !this.props.data,
          }
        )}
      >
        <span className={style.b1} />
        <span className={style.b2} />
        <span className={style.b3} />
        <span className={style.b4} />
      </div>
    );
  }
}

Ghost.propTypes = {
  data: propTypes.bool.isRequired,
};
