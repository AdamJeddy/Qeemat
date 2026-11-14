package com.qeemat

import android.content.Context
import android.util.Log
import android.os.SystemClock
import androidx.work.Worker
import androidx.work.WorkerParameters
import com.facebook.react.ReactApplication
import com.facebook.react.ReactInstanceEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.internal.featureflags.ReactNativeNewArchitectureFeatureFlags
import com.facebook.react.jstasks.HeadlessJsTaskConfig
import com.facebook.react.jstasks.HeadlessJsTaskContext
import com.facebook.react.jstasks.HeadlessJsTaskEventListener
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** Keep WorkManager alive until the discovery headless task finishes. */
class QeematDiscoveryWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
  companion object {
    private val completions = ConcurrentHashMap<String, (Boolean) -> Unit>()
    fun complete(token: String, success: Boolean) { completions.remove(token)?.invoke(success) }
  }

  override fun doWork(): Result {
    val done = CountDownLatch(1)
    val application = applicationContext as ReactApplication
    var taskContext: HeadlessJsTaskContext? = null
    var taskId = -1
    var startedAt = 0L
    var timedOut = false
    var failed = false
    var started = false
    val token = UUID.randomUUID().toString()
    completions[token] = { success -> failed = !success; done.countDown() }
    val taskListener = object : HeadlessJsTaskEventListener {
      override fun onHeadlessJsTaskStart(taskId: Int) = Unit
      override fun onHeadlessJsTaskFinish(finishedId: Int) {
        if (finishedId == taskId && SystemClock.elapsedRealtime() - startedAt >= 269000) {
          timedOut = true
          done.countDown()
        }
      }
    }
    fun startTask(context: ReactContext) {
      if (started || isStopped) { return }
      started = true
      try {
        check(context.hasActiveReactInstance()) { "React instance is not ready" }
        val tasks = HeadlessJsTaskContext.getInstance(context)
        taskContext = tasks
        tasks.addTaskEventListener(taskListener)
        startedAt = SystemClock.elapsedRealtime()
        val data = Arguments.createMap().apply { putString("completionToken", token) }
        taskId = tasks.startTask(HeadlessJsTaskConfig("QeematBackgroundDiscoveryRefresh", data, 270000, true))
        Log.i("QeematDiscoveryWorker", "Discovery task started")
      } catch (error: Exception) {
        Log.e("QeematDiscoveryWorker", "Unable to start discovery task", error)
        failed = true
        done.countDown()
      }
    }
    val instanceListener = object : ReactInstanceEventListener {
      override fun onReactContextInitialized(context: ReactContext) { UiThreadUtil.runOnUiThread { startTask(context) } }
    }
    val bridgeless = ReactNativeNewArchitectureFeatureFlags.enableBridgelessArchitecture()
    @Suppress("DEPRECATION")
    val manager = if (bridgeless) null else application.reactNativeHost.reactInstanceManager
    val host = if (bridgeless) application.reactHost else null
    UiThreadUtil.runOnUiThread {
      try {
        val current = if (bridgeless) host?.currentReactContext else manager?.currentReactContext
        if (current != null) { startTask(current) }
        else if (bridgeless) {
          host?.addReactInstanceEventListener(instanceListener)
          host?.start()
        } else {
          manager?.addReactInstanceEventListener(instanceListener)
          manager?.createReactContextInBackground()
        }
      } catch (error: Exception) {
        Log.e("QeematDiscoveryWorker", "Unable to initialize React", error)
        failed = true
        done.countDown()
      }
    }
    val completed = try { done.await(290, TimeUnit.SECONDS) } catch (_: InterruptedException) { false }
    completions.remove(token)
    UiThreadUtil.runOnUiThread {
      host?.removeReactInstanceEventListener(instanceListener)
      manager?.removeReactInstanceEventListener(instanceListener)
      taskContext?.removeTaskEventListener(taskListener)
      taskContext?.let { if (taskId >= 0 && it.isTaskRunning(taskId)) { it.finishTask(taskId) } }
    }
    return if (completed && !failed && !timedOut && !isStopped) {
      Log.i("QeematDiscoveryWorker", "Discovery task finished")
      Result.success()
    } else {
      Log.w("QeematDiscoveryWorker", "Discovery task did not finish")
      Result.retry()
    }
  }
}
