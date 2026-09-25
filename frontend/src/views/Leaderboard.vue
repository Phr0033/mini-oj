<script setup>
import { API_BASE_URL } from '../api'
import { ref, onMounted, onUnmounted } from 'vue'

const rankList = ref([])
const errorMessage = ref('')
let refreshTimer

const loadLeaderboard = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/leaderboard`, { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok || data.status !== 'success') throw new Error(data.message || '获取排行榜失败')
    rankList.value = data.data
    errorMessage.value = ''
  } catch (error) {
    errorMessage.value = error.message || '获取排行榜失败'
  }
}

onMounted(() => {
  loadLeaderboard()
  refreshTimer = setInterval(loadLeaderboard, 15000)
})
onUnmounted(() => clearInterval(refreshTimer))
</script>

<template>
  <div class="page-container">
    <h1>🏆 全站排行榜</h1>
    <button type="button" @click="loadLeaderboard">刷新排行榜</button>
    <p v-if="errorMessage" role="alert">{{ errorMessage }}</p>
    <table class="data-table">
      <thead>
        <tr>
          <th>排名</th>
          <th>用户</th>
          <th>AC 题数</th>
          <th>总提交数</th>
          <th>题目通过率</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(user, index) in rankList" :key="user.username">
          <td class="rank-num">#{{ index + 1 }}</td>
          <td class="username">👤 {{ user.username }}</td>
          <td class="ac-count">{{ user.ac_count }}</td>
          <td>{{ user.total_submissions }}</td>
          <td>
            {{ user.attempted_count > 0 ? Math.round((user.ac_count / user.attempted_count) * 100) : 0 }}%
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.page-container { max-width: 900px; margin: 40px auto; padding: 20px; }
button { background: #4CAF50; color: white; border: 0; border-radius: 4px; padding: 8px 14px; cursor: pointer; margin-bottom: 12px; }
p[role='alert'] { color: #f44336; }
h1 { color: #fff; margin-bottom: 20px; text-align: center; }
.data-table { width: 100%; border-collapse: collapse; background: #1e1e1e; border-radius: 8px; overflow: hidden; }
.data-table th, .data-table td { padding: 15px; text-align: center; border-bottom: 1px solid #333; color: #ccc; }
.data-table th { background: #252526; color: #4CAF50; font-weight: bold; }
.data-table tr:hover { background: #2a2a2a; }
.rank-num { font-weight: bold; color: #ff9800; font-size: 1.1em; }
.username { font-weight: bold; color: #fff; }
.ac-count { color: #4CAF50; font-weight: bold; font-size: 1.1em; }
</style>