<script setup>
import { API_BASE_URL } from '../api'
import { ref, watch, computed } from 'vue'
import { useRoute } from 'vue-router'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

const route = useRoute()
const postId = computed(() => route.params.id)

const post = ref({})
const comments = ref([])
const newComment = ref('')

// 把帖子的 Markdown 转成漂亮的 HTML
const parsedContent = computed(() => {
  return post.value.content ? DOMPurify.sanitize(marked.parse(post.value.content)) : ''
})

// 1. 获取帖子详情和评论
const fetchPostDetail = async (id) => {
  try {
    const res = await fetch(`${API_BASE_URL}/posts/${id}`)
    const data = await res.json()
    if (data.status === 'success' && String(route.params.id) === String(id)) {
      post.value = data.data.post
      comments.value = data.data.comments
    }
  } catch (error) {
    console.error('获取详情失败')
  }
}

watch(() => route.params.id, (id) => {
  post.value = {}
  comments.value = []
  fetchPostDetail(id)
}, { immediate: true })

// 2. 提交评论
const submitComment = async () => {
  if (!newComment.value) return alert('总得写点什么吧！')
  const idAtSubmit = postId.value

  try {
    const res = await fetch(`${API_BASE_URL}/posts/${idAtSubmit}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('oj_token')}`
      },
      body: JSON.stringify({ content: newComment.value })
    })
    const data = await res.json()
    if (data.status === 'success') {
      newComment.value = ''
      if (String(route.params.id) === String(idAtSubmit)) comments.value.push(data.data)
    } else {
      alert(data.message)
    }
  } catch (error) {
    alert('评论失败，请先登录！')
  }
}

const formatDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleString() : ''
</script>

<template>
  <div class="detail-container">
    <div class="post-header">
      <h1>{{ post.title }}</h1>
      <div class="meta">
        <span>👤 作者：{{ post.username || '匿名用户' }}</span>
        <span>🕒 时间：{{ formatDate(post.created_at) }}</span>
        <span>👁️ 阅读：{{ post.view_count }}</span>
      </div>
    </div>
    <div class="post-content markdown-body" v-html="parsedContent"></div>

    <hr class="divider" />

    <div class="comment-section">
      <h3>💬 评论 ({{ comments.length }})</h3>
      
      <div class="comment-input-box">
        <textarea v-model="newComment" placeholder="写下你的神评..." rows="3"></textarea>
        <button class="btn-reply" @click="submitComment">发送回复</button>
      </div>

      <div class="comment-list">
        <div class="comment-item" v-for="(comment, index) in comments" :key="comment.id">
          <div class="comment-avatar">{{ comment.username ? comment.username.charAt(0).toUpperCase() : '?' }}</div>
          <div class="comment-body">
            <div class="comment-meta">
              <span class="user">{{ comment.username || '匿名用户' }}</span>
              <span class="floor">#{{ index + 1 }} 楼</span>
              <span class="time">{{ formatDate(comment.created_at) }}</span>
            </div>
            <div class="comment-text">{{ comment.content }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.detail-container { max-width: 900px; margin: 30px auto; padding: 20px; }
.post-header { margin-bottom: 30px; border-bottom: 1px solid #333; padding-bottom: 20px; }
h1 { color: #fff; margin-bottom: 15px; }
.meta { font-size: 14px; color: #888; display: flex; gap: 20px; }
.post-content { background: #1e1e1e; padding: 30px; border-radius: 8px; margin-bottom: 40px; }
.divider { border: 0; height: 1px; background: #333; margin: 40px 0; }

.comment-section h3 { color: #fff; margin-bottom: 20px; }
.comment-input-box { background: #1e1e1e; padding: 15px; border-radius: 8px; margin-bottom: 30px; }
.comment-input-box textarea { width: 100%; box-sizing: border-box; background: #121212; border: 1px solid #444; color: #fff; padding: 10px; border-radius: 6px; resize: vertical; margin-bottom: 10px; }
.btn-reply { background: #4CAF50; color: white; border: none; padding: 8px 20px; border-radius: 4px; font-weight: bold; cursor: pointer; float: right; }

.comment-list { display: flex; flex-direction: column; gap: 15px; }
.comment-item { display: flex; gap: 15px; background: #1e1e1e; padding: 15px; border-radius: 8px; }
.comment-avatar { width: 40px; height: 40px; background: #ff9800; color: #121212; font-weight: bold; font-size: 20px; display: flex; justify-content: center; align-items: center; border-radius: 50%; flex-shrink: 0; }
.comment-body { flex: 1; }
.comment-meta { margin-bottom: 8px; font-size: 13px; color: #888; }
.comment-meta .user { color: #64b5f6; font-weight: bold; margin-right: 15px; }
.comment-meta .floor { background: #333; padding: 2px 6px; border-radius: 4px; margin-right: 10px; }
.comment-text { color: #ccc; line-height: 1.5; white-space: pre-wrap; }

/* 复用 Markdown 样式，保证正文渲染好看 */
.markdown-body :deep(h1), .markdown-body :deep(h2), .markdown-body :deep(h3) { color: #fff; border-bottom: 1px solid #333; padding-bottom: 0.3em; margin-bottom: 16px; }
.markdown-body :deep(pre) { background-color: #121212; padding: 16px; border-radius: 8px; overflow-x: auto; border: 1px solid #333; }
.markdown-body :deep(code) { color: #ff9800; background-color: rgba(255,255,255,0.1); padding: 2px 4px; border-radius: 4px; }
</style>