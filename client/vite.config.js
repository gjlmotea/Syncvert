import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            '/socket.io': {
                target: 'http://gjlmotea.com:3001',
                ws: true,              // ✅ 開啟 WebSocket 支援
                changeOrigin: true,    // ✅ 一般也會加這行
            },
        },
    },
});
