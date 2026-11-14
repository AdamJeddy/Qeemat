package com.qeemat

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.Locale

private const val UPDATE_STATE_IDLE = "idle"
private const val UPDATE_STATE_DOWNLOADING = "downloading"
private const val UPDATE_STATE_VERIFYING = "verifying"
private const val UPDATE_STATE_READY = "ready"
private const val UPDATE_STATE_FAILED = "failed"
private const val UPDATE_STATE_CANCELLED = "cancelled"
private const val UPDATE_FILE_PROVIDER_SUFFIX = ".fileprovider"
private const val MAX_REDIRECTS = 5

private class UpdateCancelledException : Exception()

class QeematAppUpdaterModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  private var worker: Thread? = null

  @Volatile private var state = UPDATE_STATE_IDLE
  @Volatile private var downloadedBytes = 0.0
  @Volatile private var totalBytes = 0.0
  @Volatile private var downloadError: String? = null
  @Volatile private var cancelRequested = false
  @Volatile private var downloadedFile: File? = null
  @Volatile private var activeConnection: HttpURLConnection? = null

  override fun getName(): String = "QeematAppUpdater"

  @ReactMethod
  fun startDownload(url: String, fileName: String, expectedBytes: Double, sha256: String, promise: Promise) {
    try {
      if (worker?.isAlive == true) {
        promise.resolve(false)
        return
      }
      val parsed = URL(url)
      if (parsed.protocol != "https" || !isAllowedHost(parsed.host)) {
        promise.reject("QUPDATE_BAD_URL", "Update downloads must come from GitHub over HTTPS.")
        return
      }

      val directory = File(reactContext.cacheDir, "updates").apply { mkdirs() }
      directory.listFiles()?.forEach { it.delete() }
      val target = File(directory, safeFileName(fileName))

      downloadedFile = null
      downloadedBytes = 0.0
      totalBytes = 0.0
      downloadError = null
      cancelRequested = false
      state = UPDATE_STATE_DOWNLOADING

      worker = Thread({ download(url, target, expectedBytes, sha256) }, "qeemat-update-download").apply { start() }
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("QUPDATE_START_FAILED", error)
    }
  }

  @ReactMethod
  fun getDownloadState(promise: Promise) {
    val result = Arguments.createMap().apply {
      putString("state", state)
      putDouble("downloadedBytes", downloadedBytes)
      putDouble("totalBytes", totalBytes)
      putString("error", downloadError)
    }
    promise.resolve(result)
  }

  @ReactMethod
  fun installDownloaded(promise: Promise) {
    try {
      val file = downloadedFile
      if (state != UPDATE_STATE_READY || file == null || !file.isFile) {
        promise.resolve(Arguments.createMap().apply {
          putBoolean("started", false)
          putString("reason", "no_download")
        })
        return
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
          !reactContext.packageManager.canRequestPackageInstalls()) {
        promise.resolve(Arguments.createMap().apply {
          putBoolean("started", false)
          putBoolean("permissionRequired", true)
        })
        return
      }

      val uri = FileProvider.getUriForFile(reactContext, "${reactContext.packageName}$UPDATE_FILE_PROVIDER_SUFFIX", file)
      val intent = Intent(Intent.ACTION_VIEW).apply {
        setDataAndType(uri, "application/vnd.android.package-archive")
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      reactContext.startActivity(intent)
      promise.resolve(Arguments.createMap().apply { putBoolean("started", true) })
    } catch (error: Exception) {
      promise.reject("QUPDATE_INSTALL_FAILED", error)
    }
  }

  @ReactMethod
  fun openInstallPermissionSettings(promise: Promise) {
    try {
      val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
          data = Uri.parse("package:${reactContext.packageName}")
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
      } else {
        Intent(Settings.ACTION_SECURITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      reactContext.startActivity(intent)
      promise.resolve(true)
    } catch (error: Exception) {
      try {
        reactContext.startActivity(
            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
              data = Uri.parse("package:${reactContext.packageName}")
              addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            })
        promise.resolve(true)
      } catch (fallbackError: Exception) {
        promise.reject("QUPDATE_OPEN_SETTINGS_FAILED", fallbackError)
      }
    }
  }

  @ReactMethod
  fun cancelDownload(promise: Promise) {
    cancelRequested = true
    activeConnection?.disconnect()
    promise.resolve(true)
  }

  override fun invalidate() {
    cancelRequested = true
    activeConnection?.disconnect()
    super.invalidate()
  }

  private fun download(urlText: String, target: File, expectedBytes: Double, sha256: String) {
    var connection: HttpURLConnection? = null
    try {
      connection = openConnection(urlText)
      totalBytes = connection.contentLengthLong.toDouble().coerceAtLeast(0.0)
      val digest = MessageDigest.getInstance("SHA-256")
      var bytes = 0L
      connection.inputStream.use { input ->
        target.outputStream().use { output ->
          val buffer = ByteArray(64 * 1024)
          while (true) {
            if (cancelRequested) {
              throw UpdateCancelledException()
            }
            val read = input.read(buffer)
            if (read < 0) {
              break
            }
            output.write(buffer, 0, read)
            digest.update(buffer, 0, read)
            bytes += read
            downloadedBytes = bytes.toDouble()
          }
        }
      }

      if (expectedBytes > 0 && bytes != expectedBytes.toLong()) {
        target.delete()
        fail("The downloaded update was incomplete. Please try again.")
        return
      }
      if (sha256.isNotBlank()) {
        state = UPDATE_STATE_VERIFYING
        val actual = digest.digest().joinToString("") { String.format(Locale.US, "%02x", it) }
        if (!actual.equals(sha256.removePrefix("sha256:"), ignoreCase = true)) {
          target.delete()
          fail("The downloaded update failed its integrity check. Please try again.")
          return
        }
      }

      downloadedFile = target
      state = UPDATE_STATE_READY
    } catch (cancelled: UpdateCancelledException) {
      target.delete()
      downloadedFile = null
      downloadedBytes = 0.0
      state = UPDATE_STATE_CANCELLED
    } catch (error: Exception) {
      target.delete()
      downloadedFile = null
      if (cancelRequested) {
        downloadedBytes = 0.0
        state = UPDATE_STATE_CANCELLED
        return
      }
      fail(error.message?.takeIf { it.isNotBlank() } ?: "Could not download the update. Please try again.")
    } finally {
      activeConnection = null
      connection?.disconnect()
    }
  }

  private fun openConnection(urlText: String): HttpURLConnection {
    var current = URL(urlText)
    var redirects = 0
    while (true) {
      val connection = (current.openConnection() as HttpURLConnection).apply {
        instanceFollowRedirects = false
        connectTimeout = 15000
        readTimeout = 30000
        setRequestProperty("User-Agent", "Qeemat/${BuildConfig.VERSION_NAME}")
        setRequestProperty("Accept", "application/octet-stream")
      }
      activeConnection = connection
      val code = connection.responseCode
      if (code in 300..399) {
        val location = connection.getHeaderField("Location")
        connection.disconnect()
        activeConnection = null
        if (location.isNullOrBlank() || ++redirects > MAX_REDIRECTS) {
          throw IOException("GitHub did not return a valid update download.")
        }
        current = URL(current, location)
        if (current.protocol != "https" || !isAllowedHost(current.host)) {
          throw IOException("The update download was redirected to an untrusted host.")
        }
        continue
      }
      if (code != HttpURLConnection.HTTP_OK) {
        throw IOException("GitHub returned HTTP $code for the update download.")
      }
      return connection
    }
  }

  private fun fail(message: String) {
    downloadError = message
    state = UPDATE_STATE_FAILED
    downloadedBytes = 0.0
  }

  private fun isAllowedHost(host: String?): Boolean =
      host == "github.com" || (host?.endsWith(".githubusercontent.com") == true)

  private fun safeFileName(fileName: String): String {
    val base = fileName.substringAfterLast('/').substringAfterLast('\\')
    val cleaned = base.replace(Regex("[^A-Za-z0-9._-]"), "_")
    return when {
      cleaned.isBlank() -> "qeemat-update.apk"
      cleaned.endsWith(".apk", ignoreCase = true) -> cleaned
      else -> "$cleaned.apk"
    }
  }
}
