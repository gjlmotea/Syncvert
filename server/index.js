const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*', // 若有安全需求請設定為指定網址
        methods: ['GET', 'POST']
    }
});

io.on('connection', (socket) => {
    console.log('⚡ 有用戶連線');

    socket.on('curl_update', (data) => {
        // 廣播給除了發送者以外的所有人
        socket.broadcast.emit('curl_update', data);
    });

    socket.on('disconnect', () => {
        console.log('❌ 用戶斷線');
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
