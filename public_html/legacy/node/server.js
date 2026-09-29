const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const { status } = require('minecraft-server-util');
const app = express();

const DEFAULT_PORT = 15492;
const parsedPort = Number(process.env.PORT);
const PORT = Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : DEFAULT_PORT;
const HOST = process.env.HOST || '0.0.0.0';
const COUNTER_FILE = path.join(__dirname, 'counter.json');
const MUSIC_DIR = path.join(__dirname, 'assets', 'music');
const BASE_VIEWS = 0; // Đã reset số lượt xem về 0 theo yêu cầu

app.disable('x-powered-by');
app.set('trust proxy', true);

function normalizeIp(ip) {
    if (!ip) return 'unknown';
    if (ip === '::1') return '127.0.0.1';
    if (ip.startsWith('::ffff:')) return ip.slice(7);
    return ip;
}

function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
        return normalizeIp(forwarded.split(',')[0].trim());
    }

    return normalizeIp(req.ip || req.socket?.remoteAddress || 'unknown');
}

function hashIp(ip) {
    return crypto.createHash('sha256').update(ip).digest('hex');
}

function createCounterState() {
    return {
        unique_visitors: 0,
        visitors: {}
    };
}

async function readCounterState() {
    try {
        const content = await fs.readFile(COUNTER_FILE, 'utf8');
        const parsed = JSON.parse(content);
        return {
            unique_visitors: Number(parsed.unique_visitors || 0),
            visitors: typeof parsed.visitors === 'object' && parsed.visitors ? parsed.visitors : {}
        };
    } catch (error) {
        return createCounterState();
    }
}

// Template cho trình xem file DOCX trên web (Giao diện chuyên nghiệp như PDF Viewer)
const DOCX_VIEWER_TEMPLATE = (filename) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DOCX Viewer - ${filename}</title>
    <script src="https://cdn.jsdelivr.net/npm/jszip/dist/jszip.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/docx-preview/dist/docx-preview.js"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <style>
        :root {
            --viewer-bg: #323639;
            --toolbar-bg: #202124;
            --page-shadow: 0 1px 3px rgba(0,0,0,0.2), 0 2px 2px rgba(0,0,0,0.12), 0 0 2px rgba(0,0,0,0.14);
            --primary-color: #10B981;
        }

        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            background: var(--viewer-bg); 
            margin: 0; 
            padding: 0; 
            height: 100vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        /* Toolbar */
        .toolbar {
            background: var(--toolbar-bg);
            color: white;
            height: 56px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 20px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            z-index: 1000;
        }

        .file-info {
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 14px;
            font-weight: 500;
            max-width: 60%;
        }

        .file-info i {
            color: #2b579a; /* Word Blue */
            font-size: 18px;
        }

        .file-name {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .actions {
            display: flex;
            gap: 8px;
        }

        .btn-action {
            background: transparent;
            color: #e8eaed;
            border: none;
            padding: 8px;
            border-radius: 50%;
            cursor: pointer;
            transition: background 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 36px;
            height: 36px;
            text-decoration: none;
        }

        .btn-action:hover {
            background: rgba(255,255,255,0.1);
            color: white;
        }

        .btn-download:hover {
            color: var(--primary-color);
        }

        /* Viewer Area */
        #viewer-scroll-container {
            flex: 1;
            overflow-y: auto;
            padding: 20px 0;
            display: flex;
            justify-content: center;
        }

        #viewer-container {
            background: white;
            box-shadow: var(--page-shadow);
            margin-bottom: 20px;
            width: fit-content;
            min-height: 297mm; /* A4 Ratio */
        }

        /* Docx Preview Overrides */
        .docx-wrapper {
            background: transparent !important;
            padding: 0 !important;
        }

        article.docx {
            margin: 0 !important;
            box-shadow: none !important;
            padding: 20mm !important; /* Standard margins */
        }

        /* Loading Spinner */
        .loader {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 15px;
            color: white;
        }

        .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid rgba(255,255,255,0.1);
            border-left-color: var(--primary-color);
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        @media (max-width: 600px) {
            article.docx {
                padding: 10mm !important;
            }
            .file-info {
                max-width: 50%;
            }
        }
    </style>
</head>
<body>
    <div class="toolbar">
        <div class="file-info">
            <i class="fas fa-file-word"></i>
            <span class="file-name">${filename}</span>
        </div>
        <div class="actions">
            <a href="?raw=1" class="btn-action btn-download" title="Tải xuống">
                <i class="fas fa-download"></i>
            </a>
            <button class="btn-action" onclick="window.print()" title="In tài liệu">
                <i class="fas fa-print"></i>
            </button>
        </div>
    </div>

    <div id="viewer-scroll-container">
        <div id="viewer-container">
            <div class="loader">
                <div class="spinner"></div>
                <span>Đang tải tài liệu...</span>
            </div>
        </div>
    </div>

    <script>
        const container = document.getElementById("viewer-container");
        fetch(window.location.pathname + "?raw=1")
            .then(res => {
                if (!res.ok) throw new Error("Không thể tải file");
                return res.arrayBuffer();
            })
            .then(buffer => {
                container.innerHTML = "";
                docx.renderAsync(buffer, container, null, {
                    className: "docx",
                    inWrapper: true,
                    ignoreWidth: false,
                    ignoreHeight: false,
                    ignoreFonts: false,
                    breakPageHasItems: false,
                    useBase64URL: false,
                    useMathMLPolyfill: false,
                    showChanges: false,
                    debug: false
                })
                .then(x => console.log("docx: finished"))
                .catch(e => {
                    container.innerHTML = "<div style='padding: 20px; color: red;'>Lỗi khi hiển thị file: " + e + "</div>";
                });
            })
            .catch(err => {
                container.innerHTML = "<div style='padding: 20px; color: red;'>Lỗi: " + err.message + "</div>";
            });
    </script>
