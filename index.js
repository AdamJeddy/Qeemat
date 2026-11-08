/**
 * @format
 */

import { AppRegistry, NativeModules } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { runDiscoveryBackgroundRefresh } from './src/domain/discoveryBackground';
import { runBackgroundUpdateCheck } from './src/domain/updateBackground';
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

AppRegistry.registerHeadlessTask('QeematBackgroundUpdateCheck', () => runBackgroundUpdateCheck);

AppRegistry.registerHeadlessTask('QeematBackgroundDiscoveryRefresh', () => async (taskData) => {
  try {
    await runDiscoveryBackgroundRefresh();
    if (typeof taskData?.completionToken === 'string') { NativeModules.QeematBackgroundCheck?.completeDiscovery?.(taskData.completionToken, true); }
  } catch (error) {
    if (typeof taskData?.completionToken === 'string') { NativeModules.QeematBackgroundCheck?.completeDiscovery?.(taskData.completionToken, false); }
    throw error;
  }
});
