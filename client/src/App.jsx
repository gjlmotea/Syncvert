import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

// socket 設定檔自動讀取
const socket = io(import.meta.env.VITE_SOCKET_HOST, {
    auth: { token: 'demo' },
});

console.log(`Socket連線到：${import.meta.env.VITE_SOCKET_HOST}`);

// 解析 curl 中資訊
function extractInfoFromCurl(curl) {
    const urlMatch = curl.match(/curl '([^']+)'/);
    const refererMatch = curl.match(/-H 'Referer: ([^']+)'/);
    const uaMatch = curl.match(/-H 'User-Agent: ([^']+)'/);
    const cookieMatch = curl.match(/-b '([^']+)'/);

    const headers = {};
    const headerMatches = [...curl.matchAll(/-H '([^:]+): ([^']+)'/g)];
    headerMatches.forEach(([, key, value]) => {
        headers[key] = value;
    });

    return {
        url: urlMatch?.[1] || '',
        referer: refererMatch?.[1] || '',
        userAgent: uaMatch?.[1] || '',
        cookies: cookieMatch?.[1] || '',
        headers,
    };
}

// 組成 yt-dlp 指令
function convertToYtDlp(info, title, episode) {
    const base = ['yt-dlp'];

    const unifiedHeaders = {
        ...(info.referer ? { Referer: info.referer } : {}),
        ...(info.userAgent ? { 'User-Agent': info.userAgent } : {}),
        ...(info.cookies ? { Cookie: info.cookies } : {}),
        ...info.headers,
    };

    for (const [key, value] of Object.entries(unifiedHeaders)) {
        const escapedValue = value.replace(/"/g, '\\"');
        base.push(`--add-header "${key}: ${escapedValue}"`);
    }

    if (info.url) base.push(`"${info.url}"`);

    const safeTitle = title.replace(/[\\/:*?"<>|]/g, '_');
    const safeEpisode = episode.replace(/[\\/:*?"<>|]/g, '_');
    base.push(`-o "${safeTitle}${safeEpisode ? safeEpisode : ''}.mp4"`);

    return base.join(' \\\n  ');
}

export default function YtDlpSyncTool() {
    const [curlText, setCurlText] = useState('');
    const [title, setTitle] = useState('');
    const [episode, setEpisode] = useState('');
    const [ytDlpCommand, setYtDlpCommand] = useState('');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        socket.on('init_state', (data) => {
            setCurlText(data.curl || '');
            setTitle(data.title || '');
            setEpisode(data.episode || '');
        });

        socket.on('curl_update', (newCurl) => {
            setCurlText(newCurl);
        });

        socket.on('meta_update', (data) => {
            if (data.title !== undefined) setTitle(data.title);
            if (data.episode !== undefined) setEpisode(data.episode);
        });

        return () => {
            socket.off('init_state');
            socket.off('curl_update');
            socket.off('meta_update');
        };
    }, []);

    useEffect(() => {
        const info = extractInfoFromCurl(curlText);
        const ytdlp = convertToYtDlp(info, title, episode);
        setYtDlpCommand(ytdlp);
    }, [curlText, title, episode]);

    const updateCurl = (val) => {
        setCurlText(val);
        socket.emit('curl_update', val);
    };

    const updateMeta = (key, val) => {
        const payload = {
            title: key === 'title' ? val : title,
            episode: key === 'episode' ? val : episode,
        };

        if (key === 'title') setTitle(val);
        if (key === 'episode') setEpisode(val);

        socket.emit('meta_update', payload);
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(ytDlpCommand).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 750); // ✅ 自動清除 tooltip
        });
    };

    return (
        <div className="p-4 sm:p-6 md:p-8 font-mono bg-green-50 min-h-screen max-w-screen-lg mx-auto">
            <h1 className="text-3xl font-semibold italic text-green-900 mb-6 select-none">
                🎯 yt-dlp curl 轉換器
            </h1>

            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <input
                    placeholder="名稱（如：閱讀）"
                    value={title}
                    onChange={(e) => updateMeta('title', e.target.value)}
                    className="w-full md:w-1/2 p-2 rounded border border-green-800 bg-green-100 text-green-900 placeholder-green-600 focus:outline-none focus:ring-2 focus:ring-green-700"
                />
                <input
                    placeholder="集數（如：00-01）"
                    value={episode}
                    onChange={(e) => updateMeta('episode', e.target.value)}
                    className="w-full md:w-1/2 p-2 rounded border border-green-800 bg-green-100 text-green-900 placeholder-green-600 focus:outline-none focus:ring-2 focus:ring-green-700"
                />
            </div>

            <textarea
                rows={12}
                placeholder="貼上 curl 指令..."
                value={curlText}
                onChange={(e) => updateCurl(e.target.value)}
                className="w-full min-w-0 p-3 rounded border border-green-800 bg-green-100 text-green-900 placeholder-green-600 font-mono resize-y focus:outline-none focus:ring-2 focus:ring-green-700 mb-6"
            />

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-2">
                <h2 className="text-2xl text-green-900 font-semibold select-none">
                    🧠 轉換後指令
                </h2>
                <div className="relative inline-block">
                    <button
                        onClick={handleCopy}
                        className="px-6 py-2 bg-green-900 text-green-100 rounded font-semibold hover:bg-green-800 transition-colors cursor-pointer"
                    >
                        📋 複製 yt-dlp 指令
                    </button>
                    {copied && (
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1 text-sm text-white bg-green-700 rounded shadow whitespace-nowrap">
                            ✅ 已複製！
                        </div>
                    )}
                </div>
            </div>

            <pre className="bg-green-100 p-4 rounded whitespace-pre-wrap break-words overflow-x-auto text-green-900 font-mono border border-green-800">
        {ytDlpCommand}
      </pre>
        </div>
    );
}
