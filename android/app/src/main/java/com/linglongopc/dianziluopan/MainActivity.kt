package com.linglongopc.dianziluopan

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.hardware.GeomagneticField
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import java.util.Locale
import kotlin.math.abs

/**
 * 电子罗盘 Android 容器：全屏 WebView + 陀螺仪推送。
 *
 * 界面来自 app/src/main/assets/www（由 web 工程 `npm run sync` 同步），
 * JS 侧只依赖两个约定（见 web/src/platform/contract.js）：
 *   - window.DiZhiNative.*            JS 调原生
 *   - window.__diZhiBridge.emit(...)  原生推 JS
 */
class MainActivity : Activity() {

    private lateinit var web: WebView
    private lateinit var bridge: DiZhiNative
    private lateinit var sensors: SensorManager

    /** 优先用旋转矢量（陀螺仪+磁力计融合），退而求其次用 加速度计+磁力计。 */
    private val rotationSensor: Sensor? by lazy {
        sensors.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)
            ?: sensors.getDefaultSensor(Sensor.TYPE_GAME_ROTATION_VECTOR)
    }

    private val accelSensor: Sensor? by lazy { sensors.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) }
    private val magSensor: Sensor? by lazy { sensors.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD) }

    private val gravity = FloatArray(3)
    private val geomagnetic = FloatArray(3)
    private val rotMatrix = FloatArray(9)
    private val remapped = FloatArray(9)
    private val orientation = FloatArray(3)
    private var haveGravity = false
    private var haveMag = false

    private var listening = false
    private var lastEmit = 0L
    private var lastMag = Float.NaN      // 磁北原始角（度）
    private var continuous = 0f          // 展开后的连续角，避免 0/360 跳变
    private var declination = 0f         // 磁偏角（有位置权限时用于换算真北）

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Android 13+ 预测式返回：必须在 onCreate 里注册（构造期拿不到 dispatcher）
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            onBackInvokedDispatcher.registerOnBackInvokedCallback(
                android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT
            ) { requestExit() }
        }
        sensors = getSystemService(Context.SENSOR_SERVICE) as SensorManager
        bridge = DiZhiNative(this) { requestExit() }
        web = WebView(this)
        setContentView(web)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.attributes = window.attributes.apply {
                layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
            }
        }
        setupWebView()
        applyImmersive()
        // Android 7.0（API 24）的 Chrome 51 WebView 在硬件加速下，canvas 缓冲里
        // 有内容但屏幕合成不出来（真机上也有类似报告），只能强制软件渲染。
        // 其它版本 WebView 正常，保持默认硬件加速。
        if (Build.VERSION.SDK_INT == Build.VERSION_CODES.N) {
            web.setLayerType(View.LAYER_TYPE_SOFTWARE, null)
        }
        web.loadUrl("file:///android_asset/www/index.html")
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        web.settings.apply {
            javaScriptEnabled = true          // 界面本身需要 JS
            domStorageEnabled = true
            databaseEnabled = true
            textZoom = 100                    // 不跟随系统字号，保证 8/70/20 布局
            useWideViewPort = false
            loadWithOverviewMode = false
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            allowFileAccess = true
            mediaPlaybackRequiresUserGesture = false
            cacheMode = android.webkit.WebSettings.LOAD_DEFAULT
        }
        web.isVerticalScrollBarEnabled = false
        web.isHorizontalScrollBarEnabled = false
        web.overScrollMode = View.OVER_SCROLL_NEVER
        web.setBackgroundColor(0xFF1A0A08.toInt())
        web.setOnLongClickListener { true }  // 屏蔽长按选词气泡，保证拖拽盘面不被打断

        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false
                return !(url.startsWith("file://") || url.startsWith("about:") || url.startsWith("data:"))
            }

            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                if (request?.isForMainFrame == true) {
                    Log.e(TAG, "页面加载失败 ${request.url} : ${error?.description}")
                }
            }
        }
        web.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(msg: ConsoleMessage): Boolean {
                Log.i(TAG, "[web] ${msg.message()} (${msg.sourceId()}:${msg.lineNumber()})")
                return true
            }
        }
        web.addJavascriptInterface(bridge, "DiZhiNative")
        if (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0) {
            WebView.setWebContentsDebuggingEnabled(true)
        }
    }

    /** 隐藏状态栏/导航栏：界面自带 8/70/20 布局，不要系统栏挤占空间。 */
    private fun applyImmersive() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false)
            window.insetsController?.let {
                it.hide(WindowInsets.Type.systemBars())
                it.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
                    View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
                    View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                    View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                    View.SYSTEM_UI_FLAG_FULLSCREEN or
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                )
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) applyImmersive()
    }

    // ---------------------------------------------------------------- 传感器

    fun startSensors() {
        if (listening) return
        refreshDeclination()
        val started = rotationSensor?.let {
            sensors.registerListener(sensorListener, it, SensorManager.SENSOR_DELAY_GAME)
        } ?: false
        if (!started) {
            accelSensor?.let { sensors.registerListener(sensorListener, it, SensorManager.SENSOR_DELAY_GAME) }
            magSensor?.let { sensors.registerListener(sensorListener, it, SensorManager.SENSOR_DELAY_GAME) }
        }
        listening = true
        Log.i(TAG, "传感器启动 rotation=${rotationSensor != null} fallback=${!started}")
    }

    fun stopSensors() {
        if (!listening) return
        sensors.unregisterListener(sensorListener)
        listening = false
    }

    private fun refreshDeclination() {
        // 不主动申请定位权限；若已有粗略位置权限则按当地磁偏角换算真北，否则保持磁北
        if (checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)
            != PackageManager.PERMISSION_GRANTED
        ) return
        try {
            val lm = getSystemService(Context.LOCATION_SERVICE) as LocationManager
            val loc = lm.getLastKnownLocation(LocationManager.PASSIVE_PROVIDER) ?: return
            declination = GeomagneticField(
                loc.latitude.toFloat(), loc.longitude.toFloat(), loc.altitude.toFloat(),
                System.currentTimeMillis()
            ).declination
        } catch (e: Exception) {
            Log.w(TAG, "磁偏角读取失败：${e.message}")
        }
    }

    private val sensorListener = object : SensorEventListener {
        override fun onSensorChanged(event: SensorEvent) {
            when (event.sensor.type) {
                Sensor.TYPE_ROTATION_VECTOR, Sensor.TYPE_GAME_ROTATION_VECTOR ->
                    publish(event.values)

                Sensor.TYPE_ACCELEROMETER -> {
                    event.values.copyInto(gravity, 0, 0, minOf(3, event.values.size))
                    haveGravity = true
                    if (haveMag) publish(null)
                }

                Sensor.TYPE_MAGNETIC_FIELD -> {
                    event.values.copyInto(geomagnetic, 0, 0, minOf(3, event.values.size))
                    haveMag = true
                    if (haveGravity) publish(null)
                }
            }
        }

        override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
    }

    /** 把一次姿态解算结果推给 JS（约 30Hz）。 */
    private fun publish(vector: FloatArray?) {
        val ok = if (vector != null) {
            SensorManager.getRotationMatrixFromVector(rotMatrix, vector)
            true
        } else {
            haveGravity && haveMag && SensorManager.getRotationMatrix(rotMatrix, null, gravity, geomagnetic)
        }
        if (!ok) return

        // 竖屏锁定：把设备坐标重映射到「屏幕上为上」的手机坐标
        SensorManager.remapCoordinateSystem(
            rotMatrix, SensorManager.AXIS_X, SensorManager.AXIS_Z, remapped
        )
        SensorManager.getOrientation(remapped, orientation)

        if (orientation[0].isNaN()) return
        val magnetic = Math.toDegrees(orientation[0].toDouble()).toFloat() + declination
        val tilt = Math.toDegrees(orientation[1].toDouble()).toFloat() + 90f  // 与竖直方向的夹角
        val lean = Math.toDegrees(orientation[2].toDouble()).toFloat()         // 左右倾斜

        // 展开 0/360 接缝，指针与校对算法都不会被 359.9→0.1 打断
        var mag = ((magnetic % 360f) + 360f) % 360f
        if (lastMag.isNaN()) {
            continuous = mag
        } else {
            var d = mag - lastMag
            if (d > 180f) d -= 360f
            if (d < -180f) d += 360f
            continuous += d
        }
        lastMag = mag
        // 先归一化再保留两位小数：359.999 四舍五入会变成 360.00，越过 0~360 契约
        val azimuth = deg360(continuous)

        val now = System.currentTimeMillis()
        if (now - lastEmit < 30) return
        lastEmit = now

        val js = buildString {
            append("window.__diZhiBridge&&__diZhiBridge.emit('sensor',{azimuth:")
            append(num(azimuth))
            append(",pitch:").append(num(tilt.coerceIn(-180f, 180f)))
            append(",roll:").append(num(lean.coerceIn(-90f, 90f)))
            append(",accuracy:").append(if (abs(declination) < 90f) 3 else 1)
            append(",drift:0,timestamp:").append(now).append("})")
        }
        runOnUiThread { if (!isFinishing && !isDestroyed()) web.evaluateJavascript(js, null) }
    }

    /** 归一到 0~360，保留两位小数，并把四舍五入到 360 的值归 0。 */
    private fun deg360(v: Float): Float {
        val n = ((v % 360f) + 360f) % 360f
        val r = Math.round(n * 100f) / 100f
        return if (r >= 360f) 0f else r
    }

    /** 始终用 US Locale，避免个别机型把小数点输出成逗号导致 JSON 解析失败。 */
    private fun num(v: Float): String = String.format(Locale.US, "%.2f", v)

    // ---------------------------------------------------------------- 生命周期

    override fun onResume() {
        super.onResume()
        startSensors()
        web.evaluateJavascript("window.__diZhiBridge&&__diZhiBridge.emit('event',{name:'resume'})", null)
    }

    override fun onPause() {
        stopSensors()
        web.evaluateJavascript("window.__diZhiBridge&&__diZhiBridge.emit('event',{name:'pause'})", null)
        super.onPause()
    }

    override fun onDestroy() {
        web.removeJavascriptInterface("DiZhiNative")
        (web.parent as? android.view.ViewGroup)?.removeView(web)
        web.destroy()
        super.onDestroy()
    }

    // ---------------------------------------------------------------- 返回键

    private fun requestExit() {
        web.evaluateJavascript("window.__diZhiBridge&&__diZhiBridge.emit('event',{name:'back'})", null)
        web.postDelayed({ if (!isFinishing) finish() }, 180)
    }

    @Deprecated("兼容 Android 7~12 的返回键；Android 13+ 走 OnBackInvokedDispatcher")
    @Suppress("DEPRECATION")
    override fun onBackPressed() = requestExit()

    companion object {
        const val TAG = "DiZhi"
    }
}
