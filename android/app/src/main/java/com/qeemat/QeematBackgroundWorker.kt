package com.qeemat

import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.work.Worker
import androidx.work.WorkerParameters
import com.facebook.react.HeadlessJsTaskService

class QeematBackgroundWorker(
    private val appContext: Context,
    workerParameters: WorkerParameters
) : Worker(appContext, workerParameters) {

  companion object {
    private const val TAG = "QeematBackgroundWorker"
  }

  override fun doWork(): Result {
    return try {
      val intent = Intent(appContext, QeematBackgroundTaskService::class.java).apply {
        putExtra("force", inputData.getBoolean("force", false))
        putExtra("source", "work-manager")
        putExtra("scheduledAt", System.currentTimeMillis().toDouble())
      }

      appContext.startService(intent)
      HeadlessJsTaskService.acquireWakeLockNow(appContext)
      Log.d(TAG, "Background task service started successfully")
      Result.success()
    } catch (e: IllegalStateException) {
      Log.e(TAG, "Failed to start background service (background restrictions)", e)
      Result.failure()
    } catch (e: SecurityException) {
      Log.e(TAG, "Security exception starting background service", e)
      Result.failure()
    } catch (e: Exception) {
      Log.e(TAG, "Unexpected error in background worker", e)
      Result.retry()
    }
  }
}
