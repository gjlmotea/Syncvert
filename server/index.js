const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const { Server } = require('socket.io');
const path = require('path');

const app = express();

// ======== SSL 模式（僅正式環境才需要） ========
const sslOptions = {
    key: fs.readFileSync('C:/Certbot/live/gjlmotea.com/privkey.pem'),
    cert: fs.readFileSync('C:/Certbot/live/gjlmotea.com/fullchain.pem'),
};
const server = https.createServer(sslOptions, app);
// ==============================================

// ======== 開發／預設使用 HTTP Server ========
// const server = http.createServer(app);
// ============================================

// Socket.IO 初始化（跨域設定）
const io = new Server(server, {
    cors: {
        origin: '*', // ⚠️ 開發測試用，正式環境請指定白名單
        methods: ['GET', 'POST'],
    },
});

// ======== 正式環境才需要加入這段 ========
const buildPath = path.join(__dirname, '../client/dist');
app.use(express.static(buildPath));

app.get(/^\/(?!api)(?!.*:\/\/).*$/, (req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
});
// =====================================

// 🧠 全局狀態記憶（以記憶體暫存，目前僅支援單一房間共享）
let currentState = {
    curl: '',
    title: '',
    episode: '',
};

// 用戶連線時
io.on('connection', (socket) => {
    console.log('⚡ 有用戶連線：', socket.id);

    // 發送初始狀態給新連線的用戶
    socket.emit('init_state', currentState);

    // 處理 curl 更新事件
    socket.on('curl_update', (data) => {
        currentState.curl = data;
        // 廣播給其他人（不含自己）
        socket.broadcast.emit('curl_update', data);
    });

    // 處理標題與集數更新
    socket.on('meta_update', (data) => {
        if (typeof data.title === 'string') currentState.title = data.title;
        if (typeof data.episode === 'string') currentState.episode = data.episode;
        // 廣播給其他人（不含自己）
        socket.broadcast.emit('meta_update', data);
    });

    socket.on('disconnect', () => {
        console.log('❌ 用戶斷線：', socket.id);
    });
});

// 啟動 HTTP Server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
