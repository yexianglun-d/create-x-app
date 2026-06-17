<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const plan = computed(() => {
  const planId = String(route.params.id ?? 'store-open')

  if (planId === 'customer-care') {
    return {
      title: '客户回访排期',
      summary: '把回访对象、预约时间和负责人统一收口，适合售后与客户成功团队。',
      steps: ['确认客户名单', '选择回访时段', '同步负责人', '记录回访结果'],
    }
  }

  return {
    title: '新店开业支持',
    summary: '把开业前的物料、人员和检查项集中确认，减少现场反复沟通。',
    steps: ['提交门店信息', '确认物料清单', '预约支持时段', '完成开业检查'],
  }
})
</script>

<template>
  <div class="detail-page">
    <van-nav-bar
      title="预约详情"
      left-text="返回"
      left-arrow
      fixed
      placeholder
      @click-left="router.back()"
    />

    <section class="detail-card">
      <h1>{{ plan.title }}</h1>
      <p>{{ plan.summary }}</p>

      <van-steps direction="vertical" :active="1">
        <van-step v-for="step in plan.steps" :key="step">{{ step }}</van-step>
      </van-steps>

      <van-button type="primary" round block @click="router.push({ name: 'home' })">
        返回提交预约
      </van-button>
    </section>
  </div>
</template>

<style scoped>
.detail-page {
  min-height: 100vh;
  padding: 0.2rem 0.16rem 0.32rem;
  background: #f5f7fb;
}

.detail-card {
  border: 1px solid #e6ebf2;
  border-radius: 0.08rem;
  padding: 0.22rem;
  background: #ffffff;
}

.detail-card h1 {
  margin: 0;
  color: #111827;
  font-size: 0.28rem;
  line-height: 1.4;
}

.detail-card p {
  margin: 0.12rem 0 0.2rem;
  color: #5d6678;
  font-size: 0.15rem;
  line-height: 1.75;
}
</style>
