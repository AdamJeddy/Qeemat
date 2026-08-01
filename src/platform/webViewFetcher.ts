import { NativeModules } from 'react-native';

export type WebViewFetcherModule = {
  fetchPageHtml: (url: string) => Promise<string>;
};

const webViewFetcher = NativeModules.QeematWebViewFetcher as WebViewFetcherModule | undefined;

/**
 * Fetch page HTML using the platform's native WebView implementation. This can
 * help with challenges that reject the networking stack used by standard fetch.
 *
 * Falls back to null if the platform has no native fetcher or in tests.
 */
export async function fetchPageHtmlViaWebView(url: string): Promise<string | null> {
  if (!webViewFetcher?.fetchPageHtml) {
    return null;
  }

  try {
    const html = await webViewFetcher.fetchPageHtml(url);
    return html;
  } catch {
    return null;
  }
}
