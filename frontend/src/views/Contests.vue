<script setup>
import { API_BASE_URL } from '../api'
import { ref, onMounted, onUnmounted } from 'vue'

const contestList = ref([])
const loadingContests = ref(true)
const contestError = ref('')
const activeContest = ref(null)
const contestProblems = ref([])
const loadingProblems = ref(false)
const problemError = ref('')
const now = ref(Date.now())
let clockTimer

const contestStatus = (contest) => {
  if (now.value < new Date(contest.start_time).getTime()) return '未开始'
  if (now.value > new Date(contest.end_time).getTime()) return '已结束'
  return '进行中'
}

// 1. 获取全站竞赛/作业列表
const fetchContests = async () => {
  loadingContests.value = true
  contestError.value = ''
  try {
    const res = await fetch(`${API_BASE_URL}/list`, { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok || data.status !== 'success') throw new Error(data.message || '获取比赛失败')
    contestList.value = data.data
  } catch (error) {
    contestError.value = error.message || '获取比赛失败'
  } finally {
    loadingContests.value = false
  }
}
// 2. 联动多对多中间表：点击某场比赛，拉取它的专属题目集
const selectContest = async (contest) => {
  activeContest.value = contest
  contestProblems.value = []
  loadingProblems.value = true
  problemError.value = ''
  try {
    const res = await fetch(`${API_BASE_URL}/${contest.id}/problems`)
    const data = await res.json()
    if (!res.ok || data.status !== 'success') throw new Error(data.message || '获取竞赛题目失败')
    if (activeContest.value?.id === contest.id) contestProblems.value = data.data
  } catch (error) {
    if (activeContest.value?.id === contest.id) problemError.value = error.message || '获取竞赛题目失败'
  } finally {
    if (activeContest.value?.id === contest.id) loadingProblems.value = false
  }
}

const formatDate = (isoStr) => {
  return new Date(isoStr).toLocaleString()
}

onMounted(() => {
  fetchContests()
  clockTimer = setInterval(() => { now.value = Date.now() }, 60000)
})
onUnmounted(() => clearInterval(clockTimer))
</script>

<template>
  <div class="contest-container">
    <h1>🏆 竞赛与作业大厅</h1>
    <p v-if="loadingContests" class="no-data">正在加载比赛...</p>
    <p v-else-if="contestError" class="no-data" role="alert">{{ contestError }}</p>
    <p v-else-if="contestList.length === 0" class="no-data">暂无比赛</p>
    
    <div 
      :class="['contest-card', activeContest?.id === c.id ? 'active' : '']" 
      v-for="c in contestList" 
      :key="c.id"
      @click="selectContest(c)"
    >
      <div class="contest-main">
        <span class="ctitle">{{ c.title }}</span>
        <span class="status-tag">{{ contestStatus(c) }}</span>
      </div>
      <div class="contest-time">
        <p>📅 开始: {{ formatDate(c.start_time) }}</p>
        <p>🏁 结束: {{ formatDate(c.end_time) }}</p>
      </div>
    </div>

    <div class="sub-section" v-if="activeContest">
      <h2>🎯 {{ activeContest.title }} - 专属作业赛题</h2>
      <div class="no-data" v-if="loadingProblems">正在加载赛题...</div>
      <div class="no-data" v-else-if="problemError">{{ problemError }}</div>
      <div class="no-data" v-else-if="contestProblems.length === 0">暂无赛题</div>
      
      <div class="problem-item" v-for="p in contestProblems" :key="p.id">
        <div class="prob-left">
          <span class="pid">#{{ p.id }}</span>
          <span class="ptitle">{{ p.title }}</span>
          <span class="limit-badge">{{ p.time_limit }}ms / {{ p.memory_limit }}MB</span>
        </div>
        <router-link :to="`/problem/${p.id}`" class="go-btn">去切题</router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.contest-container { max-width: 800px; margin: 40px auto; padding: 20px; }
h1, h2 { color: #fff; margin-bottom: 20px; }
h2 { margin-top: 40px; color: #fbbf24; border-bottom: 1px solid #333; padding-bottom: 10px; }

/* 竞赛卡片基础样式 */
.contest-card { background-color: #1e1e1e; padding: 20px; margin-bottom: 15px; border-radius: 8px; border-left: 4px solid #3b82f6; cursor: pointer; transition: all 0.2s; }
.contest-card:hover { transform: translateX(5px); background-color: #252525; }
.contest-card.active { border-left-color: #fbbf24; background-color: #252525; box-shadow: 0 0 15px rgba(251, 191, 36, 0.1); }

.contest-main { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.ctitle { color: #fff; font-size: 18px; font-weight: bold; }
.status-tag { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; background-color: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid #3b82f6; }

.contest-time { font-size: 13px; color: #888; }
.contest-time p { margin: 4px 0; }

/* 联动的题目项样式 */
.problem-item { display: flex; justify-content: space-between; align-items: center; background-color: #151515; padding: 15px 20px; margin-bottom: 10px; border-radius: 6px; border: 1px solid #222; }
.prob-left { display: flex; align-items: center; gap: 15px; }
.pid { color: #666; font-weight: bold; }
.ptitle { color: #eee; font-size: 16px; font-weight: bold; }
.limit-badge { font-size: 11px; color: #888; background: #222; padding: 2px 6px; border-radius: 4px; }
.no-data { color: #555; font-size: 14px; text-align: center; padding: 20px; }

.go-btn { text-decoration: none; background-color: #fbbf24; color: #111; padding: 6px 14px; border-radius: 4px; font-weight: bold; transition: background 0.2s; font-size: 14px; }
.go-btn:hover { background-color: #f59e0b; }
</style>
