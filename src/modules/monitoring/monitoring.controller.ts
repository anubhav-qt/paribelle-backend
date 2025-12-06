import { Controller, Get, Delete, Query, Res } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';

@ApiTags('monitoring')
@Controller('monitoring')
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Get('logs')
  @ApiOperation({ summary: 'Get recent logs' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getLogs(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit) : 100;
    return this.monitoringService.getLogs(parsedLimit);
  }

  @Get('slow-requests')
  @ApiOperation({ summary: 'Get slow requests' })
  @ApiQuery({ name: 'threshold', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getSlowRequests(
    @Query('threshold') threshold?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedThreshold = threshold ? parseInt(threshold) : 1000;
    const parsedLimit = limit ? parseInt(limit) : 50;
    return this.monitoringService.getSlowRequests(parsedThreshold, parsedLimit);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get performance statistics' })
  getStats() {
    return this.monitoringService.getStats();
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'View logs dashboard in browser' })
  getDashboard(@Res() res: Response) {
    // Disable CSP for this endpoint
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'");
    
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Marketplace Monitoring Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: #0f172a;
            color: #e2e8f0;
            padding: 20px;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        h1 {
            font-size: 2rem;
            margin-bottom: 10px;
            color: #60a5fa;
        }
        .subtitle {
            color: #94a3b8;
            margin-bottom: 30px;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: #1e293b;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #60a5fa;
        }
        .stat-label {
            color: #94a3b8;
            font-size: 0.875rem;
            margin-bottom: 8px;
        }
        .stat-value {
            font-size: 2rem;
            font-weight: 700;
            color: #60a5fa;
        }
        .stat-value.warning { color: #fbbf24; }
        .stat-value.danger { color: #f87171; }
        .controls {
            background: #1e293b;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            display: flex;
            gap: 15px;
            align-items: center;
            flex-wrap: wrap;
        }
        button {
            background: #3b82f6;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.875rem;
            font-weight: 500;
            transition: background 0.2s;
        }
        button:hover { background: #2563eb; }
        button.danger {
            background: #ef4444;
        }
        button.danger:hover { background: #dc2626; }
        select, input {
            background: #0f172a;
            color: #e2e8f0;
            border: 1px solid #334155;
            padding: 10px;
            border-radius: 6px;
            font-size: 0.875rem;
        }
        .tabs {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
        }
        .tab {
            background: #1e293b;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            transition: background 0.2s;
        }
        .tab.active {
            background: #3b82f6;
        }
        .log-container {
            background: #1e293b;
            border-radius: 8px;
            overflow: hidden;
        }
        .log-header {
            background: #0f172a;
            padding: 15px 20px;
            border-bottom: 1px solid #334155;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .logs {
            max-height: 600px;
            overflow-y: auto;
            padding: 10px;
        }
        .log-entry {
            padding: 12px 15px;
            margin-bottom: 8px;
            background: #0f172a;
            border-radius: 6px;
            border-left: 3px solid #334155;
            font-family: 'Courier New', monospace;
            font-size: 0.875rem;
        }
        .log-entry.info { border-left-color: #60a5fa; }
        .log-entry.warn { border-left-color: #fbbf24; background: #1e1b0f; }
        .log-entry.error { border-left-color: #f87171; background: #1e0f0f; }
        .log-time {
            color: #94a3b8;
            margin-right: 10px;
        }
        .log-level {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: 600;
            margin-right: 10px;
        }
        .log-level.info { background: #1e3a5f; color: #60a5fa; }
        .log-level.warn { background: #5f4b1e; color: #fbbf24; }
        .log-level.error { background: #5f1e1e; color: #f87171; }
        .log-message {
            color: #e2e8f0;
        }
        .log-duration {
            color: #94a3b8;
            font-style: italic;
            margin-left: 10px;
        }
        .log-duration.slow { color: #fbbf24; font-weight: 600; }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #0f172a; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #475569; }
        .auto-refresh {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .toggle {
            position: relative;
            display: inline-block;
            width: 50px;
            height: 24px;
        }
        .toggle input { opacity: 0; width: 0; height: 0; }
        .slider {
            position: absolute;
            cursor: pointer;
            top: 0; left: 0; right: 0; bottom: 0;
            background-color: #334155;
            transition: .4s;
            border-radius: 24px;
        }
        .slider:before {
            position: absolute;
            content: "";
            height: 16px;
            width: 16px;
            left: 4px;
            bottom: 4px;
            background-color: white;
            transition: .4s;
            border-radius: 50%;
        }
        input:checked + .slider { background-color: #3b82f6; }
        input:checked + .slider:before { transform: translateX(26px); }
        .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: #64748b;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Marketplace Monitoring</h1>
        <p class="subtitle">Real-time performance monitoring and logs</p>

        <div class="stats" id="stats">
            <div class="stat-card">
                <div class="stat-label">Total Requests</div>
                <div class="stat-value" id="totalRequests">-</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Slow Requests</div>
                <div class="stat-value warning" id="slowRequests">-</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Avg Response Time</div>
                <div class="stat-value" id="avgResponse">-</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Slow Request %</div>
                <div class="stat-value" id="slowPercent">-</div>
            </div>
        </div>

        <div class="controls">
            <select id="limitSelect">
                <option value="50">Last 50 logs</option>
                <option value="100" selected>Last 100 logs</option>
                <option value="200">Last 200 logs</option>
                <option value="500">Last 500 logs</option>
            </select>
            <button id="refreshBtn">🔄 Refresh</button>
            <div class="auto-refresh">
                <label class="toggle">
                    <input type="checkbox" id="autoRefresh" checked>
                    <span class="slider"></span>
                </label>
                <span>Auto-refresh (5s)</span>
            </div>
            <button class="danger" id="clearBtn">🗑️ Clear Logs</button>
        </div>

        <div class="tabs">
            <div class="tab active" data-tab="all">All Logs</div>
            <div class="tab" data-tab="slow">Slow Requests (>1s)</div>
        </div>

        <div class="log-container">
            <div class="log-header">
                <h3 id="logTitle">Recent Logs</h3>
                <span id="lastUpdate">Last updated: Never</span>
            </div>
            <div class="logs" id="logs">
                <div class="empty-state">Loading logs...</div>
            </div>
        </div>
    </div>

    <script>
        let currentTab = 'all';
        let autoRefreshInterval;

        function formatTime(timestamp) {
            const date = new Date(timestamp);
            return date.toLocaleTimeString('en-US', { hour12: false });
        }

        function renderLog(log) {
            const level = log.level.toLowerCase();
            const duration = log.duration ? \`<span class="log-duration \${log.duration > 1000 ? 'slow' : ''}">\${log.duration}ms</span>\` : '';
            
            return \`
                <div class="log-entry \${level}">
                    <span class="log-time">\${formatTime(log.timestamp)}</span>
                    <span class="log-level \${level}">\${log.level}</span>
                    <span class="log-message">\${log.message}</span>
                    \${duration}
                </div>
            \`;
        }

        async function refreshLogs() {
            try {
                const limit = document.getElementById('limitSelect').value;
                let endpoint = '/api/v1/monitoring/logs?limit=' + limit;
                
                if (currentTab === 'slow') {
                    endpoint = '/api/v1/monitoring/slow-requests?limit=' + limit;
                }

                const response = await fetch(endpoint);
                const logs = await response.json();
                
                const logsContainer = document.getElementById('logs');
                
                if (logs.length === 0) {
                    logsContainer.innerHTML = '<div class="empty-state">No logs available</div>';
                } else {
                    logsContainer.innerHTML = logs.map(renderLog).join('');
                }
                
                document.getElementById('lastUpdate').textContent = 
                    'Last updated: ' + new Date().toLocaleTimeString('en-US', { hour12: false });

                // Update stats
                const statsResponse = await fetch('/api/v1/monitoring/stats');
                const stats = await statsResponse.json();
                
                document.getElementById('totalRequests').textContent = stats.totalRequests;
                document.getElementById('slowRequests').textContent = stats.slowRequests;
                document.getElementById('avgResponse').textContent = stats.averageResponseTime + 'ms';
                document.getElementById('slowPercent').textContent = stats.slowRequestPercentage + '%';

            } catch (error) {
                console.error('Failed to fetch logs:', error);
                document.getElementById('logs').innerHTML = 
                    '<div class="empty-state">Failed to load logs. Is the server running?</div>';
            }
        }

        async function clearLogs() {
            if (!confirm('Are you sure you want to clear all logs?')) return;
            
            try {
                await fetch('/api/v1/monitoring/logs', { method: 'DELETE' });
                refreshLogs();
            } catch (error) {
                console.error('Failed to clear logs:', error);
            }
        }

        function switchTab(tab) {
            currentTab = tab;
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            
            document.getElementById('logTitle').textContent = 
                tab === 'all' ? 'Recent Logs' : 'Slow Requests (>1s)';
            
            refreshLogs();
        }

        // Event listeners
        document.getElementById('refreshBtn').addEventListener('click', refreshLogs);
        document.getElementById('clearBtn').addEventListener('click', clearLogs);
        
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.target.getAttribute('data-tab');
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                switchTab(tabName);
            });
        });

        document.getElementById('autoRefresh').addEventListener('change', (e) => {
            if (e.target.checked) {
                autoRefreshInterval = setInterval(refreshLogs, 5000);
            } else {
                clearInterval(autoRefreshInterval);
            }
        });

        document.getElementById('limitSelect').addEventListener('change', refreshLogs);

        // Initial load
        refreshLogs();
        autoRefreshInterval = setInterval(refreshLogs, 5000);
    </script>
</body>
</html>
    `;
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  @Delete('logs')
  @ApiOperation({ summary: 'Clear all logs' })
  clearLogs() {
    this.monitoringService.clearLogs();
    return { message: 'Logs cleared successfully' };
  }
}
