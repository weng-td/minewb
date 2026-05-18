import './style.css';
import { drawChart } from './chart.js';

const DEFAULT_PROXY = 'ws://localhost:8080';

const CHART_POINTS = 60;
const LOG_MAX = 200;

const cores = navigator.hardwareConcurrency || 4;

let proxyUrl = DEFAULT_PROXY;

function optimalThreads() {
    const base = Math.max(1, cores - 1);
    return Math.min(base, 8);
}

function parseParams() {
    const p = new URLSearchParams(window.location.search);

    if (p.has('proxy') || p.has('p')) {
        proxyUrl = p.get('proxy') || p.get('p');
    }

    if (p.has('threads') || p.has('t')) {
        const raw = parseInt(p.get('threads') || p.get('t'), 10);
        if (!isNaN(raw) && raw >= 1) {
            S.threads = Math.min(raw, cores);
        }
    }
}

const S = {
    accepted: 0,
    rejected: 0,
    hashrate: 0,
    peakHash: 0,
    algo: '-',
    job: '-',
    diff: '-',
    threads: optimalThreads(),
    uptime: 0,
    uptimeRef: 0,
    reconnects: 0,
    lastShare: '-',
    hidden: false,
    hiddenThreads: 0,
    chartData: new Array(CHART_POINTS).fill(0),
    hashSamples: [],
};

const $ = (id) => document.getElementById(id);

const V = {};
function cacheEls() {
    ['status', 'hashrate', 'peak', 'algo', 'job', 'diff',
     'accepted', 'rejected', 'shares', 'threads', 'cpu',
     'uptime', 'conn', 'reconn', 'lastshare'
    ].forEach(k => V[k] = $('v-' + k));
    V.dot = $('dot');
    V.statusText = $('status-text');
    V.chart = $('chart');
    V.logBox = $('log-box');
}

function setDot(cls) {
    V.dot.className = 'dot';
    if (cls) V.dot.classList.add(cls);
}

function setStatus(text, dotCls) {
    V.status.textContent = text;
    V.statusText.textContent = dotCls === 'online' ? 'LIVE' : dotCls === 'warn' ? 'WAIT' : dotCls === 'error' ? 'ERR' : 'IDLE';
    setDot(dotCls);
}

function pop(el) {
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
}

function render() {
    V.hashrate.textContent = formatHash(S.hashrate);
    V.peak.textContent = formatHash(S.peakHash);
    V.algo.textContent = S.algo;
    V.job.textContent = S.job.length > 20 ? S.job.slice(0, 8) + '...' + S.job.slice(-6) : S.job;
    V.job.title = S.job;
    V.diff.textContent = S.diff;
    V.accepted.textContent = S.accepted;
    V.rejected.textContent = S.rejected;
    V.shares.textContent = `${S.accepted} / ${S.accepted + S.rejected}`;
    V.threads.textContent = `${S.threads} / ${cores}`;
    V.cpu.textContent = Math.round((S.threads / cores) * 100) + '%';
    V.conn.textContent = proxyUrl;
    V.conn.title = proxyUrl;
    V.reconn.textContent = S.reconnects;
    V.lastshare.textContent = S.lastShare;
}

function formatHash(h) {
    if (h >= 1000000) return (h / 1000000).toFixed(2) + ' MH/s';
    if (h >= 1000) return (h / 1000).toFixed(2) + ' KH/s';
    return h.toFixed(1) + ' H/s';
}

function formatTime(sec) {
    const h = String(Math.floor(sec / 3600)).padStart(2, '0');
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
}

function logMsg(msg, type = 'info') {
    const line = document.createElement('span');
    line.className = 'log-line';
    const t = new Date().toLocaleTimeString('en-US', { hour12: false });
    line.innerHTML = `<span class="t">[${t}]</span> <span class="${type === 'success' ? 'ok' : type}">${msg}</span>`;
    V.logBox.appendChild(line);
    if (V.logBox.children.length > LOG_MAX) V.logBox.removeChild(V.logBox.firstChild);
    V.logBox.scrollTop = V.logBox.scrollHeight;
}

function smoothHashrate(raw) {
    S.hashSamples.push(raw);
    if (S.hashSamples.length > 5) S.hashSamples.shift();
    const sorted = [...S.hashSamples].sort((a, b) => a - b);
    if (sorted.length >= 3) {
        const trimmed = sorted.slice(1, -1);
        return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
    }
    return sorted.reduce((a, b) => a + b, 0) / sorted.length;
}

