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

/** 双层水平仪的悬停提示：状态靠气泡是否居中表达，不占界面文字 */
const levelText = computed(() =>
  Math.abs(props.roll) < 1.2 && Math.abs(props.pitch) < 1.2 ? '水平' : '倾斜'
)
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
      <div class="lv-ring">
        <span class="lv-cross lv-cross-h" />
        <span class="lv-cross lv-cross-v" />
        <div
          class="lv-ball"
          :style="{
            transform: `translate(${Math.max(-9, Math.min(9, roll * 0.3))}px, ${Math.max(-9, Math.min(9, pitch * 0.3))}px)`
          }"
        />
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
.level { margin-left: auto; display: flex; align-items: center; }
/* 双层圆形水平仪：外圈固定 + 十字参考 + 内层气泡随倾斜移动 */
.lv-ring {
  width: 34px; height: 34px; border-radius: 50%; position: relative;
  border: 1.5px solid var(--line); background: var(--panel-2);
  box-shadow: inset 0 0 0 3px var(--panel);
}
.lv-cross {
  position: absolute; background: var(--line-soft);
}
.lv-cross-h { left: 3px; right: 3px; top: 50%; height: 1px; transform: translateY(-0.5px); }
.lv-cross-v { top: 3px; bottom: 3px; left: 50%; width: 1px; transform: translateX(-0.5px); }
.lv-ball {
  position: absolute; left: 50%; top: 50%; width: 13px; height: 13px;
  margin: -6.5px 0 0 -6.5px; border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #ffe9a8, #d9a441);
  box-shadow: 0 0 0 1.5px var(--bg);
  transition: transform .12s linear;
}
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
