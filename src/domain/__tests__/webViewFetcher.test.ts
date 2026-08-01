jest.mock('react-native', () => ({
  NativeModules: {
    QeematWebViewFetcher: {
      fetchPageHtml: jest.fn().mockResolvedValue('<html>product</html>')
    }
  },
  Platform: { OS: 'ios' }
}));

import { NativeModules } from 'react-native';

import { fetchPageHtmlViaWebView } from '../webViewFetcher';

describe('WebView fetch platform adapter', () => {
  it('uses an available native WebView fetcher on iOS', async () => {
    await expect(fetchPageHtmlViaWebView('https://example.com/product')).resolves.toBe('<html>product</html>');
    expect(NativeModules.QeematWebViewFetcher.fetchPageHtml).toHaveBeenCalledWith('https://example.com/product');
  });
});
