require('./config/env');
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());
app.use(cors());

const userRoutes = require('./routes/user');
const problemRoutes = require('./routes/problem');
const submitRoutes = require('./routes/submit');
const recordsRoutes = require('./routes/records');
const adminRoutes = require('./routes/admin');
const forumRoutes = require('./routes/forum');
const contestRouter = require('./routes/contest'); // 👈 1. 引入竞赛路由

app.use('/', userRoutes);
app.use('/', problemRoutes);
app.use('/', submitRoutes);
app.use('/', recordsRoutes);
app.use('/', adminRoutes);
app.use('/', forumRoutes);
app.use('/', contestRouter); // 👈 2. 挂载竞赛路由，通电成功！

app.listen(PORT, () => {
    console.log(`Mini OJ 后端已启动，正在监听 http://localhost:${PORT}`);
});