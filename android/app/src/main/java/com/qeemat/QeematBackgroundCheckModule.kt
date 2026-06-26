package com.qeemat

import android.os.PowerManager
import android.provider.Settings
import androidx.work.Data
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.Calendar
import java.util.concurrent.TimeUnit

private const val PERIODIC_WORK_NAME = "qeemat-price-check-periodic"
private const val ONE_TIME_WORK_NAME = "qeemat-price-check-now"

class QeematBackgroundCheckModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "QeematBackgroundCheck"

  @ReactMethod
  fun schedule(preferredHour: Double, promise: Promise) {
    try {
      val hour = preferredHour.toInt().coerceIn(0, 23)
      val initialDelayMillis = calculateInitialDelayMillis(hour)
      val request =
          PeriodicWorkRequestBuilder<QeematBackgroundWorker>(24, TimeUnit.HOURS)
              .setInputData(Data.Builder().putBoolean("force", false).build())
              .setInitialDelay(initialDelayMillis, TimeUnit.MILLISECONDS)
              .addTag(PERIODIC_WORK_NAME)
              .build()

      WorkManager.getInstance(reactContext)
          .enqueueUniquePeriodicWork(
              PERIODIC_WORK_NAME,
              ExistingPeriodicWorkPolicy.UPDATE,
              request,
          )

      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("QBG_SCHEDULE_FAILED", error)
    }
  }

  private fun calculateInitialDelayMillis(hour: Int): Long {
    val now = Calendar.getInstance()
    val nextRun = Calendar.getInstance().apply {
      set(Calendar.MINUTE, 0)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
      set(Calendar.HOUR_OF_DAY, hour)
      if (!after(now)) {
        add(Calendar.DAY_OF_YEAR, 1)
      }
    }

    return nextRun.timeInMillis - now.timeInMillis
  }

  @ReactMethod
  fun runOnce(promise: Promise) {
    try {
      val request =
          OneTimeWorkRequestBuilder<QeematBackgroundWorker>()
              .setInputData(Data.Builder().putBoolean("force", true).build())
              .addTag(ONE_TIME_WORK_NAME)
              .build()

      WorkManager.getInstance(reactContext)
          .enqueueUniqueWork(
              ONE_TIME_WORK_NAME,
              ExistingWorkPolicy.REPLACE,
              request,
          )

      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("QBG_RUN_ONCE_FAILED", error)
    }
  }

  @ReactMethod
  fun runTestOnce(delayMinutes: Double, promise: Promise) {
    try {
      val minutes = delayMinutes.toLong().coerceIn(1, 60)
      val request =
          OneTimeWorkRequestBuilder<QeematBackgroundWorker>()
              .setInitialDelay(minutes, TimeUnit.MINUTES)
              .setInputData(Data.Builder().putBoolean("force", true).build())
              .addTag("qeemat-price-check-test")
              .build()

      WorkManager.getInstance(reactContext)
          .enqueueUniqueWork(
              "qeemat-price-check-test",
              ExistingWorkPolicy.REPLACE,
              request,
          )

      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("QBG_TEST_FAILED", error)
    }
  }

  @ReactMethod
  fun cancel(promise: Promise) {
    try {
      WorkManager.getInstance(reactContext).cancelUniqueWork(PERIODIC_WORK_NAME)
      WorkManager.getInstance(reactContext).cancelUniqueWork(ONE_TIME_WORK_NAME)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("QBG_CANCEL_FAILED", error)
    }
  }

  @ReactMethod
  fun isBatteryOptimizationExempt(promise: Promise) {
    try {
      val powerManager = reactContext.getSystemService(PowerManager::class.java)
      promise.resolve(powerManager.isIgnoringBatteryOptimizations(reactContext.packageName))
    } catch (error: Exception) {
      promise.reject("QBG_BATTERY_CHECK_FAILED", error)
    }
  }

  @ReactMethod
  fun requestBatteryOptimizationExemption(promise: Promise) {
    try {
      val powerManager = reactContext.getSystemService(PowerManager::class.java)
      if (powerManager.isIgnoringBatteryOptimizations(reactContext.packageName)) {
        promise.resolve(true)
        return
      }

      // Try the standard API first
      val intent = android.content.Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
        data = android.net.Uri.parse("package:${reactContext.packageName}")
        addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      reactContext.startActivity(intent)
      promise.resolve(false)
    } catch (error: Exception) {
      promise.reject("QBG_BATTERY_REQUEST_FAILED", error)
    }
  }

  @ReactMethod
  fun openAppSystemSettings(promise: Promise) {
    try {
      val intent = android.content.Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
        data = android.net.Uri.parse("package:${reactContext.packageName}")
        addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      reactContext.startActivity(intent)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("QBG_APP_SETTINGS_FAILED", error)
    }
  }
}
