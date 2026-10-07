# JNA binds native functions and structures by reflection (UniFFI bindings).
-keep class com.sun.jna.** { *; }
-keepclassmembers class * extends com.sun.jna.** { public *; }
-dontwarn java.awt.**

# Generated UniFFI bindings of the Rust core: structures, callbacks and
# native method names must keep their names.
-keep class de.kernich.pstviewer.core.** { *; }

# PDF export drives the WebView's print adapter (see PdfWriter).
-keep class android.print.** { *; }
