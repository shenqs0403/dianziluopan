<script setup>
/** 2.3 第一部分：罗盘类型按钮组、主题切换按钮组、右侧水平仪 */
import { computed } from 'vue'

const props = defineProps({
  types: { type: Array, default: () => [] },
  modelValue: { type: String, default: 'sanhe' },
  dark: { type: Boolean, default: false },
  roll: { type: Number, default: 0 },
  pitch: { type: Number, default: 0 },
  /** 指针方向命中的格子文字：最内层 → 最外层，用「、」连接 */
  needleText: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue', 'toggle-theme'])

/** 双层十字水平仪的悬停提示：状态靠气泡是否居中表达，不占界面文字 */
const levelText = computed(() =>
  Math.abs(props.roll) < 1.2 && Math.abs(props.pitch) < 1.2 ? '水平' : '倾斜'
)

/**
 * 气泡位移（px）：一横测左右倾斜、一竖测前后倾斜，各自独立一颗气泡。
 * 帧约定（原生与 web 都已换算成同一套）：roll>0＝右侧抬起（右高）、pitch>0＝顶边抬起（前高）。
 * 气泡只往「抬高的一侧」跑：横管 dx＝+roll（右高→右移），竖管 dy＝−pitch
 * （CSS translateY 正方向是向下，前高时气泡要往上，故取负）。
 * 系数 0.5、最大 13px 与 36px 槽长匹配，越靠近边缘越接近满量程。
 */
const LEV_MAX = 13
const clampLev = (v) => Math.max(-LEV_MAX, Math.min(LEV_MAX, v))
const levX = computed(() => clampLev(props.roll * 0.5))
const levY = computed(() => clampLev(-props.pitch * 0.5))
</script>

<template>
  <div class="bar">
    <div class="btns">
    <div class="group">
      <button
        v-for="t in types" :key="t.key"
        class="btn" :class="{ on: t.key === modelValue }"
        @click="emit('update:modelValue', t.key)"
      >{{ t.text }}</button>
    </div>
    <div class="group">
      <button class="btn wide" @click="emit('toggle-theme')">{{ dark ? '亮色' : '暗色' }}</button>
    </div>
    <div class="level" :title="levelText">
      <div class="vial vial-x">
        <span class="v-center v-center-x" />
        <span class="ball ball-x" :style="{ transform: `translateX(${levX}px)` }" />
      </div>
      <div class="vial vial-y">
        <span class="v-center v-center-y" />
        <span class="ball ball-y" :style="{ transform: `translateY(${levY}px)` }" />
      </div>
    </div>
    </div>
    <div class="needle" :title="needleText">{{ needleText || '指针方向无对应格' }}</div>
  </div>
</template>

<style scoped>
/* Android 7 的 WebView 是 Chromium 51，不支持 flex 的 gap（Chrome 84 才有），
   这里一律用 margin 代替，视觉间距保持一致。 */
.bar {
  height: 100%; display: flex; flex-direction: column; justify-content: center;
  padding: 2px 8px 3px; box-sizing: border-box; overflow: hidden;
}
.btns { display: flex; align-items: center; }
.btns > .group + .group { margin-left: 8px; }
/* 连体按钮组：相邻按钮共边，只有首尾有圆角 */
.group {
  display: flex; flex: 0 0 auto;
  border: 1px solid var(--line); border-radius: 6px; overflow: hidden;
  background: var(--panel);
}
.btn {
  padding: 5px 10px; font-size: 13px; white-space: nowrap;
  border: 0; border-right: 1px solid var(--line);
  border-radius: 0; background: transparent; color: var(--text);
}
.btn:last-child { border-right: 0; }
.btn.wide { min-width: 46px; }
.btn:active { background: var(--panel-2); }
.btn.on { background: var(--gold); color: #fff; font-weight: 600; }
.level { margin-left: auto; width: 36px; height: 36px; position: relative; flex: 0 0 auto; }
/* 十字双气泡水平仪：横管测左右倾斜，竖管测前后倾斜，交叉处有定位刻度 */
.vial {
  position: absolute; background: var(--panel-2); border: 1px solid var(--line);
}
.vial-x { left: 0; right: 0; top: 50%; height: 8px; margin-top: -4px; border-radius: 4px; }
.vial-y { top: 0; bottom: 0; left: 50%; width: 8px; margin-left: -4px; border-radius: 4px; }
.ball {
  position: absolute; left: 50%; top: 50%; width: 6px; height: 6px;
  margin: -3px 0 0 -3px; border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #ffe9a8, #d9a441);
  box-shadow: 0 0 0 1px var(--bg);
  transition: transform .12s linear;
}
.v-center { position: absolute; background: var(--line-soft); }
.v-center-x { left: 50%; top: 1px; bottom: 1px; width: 1px; margin-left: -0.5px; }
.v-center-y { top: 50%; left: 1px; right: 1px; height: 1px; margin-top: -0.5px; }
.needle {
  margin-top: 3px;
  font-size: 10.5px; line-height: 1.35; color: var(--text-dim);
  /* 内容可能很长（含 22 环命中），允许换行并给足两行高度 */
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden; word-break: break-all;
  border-top: 1px solid var(--line-soft); padding-top: 3px;
  min-height: 34px;
}
</style>
