<script setup>
import { API_BASE_URL } from '../api'
import { ref, onMounted } from 'vue'

// --- 状态控制 ---
const activeTab = ref('manage')
const message = ref('')
const problems = ref([])
const contests = ref([])
const forumPosts = ref([])
const forumComments = ref([])
const selectedPostId = ref(null)
const forumLoading = ref(false)
const commentsLoading = ref(false)
const forumError = ref('')
const forumMessage = ref('')
const forumBusy = ref(false)
const contestMessage = ref('')
const publishingContest = ref(false)
const emptyContest = () => ({ title: '', start_time: '', end_time: '', problem_ids: [] })
const newContest = ref(emptyContest())

// --- 表单数据 ---
const emptyTestCase = () => ({ input_data: '', output_data: '' })
const emptyProblem = () => ({ title: '', description: '', test_cases: [emptyTestCase()], time_limit: 1000, memory_limit: 256 })
const newProblem = ref(emptyProblem())
const editForm = ref({ id: null, ...emptyProblem() })
const addTestCase = (form) => form.test_cases.push(emptyTestCase())
const removeTestCase = (form, index) => {
  if (form.test_cases.length > 1) form.test_cases.splice(index, 1)
}
const showEditModal = ref(false)

// --- 提取公共 Token ---
const getHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem('oj_token')}`
})

// ================= API 逻辑 =================

// 1. 获取所有题目列表
const fetchProblems = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/problems`)
    const data = await res.json()
    if (data.status === 'success') problems.value = data.data
  } catch (err) { console.error('获取列表失败') }
}

const fetchContests = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/list`, { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok || data.status !== 'success') throw new Error(data.message || '获取比赛失败')
    contests.value = data.data
  } catch (error) {
    contestMessage.value = error.message || '获取比赛失败'
  }
}
onMounted(() => {
  fetchProblems()
  fetchContests()
})

// 2. 发布新题
const publishProblem = async () => {
  message.value = '正在发布...'
  try {
    const res = await fetch(`${API_BASE_URL}/admin/problem`, {
      method: 'POST', headers: getHeaders(),
      body: JSON.stringify(newProblem.value)
    })
    const data = await res.json()
    message.value = data.message
    if (data.status === 'success') {
      newProblem.value = emptyProblem()
      fetchProblems() // 刷新列表
      setTimeout(() => activeTab.value = 'manage', 1000) // 发布成功后跳回管理列表
    }
  } catch (error) { message.value = '发布失败' }
}

// 3. 删除题目
const deleteProblem = async (id, title) => {
  if (!confirm(`🚨 警告：确定要彻底删除题目【${title}】以及它的所有提交记录吗？此操作不可逆！`)) return
  
  try {
    const res = await fetch(`${API_BASE_URL}/admin/problem/${id}`, {
      method: 'DELETE', headers: getHeaders()
    })
    const data = await res.json()
    if (data.status === 'success') {
      alert('题目已删除！')
      fetchProblems() // 刷新列表
    }
  } catch (err) { alert('删除失败') }
}

// 4. 打开编辑弹窗 (需先获取详细信息)
const openEdit = async (id) => {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/problem/${id}`, { headers: getHeaders() })
    const data = await res.json()
    if (data.status === 'success') {
      editForm.value = { ...data.data, id }
      showEditModal.value = true // 弹出修改框
    }
  } catch (err) { alert('获取题目详情失败') }
}

