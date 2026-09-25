<script setup>
import { API_BASE_URL } from '../api'
import { ref, onMounted, onUnmounted } from 'vue'

const statusList = ref([])
const errorMessage = ref('')
let refreshTimer

const loadStatus = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/status`, { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok || data.status !== 'success') throw new Error(data.message || '获取状态失败')
    statusList.value = data.data
    errorMessage.value = ''
  } catch (error) {
    errorMessage.value = error.message || '获取状态失败'
  }
}

onMounted(() => {
  loadStatus()
  refreshTimer = setInterval(loadStatus, 15000)
})
onUnmounted(() => clearInterval(refreshTimer))

const formatDate = (dateString) => new Date(dateString).toLocaleString()
</script>

<template>
  <div class="page-container">
    <h1>📡 实时评测动态</h1>
    <button type="button" @click="loadStatus">刷新动态</button>
    <p v-if="errorMessage" role="alert">{{ errorMessage }}</p>
    <table class="data-table">
      <thead>
        <tr>
          <th>运行 ID</th>
          <th>提交时间</th>
          <th>用户</th>
          <th>题目</th>
          <th>评测结果</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="s in statusList" :key="s.id">
          <td>{{ s.id }}</td>
          <td class="time">{{ formatDate(s.created_at) }}</td>
          <td class="username">{{ s.username }}</td>
          <td>
            <router-link :to="`/problem/${s.problem_id}`" class="prob-link">
              {{ s.problem_id }}. {{ s.problem_title }}
            </router-link>
          </td>
          <td>
            <span class="badge" :class="{'ac': s.result === 'Accepted', 'pending': s.result === 'Pending' || s.result === 'Running', 'wa': s.result !== 'Accepted' && s.result !== 'Pending' && s.result !== 'Running'}">
              {{ s.result }}
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.page-container { max-width: 1000px; margin: 40px auto; padding: 20px; }
button { background: #4CAF50; color: white; border: 0; border-radius: 4px; padding: 8px 14px; cursor: pointer; margin-bottom: 12px; }
p[role='alert'] { color: #f44336; }
h1 { color: #fff; margin-bottom: 20px; text-align: center; }
.data-table { width: 100%; border-collapse: collapse; background: #1e1e1e; border-radius: 8px; overflow: hidden; }
.data-table th, .data-table td { padding: 12px 15px; text-align: center; border-bottom: 1px solid #333; color: #ccc; }
.data-table th { background: #252526; color: #4CAF50; font-weight: bold; }
.data-table tr:hover { background: #2a2a2a; }
.time { font-size: 0.9em; color: #888; }
.username { font-weight: bold; color: #fff; }
.prob-link { color: #2196F3; text-decoration: none; transition: color 0.2s; }
.prob-link:hover { color: #64b5f6; text-decoration: underline; }
.badge { padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: bold; }
.badge.ac { background-color: rgba(76, 175, 80, 0.2); color: #81c784; border: 1px solid #4CAF50; }
.badge.pending { background: rgba(255, 152, 0, 0.2); color: #ffb74d; border: 1px solid #ff9800; }
.badge.wa { background-color: rgba(244, 67, 54, 0.2); color: #e57373; border: 1px solid #f44336; }
</style>
