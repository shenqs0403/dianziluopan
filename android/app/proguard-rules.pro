# WebView 通过 addJavascriptInterface 反射调用，保留 JS 接口方法
-keepclassmembers class com.linglongopc.dianziluopan.DiZhiNative {
    public *;
}
-keepattributes JavascriptInterface
-keep class com.linglongopc.dianziluopan.MainActivity { *; }
