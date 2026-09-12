# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.

# Preserve JavascriptInterface methods for WebView (including native print bridge)
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keepclassmembers class com.meuapp.android.MainActivity$AndroidPrintBridge {
    public *;
}

# Capacitor bridge and plugins
-keep class com.getcapacitor.** { *; }
-keep class * extends com.getcapacitor.Plugin { *; }

# SQLite and SQLCipher
-keep class com.getcapacitor.community.database.sqlite.** { *; }
-keep class io.sqlcipher.** { *; }
-dontwarn io.sqlcipher.**

# AndroidX / Tink crypto annotations
-dontwarn com.google.errorprone.annotations.**
-dontwarn javax.annotation.**
