// src/App.jsx
import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001', {
    auth: { token: 'demo' },
});

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

function convertToYtDlp(info, title, episode) {
    const base = ['yt-dlp'];

    if (info.referer) base.push(`--referer "${info.referer}"`);
    if (info.userAgent) base.push(`--user-agent "${info.userAgent}"`);
    if (info.cookies) base.push(`--add-header "Cookie: ${info.cookies}"`);

    for (const [key, value] of Object.entries(info.headers)) {
        if (!['User-Agent', 'Referer'].includes(key)) {
            base.push(`--add-header "${key}: ${value}"`);
        }
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

    useEffect(() => {
        socket.on('init_state', (data) => {
            setCurlText(data.curl || '');
            setTitle(data.title || '');
            setEpisode(data.episode || '');
        });

        socket.on('curl_update', setCurlText);
        socket.on('meta_update', (data) => {
            if (data.title !== undefined) setTitle(data.title);
            if (data.episode !== undefined) setEpisode(data.episode);
        });

        return () => {
            socket.off('curl_update');
            socket.off('meta_update');
            socket.off('init_state');
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

    return (
        <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
            <h1>yt-dlp curl 轉換器</h1>
            <input
                placeholder="名稱（如：閱讀）"
                value={title}
                onChange={(e) => updateMeta('title', e.target.value)}
                style={{ width: '49%', marginRight: '2%' }}
            />
            <input
                placeholder="集數（如：00-01）"
                value={episode}
                onChange={(e) => updateMeta('episode', e.target.value)}
                style={{ width: '49%' }}
            />
            <textarea
                rows={15}
                cols={100}
                placeholder="貼上 curl 指令..."
                value={curlText}
                onChange={(e) => updateCurl(e.target.value)}
                style={{ width: '100%', fontFamily: 'monospace', marginTop: '1rem' }}
            />
            <h2>yt-dlp 指令</h2>
            <pre style={{ backgroundColor: '#eee', padding: '1rem' }}>
        {ytDlpCommand}
      </pre>
            <button onClick={() => navigator.clipboard.writeText(ytDlpCommand)}>
                複製 yt-dlp 指令
            </button>
        </div>
    );
}
