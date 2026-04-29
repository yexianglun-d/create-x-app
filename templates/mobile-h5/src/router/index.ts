import { createRouter, createWebHistory } from 'vue-router'
import Detail from '../views/Detail.vue'
import Home from '../views/Home.vue'

export default createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: Home,
    },
    {
      path: '/detail/:id',
      name: 'detail',
      component: Detail,
    },
  ],
})
