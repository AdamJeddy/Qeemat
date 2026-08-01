import { NativeEventEmitter, NativeModules, NativeModule } from 'react-native';

import { detectSharedUrl } from '../domain/sites';

type SharedProductModule = NativeModule & {
  getInitialSharedText?: () => Promise<string | null>;
};

const SHARE_EVENT_NAME = 'qeematShareReceived';

export function subscribeToSharedProductUrls(onUrl: (url: string) => void): () => void {
  const shareModule = NativeModules.QeematShare as SharedProductModule | undefined;
  if (!shareModule) {
    return () => undefined;
  }

  const handleSharedText = (sharedText: string | null) => {
    if (!sharedText) {
      return;
    }

    const sharedUrl = detectSharedUrl(sharedText);
    if (sharedUrl) {
      onUrl(sharedUrl);
    }
  };

  shareModule.getInitialSharedText?.().then(handleSharedText).catch(() => undefined);
  const subscription = new NativeEventEmitter(shareModule).addListener(SHARE_EVENT_NAME, handleSharedText);

  return () => subscription.remove();
}
