<script setup>
import { API_BASE_URL } from '../api'
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const pwdInput = ref(null)

const router = useRouter()
const isLoginMode = ref(true) // true 为登录模式，false 为注册模式
const username = ref('')
const password = ref('')
const message = ref('')

const handleSubmit = async () => {
  message.value = '处理中...'
  const endpoint = isLoginMode.value ? '/login' : '/register'
  
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.value, password: password.value })
    })
    
    const data = await response.json()
    message.value = data.message

    if (data.status === 'success') {
      if (isLoginMode.value) {
        // 🚨 核心魔法：把后端发来的通行证(Token)和用户名存到浏览器本地！
        localStorage.setItem('oj_token', data.token)
        localStorage.setItem('oj_username', data.username)
        localStorage.setItem('oj_is_admin', String(data.isAdmin === true))
        // 登录成功，0.5秒后跳转到首页
        setTimeout(() => router.push('/'), 500)
      } else {
        // 注册成功，自动切换到登录模式让你登录
        setTimeout(() => {
          isLoginMode.value = true
          password.value = ''
          message.value = ''
        }, 1000)
      }
    }
  } catch (error) {
    message.value = '网络请求失败，请检查后端是否启动'
  }
}
</script>

<template>
  <div class="login-container">
    <div class="auth-box">
      <h2>{{ isLoginMode ? '👋 欢迎回到 Mini OJ' : '🚀 注册新账号' }}</h2>
      
      <div class="input-group">
        <input type="text" v-model="username" @keyup.enter="pwdInput?.focus()" placeholder="请输入用户名" />
        <input ref="pwdInput" type="password" v-model="password" @keyup.enter="handleSubmit" placeholder="请输入密码" />
      </div>

      <button class="submit-btn" @click="handleSubmit">
        {{ isLoginMode ? '登 录' : '注 册' }}
      </button>

      <p class="msg" :class="{'error': message.includes('错误') || message.includes('失败')}">{{ message }}</p>

      <div class="toggle-link" @click="isLoginMode = !isLoginMode; message = ''">
        {{ isLoginMode ? '没有账号？点击注册 ➔' : '已有账号？返回登录 ➔' }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-container { display: flex; justify-content: center; align-items: center; height: 80vh; }
.auth-box { background: #1e1e1e; padding: 40px; border-radius: 12px; width: 350px; box-shadow: 0 8px 24px rgba(0,0,0,0.5); text-align: center; border: 1px solid #333; }
h2 { color: #fff; margin-bottom: 30px; font-size: 22px; }
.input-group input { width: 100%; box-sizing: border-box; padding: 12px 15px; margin-bottom: 20px; background: #121212; border: 1px solid #444; color: #fff; border-radius: 6px; font-size: 16px; outline: none; transition: border 0.3s; }
.input-group input:focus { border-color: #4CAF50; }
.submit-btn { width: 100%; padding: 12px; background: #4CAF50; color: white; border: none; border-radius: 6px; font-size: 16px; font-weight: bold; cursor: pointer; transition: background 0.2s; }
.submit-btn:hover { background: #45a049; }
.msg { margin-top: 15px; min-height: 20px; font-size: 14px; color: #4CAF50; }
.msg.error { color: #f44336; }
.toggle-link { margin-top: 20px; font-size: 14px; color: #888; cursor: pointer; transition: color 0.2s; }
.toggle-link:hover { color: #ccc; }
</style>