// 5. 保存修改
const saveEdit = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/problem/${editForm.value.id}`, {
      method: 'PUT', headers: getHeaders(),
      body: JSON.stringify(editForm.value)
    })
    const data = await res.json()
    if (data.status === 'success') {
      alert('修改成功！')
      showEditModal.value = false
      fetchProblems()
    }
  } catch (err) { alert('修改失败') }
}
const publishContest = async () => {
  contestMessage.value = ''
  if (!newContest.value.title.trim() || !newContest.value.start_time || !newContest.value.end_time || !newContest.value.problem_ids.length) {
    contestMessage.value = '请填写比赛名称、起止时间并选择至少一道题'
    return
  }
  if (new Date(newContest.value.end_time) <= new Date(newContest.value.start_time)) {
    contestMessage.value = '结束时间必须晚于开始时间'
    return
  }
  publishingContest.value = true
  try {
    const res = await fetch(`${API_BASE_URL}/admin/contest`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify(newContest.value)
    })
    const data = await res.json()
    if (!res.ok || data.status !== 'success') throw new Error(data.message || '发布比赛失败')
    newContest.value = emptyContest()
    await fetchContests()
    activeTab.value = 'contests'
    contestMessage.value = '比赛发布成功'
  } catch (error) {
    contestMessage.value = error.message || '发布比赛失败'
  } finally {
    publishingContest.value = false
  }
}

const deleteContest = async (contest) => {
  if (!confirm(`确定删除比赛「${contest.title}」吗？`)) return
  try {
    const res = await fetch(`${API_BASE_URL}/admin/contest/${contest.id}`, {
      method: 'DELETE', headers: getHeaders()
    })
    const data = await res.json()
    if (!res.ok || data.status !== 'success') throw new Error(data.message || '删除比赛失败')
    await fetchContests()
    contestMessage.value = '比赛已删除'
  } catch (error) {
    contestMessage.value = error.message || '删除比赛失败'
  }
}

const formatContestDate = (value) => new Date(value).toLocaleString()
const fetchForumPosts = async () => {
  forumLoading.value = true
  forumError.value = ''
  try {
    const res = await fetch(`${API_BASE_URL}/admin/posts`, { headers: getHeaders(), cache: 'no-store' })
    const data = await res.json()
    if (!res.ok || data.status !== 'success') throw new Error(data.message || '获取帖子失败')
    forumPosts.value = data.data
    if (selectedPostId.value && !data.data.some(post => post.id === selectedPostId.value)) {
      selectedPostId.value = null
      forumComments.value = []
    }
  } catch (error) {
    forumError.value = error.message || '获取帖子失败'
  } finally {
    forumLoading.value = false
  }
}

const toggleForumComments = async (post) => {
  if (selectedPostId.value === post.id) {
    selectedPostId.value = null
    forumComments.value = []
    return
  }
  selectedPostId.value = post.id
  forumComments.value = []
  commentsLoading.value = true
  forumError.value = ''
  try {
    const res = await fetch(`${API_BASE_URL}/admin/posts/${post.id}/comments`, {
      headers: getHeaders(), cache: 'no-store'
    })
    const data = await res.json()
    if (!res.ok || data.status !== 'success') throw new Error(data.message || '获取评论失败')
    if (selectedPostId.value === post.id) forumComments.value = data.data
  } catch (error) {
    if (selectedPostId.value === post.id) forumError.value = error.message || '获取评论失败'
  } finally {
    if (selectedPostId.value === post.id) commentsLoading.value = false
  }
}

const removeForumPost = async (post) => {
  if (!confirm(`确定删除帖子「${post.title}」及其全部评论吗？`)) return
  forumBusy.value = true
  forumError.value = ''
  try {
    const res = await fetch(`${API_BASE_URL}/admin/posts/${post.id}`, {
      method: 'DELETE', headers: getHeaders()
    })
    const data = await res.json()
    if (!res.ok || data.status !== 'success') throw new Error(data.message || '删除帖子失败')
    forumPosts.value = forumPosts.value.filter(item => item.id !== post.id)
    if (selectedPostId.value === post.id) {
      selectedPostId.value = null
      forumComments.value = []
    }
    forumMessage.value = '帖子及其评论已删除'
  } catch (error) {
    forumError.value = error.message || '删除帖子失败'
  } finally {
    forumBusy.value = false
  }
}

const removeForumComment = async (comment) => {
  if (!confirm('确定删除这条评论吗？')) return
  forumBusy.value = true
  forumError.value = ''
  try {
    const res = await fetch(`${API_BASE_URL}/admin/comments/${comment.id}`, {
      method: 'DELETE', headers: getHeaders()
    })
    const data = await res.json()
    if (!res.ok || data.status !== 'success') throw new Error(data.message || '删除评论失败')
    forumComments.value = forumComments.value.filter(item => item.id !== comment.id)
    const post = forumPosts.value.find(item => item.id === comment.post_id)
    if (post) post.comment_count = Math.max(0, Number(post.comment_count) - 1)
    forumMessage.value = '评论已删除'
  } catch (error) {
    forumError.value = error.message || '删除评论失败'
  } finally {
    forumBusy.value = false
  }
}

const formatForumDate = (value) => new Date(value).toLocaleString()
</script>

<template>
  <div class="admin-container">
    <div class="header">
      <h1>👑 站长控制台</h1>
    </div>

    <div class="tabs">
      <div class="tab" :class="{ active: activeTab === 'manage' }" @click="activeTab = 'manage'">📚 题库管理</div>
      <div class="tab" :class="{ active: activeTab === 'publish' }" @click="activeTab = 'publish'">🚀 发布新题</div>
      <div class="tab" :class="{ active: activeTab === 'contests' }" @click="activeTab = 'contests'; fetchContests()">🏆 比赛管理</div>
      <div class="tab" :class="{ active: activeTab === 'publish-contest' }" @click="activeTab = 'publish-contest'">📅 发布比赛</div>
      <div class="tab" :class="{ active: activeTab === 'forum' }" @click="activeTab = 'forum'; fetchForumPosts()">💬 讨论区管理</div>
    </div>

    <div v-if="activeTab === 'manage'" class="manage-box">
      <table class="data-table">
        <thead>
          <tr>
            <th width="10%">ID</th>
            <th width="60%">题目名称</th>
            <th width="30%">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in problems" :key="p.id">
            <td class="pid">#{{ p.id }}</td>
            <td class="ptitle">{{ p.title }}</td>
            <td>
              <button class="action-btn edit" @click="openEdit(p.id)">编辑</button>
              <button class="action-btn delete" @click="deleteProblem(p.id, p.title)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="activeTab === 'publish'" class="form-box">
      <div class="form-group"><label>题目名称</label><input type="text" v-model="newProblem.title" /></div>
      <div class="form-group"><label>题目描述</label><textarea v-model="newProblem.description" rows="4"></textarea></div>
      <div v-for="(test, index) in newProblem.test_cases" :key="index" class="row-group">
        <div class="form-group half"><label>测试点 {{ index + 1 }} 输入</label><textarea v-model="test.input_data" rows="3"></textarea></div>
        <div class="form-group half"><label>预期输出</label><textarea v-model="test.output_data" rows="3"></textarea></div>
        <button type="button" :disabled="newProblem.test_cases.length === 1" @click="removeTestCase(newProblem, index)">删除</button>
      </div>
      <button type="button" @click="addTestCase(newProblem)">添加测试点</button>
      <div class="row-group">
        <div class="form-group half"><label>⏱️ 时间限制 (ms)</label><input type="number" v-model.number="newProblem.time_limit" /></div>
        <div class="form-group half"><label>💾 内存限制 (MB)</label><input type="number" v-model.number="newProblem.memory_limit" /></div>
      </div>
      <button class="publish-btn" @click="publishProblem">🚀 立即发布</button>
      <p class="msg">{{ message }}</p>
    </div>

    <div v-if="activeTab === 'contests'" class="manage-box">
      <p v-if="!contests.length" class="empty-note">暂无比赛。可以切换到「发布比赛」创建第一场。</p>
      <table v-else class="data-table">
        <thead><tr><th>比赛名称</th><th>开始时间</th><th>结束时间</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="contest in contests" :key="contest.id">
            <td class="ptitle">{{ contest.title }}</td>
            <td>{{ formatContestDate(contest.start_time) }}</td>
            <td>{{ formatContestDate(contest.end_time) }}</td>
            <td><button type="button" class="action-btn delete" @click="deleteContest(contest)">删除</button></td>
          </tr>
        </tbody>
      </table>
      <p class="msg" role="status">{{ contestMessage }}</p>
    </div>

    <form v-if="activeTab === 'publish-contest'" class="form-box" @submit.prevent="publishContest">
      <div class="form-group"><label for="contest-title">比赛名称</label><input id="contest-title" v-model.trim="newContest.title" type="text" maxlength="255" required /></div>
      <div class="row-group">
        <div class="form-group half"><label for="contest-start">开始时间</label><input id="contest-start" v-model="newContest.start_time" type="datetime-local" required /></div>
        <div class="form-group half"><label for="contest-end">结束时间</label><input id="contest-end" v-model="newContest.end_time" type="datetime-local" required /></div>
      </div>
      <fieldset class="contest-problems">
        <legend>选择赛题（至少一道）</legend>
        <label v-for="p in problems" :key="p.id" class="contest-problem-option">
          <input v-model="newContest.problem_ids" type="checkbox" :value="p.id" /> #{{ p.id }} {{ p.title }}
        </label>
        <p v-if="!problems.length" class="empty-note">题库暂无题目，请先发布题目。</p>
      </fieldset>
      <button type="submit" class="publish-btn" :disabled="publishingContest || !problems.length">{{ publishingContest ? '正在发布...' : '发布比赛' }}</button>
      <p class="msg" role="status">{{ contestMessage }}</p>
    </form>
    <section v-if="activeTab === 'forum'" class="manage-box forum-manage">
      <h2>讨论区管理</h2>
      <p v-if="forumError" class="forum-error" role="alert">{{ forumError }}</p>
      <p v-if="forumMessage" class="msg" role="status">{{ forumMessage }}</p>
      <p v-if="forumLoading" class="empty-note">正在加载帖子...</p>
      <p v-else-if="!forumPosts.length && !forumError" class="empty-note">暂无帖子</p>
      <article v-for="post in forumPosts" :key="post.id" class="forum-post">
        <div class="forum-post-head">
          <div>
            <h3>{{ post.title }}</h3>
            <p class="forum-meta">#{{ post.id }} · {{ post.username }} · {{ formatForumDate(post.created_at) }}</p>
          </div>
          <div class="forum-actions">
            <button type="button" class="action-btn edit" @click="toggleForumComments(post)">{{ selectedPostId === post.id ? '收起评论' : `查看评论 (${post.comment_count})` }}</button>
            <button type="button" class="action-btn delete" :disabled="forumBusy" @click="removeForumPost(post)">删除帖子</button>
          </div>
        </div>
        <p class="forum-content">{{ post.content }}</p>
        <div v-if="selectedPostId === post.id" class="forum-comments">
          <p v-if="commentsLoading" class="empty-note">正在加载评论...</p>
          <p v-else-if="!forumComments.length" class="empty-note">暂无评论</p>
          <div v-for="comment in forumComments" :key="comment.id" class="forum-comment">
            <div>
              <p class="forum-meta">{{ comment.username }} · {{ formatForumDate(comment.created_at) }}</p>
              <p class="forum-content">{{ comment.content }}</p>
            </div>
            <button type="button" class="action-btn delete" :disabled="forumBusy" @click="removeForumComment(comment)">删除评论</button>
          </div>
        </div>
      </article>
    </section>
    <div class="modal-overlay" v-if="showEditModal">
      <div class="modal-content">
        <h2>✏️ 编辑题目 - #{{ editForm.id }}</h2>
        <div class="form-group"><label>题目名称</label><input type="text" v-model="editForm.title" /></div>
        <div class="form-group"><label>题目描述</label><textarea v-model="editForm.description" rows="4"></textarea></div>
        <div v-for="(test, index) in editForm.test_cases" :key="test.id || index" class="row-group">
          <div class="form-group half"><label>测试点 {{ index + 1 }} 输入</label><textarea v-model="test.input_data" rows="2"></textarea></div>
          <div class="form-group half"><label>预期输出</label><textarea v-model="test.output_data" rows="2"></textarea></div>
          <button type="button" :disabled="editForm.test_cases.length === 1" @click="removeTestCase(editForm, index)">删除</button>
        </div>
        <button type="button" @click="addTestCase(editForm)">添加测试点</button>
        <div class="row-group">
          <div class="form-group half"><label>时间 (ms)</label><input type="number" v-model.number="editForm.time_limit" /></div>
          <div class="form-group half"><label>内存 (MB)</label><input type="number" v-model.number="editForm.memory_limit" /></div>
        </div>
        <div class="modal-actions">
          <button class="btn-cancel" @click="showEditModal = false">取消</button>
          <button class="btn-save" @click="saveEdit">💾 保存修改</button>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.admin-container { max-width: 900px; margin: 40px auto; padding: 20px; }
.header { text-align: center; margin-bottom: 20px; }
h1 { color: #ff9800; margin: 0; }

/* Tabs 样式 */
.tabs { display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
.tab { padding: 10px 20px; color: #888; font-weight: bold; cursor: pointer; border-radius: 6px; transition: all 0.2s; }
.tab:hover { background: rgba(255, 255, 255, 0.05); }
.tab.active { color: #121212; background: #ff9800; }

/* 表格与表单基础 */
.manage-box, .form-box { background: #1e1e1e; padding: 30px; border-radius: 12px; border: 1px solid #333; }
.data-table { width: 100%; border-collapse: collapse; text-align: left; }
.data-table th, .data-table td { padding: 15px; border-bottom: 1px solid #333; color: #ccc; }
.data-table th { background: #252526; color: #ff9800; }
.data-table tr:hover { background: #2a2a2a; }
.pid { color: #888; font-weight: bold; }
.ptitle { color: #fff; font-size: 16px; font-weight: bold; }

/* 按钮样式 */
.action-btn { padding: 6px 12px; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; margin-right: 10px; transition: 0.2s; }
.action-btn.edit { background: rgba(33, 150, 243, 0.2); color: #64b5f6; border: 1px solid #2196F3; }
.action-btn.edit:hover { background: #2196F3; color: white; }
.action-btn.delete { background: rgba(244, 67, 54, 0.2); color: #e57373; border: 1px solid #f44336; }
.action-btn.delete:hover { background: #f44336; color: white; }

.form-group { margin-bottom: 15px; display: flex; flex-direction: column; }
.row-group { display: flex; gap: 20px; }
.half { flex: 1; }
label { color: #ccc; font-weight: bold; margin-bottom: 6px; font-size: 13px; }
input, textarea { background: #121212; border: 1px solid #444; color: #fff; padding: 10px; border-radius: 6px; font-family: monospace; resize: vertical; }
input:focus, textarea:focus { outline: none; border-color: #ff9800; }
.publish-btn { width: 100%; padding: 14px; background: #ff9800; color: #121212; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 16px; margin-top: 10px; }
.msg { text-align: center; color: #4CAF50; font-weight: bold; margin-top: 10px; }

/* 🌟 弹窗 (Modal) 的魔法样式 */
.modal-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(5px); display: flex; justify-content: center; align-items: center; z-index: 999; }
.modal-content { background: #1e1e1e; padding: 30px; border-radius: 12px; width: 600px; max-width: 90%; border: 1px solid #ff9800; box-shadow: 0 10px 40px rgba(0,0,0,0.5); }
.modal-content h2 { margin-top: 0; color: #fff; border-bottom: 1px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 15px; margin-top: 20px; }
.btn-cancel { background: transparent; border: 1px solid #555; color: #ccc; padding: 10px 20px; border-radius: 6px; cursor: pointer; }
.btn-cancel:hover { background: #333; }
.btn-save { background: #4CAF50; border: none; color: white; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; }
.btn-save:hover { background: #45a049; }
.empty-note { color: #aaa; }
.contest-problems { border: 1px solid #444; border-radius: 6px; margin: 0 0 15px; padding: 15px; }
.contest-problems legend { color: #ccc; font-weight: bold; }
.contest-problem-option { display: block; margin: 8px 0; cursor: pointer; }
.contest-problem-option input { margin-right: 8px; }
.publish-btn:disabled { opacity: 0.55; cursor: not-allowed; }.tabs { flex-wrap: wrap; }
.forum-manage h2 { margin-top: 0; color: #fff; }
.forum-error { color: #e57373; }
.forum-post { border: 1px solid #444; border-radius: 8px; padding: 18px; margin-top: 16px; }
.forum-post-head, .forum-comment { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
.forum-post h3 { color: #fff; margin: 0 0 6px; }
.forum-meta { color: #999; font-size: 13px; margin: 4px 0; }
.forum-content { color: #ddd; white-space: pre-wrap; overflow-wrap: anywhere; max-height: 180px; overflow: auto; }
.forum-actions { display: flex; flex-shrink: 0; }
.forum-comments { margin-top: 16px; padding-left: 18px; border-left: 2px solid #555; }
.forum-comment { border-top: 1px solid #444; padding: 12px 0; }
.action-btn:disabled { opacity: .5; cursor: not-allowed; }</style>



