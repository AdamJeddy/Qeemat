/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { checkAllActiveProductsFromBackground, checkDueProducts } from './src/domain/checker';
import {
  markBackgroundRunCompleted,
  markBackgroundRunFailed,
  markBackgroundRunStarted
} from './src/domain/backgroundStatus';

AppRegistry.registerComponent(appName, () => App);

AppRegistry.registerHeadlessTask('QeematBackgroundPriceCheck', () => async (taskData) => {
  await markBackgroundRunStarted(taskData?.source ?? 'headless', Boolean(taskData?.force));

  try {
    if (taskData?.force) {
      await checkAllActiveProductsFromBackground();
      await markBackgroundRunCompleted();
      return;
    }

    await checkDueProducts();
    await markBackgroundRunCompleted();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Background check failed.';
    await markBackgroundRunFailed(message);
    throw error;
  }
});
