package com.qeemat

import android.content.Intent
import android.app.Activity
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

private const val SHARE_EVENT_NAME = "qeematShareReceived"

class QeematShareModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), ActivityEventListener {

  init {
    reactContext.addActivityEventListener(this)
  }

  override fun getName(): String = "QeematShare"

  @ReactMethod
  fun getInitialSharedText(promise: Promise) {
    promise.resolve(getSharedText(reactContext.currentActivity?.intent))
  }

  @ReactMethod
  fun addListener(eventName: String) = Unit

  @ReactMethod
  fun removeListeners(count: Double) = Unit

  override fun onNewIntent(intent: Intent) {
    val sharedText = getSharedText(intent) ?: return
    reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(SHARE_EVENT_NAME, sharedText)
  }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) = Unit

  override fun invalidate() {
    reactContext.removeActivityEventListener(this)
    super.invalidate()
  }

  private fun getSharedText(intent: Intent?): String? {
    if (intent?.action != Intent.ACTION_SEND || intent.type != "text/plain") {
      return null
    }

    return intent.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString()?.takeIf { it.isNotBlank() }
  }
}
