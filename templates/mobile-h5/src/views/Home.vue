<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useRequest } from '../composables/useRequest'

interface CampaignCard {
  id: string
  title: string
  desc: string
  tag: string
  price: string
}

const bannerImages = [
  'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&q=80',
]

const router = useRouter()
const campaignRequest = useRequest<CampaignCard[]>(async () => {
  await new Promise((resolve) => setTimeout(resolve, 200))

  return [
    {
      id: 'summer',
      title: '夏日会员日',
      desc: '适合承载微信 H5 活动页、导购页和报名页。',
      tag: '营销活动',
      price: '¥ 89 起',
    },
    {
      id: 'coupon',
      title: '新客券包',
      desc: '配好路由、请求封装和 rem 布局，直接接接口即可上线。',
      tag: '增长转化',
      price: '¥ 39 起',
    },
  ]
})
const campaigns = computed(() => campaignRequest.data.value ?? [])

onMounted(() => {
  void campaignRequest.run()
})

function openDetail(campaignId: string) {
  void router.push({
    name: 'detail',
    params: { id: campaignId },
  })
}
</script>

<template>
  <div class="page-shell">
    <van-nav-bar title="移动端 H5 模板" fixed placeholder />

    <section class="hero-section">
      <div class="hero-copy">
        <p class="hero-kicker">create-x-app / mobile-h5</p>
        <h1 class="hero-title">用 Vant 快速起一个真正适合手机的页面</h1>
        <p class="hero-desc">
          这个模板已经接好 rem 自适应、Vue Router 和请求 composable，
          非常适合微信活动页、促销页和轻应用场景。
        </p>
      </div>

      <van-swipe class="hero-swipe" :autoplay="2800" indicator-color="#2563eb">
        <van-swipe-item v-for="imageUrl in bannerImages" :key="imageUrl">
          <img :src="imageUrl" alt="banner" class="hero-image" />
        </van-swipe-item>
      </van-swipe>
    </section>

    <section class="content-section">
      <div class="section-head">
        <h2>推荐场景</h2>
        <van-tag type="primary" round>Mobile Ready</van-tag>
      </div>

      <van-skeleton v-if="campaignRequest.loading" title :row="3" />

      <van-empty
        v-else-if="campaignRequest.error"
        image="error"
        :description="campaignRequest.error"
      />

      <div v-else class="card-list">
        <van-card
          v-for="campaign in campaigns"
          :key="campaign.id"
          :title="campaign.title"
          :desc="campaign.desc"
          :price="campaign.price"
          currency=""
          class="campaign-card"
        >
          <template #tags>
            <van-tag plain type="primary">{{ campaign.tag }}</van-tag>
          </template>

          <template #footer>
            <van-button size="small" type="primary" round @click="openDetail(campaign.id)">
              查看详情
            </van-button>
          </template>
        </van-card>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page-shell {
  min-height: 100vh;
  padding-bottom: 0.48rem;
  background:
    radial-gradient(circle at top left, rgba(37, 99, 235, 0.12), transparent 32%),
    linear-gradient(180deg, #f8fbff 0%, #eef4fb 100%);
}

.hero-section {
  padding: 0.32rem 0.16rem 0;
}

.hero-copy {
  padding: 0.12rem 0.08rem 0.24rem;
}

.hero-kicker {
  margin: 0 0 0.12rem;
  color: #2563eb;
  font-size: 0.12rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.hero-title {
  margin: 0;
  color: #0f172a;
  font-size: 0.34rem;
  line-height: 1.35;
}

.hero-desc {
  margin: 0.14rem 0 0;
  color: #475569;
  font-size: 0.15rem;
  line-height: 1.7;
}

.hero-swipe {
  overflow: hidden;
  height: 2rem;
  border-radius: 0.24rem;
  box-shadow: 0 0.18rem 0.4rem rgba(37, 99, 235, 0.14);
}

.hero-image {
  height: 100%;
  width: 100%;
  object-fit: cover;
}

.content-section {
  padding: 0.24rem 0.16rem 0;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.16rem;
}

.section-head h2 {
  margin: 0;
  font-size: 0.22rem;
}

.card-list {
  display: grid;
  gap: 0.14rem;
}

.campaign-card {
  overflow: hidden;
  border-radius: 0.22rem;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 0.18rem 0.32rem rgba(15, 23, 42, 0.08);
}
</style>
