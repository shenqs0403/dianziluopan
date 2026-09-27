<script setup>
/** 2.2 陀螺仪校对界面：提示画「8」字，完成后自动关闭，也可跳过 */
const props = defineProps({
  progress: { type: Number, default: 0 },
  statusText: { type: String, default: '' },
  visible: { type: Boolean, default: false }
})
const emit = defineEmits(['skip'])
</script>

<template>
  <div v-if="visible" class="mask">
    <button class="skip" @click="emit('skip')">跳过</button>
    <div class="box">
      <div class="fig">8</div>
      <div class="title">陀螺仪校对</div>
      <p class="text">请手持设备缓慢、连贯地画「8」字样<br />校对成功后会自动关闭</p>
      <div class="bar"><i :style="{ width: Math.round(props.progress * 100) + '%' }" /></div>
      <div class="status">{{ statusText }}（{{ Math.round(props.progress * 100) }}%）</div>
    </div>
  </div>
</template>

<style scoped>
.mask {
  position: fixed; inset: 0; z-index: 30;
  background: var(--mask);
  display: flex; align-items: center; justify-content: center;
}
.skip {
  position: absolute; top: 12px; right: 14px;
  padding: 6px 12px; font-size: 13px; border-radius: 14px;
  border: 1px solid var(--line); background: var(--box); color: var(--accent);
}
.box { text-align: center; color: var(--text-strong); padding: 0 30px; }
.fig {
  width: 108px; height: 108px; margin: 0 auto 14px; line-height: 108px;
  border: 3px dashed var(--gold-2); border-radius: 50%;
  font-size: 56px; color: var(--gold-2); font-weight: 700;
}
.title { font-size: 17px; margin-bottom: 8px; }
.text { font-size: 13px; line-height: 1.7; color: var(--text-dim); margin: 0 0 16px; }
.bar {
  height: 8px; border-radius: 4px; background: var(--line-soft); overflow: hidden;
}
.bar i { display: block; height: 100%; background: var(--gold-2); transition: width .2s; }
.status { margin-top: 8px; font-size: 12px; color: var(--text-dim); }
</style>
