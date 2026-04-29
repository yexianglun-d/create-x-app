import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import 'vant/lib/index.css'
import './styles/reset.css'
import { setupRem } from './utils/rem'

setupRem()

createApp(App)
  .use(router)
  .mount('#app')
