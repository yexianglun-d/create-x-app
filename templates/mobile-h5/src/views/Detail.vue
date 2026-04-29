<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const detailCopy = computed(() => ({
  title: `活动详情：${String(route.params.id ?? 'unknown')}`,
  summary: '你可以在这里扩展报名表单、商品详情、规格弹层和接口联调逻辑。',
}))
</script>

<template>
  <div class="detail-page">
    <van-nav-bar
      title="详情页"
      left-text="返回"
      left-arrow
      fixed
      placeholder
      @click-left="router.back()"
    />

    <section class="detail-card">
      <h1>{{ detailCopy.title }}</h1>
      <p>{{ detailCopy.summary }}</p>

      <van-cell-group inset class="detail-group">
        <van-cell title="路由" value="/detail/:id" />
        <van-cell title="布局" value="rem 自适应" />
        <van-cell title="组件库" value="Vant" />
      </van-cell-group>

      <van-button type="primary" round block @click="router.push({ name: 'home' })">
        返回首页
      </van-button>
    </section>
  </div>
</template>

<style scoped>
.detail-page {
  min-height: 100vh;
  padding: 0.2rem 0.16rem 0.32rem;
  background:
    radial-gradient(circle at top left, rgba(14, 165, 233, 0.12), transparent 32%),
    linear-gradient(180deg, #f8fbff 0%, #eef4fb 100%);
}

.detail-card {
  margin-top: 0.08rem;
  padding: 0.24rem;
  border-radius: 0.24rem;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 0.18rem 0.32rem rgba(15, 23, 42, 0.08);
}

.detail-card h1 {
  margin: 0;
  font-size: 0.28rem;
  line-height: 1.4;
}

.detail-card p {
  margin: 0.14rem 0 0.22rem;
  color: #475569;
  font-size: 0.15rem;
  line-height: 1.75;
}

.detail-group {
  margin-bottom: 0.2rem;
}
</style>
