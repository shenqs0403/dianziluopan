<script setup>
/**
 * 第三部分左右等分两半：左边「选定方位」（点外圈角度带选定，未选时跟随陀螺仪），
 * 右边「陀螺仪南向」（红针所指 = 实时方位 + 180°）。
 * 两半显示同样的六项：度数、方向、坐山、朝山、吉凶、吉凶说明。
 * 放山靠点盘面完成，这里不再放「清除」按钮。
 */
import { computed } from 'vue'
import { azimuthLuck } from '../dial/fortune.js'
import { directionName, normalize } from '../dial/mountains.js'

const props = defineProps({
  azimuth: { type: Number, default: 0 },
  /** 左侧「选定方位」的角度 */
  selected: { type: Number, default: 0 },
  sitting: { type: Object, default: null },
  facing: { type: Object, default: null }
})

/** 显示用度数：359.97° 这类四舍五入到 360 的值要显示成 0.0° */
const halves = computed(() => [
  { key: 'pick', title: '选定方位', deg: props.selected },
  { key: 'south', title: '陀螺仪南向', deg: normalize(props.azimuth + 180) }
].map((h) => ({
  ...h,
  degText: normalize(Math.round(h.deg * 10) / 10).toFixed(1),
  dir: directionName(h.deg),
  luck: azimuthLuck(props.sitting, h.deg)
})))
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
        <span class="tag sit">坐山<em>{{ sitting ? sitting.text : '—' }}</em></span>
        <span class="tag fac">朝山<em>{{ facing ? facing.text : '—' }}</em></span>
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
  /* 1fr 1fr 保证左右严格等宽；用 flex 时第二个半区的 padding 会把外宽撑大 8px */
  display: grid; grid-template-columns: 1fr 1fr; gap: 8px; overflow: hidden;
}
.half {
  box-sizing: border-box; min-width: 0;
  display: flex; flex-direction: column; gap: 3px;
}
.half + .half { border-left: 1px solid var(--line-soft); padding-left: 8px; }
.half-title { font-size: 10px; color: var(--text-dim); letter-spacing: .5px; }

.head { display: flex; align-items: baseline; gap: 6px; }
.deg { font-size: 21px; font-weight: 700; color: var(--accent); }
.dir { font-size: 14px; color: var(--text-strong); }

.pair { display: flex; gap: 5px; }
.tag {
  flex: 1; padding: 2px 0; text-align: center; font-size: 11px; white-space: nowrap;
  border: 1px solid var(--line); border-radius: 5px; background: var(--panel); color: var(--text-dim);
}
.tag em { font-style: normal; font-size: 13.5px; margin-left: 3px; color: var(--text-strong); }
.tag.sit em { color: #ff8a80; }
.tag.fac em { color: #90caf9; }

.foot-note { display: flex; align-items: center; gap: 6px; flex: 1; min-height: 0; }
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
