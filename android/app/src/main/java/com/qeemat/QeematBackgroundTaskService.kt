package com.qeemat

import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

class QeematBackgroundTaskService : HeadlessJsTaskService() {
  override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig {
    val extras = intent?.extras
    val data = if (extras != null) Arguments.fromBundle(extras) else Arguments.createMap()

    return HeadlessJsTaskConfig(
        "QeematBackgroundPriceCheck",
        data,
        300000,
        true,
    )
  }
}
