<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useRequest } from '../composables/useRequest'

interface AppointmentPlan {
  id: string
  title: string
  summary: string
  tag: string
  quota: number
}

interface AppointmentForm {
  name: string
  phone: string
  demand: string
}

const router = useRouter()
const submitted = ref(false)
const form = ref<AppointmentForm>({
  name: '',
  phone: '',
  demand: '',
})

const planRequest = useRequest<AppointmentPlan[]>(async () => {
  await new Promise((resolve) => setTimeout(resolve, 200))

  return [
    {
      id: 'store-open',
      title: '新店开业支持',
      summary: '适合门店筹备、物料确认和开业前检查。',
      tag: '门店运营',
      quota: 18,
    },
    {
      id: 'customer-care',
      title: '客户回访排期',
      summary: '适合客户成功、售后跟进和服务预约。',
      tag: '客户服务',
      quota: 32,
    },
  ]
})

const plans = computed(() => planRequest.data.value ?? [])

onMounted(() => {
  void planRequest.run()
})

function submitAppointment() {
  submitted.value = true
}

function openDetail(planId: string) {
  void router.push({
    name: 'detail',
    params: { id: planId },
  })
}
</script>

<template>
  <div class="page-shell">
    <van-nav-bar title="预约申请" fixed placeholder />

    <section class="hero-section">
      <h1>把客户报名和预约收口到手机端</h1>
      <p>适合活动报名、到店预约、服务咨询和线索收集，提交后即可进入后续跟进流程。</p>
      <div class="hero-actions">
        <van-button type="primary" round block @click="openDetail('store-open')">
          查看预约方案
        </van-button>
      </div>
    </section>

    <section class="content-section">
      <div class="section-head">
        <h2>可预约服务</h2>
        <van-tag type="primary" round>本周开放</van-tag>
      </div>

      <van-skeleton v-if="planRequest.loading.value" title :row="3" />

      <van-empty
        v-else-if="planRequest.error.value"
        image="error"
        :description="planRequest.error.value"
      />

      <div v-else class="card-list">
        <van-card
          v-for="plan in plans"
          :key="plan.id"
          :title="plan.title"
          :desc="plan.summary"
          :price="plan.quota"
          currency=""
          num="个名额"
          class="service-card"
        >
          <template #tags>
            <van-tag plain type="primary">{{ plan.tag }}</van-tag>
          </template>

          <template #footer>
            <van-button size="small" type="primary" round @click="openDetail(plan.id)">
              查看详情
            </van-button>
          </template>
        </van-card>
      </div>
    </section>

    <section class="form-section">
      <h2>提交预约</h2>
      <van-form @submit="submitAppointment">
        <van-cell-group inset>
          <van-field
            v-model="form.name"
            name="name"
            label="姓名"
            placeholder="请输入姓名"
            :rules="[{ required: true, message: '请填写姓名' }]"
          />
          <van-field
            v-model="form.phone"
            name="phone"
            label="手机号"
            placeholder="请输入手机号"
            type="tel"
            :rules="[{ required: true, message: '请填写手机号' }]"
          />
          <van-field
            v-model="form.demand"
            name="demand"
            label="需求"
            placeholder="例如：周五下午到店咨询"
            rows="2"
            type="textarea"
          />
        </van-cell-group>

        <div class="submit-area">
          <van-button round block type="primary" native-type="submit">
            提交预约
          </van-button>
          <van-notice-bar
            v-if="submitted"
            mode="closeable"
            text="预约已记录，后续可接入短信、企微或 CRM 跟进。"
          />
        </div>
      </van-form>
    </section>
  </div>
</template>

<style scoped>
.page-shell {
  min-height: 100vh;
  padding-bottom: 0.48rem;
  background: #f5f7fb;
}

.hero-section {
  padding: 0.28rem 0.16rem 0.18rem;
  background: #ffffff;
  border-bottom: 1px solid #e6ebf2;
}

.hero-section h1 {
  margin: 0;
  color: #111827;
  font-size: 0.32rem;
  line-height: 1.32;
}

.hero-section p {
  margin: 0.12rem 0 0;
  color: #5d6678;
  font-size: 0.15rem;
  line-height: 1.7;
}

.hero-actions {
  margin-top: 0.2rem;
}

.content-section,
.form-section {
  padding: 0.22rem 0.16rem 0;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.14rem;
}

.section-head h2,
.form-section h2 {
  margin: 0;
  color: #111827;
  font-size: 0.2rem;
}

.form-section h2 {
  margin-bottom: 0.14rem;
}

.card-list {
  display: grid;
  gap: 0.12rem;
}

.service-card {
  overflow: hidden;
  border: 1px solid #e6ebf2;
  border-radius: 0.08rem;
  background: #ffffff;
}

.submit-area {
  display: grid;
  gap: 0.12rem;
  margin-top: 0.16rem;
}
</style>
