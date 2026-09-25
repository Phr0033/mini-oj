<script setup>
import { API_BASE_URL } from '../api'
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const problems = ref([])
const userStatus = ref({})
const statusState = ref('loading')
const statusError = ref('')

const loadProblems = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/problems`, { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok || data.status !== 'success') throw new Error(data.message || '获取题库失败')
    problems.value = data.data
  } catch (error) {
    console.error('获取题库失败', error)
  }
}

const loadUserStatus = async () => {
  statusState.value = 'loading'
  statusError.value = ''
  const token = localStorage.getItem('oj_token')
  if (!token) {
    router.replace('/login')
    return
  }
  try {
    const res = await fetch(`${API_BASE_URL}/user/status`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store'
    })
    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem('oj_token')
      localStorage.removeItem('oj_username')
      localStorage.removeItem('oj_is_admin')
      router.replace('/login')
      return
    }
    const data = await res.json()
    if (!res.ok || data.status !== 'success' || !Array.isArray(data.data)) {
      throw new Error(data.message || '获取做题状态失败')
    }
    userStatus.value = Object.fromEntries(data.data.map(item => [
      item.problem_id,
      { isAc: Number(item.ac_count) > 0, attempts: Number(item.total_attempts), pending: Number(item.pending_count) }
    ]))
    statusState.value = 'ready'
  } catch (error) {
    statusState.value = 'error'
    statusError.value = error.message || '获取做题状态失败'
  }
}

onMounted(() => {
  loadProblems()
  loadUserStatus()
})
</script>

<template>
  <div class="list-container">
    <h1>📚 题库列表</h1>
    <p v-if="statusState === 'error'" class="status-error" role="alert">
      做题状态暂时无法获取：{{ statusError }}
      <button type="button" @click="loadUserStatus">重试</button>
    </p>
    <div class="problem-card" v-for="p in problems" :key="p.id">
      <div class="problem-main">
        <span class="pid">#{{ p.id }}</span>
        <span class="ptitle">{{ p.title }}</span>
        <span class="status-badge todo" v-if="statusState === 'loading'">状态加载中</span>
        <span class="status-badge todo" v-else-if="statusState === 'error'">状态未知</span>
        <span class="status-badge ac" v-else-if="userStatus[p.id]?.isAc">
          ✅ 已通过 ({{ userStatus[p.id].attempts }}次尝试)
        </span>
        <span class="status-badge todo" v-else-if="userStatus[p.id]?.pending > 0">⏳ 评测中</span>
        <span class="status-badge wa" v-else-if="userStatus[p.id]?.attempts > 0">
          ❌ 未通过 ({{ userStatus[p.id].attempts }}次尝试)
        </span>
        <span class="status-badge todo" v-else>📝 未尝试</span>
      </div>
      <router-link :to="`/problem/${p.id}`" class="go-btn">去挑战</router-link>
    </div>
  </div>
</template>

<style scoped>
.list-container { max-width: 800px; margin: 40px auto; padding: 20px; }
h1 { color: #fff; margin-bottom: 20px; }
.problem-card { display: flex; justify-content: space-between; align-items: center; background-color: #1e1e1e; padding: 20px; margin-bottom: 15px; border-radius: 8px; border-left: 4px solid #4CAF50; transition: transform 0.2s; }
.problem-card:hover { transform: translateX(5px); background-color: #252525; }
.problem-main { display: flex; align-items: center; gap: 15px; }
.pid { color: #888; font-weight: bold; }
.ptitle { color: #fff; font-size: 18px; font-weight: bold; }
.status-badge { padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: bold; margin-left: 10px; }
.status-badge.ac { background-color: rgba(76, 175, 80, 0.2); color: #81c784; border: 1px solid #4CAF50; }
.status-badge.wa { background-color: rgba(244, 67, 54, 0.2); color: #e57373; border: 1px solid #f44336; }
.status-badge.todo { background-color: rgba(136, 136, 136, 0.2); color: #aaa; border: 1px solid #555; }
.go-btn { text-decoration: none; background-color: #4CAF50; color: white; padding: 8px 16px; border-radius: 4px; font-weight: bold; }
.go-btn:hover { background-color: #45a049; }
.status-error { color: #e57373; }
.status-error button { margin-left: 12px; cursor: pointer; }
</style>

