<script setup>
/**
 * 第三部分左右等分两半，两半显示同样的六项：度数、方向、坐山、朝山、吉凶、吉凶说明。
 *
 * 两半的数据来源必须互不相干：
 * - 左「选定方位」只跟用户点击有关，点一下就定住；
 * - 右「陀螺仪南向」＝红针在当前盘面上所指的度数，只跟传感器方向和盘面旋转有关，
 *   连坐山、朝山、吉凶都按它自己的方位现算，不共用点击产生的坐山朝山，
 *   所以点盘面不会影响右边，但转动内盘会。
 */
import { computed } from 'vue'
import { azimuthLuck } from '../dial/fortune.js'
import { directionName, mountainOf, normalize } from '../dial/mountains.js'

const props = defineProps({
  /** 右侧「陀螺仪南向」：红针在当前盘面上所指的度数（已扣掉盘面旋转） */
  south: { type: Number, default: 180 },
  /** 左侧「选定方位」的角度 */
  selected: { type: Number, default: 0 },
  sitting: { type: Object, default: null },
  facing: { type: Object, default: null }
})

/** 显示用度数：359.97° 这类四舍五入到 360 的值要显示成 0.0° */
const halves = computed(() => {
  const south = normalize(props.south)
  return [
    // 左半：坐山朝山来自点击
    { key: 'pick', title: '选定方位', deg: props.selected, sit: props.sitting, fac: props.facing },
    // 右半：坐山朝山按自己这个方位现算，只跟陀螺仪走
    { key: 'south', title: '陀螺仪南向', deg: south, sit: mountainOf(south), fac: mountainOf(south + 180) }
  ].map((h) => ({
    ...h,
    degText: normalize(Math.round(h.deg * 10) / 10).toFixed(1),
    dir: directionName(h.deg),
    luck: azimuthLuck(h.sit, h.deg)
  }))
})
</script>

<template>
  <div class="panel">
    <section v-for="h in halves" :key="h.key" class="half">
      <div class="half-title">{{ h.title }}</div>
      <div class="head">
        <span class="deg">{{ h.degText }}°</span>
        <span class="dir">{{ h.dir }}</span>
      </div>
      <div class="pair">
        <span class="tag sit">坐山<em>{{ h.sit ? h.sit.text : '—' }}</em></span>
        <span class="tag fac">朝山<em>{{ h.fac ? h.fac.text : '—' }}</em></span>
      </div>
      <div class="foot-note">
        <span class="luck" :class="h.luck.luck">{{ h.luck.luck }}</span>
        <span class="note">{{ h.luck.note }}</span>
      </div>
    </section>
  </div>
</template>

<style scoped>
.panel {
  height: 100%; box-sizing: border-box; padding: 5px 8px 6px;
  /* Android 7 WebView（Chromium 51）没有 CSS Grid，flex 也没有 gap（Chrome 84 才有）。
     用 flex + flex:1 1 0 保证左右严格等宽（box-sizing:border-box 下 padding 不外扩），
     间距一律用 margin 模拟。 */
  display: flex; overflow: hidden;
}
.half {
  flex: 1 1 0; box-sizing: border-box; min-width: 0;
  display: flex; flex-direction: column;
}
.half > * + * { margin-top: 3px; }
.half + .half { margin-left: 8px; border-left: 1px solid var(--line-soft); padding-left: 8px; }
.half-title { font-size: 10px; color: var(--text-dim); letter-spacing: .5px; }

.head { display: flex; align-items: baseline; }
.head .dir { margin-left: 6px; }
.deg { font-size: 21px; font-weight: 700; color: var(--accent); }
.dir { font-size: 14px; color: var(--text-strong); }

.pair { display: flex; }
.pair .tag + .tag { margin-left: 5px; }
.tag {
  flex: 1; padding: 2px 0; text-align: center; font-size: 11px; white-space: nowrap;
  border: 1px solid var(--line); border-radius: 5px; background: var(--panel); color: var(--text-dim);
}
.tag em { font-style: normal; font-size: 13.5px; margin-left: 3px; color: var(--text-strong); }
.tag.sit em { color: #ff8a80; }
.tag.fac em { color: #90caf9; }

.foot-note { display: flex; align-items: center; flex: 1; min-height: 0; }
.foot-note .note { margin-left: 6px; }
.luck {
  flex: 0 0 28px; width: 28px; height: 28px; border-radius: 50%;
  text-align: center; line-height: 28px; font-size: 14px; font-weight: 700;
  border: 1px solid var(--line-soft);
}
.luck.吉 { color: #7bd07b; border-color: #2e7d32; }
.luck.凶 { color: #ef5350; border-color: #b3261e; }
.luck.中 { color: #d9a441; border-color: #8d6a08; }
.note { flex: 1; min-width: 0; font-size: 10.5px; line-height: 1.45; color: var(--text-dim); overflow: auto; }
</style>
