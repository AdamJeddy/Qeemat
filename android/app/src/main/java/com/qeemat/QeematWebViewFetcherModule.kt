package com.qeemat

import android.os.Handler
import android.os.Looper
import android.util.Log
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class QeematWebViewFetcherModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  companion object {
    private const val TAG = "QeematWebViewFetcher"
    private const val TOTAL_TIMEOUT_MS = 45_000L
    private const val USER_AGENT =
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) " +
      "Chrome/125.0.6422.165 Mobile Safari/537.36"
  }

  override fun getName(): String = "QeematWebViewFetcher"

  @ReactMethod
  fun fetchPageHtml(url: String, promise: Promise) {
    val handler = Handler(Looper.getMainLooper())
    var resolved = false

    // Total timeout guard (includes Cloudflare challenge time)
    val timeoutRunnable = Runnable {
      if (!resolved) {
        resolved = true
        promise.reject("WEBVIEW_TIMEOUT", "WebView page load timed out after ${TOTAL_TIMEOUT_MS}ms")
      }
    }
    handler.postDelayed(timeoutRunnable, TOTAL_TIMEOUT_MS)

    handler.post {
      val webView: WebView
      try {
        webView = WebView(reactContext.applicationContext).apply {
          settings.javaScriptEnabled = true
          settings.domStorageEnabled = true
          settings.userAgentString = USER_AGENT
          settings.blockNetworkLoads = false
          settings.blockNetworkImage = true // skip images for speed
          settings.mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        }
      } catch (e: Exception) {
        handler.removeCallbacks(timeoutRunnable)
        if (!resolved) {
          resolved = true
          promise.reject("WEBVIEW_CREATE_FAILED", "Failed to create WebView: ${e.message}")
        }
        return@post
      }

      webView.webViewClient = object : WebViewClient() {
        private var pageLoadCount = 0

        override fun onPageStarted(view: WebView, pageUrl: String, favicon: android.graphics.Bitmap?) {
          pageLoadCount++
          Log.d(TAG, "onPageStarted #$pageLoadCount: $pageUrl")
        }

        override fun shouldOverrideUrlLoading(
          view: WebView,
          request: WebResourceRequest
        ): Boolean {
          // Let WebView handle all navigations (including Cloudflare redirects)
          Log.d(TAG, "shouldOverrideUrlLoading: ${request.url}")
          return false
        }

        override fun onPageFinished(view: WebView, finishedUrl: String) {
          Log.d(TAG, "onPageFinished #$pageLoadCount: $finishedUrl")

          // After page finishes, wait a bit for Cloudflare JS challenge
          // to complete and any post-challenge redirect to happen.
          // If we're still on a Cloudflare challenge page after the delay,
          // onPageStarted/onPageFinished will fire again for the real page.
          handler.postDelayed({
            if (resolved) return@postDelayed

            view.evaluateJavascript(
              "(function() { return document.documentElement.outerHTML; })();"
            ) { html ->
              if (resolved) {
                view.destroy()
                return@evaluateJavascript
              }

              if (html == null || html == "null") {
                Log.w(TAG, "evaluateJavascript returned null, will retry on next page finish")
                return@evaluateJavascript
              }

              // Strip JSON string wrapper from evaluateJavascript
              val unescaped = html
                .removeSurrounding("\"")
                .replace("\\\"", "\"")
                .replace("\\n", "\n")
                .replace("\\/", "/")
                .replace("\\\\", "\\")

              // Check whether the storefront returned a browser challenge or
              // explicit access-denied page instead of product HTML.
              val lower = unescaped.lowercase()
              val isCloudflareChallenge =
                (lower.contains("just a moment") && lower.contains("cloudflare")) ||
                lower.contains("challenges.cloudflare.com") ||
                lower.contains("cf-browser-verify") ||
                lower.contains("cf_chl_opt") ||
                (lower.contains("checking your browser") && lower.contains("cloudflare"))
              val isAccessDenied = lower.contains("access denied") &&
                (lower.contains("edgesuite.net") || lower.contains("reference&#"))

              if (isAccessDenied) {
                resolved = true
                handler.removeCallbacks(timeoutRunnable)
                Log.w(TAG, "WebView received an access-denied page from $finishedUrl")
                promise.reject("WEBVIEW_BLOCKED", "The website blocked this check.")
                view.destroy()
                return@evaluateJavascript
              }

              if (isCloudflareChallenge) {
                Log.d(TAG, "Cloudflare challenge detected, waiting for redirect (attempt after page #$pageLoadCount)")
                // Don't resolve yet — Cloudflare will redirect and onPageFinished
                // will fire again for the real product page
                return@evaluateJavascript
              }

              if (unescaped.length < 100) {
                Log.w(TAG, "HTML too short (${unescaped.length} chars), will retry on next page finish")
                return@evaluateJavascript
              }

              // Success: we have real product page HTML
              resolved = true
              handler.removeCallbacks(timeoutRunnable)
              Log.d(TAG, "Extracted product HTML: ${unescaped.length} chars from $finishedUrl")
              promise.resolve(unescaped)
              view.destroy()
            }
          }, 2_500) // Wait 2.5s for Cloudflare challenge to complete
        }

        override fun onReceivedError(
          view: WebView,
          errorCode: Int,
          description: String,
          failingUrl: String
        ) {
          // HTTP errors (like 503 from Cloudflare) are often followed by
          // the challenge page loading successfully. Don't reject on HTTP errors.
          Log.w(TAG, "WebView HTTP error $errorCode on $failingUrl: $description (may be Cloudflare)")
        }
      }

      Log.d(TAG, "Loading URL: $url")
      webView.loadUrl(url)
    }
  }
}
