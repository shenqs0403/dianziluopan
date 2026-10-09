<script setup>
/**
 * 电子罗盘主界面。
 * 第一部分 8%：类型按钮组 / 主题切换 / 水平仪
 * 第二部分 70%：罗盘正方形（黑红底、红色天心十字线、天池 5%、内盘 90%）
 * 第三部分 20%：当前方位与吉凶、放盘方位与吉凶
 */
import { computed, ref, toValue, watch } from 'vue'
import TopBar from './components/TopBar.vue'
import DialCanvas from './components/DialCanvas.vue'
import BottomBar from './components/BottomBar.vue'
import FirstRunNotice from './components/FirstRunNotice.vue'
import CalibrateOverlay from './components/CalibrateOverlay.vue'
import { useSensors } from './composables/useSensors.js'
import { useCalibration } from './composables/useCalibration.js'
import { DIAL_TYPES } from './dial/layers.js'
import { needleLine } from './dial/draw.js'
import { mountainOf, normalize } from './dial/mountains.js'
import { device, loadPrefs, savePrefs } from './platform/index.js'

const NOTICE_TEXT = '点击盘面任意位置（含内盘）即按该方位选定坐山与朝山，长按盘面可清空。'
  + '电子罗盘仅供参考和学习使用，正式测量请使用真实罗盘'

const prefs = loadPrefs({ noticeShown: false, calibrated: false, dark: true, type: 'sanhe' })
const showNotice = ref(!prefs.noticeShown)
const dark = ref(!!prefs.dark)
const type = ref(DIAL_TYPES.some((t) => t.key === prefs.type) ? prefs.type : 'sanhe')
const sitting = ref(null)
const facing = ref(null)
/** 点外圈角度带选定的方位角；null 表示还没选过，跟随陀螺仪 */
const pickedDeg = ref(null)
/** 内盘被拖拽转过的角度（盘面坐标系的旋转量） */
const rotation = ref(0)
const step = ref(0)

const dialRef = ref(null)
const { azimuth: rawAzimuth, roll, pitch } = useSensors()
const cal = useCalibration(rawAzimuth)
// 模板里的顶层 ref 才会自动解包，cal 是普通对象，所以这里显式摊平给模板用
const calProgress = cal.progress
const calStatus = cal.statusText

/** 校准零偏由 JS 侧补偿，四端共用同一逻辑。 */
const azimuth = computed(() => normalize(rawAzimuth.value - cal.offset.value))
/**
 * 底部右侧「实时方位」＝蓝针（指北）在「转过来的盘面」上所指的那个度数。
 * 屏幕角 azimuth 对应盘面角要扣掉盘面旋转量，所以内盘一转它就跟着变。
 */
const heading = computed(() => normalize(azimuth.value - rotation.value))

/** 底部左侧「选定方位」：没点过就是 null，界面显示占位符而不是跟陀螺仪 */
const selected = computed(() => pickedDeg.value)
const showCalibrate = ref(!prefs.calibrated)
// 首次进入就同步主题，避免 CSS 的 :root 默认暗色与 dark=false 打架
document.documentElement.dataset.theme = dark.value ? 'dark' : 'light'

/** 指针方向命中的格子：最内层 → 最外层，用「、」连接（盘面旋转后仍与指针对齐）。 */
const needleText = computed(() => {
  const dial = dialRef.value
  if (!dial) return ''
  const layers = toValue(dial.layers)
  if (!layers?.length) return ''
  const rot = toValue(dial.rotation) || 0
  return needleLine(layers, normalize(azimuth.value - rot))
})

// 传感器就绪后自动开始检测（覆盖「已确认提示、遮罩已显示」的路径）。
// 必须排除 done，否则每帧传感器都会把已完成的校对重置回 0%。
watch(rawAzimuth, () => {
  if (showCalibrate.value && !cal.running.value && !cal.done.value) cal.start()
}, { immediate: true })

watch(azimuth, (v) => {
  cal.feed(v)
  if (cal.progress.value >= 1 && showCalibrate.value) {
    savePrefs({ calibrated: true })
    setTimeout(() => (showCalibrate.value = false), 500)
  }
})

function confirmNotice() {
  showNotice.value = false
  savePrefs({ noticeShown: true })
  if (showCalibrate.value) cal.start()   // 提示确认后才开始采集
}

function skipCalibrate() {
  cal.skip()
  showCalibrate.value = false
  savePrefs({ calibrated: true })
}

function toggleTheme() {
  dark.value = !dark.value
  savePrefs({ dark: dark.value })
}

watch(dark, (v) => {
  document.documentElement.dataset.theme = v ? 'dark' : 'light'
  device.setTheme(v)
})
watch(type, (v) => savePrefs({ type: v }))

/**
 * 点盘面任意位置：按「相对盘心的方位」一次定下坐山与朝山。
 * 朝山取正对面的山，和盘面传统读法一致，不再分两步点。
 */
function onPick(deg) {
  pickedDeg.value = deg
  sitting.value = mountainOf(deg)
  facing.value = mountainOf(deg + 180)
  step.value += 1
  device.vibrate(15)
}

function clearAll() {
  // 长按＝彻底清空：选定方位与坐山朝山一起清，底部左侧回到占位符
  pickedDeg.value = null
  sitting.value = null
  facing.value = null
  step.value += 1
}
</script>

<template>
  <div class="app" :class="{ dark }">
    <div class="top">
      <TopBar
        v-model="type" :types="DIAL_TYPES" :dark="dark" :roll="roll" :pitch="pitch"
        :needle-text="needleText" @toggle-theme="toggleTheme"
      />
    </div>

    <div class="mid">
      <DialCanvas
        ref="dialRef" :azimuth="azimuth" :type="type" :dark="dark" :sitting="sitting" :facing="facing"
        :selected="pickedDeg" :step="step"
        @pick="onPick" @clear="clearAll" @rotate="rotation = $event"
      />
    </div>

    <div class="bottom">
      <BottomBar :heading="heading" :selected="selected" :sitting="sitting" :facing="facing" />
    </div>

    <FirstRunNotice v-if="showNotice" :text="NOTICE_TEXT" @confirm="confirmNotice" />
    <CalibrateOverlay
      :visible="showCalibrate" :progress="calProgress" :status-text="calStatus"
      @skip="skipCalibrate"
    />
  </div>
</template>

<style scoped>
.app {
  width: 100%; height: 100vh; height: 100dvh;
  display: flex; flex-direction: column; overflow: hidden;
  background: var(--bg); color: var(--text);
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}
.top { height: 12%; min-height: 60px; }
.mid { height: 62%; }
.bottom { height: 26%; min-height: 118px; }
</style>
