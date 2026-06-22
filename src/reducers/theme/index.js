import * as reducerType from '../../unit/reducerType';
import { lastRecord } from '../../unit/const';

const initState = lastRecord && lastRecord.theme ? lastRecord.theme : 'classic';
const theme = (state = initState, action) => {
  switch (action.type) {
    case reducerType.THEME:
      return action.data;
    default:
      return state;
  }
};

export default theme;
