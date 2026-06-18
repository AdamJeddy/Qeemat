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
import java.util.concurrent.TimeUnit

private const val PERIODIC_WORK_NAME = "qeemat-price-check-periodic"
private const val ONE_TIME_WORK_NAME = "qeemat-price-check-now"

class QeematBackgroundCheckModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "QeematBackgroundCheck"

  @ReactMethod
  fun schedule(promise: Promise) {
    try {
      val request =
          PeriodicWorkRequestBuilder<QeematBackgroundWorker>(15, TimeUnit.MINUTES)
              .setInputData(Data.Builder().putBoolean("force", false).build())
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
