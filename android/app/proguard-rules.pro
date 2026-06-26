# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# WorkManager — keep Worker subclasses and related classes
-keep class * extends androidx.work.Worker
-keep class * extends com.facebook.react.HeadlessJsTaskService
-dontwarn androidx.work.**

# React Native — preserve native module classes
-keep class com.facebook.react.bridge.** { *; }
-keep class com.facebook.react.** { *; }

# Qeemat native modules
-keep class com.qeemat.** { *; }

