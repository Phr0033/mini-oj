# Mini OJ

一个前后端分离的在线判题项目。用户可以浏览题目、提交 C++ 代码、查看评测记录和排行榜；管理员可以维护题目、测试点、比赛以及讨论区内容。技术栈为 Vue 3、Express、PostgreSQL、Redis、BullMQ 和 Docker。

## 核心功能

- **异步判题**：API 保存提交后返回提交 ID；BullMQ 将任务交给独立 Worker。Worker 编译一次，再分别运行每个测试点，并将结果写回 PostgreSQL。前端轮询查看排队、运行和最终结果。
- **执行限制**：评测容器禁用网络，限制 CPU、内存、进程数和输出；使用非 root 用户，移除 Linux capabilities，并限制容器文件系统写入范围。
- **记录与排行**：AC 题数按题目去重；通过率为已通过题数除以已完成评测的已尝试题数。排队、运行和评测服务错误不计入尝试题数。
- **后台管理**：管理员可发布和编辑题目及测试点，发布和删除比赛，删除讨论区帖子与评论。关键关联写入与删除使用数据库事务。
- **讨论区**：支持 Markdown 帖子与评论；渲染前清理不安全的 HTML。

## 目录结构

- `frontend/`：Vue 前端。
- `backend/`：Express API、判题 Worker 和集成测试。
- `backend/routes/admin/`：按题目、比赛、讨论区拆分的管理员接口。
- `backend/db/`：建表脚本和演示数据。

## 本地运行

需要 Node.js 20.19+、PostgreSQL 和 Docker Desktop 或 Docker Engine。Docker 用于 Redis 和判题容器。判题镜像默认为 `gcc:latest`。

### 1. 准备数据库

在空 PostgreSQL 数据库 `mini_oj` 中运行：

~~~bash
psql -d mini_oj -f backend/db/schema.sql
psql -d mini_oj -f backend/db/seeds/demo_seed.sql
~~~

### 2. 启动 Redis 并拉取判题镜像

在项目根目录运行：

~~~bash
docker compose up -d redis
docker pull gcc:latest
~~~

Compose 将 Redis 仅绑定在本机 `127.0.0.1:6379`，并启用 AOF 持久化。

### 3. 启动 API 与 Worker

复制 `backend/.env.example` 为 `backend/.env`，填写数据库连接和至少 32 字符的随机 `JWT_SECRET`。Redis 默认连接本机 6379 端口；可通过 `JUDGE_CONCURRENCY` 设置单个 Worker 的并发任务数，程序将其限制在 1–4。

在 `backend` 目录安装依赖后，分别打开两个终端运行：

~~~bash
npm ci
npm start
~~~

~~~bash
npm run worker
~~~

API 默认监听 `http://localhost:3000`。Worker 停止时新提交保持 `Pending`；Worker 恢复后会检查并补入未完成任务。首次使用可通过页面注册普通账号，再由数据库管理员授予管理权限：

~~~sql
UPDATE users SET is_admin = TRUE WHERE username = 'your_username';
~~~

### 4. 启动前端

在 `frontend` 目录运行：

~~~bash
npm ci
npm run dev
~~~

前端默认请求本机 3000 端口；部署到其他机器时，按 `frontend/.env.example` 设置 `VITE_API_BASE_URL` 后运行 `npm run build`。

## 主要接口

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| POST | `/register`、`/login` | 注册与登录 |
| GET | `/problems`、`/problem/:id` | 题目列表与详情 |
| POST | `/submit` | 创建提交并返回提交 ID，HTTP 202 |
| GET | `/submission/:id` | 登录用户查询自己的评测状态与结果 |
| GET | `/status`、`/leaderboard`、`/user/status` | 提交动态、排行榜与个人做题状态 |
| GET/POST/PUT/DELETE | `/admin/problem` 相关路径 | 管理员维护题目与测试点 |
| GET | `/list`、`/:id/problems` | 比赛列表与赛题 |
| POST/DELETE | `/admin/contest`、`/admin/contest/:id` | 管理员发布或删除比赛 |
| GET/POST | `/posts`、`/posts/:id`、`/posts/:id/comments` | 讨论区内容 |
| GET/DELETE | `/admin/posts`、`/admin/posts/:id/comments`、`/admin/comments/:id` | 管理员查看与删除帖子、评论 |

## 自动化测试

启动 PostgreSQL、Redis 和 Docker 后，在 `backend` 运行 `npm test`。测试会创建独立的临时数据库和 Redis 队列，启动测试专用 API 与 Worker，验证排行榜去重、管理员权限，以及真实 Docker 判题的 AC、编译错误和超时结果。结束时会删除测试数据库和队列，不使用当前业务数据。

`.github/workflows/ci.yml` 在推送与拉取请求时启动 PostgreSQL、Redis，安装依赖、构建前端并运行同一组后端测试。
## 数据模型与边界

主要表为 `users`、`problems`、`test_cases`、`submissions`、`posts`、`comments`、`contests` 和 `contest_problems`。结构见 `backend/db/schema.sql`。BullMQ 任务只保存提交 ID，代码和判题结果保存在 PostgreSQL；Worker 重试时只会更新尚未完成的提交。

这是单机演示项目。判题 Worker 持有 Docker 调用权限；若对公网开放，应将 Worker 部署到独立主机或虚拟机，并补充限流、监控和容器安全审查。

