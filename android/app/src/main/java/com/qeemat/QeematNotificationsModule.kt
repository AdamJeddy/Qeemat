package com.qeemat

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

private const val PRICE_ALERT_CHANNEL_ID = "qeemat-price-alerts"
private const val PRICE_ALERT_CHANNEL_NAME = "Price alerts"

class QeematNotificationsModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "QeematNotifications"

  @ReactMethod
  fun areEnabled(promise: Promise) {
    try {
      val notificationsEnabled = NotificationManagerCompat.from(reactContext).areNotificationsEnabled()
      val permissionGranted =
          Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
              ContextCompat.checkSelfPermission(
                  reactContext,
                  Manifest.permission.POST_NOTIFICATIONS,
              ) == PackageManager.PERMISSION_GRANTED

      promise.resolve(notificationsEnabled && permissionGranted)
    } catch (error: Exception) {
      promise.reject("QNOTIFY_STATUS_FAILED", error)
    }
  }

  @ReactMethod
  fun notifyPriceAlert(title: String, message: String, notificationId: Double, promise: Promise) {
    try {
      if (!areNotificationsAllowed()) {
        promise.resolve(false)
        return
      }

      ensureNotificationChannel()

      val launchIntent =
          reactContext.packageManager.getLaunchIntentForPackage(reactContext.packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
          }
      val pendingIntent =
          launchIntent?.let {
            PendingIntent.getActivity(
                reactContext,
                notificationId.toInt(),
                it,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
          }

      val notification =
          NotificationCompat.Builder(reactContext, PRICE_ALERT_CHANNEL_ID)
              .setSmallIcon(R.mipmap.ic_launcher)
              .setContentTitle(title)
              .setContentText(message)
              .setStyle(NotificationCompat.BigTextStyle().bigText(message))
              .setAutoCancel(true)
              .setPriority(NotificationCompat.PRIORITY_DEFAULT)
              .setContentIntent(pendingIntent)
              .build()

      NotificationManagerCompat.from(reactContext).notify(notificationId.toInt(), notification)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("QNOTIFY_SEND_FAILED", error)
    }
  }

  @ReactMethod
  fun openNotificationSettings(promise: Promise) {
    try {
      val intent =
          Intent().apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
              action = Settings.ACTION_APP_NOTIFICATION_SETTINGS
              putExtra(Settings.EXTRA_APP_PACKAGE, reactContext.packageName)
            } else {
              action = Settings.ACTION_APPLICATION_DETAILS_SETTINGS
              data = android.net.Uri.parse("package:${reactContext.packageName}")
            }
          }

      reactContext.startActivity(intent)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("QNOTIFY_OPEN_SETTINGS_FAILED", error)
    }
  }

  private fun ensureNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }

    val manager =
        reactContext.getSystemService(NotificationManager::class.java) ?: return
    val channel =
        NotificationChannel(
            PRICE_ALERT_CHANNEL_ID,
            PRICE_ALERT_CHANNEL_NAME,
            NotificationManager.IMPORTANCE_DEFAULT,
        ).apply {
          description = "Alerts when Qeemat detects matching price changes."
        }

    manager.createNotificationChannel(channel)
  }

  private fun areNotificationsAllowed(): Boolean {
    val notificationsEnabled = NotificationManagerCompat.from(reactContext).areNotificationsEnabled()
    val permissionGranted =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(
                reactContext,
                Manifest.permission.POST_NOTIFICATIONS,
            ) == PackageManager.PERMISSION_GRANTED

    return notificationsEnabled && permissionGranted
  }
}