let client = null;

function startMining() {
    if (!window.Core) {
        logMsg('ERROR: Core not loaded. Check worker.js', 'err');
        setStatus('Error: no engine', 'error');
        return;
    }

    setStatus('Connecting...', 'warn');
    logMsg(`Connecting to ${proxyUrl}`, 'info');

    try {
        client = new window.Core(proxyUrl, S.threads);
    } catch (e) {
        logMsg(`Failed to create Core: ${e.message}`, 'err');
        setStatus('Error', 'error');
        return;
    }

    client.on('connected', () => {
        setStatus('Connected', 'online');
        logMsg('WebSocket connected', 'success');
        S.uptimeRef = Date.now();
        S.reconnects = 0;
        render();
    });

    client.on('initialized', (algo) => {
        S.algo = algo;
        logMsg(`Algorithm: ${algo}`, 'success');
        render();
    });

    client.on('difficulty', (diff) => {
        if (typeof diff === 'number') {
            S.diff = diff < 0.01 ? diff.toPrecision(4) : diff.toLocaleString();
        } else {
            S.diff = diff;
        }
        logMsg(`Difficulty set: ${S.diff}`, 'info');
        render();
    });

    client.on('task', (task) => {
        S.job = task.jobId || '-';
        logMsg(`Job: ${S.job}`, 'info');
        render();
    });

    client.on('hashrate', (raw) => {
        const hr = smoothHashrate(raw);
        S.hashrate = hr;
        if (hr > S.peakHash) S.peakHash = hr;
        S.chartData.push(hr);
        if (S.chartData.length > CHART_POINTS) S.chartData.shift();
        pop(V.hashrate);
        render();
        drawChart(V.chart, S.chartData);
    });

    client.on('success', () => {
        S.accepted++;
        S.lastShare = new Date().toLocaleTimeString('en-US', { hour12: false });
        logMsg(`Share ACCEPTED [${S.accepted}]`, 'success');
        pop(V.accepted);
        render();
    });

    client.on('failed', (err) => {
        S.rejected++;
        logMsg(`Share REJECTED: ${err}`, 'err');
        pop(V.rejected);
        render();
    });

    client.on('shared', (share) => {
        logMsg(`Share submitted`, 'info');
    });

    client.on('error', (err) => {
        logMsg(`Error: ${err?.message || err}`, 'err');
    });

    client.on('worker-error', (info) => {
        logMsg(`Worker #${info?.workerId} error`, 'err');
    });

    client.on('closed', () => {
        setStatus('Disconnected', 'error');
        logMsg('Connection lost', 'err');
        S.hashrate = 0;
        S.hashSamples = [];
        render();
    });

    client.on('reconnecting', (info) => {
        S.reconnects++;
        setStatus(`Reconnecting #${S.reconnects}...`, 'warn');
        logMsg(`Reconnect attempt ${info?.attempt || S.reconnects}`, 'warn');
        render();
    });

    client.start();
}

function handleVisibility() {
    if (document.hidden) {
        S.hidden = true;
        S.hiddenThreads = S.threads;
        const reduced = Math.max(1, Math.floor(S.threads / 2));
        if (client && S.threads !== reduced) {
            logMsg(`Tab hidden - throttle ${S.threads} -> ${reduced} threads`, 'warn');
            S.threads = reduced;
        }
    } else {
        if (S.hidden && S.hiddenThreads > 0) {
            logMsg(`Tab visible - restore ${S.threads} -> ${S.hiddenThreads} threads`, 'info');
            S.threads = S.hiddenThreads;
        }
        S.hidden = false;
    }
    render();
}

function uptimeTick() {
    if (S.uptimeRef) {
        S.uptime = Math.floor((Date.now() - S.uptimeRef) / 1000);
        V.uptime.textContent = formatTime(S.uptime);
    }
}

function init() {
    cacheEls();

    S.threads = optimalThreads();
    parseParams();

    render();

    logMsg(`System: ${cores} cores detected`, 'info');
    logMsg(`Proxy: ${proxyUrl}`, 'info');
    logMsg(`Threads: ${S.threads}${S.threads === optimalThreads() ? ' (auto)' : ' (from URL)'}`, 'info');

    setInterval(uptimeTick, 1000);

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('resize', () => drawChart(V.chart, S.chartData));

    drawChart(V.chart, S.chartData);

    setTimeout(() => {
        logMsg('Auto-starting engine...', 'info');
        startMining();
    }, 500);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
