<script setup>
import { API_BASE_URL } from '../api'
import { ref, watch, computed, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
// 👉 1. 引入神级组件：Vue Monaco Editor
import VueMonacoEditor from '@guolao/vue-monaco-editor'

const route = useRoute()
const problemId = computed(() => route.params.id) 



const problemDetail = ref({ title: '加载中...', description: '' })
const initialCode = '#include <iostream>\nusing namespace std;\n\nint main() {\n    // 请在此处编写代码\n    return 0;\n}'
const code = ref(initialCode)
const result = ref('')
const isSubmitting = ref(false)
const resultType = ref('')
let pollTimer
let requestSerial = 0

watch(() => route.params.id, async (id) => {
  requestSerial++
  clearTimeout(pollTimer)
  isSubmitting.value = false
  problemDetail.value = { title: '加载中...', description: '' }
  code.value = initialCode
  result.value = ''
  resultType.value = ''
  try {
    const response = await fetch(`${API_BASE_URL}/problem/${id}`)
    const data = await response.json()
    if (String(route.params.id) === String(id) && data.status === 'success') {
      problemDetail.value = data.data
    }
  } catch (error) {
    console.error('获取题目详情失败', error)
  }
}, { immediate: true })

const pollSubmission = async (submissionId, serial) => {
  if (serial !== requestSerial) return
  try {
    const response = await fetch(`${API_BASE_URL}/submission/${submissionId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('oj_token')}` },
      cache: 'no-store'
    })
    const data = await response.json()
    if (!response.ok || data.status !== 'success') throw new Error(data.message || '查询评测结果失败')
    if (serial !== requestSerial) return
    const submission = data.data
    resultType.value = submission.result
    if (submission.result === 'Pending' || submission.result === 'Running') {
      result.value = `提交 #${submissionId}：${submission.result === 'Pending' ? '排队中' : '正在评测'}...`
      pollTimer = setTimeout(() => pollSubmission(submissionId, serial), 1500)
      return
    }
    result.value = `【提交 #${submissionId}】\n【评测结果】: ${submission.result}\n【详细信息】: ${submission.output || '无'}`
    isSubmitting.value = false
  } catch (error) {
    if (serial !== requestSerial) return
    resultType.value = 'Error'
    result.value = `查询评测结果失败：${error.message}。可到“状态”页查看提交记录。`
    isSubmitting.value = false
  }
}

const submitCode = async () => {
  const submittedProblemId = Number(problemId.value)
  const serial = ++requestSerial
  clearTimeout(pollTimer)
  isSubmitting.value = true
  resultType.value = 'Pending'
  result.value = '正在提交代码...'
  try {
    const response = await fetch(`${API_BASE_URL}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('oj_token')}`
      },
      body: JSON.stringify({ code: code.value, problemId: submittedProblemId })
    })
    const data = await response.json()
    if (serial !== requestSerial) return
    if (!response.ok || data.status !== 'success' || !data.submissionId) {
      throw new Error(data.message || '提交失败')
    }
    result.value = `提交 #${data.submissionId} 已进入队列，等待评测...`
    pollSubmission(data.submissionId, serial)
  } catch (error) {
    if (serial !== requestSerial) return
    resultType.value = 'Error'
    result.value = `提交失败：${error.message}`
    isSubmitting.value = false
  }
}

onUnmounted(() => {
  requestSerial++
  clearTimeout(pollTimer)
})</script>

<template>
  <div class="detail-container">
    <div class="problem-info">
      <h1>{{ problemId }}. {{ problemDetail.title }}</h1>

      <div class="meta-info">
        <span class="tag">⏱️ 时间限制: {{ problemDetail.time_limit || 1000 }} ms</span>
        <span class="tag">💾 内存限制: {{ problemDetail.memory_limit || 256 }} MB</span>
      </div>

      <div class="desc-box">
        <p>{{ problemDetail.description }}</p>
      </div>
    </div>

    <div class="editor-area">
      <vue-monaco-editor
      height="400px"
       v-model:value="code"
        theme="vs-dark"
        language="cpp"
        :options="{
          automaticLayout:true,       /* 自动适应父容器大小 */
          fontSize: 16,                /* 字体大小 */
          minimap: { enabled: false }, /* 关闭右侧的迷你小地图，保持界面清爽 */
          scrollBeyondLastLine: false, /* 取消最后一行底部的过多留白 */
          wordWrap: 'on'               /* 代码自动换行 */
        }"
      />
    </div>

    <div class="button-container">
      <button @click="submitCode" :disabled="isSubmitting">
        {{ isSubmitting ? '评测中...' : '提交代码' }}
      </button>
    </div>

    <div class="result-area" v-if="result" :class="{'ac': resultType === 'Accepted', 'wa': resultType === 'Wrong Answer', 'err': resultType?.includes('Error')}">
      <pre>{{ result }}</pre>
    </div>
  </div>
</template>

<style scoped> 
.detail-container {width:100%; max-width: 900px;box-sizing: border-box; margin: 30px auto; padding: 20px; }
.problem-info { margin-bottom: 30px; }
h1 { color: #fff; font-size: 24px; margin-bottom: 15px; }
.desc-box { background: #1e1e1e; padding: 20px; border-radius: 8px; border-left: 4px solid #4CAF50; color: #ccc; line-height: 1.6; }

.meta-info {
  display: flex;
  gap: 15px;
  margin-bottom: 15px;
}

.tag {
  background-color: #252526;
  color: #aaa;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: bold;
  border: 1px solid #333;
  display: flex;
  align-items: center;
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.2);
}
/* 👉 3. 必须给容器设置一个固定的高度，否则 Monaco Editor 会缩成一条线 */

.editor-area { 
  width: 100%; 
  height: 400px; 
  border: 1px solid #333; 
  border-radius: 6px; 
  overflow: hidden; /* 保证圆角生效 */
  margin-top: 20px;
} 

.button-container { margin-top: 20px; text-align: right; }
button { padding: 12px 35px; font-size: 16px; font-weight: bold; background-color: #4CAF50; color: white; border: none; border-radius: 6px; cursor: pointer; transition: all 0.2s; }
button:hover:not(:disabled) { background-color: #45a049; }
button:disabled { background-color: #444; color: #888; cursor: not-allowed; }
.result-area { margin-top: 30px; padding: 20px; background-color: #252526; border-radius: 6px; font-size: 15px; line-height: 1.6; }
.result-area.ac { border-left: 6px solid #4CAF50; color: #81c784; }
.result-area.wa { border-left: 6px solid #f44336; color: #e57373; }
.result-area.err { border-left: 6px solid #ff9800; color: #ffb74d; }
pre { white-space: pre-wrap; margin: 0; font-family: monospace; }

</style>

