package com.linglongopc.dianziluopan

import android.content.Context
import android.content.SharedPreferences
import android.os.Handler
import android.os.Looper
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.WindowManager
import android.webkit.JavascriptInterface

/**
 * 注入给 JS 的 window.DiZhiNative，方法名与 web/src/platform/contract.js 一一对应。
 *
 * 注意：addJavascriptInterface 回调不在主线程，涉及 UI 的方法必须 post 回主线程。
 */
class DiZhiNative(
    private val ctx: Context,
    private val onClose: () -> Unit
) {

    // addJavascriptInterface 的回调在 WebView 线程，UI 操作一律 post 回主线程
    private val main = Handler(Looper.getMainLooper())

    private val prefs: SharedPreferences =
        ctx.getSharedPreferences("diZhi", Context.MODE_PRIVATE)

    @JavascriptInterface
    fun startSensors() = (ctx as? MainActivity)?.startSensors()

    @JavascriptInterface
    fun stopSensors() = (ctx as? MainActivity)?.stopSensors()

    @JavascriptInterface
    fun setTheme(dark: Boolean) {
        main.post {
            val color = if (dark) 0xFF120705.toInt() else 0xFF1A0A08.toInt()
            (ctx as? MainActivity)?.window?.decorView?.setBackgroundColor(color)
        }
    }

    @JavascriptInterface
    fun vibrate(ms: Int) {
        val duration = ms.coerceIn(10, 400).toLong()
        val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            (ctx.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager)?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            ctx.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        } ?: return
        if (!vibrator.hasVibrator()) return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createOneShot(duration, VibrationEffect.DEFAULT_AMPLITUDE))
        } else {
            @Suppress("DEPRECATION")
            vibrator.vibrate(duration)
        }
    }

    @JavascriptInterface
    fun keepScreenOn(flag: Boolean) {
        main.post {
            val window = (ctx as? MainActivity)?.window ?: return@post
            if (flag) {
                window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            } else {
                window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            }
        }
    }

    @JavascriptInterface
    fun getPrefs(): String? = prefs.getString(KEY_PREFS, null)

    @JavascriptInterface
    fun setPrefs(json: String) {
        prefs.edit().putString(KEY_PREFS, json).apply()
    }

    @JavascriptInterface
    fun close() = onClose()

    private companion object {
        const val KEY_PREFS = "prefs"
    }
}
