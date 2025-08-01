import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            '/socket.io': {
                target: 'http://gjlmotea.com:3001',
                ws: true,
                changeOrigin: true,
            },
        },
    },
});
