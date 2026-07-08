import { NativeModules, Platform } from 'react-native';

type WebViewFetcherModule = {
  fetchPageHtml: (url: string) => Promise<string>;
};

const webViewFetcher = NativeModules.QeematWebViewFetcher as WebViewFetcherModule | undefined;

/**
 * Fetch page HTML using Android's native WebView, which passes Cloudflare
 * challenges because it uses the system browser engine (Chrome on Android).
 *
 * Falls back to null if the module is unavailable (e.g. on iOS or in tests).
 */
export async function fetchPageHtmlViaWebView(url: string): Promise<string | null> {
  if (Platform.OS !== 'android' || !webViewFetcher?.fetchPageHtml) {
    return null;
  }

  try {
    const html = await webViewFetcher.fetchPageHtml(url);
    return html;
  } catch {
    return null;
  }
}
