package com.qeemat

import android.content.Context
import android.content.Intent
import androidx.work.Worker
import androidx.work.WorkerParameters
import com.facebook.react.HeadlessJsTaskService

class QeematBackgroundWorker(
    private val appContext: Context,
    workerParameters: WorkerParameters
) : Worker(appContext, workerParameters) {
  override fun doWork(): Result {
    return try {
      val intent = Intent(appContext, QeematBackgroundTaskService::class.java).apply {
        putExtra("force", inputData.getBoolean("force", false))
        putExtra("source", "work-manager")
        putExtra("scheduledAt", System.currentTimeMillis().toDouble())
      }

      appContext.startService(intent)
      HeadlessJsTaskService.acquireWakeLockNow(appContext)
      Result.success()
    } catch (_: Exception) {
      Result.retry()
    }
  }
}
