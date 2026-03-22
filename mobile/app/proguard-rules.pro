# ---------------------------------------------
# MegaConvert Business - Release hardening rules
# ---------------------------------------------

# Keep line numbers for better crash diagnostics in release.
-keepattributes SourceFile,LineNumberTable

# ---------- WebRTC ----------
-keep class org.webrtc.** { *; }
-dontwarn org.webrtc.**

# ---------- SQLCipher ----------
-keep class net.sqlcipher.** { *; }
-dontwarn net.sqlcipher.**

# ---------- FFmpeg JNI bindings ----------
-keep class com.arthenica.ffmpegkit.** { *; }
-keep class com.moizhassan.ffmpeg.** { *; }
-dontwarn com.arthenica.ffmpegkit.**
-dontwarn com.moizhassan.ffmpeg.**

# ---------- PDFBox / FontBox / XMPBox ----------
-keep class com.tom_roush.pdfbox.** { *; }
-keep class com.tom_roush.fontbox.** { *; }
-keep class com.tom_roush.xmpbox.** { *; }
-dontwarn com.tom_roush.**

# ---------- WASM bridge / JS interfaces ----------
-keep class com.megaconvert.business.data.wasm.** { *; }
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ---------- Local converters ----------
-keep class com.megaconvert.business.data.converter.** { *; }

# ---------- Room ----------
# Preserve entities and their fields to avoid schema/runtime mismatch
# when code shrinking and obfuscation are enabled.
-keep @androidx.room.Entity class * { *; }
-keepclassmembers class * {
    @androidx.room.PrimaryKey <fields>;
    @androidx.room.ColumnInfo <fields>;
    @androidx.room.Embedded <fields>;
    @androidx.room.Relation <fields>;
}

# Preserve DAO interfaces and Room DB entry points.
-keep @androidx.room.Dao class * { *; }
-keep class * extends androidx.room.RoomDatabase { *; }

# ---------- Strip Android Log calls from release ----------
-assumenosideeffects class android.util.Log {
    public static boolean isLoggable(java.lang.String, int);
    public static int v(...);
    public static int i(...);
    public static int w(...);
    public static int d(...);
    public static int e(...);
}
