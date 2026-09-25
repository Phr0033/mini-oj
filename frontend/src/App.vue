<script setup>
import { ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { API_BASE_URL } from './api'

const router = useRouter()
const route = useRoute()
const username = ref('')
const isAdmin = ref(false)

const clearSession = () => {
  localStorage.removeItem('oj_token')
  localStorage.removeItem('oj_username')
  localStorage.removeItem('oj_is_admin')
  username.value = ''
  isAdmin.value = false
}

const refreshSession = async () => {
  const token = localStorage.getItem('oj_token')
  username.value = localStorage.getItem('oj_username') || ''
  isAdmin.value = false
  if (!token || route.path === '/login') return

  try {
    const response = await fetch(`${API_BASE_URL}/user/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store'
    })
    if (localStorage.getItem('oj_token') !== token) return
    if (response.status === 401 || response.status === 403) {
      clearSession()
      router.replace('/login')
      return
    }
    if (!response.ok) return
    const result = await response.json()
    if (result.status !== 'success') return
    username.value = result.data.username
    isAdmin.value = result.data.isAdmin === true
    localStorage.setItem('oj_username', username.value)
    localStorage.setItem('oj_is_admin', String(isAdmin.value))
  } catch (error) {
    console.error('获取当前用户权限失败:', error)
  }
}

watch(() => route.path, refreshSession, { immediate: true })

const logout = () => {
  clearSession()
  router.push('/login')
}
</script>

<template>
  <div id="app">
    
    <nav class="navbar" v-if="route.path !== '/login'">
      <div class="nav-content">
        
        <div class="nav-left">
          <router-link to="/" class="logo">🚀 Mini OJ</router-link>
          
          <div class="nav-links">
            <router-link to="/" class="nav-item">题库</router-link>
            <router-link to="/status" class="nav-item">状态</router-link>
            <router-link to="/leaderboard" class="nav-item">排行榜</router-link>
            <router-link to="/forum" class="nav-item">💬 讨论区</router-link>
            <router-link to="/contests" class="nav-item">🏆 竞赛/作业</router-link>
            <router-link v-if="isAdmin" to="/admin" class="nav-item secret">后台管理</router-link>
          </div>
        </div>
        
        <div class="user-info" v-if="username">
          <span class="user-name">👤 {{ username }}</span>
          <button class="logout-btn" @click="logout">退出</button>
        </div>

      </div>
    </nav>
    
    <router-view></router-view>
  </div>
</template>

<style>
/* ================= 全局基础样式 ================= */
body { margin: 0; padding: 0; background-color: #121212; color: #e0e0e0; font-family: 'Segoe UI', Tahoma, sans-serif; }
#app { min-height: 100vh; display: flex; flex-direction: column; }

/* ================= 导航栏外层 ================= */
.navbar { background-color: #1e1e1e; padding: 0 30px; border-bottom: 1px solid #333; box-shadow: 0 2px 10px rgba(0,0,0,0.3); }

/* ================= 导航栏内层 Flex 布局 ================= */
.nav-content { display: flex; justify-content: space-between; align-items: center; max-width: 1000px; margin: 0 auto; height: 60px; }

/* 左侧容器：让 Logo 和菜单横向排列并拉开间距 */
.nav-left { display: flex; align-items: center; gap: 40px; }
.logo { color: #4CAF50; text-decoration: none; font-size: 22px; font-weight: 800; letter-spacing: 1px; }

/* 菜单链接容器 */
.nav-links { display: flex; gap: 25px; align-items: center; } /* 顺手加个居中对齐，保证暗金边框和普通字对齐 */

/* 单个菜单按钮样式 */
.nav-item { color: #aaa; text-decoration: none; font-size: 16px; font-weight: bold; transition: all 0.2s; padding: 5px 0; border-bottom: 2px solid transparent; }
.nav-item:hover { color: #ddd; }

/* Vue Router 自带的魔法类名：当前所在页面的菜单会高亮变绿 */
.nav-item.router-link-exact-active { color: #4CAF50; border-bottom: 2px solid #4CAF50; }

/* 右侧用户信息 */
.user-info { display: flex; align-items: center; gap: 20px; }
.user-name { font-weight: 600; color: #ccc; }
.logout-btn { background: transparent; border: 1px solid #555; color: #aaa; padding: 5px 15px; border-radius: 4px; cursor: pointer; transition: all 0.2s; }
.logout-btn:hover { border-color: #f44336; color: #f44336; background-color: rgba(244, 67, 54, 0.1); }

/* ================= 👑 站长专属隐藏通道样式 ================= */
.nav-item.secret {
  color: #ffb74d; /* 尊贵的暗金色 */
  border: 1px dashed #ffb74d; /* 虚线边框增加神秘感 */
  padding: 4px 12px; 
  border-radius: 6px;
  margin-left: 10px; /* 和前面的普通菜单拉开一点距离 */
  font-size: 14px;
}

/* 鼠标悬停时的发光特效 */
.nav-item.secret:hover {
  color: #fff;
  background-color: rgba(255, 152, 0, 0.15);
  border-color: #ff9800;
  border-style: solid; /* 悬停时变成实线 */
  box-shadow: 0 0 10px rgba(255, 152, 0, 0.3); /* 微微的橙色呼吸光 */
  transform: translateY(-1px); /* 轻微浮起 */
}

/* 站长正在后台页面时的激活高亮状态 */
.nav-item.secret.router-link-exact-active {
  color: #121212;
  background-color: #ff9800;
  border: 1px solid #ff9800;
  box-shadow: 0 0 12px rgba(255, 152, 0, 0.4);
}
</style>