<script setup>
/** 2.1 首次运行提示界面 */
defineProps({ text: { type: String, default: '电子罗盘仅供参考和学习使用，正式测量请使用真实罗盘' } })
const emit = defineEmits(['confirm'])
</script>

<template>
  <div class="mask">
    <div class="box">
      <div class="title">提示</div>
      <p class="text">{{ text }}</p>
      <button class="btn" @click="emit('confirm')">我知道了</button>
    </div>
  </div>
</template>

<style scoped>
.mask {
  position: fixed; inset: 0; z-index: 40;
  background: var(--mask);
  display: flex; align-items: center; justify-content: center; padding: 24px;
}
.box {
  width: 100%; max-width: 320px; padding: 20px 18px;
  background: var(--box); color: var(--text-strong); border-radius: 12px;
  border: 1px solid var(--line); text-align: center;
}
.title { font-size: 17px; margin-bottom: 12px; color: var(--accent); }
.text { font-size: 15px; line-height: 1.7; margin: 0 0 18px; }
.btn {
  width: 100%; padding: 10px 0; font-size: 15px; border: 0; border-radius: 8px;
  background: var(--gold); color: #fff;
}
.btn:active { filter: brightness(.88); }
</style>
