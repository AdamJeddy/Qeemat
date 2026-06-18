/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { checkAllActiveProducts, checkDueProducts } from './src/domain/checker';

AppRegistry.registerComponent(appName, () => App);

AppRegistry.registerHeadlessTask('QeematBackgroundPriceCheck', () => async (taskData) => {
  if (taskData?.force) {
    await checkAllActiveProducts();
    return;
  }

  await checkDueProducts();
});
