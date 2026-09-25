import { createRouter, createWebHistory } from 'vue-router'
import ProblemList from '../views/ProblemList.vue'
import ProblemDetail from '../views/ProblemDetail.vue'
import Login from '../views/Login.vue'
import Leaderboard from '../views/Leaderboard.vue'
import Status from '../views/Status.vue'
import Admin from '../views/Admin.vue'
// 👉 1. 新增：引入讨论区的两个核心视图组件
import Forum from '../views/Forum.vue'
import PostDetail from '../views/PostDetail.vue'
import Contests from '../views/Contests.vue'
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: Login },
    { path: '/', component: ProblemList },
    { path: '/problem/:id', component: ProblemDetail },
    { path: '/leaderboard', component: Leaderboard },
    { path: '/status', component: Status },
    { path: '/admin', component: Admin },
    // 👉 2. 新增：注册讨论区大厅和帖子详情的访问路径
    { path: '/forum', component: Forum },
    { path: '/post/:id', component: PostDetail },
    {
      path: '/contests',
      component: Contests
    }
  ]
})

const isTokenExpired = (token) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()
  } catch {
    return true
  }
}
// 全局前置守卫（保安大叔）
router.beforeEach((to, from, next) => {
  // 去浏览器本地存储里翻一翻，有没有 token 通行证？
  const token = localStorage.getItem('oj_token')

  // 如果你要去的地方不是登录页，而且你还没带通行证
  if (to.path !== '/login' && (!token || isTokenExpired(token))) {
    localStorage.removeItem('oj_token')
    localStorage.removeItem('oj_username')
    localStorage.removeItem('oj_is_admin')
    next('/login')
  } else {
    next() // 检查通过，放行！
  }
})

export default router
