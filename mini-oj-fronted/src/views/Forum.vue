<script setup>
import { API_BASE_URL } from '../api'
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const posts = ref([])
const showNewPostForm = ref(false)
const newPost = ref({ title: '', content: '' })

// 1. 获取帖子列表
const fetchPosts = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/posts`)
    const data = await res.json()
    if (data.status === 'success') {
      posts.value = data.data
    }
  } catch (error) {
    console.error('获取帖子失败')
  }
}

onMounted(() => {
  fetchPosts()
})

// 2. 发布新帖
const publishPost = async () => {
  if (!newPost.value.title || !newPost.value.content) {
    alert('标题和内容不能为空！')
    return
  }
  
  try {
    const res = await fetch(`${API_BASE_URL}/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('oj_token')}`
      },
      body: JSON.stringify(newPost.value)
    })
    const data = await res.json()
    if (data.status === 'success') {
      alert('发布成功！')
      newPost.value = { title: '', content: '' }
      showNewPostForm.value = false
      fetchPosts() // 刷新列表
    } else {
      alert(data.message)
    }
  } catch (error) {
    alert('发帖失败，请先登录！')
  }
}

// 时间格式化小工具
const formatDate = (dateStr) => {
  return new Date(dateStr).toLocaleString()
}
</script>

<template>
  <div class="forum-container">
    <div class="header">
      <h1>💬 讨论区</h1>
      <button class="btn-new" @click="showNewPostForm = !showNewPostForm">
        {{ showNewPostForm ? '取消发帖' : '✍️ 发起新讨论' }}
      </button>
    </div>

    <div class="new-post-box" v-if="showNewPostForm">
      <input type="text" v-model="newPost.title" placeholder="输入一针见血的标题..." class="title-input" />
      <textarea v-model="newPost.content" placeholder="支持 Markdown 语法，畅所欲言..." rows="6" class="content-input"></textarea>
      <button class="btn-submit" @click="publishPost">🚀 立即发布</button>
    </div>

    <div class="post-list">
      <div class="post-item" v-for="post in posts" :key="post.id" @click="router.push(`/post/${post.id}`)">
        <div class="post-main">
          <h3 class="post-title">{{ post.title }}</h3>
          <div class="post-meta">
            <span>👤 {{ post.username || '匿名用户' }}</span>
            <span>🕒 {{ formatDate(post.created_at) }}</span>
          </div>
        </div>
        <div class="post-stats">
          <span>👁️ {{ post.view_count }}</span>
        </div>
      </div>
      <div v-if="posts.length === 0" class="empty-tip">暂无讨论，快来抢沙发！</div>
    </div>
  </div>
</template>

<style scoped>
.forum-container { max-width: 900px; margin: 30px auto; padding: 20px; }
.header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px; }
h1 { color: #fff; margin: 0; }
.btn-new { background: #4CAF50; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-weight: bold; cursor: pointer; }
.btn-new:hover { background: #45a049; }

.new-post-box { background: #1e1e1e; padding: 20px; border-radius: 8px; margin-bottom: 25px; border: 1px solid #333; }
.title-input { width: 100%; box-sizing: border-box; background: #121212; border: 1px solid #444; color: #fff; padding: 12px; border-radius: 6px; font-size: 16px; margin-bottom: 15px; }
.content-input { width: 100%; box-sizing: border-box; background: #121212; border: 1px solid #444; color: #fff; padding: 12px; border-radius: 6px; font-family: monospace; resize: vertical; }
.btn-submit { margin-top: 15px; background: #2196F3; color: white; border: none; padding: 10px 25px; border-radius: 6px; font-weight: bold; cursor: pointer; float: right; }

.post-list { display: flex; flex-direction: column; gap: 15px; }
.post-item { background: #1e1e1e; border: 1px solid #333; border-radius: 8px; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: 0.2s; }
.post-item:hover { background: #252526; border-color: #4CAF50; transform: translateY(-2px); }
.post-title { color: #fff; margin: 0 0 10px 0; font-size: 18px; }
.post-meta { font-size: 13px; color: #888; display: flex; gap: 15px; }
.post-stats { font-size: 14px; color: #aaa; background: #121212; padding: 5px 10px; border-radius: 12px; }
.empty-tip { text-align: center; color: #888; margin-top: 50px; font-size: 16px; }
</style>