</body>
</html>
`;

// API Endpoint để ping Minecraft Server
app.get('/api/health', async (req, res) => {
    try {
        await fs.access(__dirname);

        res.json({
            ok: true,
            service: 'bio-bei',
            uptime: Math.round(process.uptime()),
            timestamp: new Date().toISOString(),
            port: PORT
        });
    } catch (error) {
        res.status(500).json({
            ok: false,
            error: error.message
        });
    }
});

app.get('/api/ping', async (req, res) => {
    const ip = req.query.ip;
    if (!ip) {
        return res.status(400).json({ error: 'IP is required' });
    }

    try {
        // Mặc định ping port 25565 nếu không có port trong IP
        const [host, portStr] = ip.split(':');
        const port = portStr ? parseInt(portStr) : 25565;

        const result = await status(host, port, {
            timeout: 5000, // 5 seconds timeout
            enableSRV: true
        });

        res.json({
            online: true,
            players: {
                now: result.players.online,
                max: result.players.max
            },
            server: {
                name: result.version.name
            }
        });
    } catch (error) {
        console.error(`Error pinging ${ip}:`, error.message);
        res.json({
            online: false,
            error: error.message
        });
    }
});

// API Endpoint để đếm lượt xem (Tránh AdBlock và ổn định nhất)
app.get('/api/views', async (req, res) => {
    try {
        const data = await readCounterState();
        const clientIp = getClientIp(req);
        const visitorKey = hashIp(clientIp);
        const shouldIncrement = req.query.increment !== 'false';
        const existingVisitor = data.visitors[visitorKey];

        if (shouldIncrement) {
            const now = new Date().toISOString();

            if (!existingVisitor) {
                data.visitors[visitorKey] = {
                    firstSeenAt: now,
                    lastSeenAt: now,
                    visits: 1
                };
            } else {
                data.visitors[visitorKey] = {
                    ...existingVisitor,
                    lastSeenAt: now,
                    visits: Number(existingVisitor.visits || 0) + 1
                };
            }

            data.unique_visitors = Object.keys(data.visitors).length;
            await fs.writeFile(COUNTER_FILE, JSON.stringify(data, null, 2));
        }

        res.json({
            count: (data.unique_visitors || 0) + BASE_VIEWS,
            isUniqueVisitor: !existingVisitor,
            countingBy: 'ip'
        });
    } catch (error) {
        console.error('Lỗi API Views:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// API Endpoint để lấy playlist từ thư mục assets/music
app.get('/api/music', async (req, res) => {
    try {
        const entries = await fs.readdir(MUSIC_DIR, { withFileTypes: true });
        const tracks = entries
            .filter((entry) => entry.isFile() && /\.(mp3|wav|ogg|m4a)$/i.test(entry.name))
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
            .map((entry, index) => ({
                id: index + 1,
                file: entry.name,
                url: `/assets/music/${encodeURIComponent(entry.name)}`
            }));

        res.json({ tracks });
    } catch (error) {
        console.error('Lỗi API Music:', error);
        res.status(500).json({ error: 'Unable to load music playlist' });
    }
});

// Middleware để xử lý file .docx
app.get('/*.docx', (req, res, next) => {
    // Nếu có tham số ?raw=1, bỏ qua middleware này và để express.static xử lý
    if (req.query.raw) {
        return next();
    }

    const filename = path.basename(req.path);
    const htmlContent = DOCX_VIEWER_TEMPLATE(filename);
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(htmlContent);
});

// Logger middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Phục vụ các file tĩnh trong thư mục hiện tại
app.use(express.static(__dirname));

const server = app.listen(PORT, HOST, () => {
    console.log(`Starting Node.js server on ${HOST}:${PORT}...`);
    console.log(`Visit http://localhost:${PORT} in your browser.`);
});

server.on('error', (error) => {
    console.error('HTTP server error:', error);
});

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
});

const shutdown = (signal) => {
    console.log(`Received ${signal}. Shutting down gracefully...`);
    server.close(() => {
        console.log('HTTP server closed.');
        process.exit(0);
    });

    setTimeout(() => {
        console.error('Forced shutdown after timeout.');
        process.exit(1);
    }, 10000).unref();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

fs.access(MUSIC_DIR).catch(() => {
    console.warn(`Music directory not found at ${MUSIC_DIR}. /api/music will return 500 until it exists.`);
});
