package com.qeemat

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
  fun cancel(promise: Promise) {
    try {
      WorkManager.getInstance(reactContext).cancelUniqueWork(PERIODIC_WORK_NAME)
      WorkManager.getInstance(reactContext).cancelUniqueWork(ONE_TIME_WORK_NAME)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("QBG_CANCEL_FAILED", error)
    }
  }
}
