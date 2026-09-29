// assets/js/socket-demo.js — Client-side Server Defense Visualization (portfolio-safe simulation)
document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("socketCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    const labSection = document.getElementById("socket-demo");
    const liteMotionQuery = window.matchMedia("(max-width: 860px), (pointer: coarse), (prefers-reduced-motion: reduce)");
    let W = 0, H = 0, dpr = 1;
    let isFrameVisible = true;
    let isDocumentVisible = !document.hidden;
    let parentPaused = false;
    let lastFrameTime = 0;

    const isLiteMode = () => liteMotionQuery.matches;
    const getFrameMs = () => isLiteMode() ? 1000 / 24 : 1000 / 45;
    const getMaxClients = () => isLiteMode() ? 18 : 26;
    const getTrailLimit = () => isLiteMode() ? 4 : 7;
    const shouldAnimate = () => isDocumentVisible && isFrameVisible && !parentPaused;

    document.addEventListener("visibilitychange", () => {
        isDocumentVisible = !document.hidden;
    });

    window.addEventListener("message", (event) => {
        const data = event.data || {};
        if (data.type !== "securityLab:setPaused") return;
        parentPaused = Boolean(data.paused);
    });

    function applyPortfolioCopy() {
        const section = document.getElementById("socket-demo");
        if (!section) return;

        const title = section.querySelector(".section-header h2");
        if (title) {
            title.innerHTML = 'Mô Phỏng <span>Kiến Trúc Bảo Vệ Server</span>';
        }

        const desc = section.querySelector(".section-header p");
        if (desc) {
            desc.textContent = "Trực quan hóa luồng client, lưu lượng bất thường và các lớp phòng thủ Anti-DDoS theo mô hình OSI. Demo chạy hoàn toàn trên trình duyệt, không gửi request thật.";
        }

        const attackBtn = document.getElementById("addAttackerBtn");
        if (attackBtn) attackBtn.innerHTML = '<i class="fas fa-bug"></i> Mô phỏng traffic xấu';

        const fwBtn = document.getElementById("toggleFwBtn");
        if (fwBtn && !fwBtn.classList.contains("active-fw")) {
            fwBtn.innerHTML = '<i class="fas fa-shield-alt"></i> Bật phòng thủ';
        }

        const addClientBtn = document.getElementById("addClientBtn");
        if (addClientBtn) addClientBtn.innerHTML = '<i class="fas fa-user-plus"></i> Thêm client';

        const removeBtn = document.getElementById("removeClientBtn");
        if (removeBtn) removeBtn.innerHTML = '<i class="fas fa-user-minus"></i> Bớt client';
    }

    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, isLiteMode() ? 1.25 : 1.75);
        const parent = canvas.parentElement || canvas;
        const rect = parent.getBoundingClientRect();
        W = Math.max(320, Math.round(rect.width || canvas.clientWidth || 996));
        H = Math.max(260, Math.round(rect.height || canvas.clientHeight || 520));
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        canvas.style.width = W + "px";
        canvas.style.height = H + "px";
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    applyPortfolioCopy();
    resize();
    if ("ResizeObserver" in window && canvas.parentElement) {
        new ResizeObserver(resize).observe(canvas.parentElement);
    } else {
        window.addEventListener("resize", resize);
    }

    if ("IntersectionObserver" in window && labSection) {
        new IntersectionObserver((entries) => {
            isFrameVisible = entries.some((entry) => entry.isIntersecting);
        }, { threshold: 0.01 }).observe(labSection);
    }

    // === STATE ===
    let fwEnabled = false, showOSI = true, tick = 0;
    let packetCounter = 0, blockedCounter = 0;
    const particles = [], packets = [], explosions = [], logLines = [];

    // OSI Attack Types
    const OSI_ATTACKS = [
        { layer: 7, name: "HTTP Burst",      color: "#f43f5e", icon: "L7" },
        { layer: 7, name: "Slow Request",    color: "#e11d48", icon: "L7" },
        { layer: 4, name: "SYN Spike",       color: "#f59e0b", icon: "L4" },
        { layer: 4, name: "UDP Spike",       color: "#d97706", icon: "L4" },
        { layer: 3, name: "ICMP Spike",      color: "#ef4444", icon: "L3" },
        { layer: 3, name: "IP Anomaly",      color: "#dc2626", icon: "L3" },
        { layer: 2, name: "ARP Anomaly",     color: "#a855f7", icon: "L2" },
        { layer: 1, name: "Physical Alert",  color: "#6366f1", icon: "L1" },
    ];

    // Anti layers
    const ANTI_LAYERS = [
        { name: "WAF",           radius: 0, color: "#10b981", desc: "Web Application Firewall" },
        { name: "Rate Limiter",  radius: 0, color: "#06b6d4", desc: "Request Rate Limiting" },
        { name: "IDS/IPS",       radius: 0, color: "#8b5cf6", desc: "Intrusion Detection" },
        { name: "DDoS Shield",   radius: 0, color: "#f59e0b", desc: "Volumetric Protection" },
    ];

    // Server cluster
    const server = { x: 0, y: 0, r: 38, stress: 0, label: "MAIN SERVER" };
    const subServers = [
        { label: "DB", icon: "💾", angle: -Math.PI/3, dist: 70, r: 18, color: "#06b6d4" },
        { label: "Cache", icon: "⚡", angle: Math.PI/3, dist: 70, r: 18, color: "#f59e0b" },
        { label: "Auth", icon: "🔑", angle: Math.PI, dist: 70, r: 18, color: "#10b981" },
    ];

    // Clients
    let clients = [];
    updateStats();

    function addClient(isAttacker) {
        if (clients.length >= getMaxClients()) return;
        const side = Math.floor(Math.random() * 4);
        let x, y;
        if (side === 0) { x = Math.random() * W; y = -15; }
        else if (side === 1) { x = W + 15; y = Math.random() * H; }
        else if (side === 2) { x = Math.random() * W; y = H + 15; }
        else { x = -15; y = Math.random() * H; }
        
        const edge = 60 + Math.random() * 40;
        const tx = edge + Math.random() * (W - edge * 2);
        const ty = edge + Math.random() * (H - edge * 2);
        
        // Keep clients in the outer ring area
        const cx = W / 2, cy = H / 2;
        const minDist = fwEnabled ? 220 : 160;
        const dx = tx - cx, dy = ty - cy;
        const d = Math.sqrt(dx*dx + dy*dy);
        let fx = tx, fy = ty;
        if (d < minDist) {
            const safeD = d || 1;
            fx = cx + (dx / safeD) * (minDist + Math.random() * 60);
            fy = cy + (dy / safeD) * (minDist + Math.random() * 60);
        }
        fx = Math.max(30, Math.min(W - 30, fx));
        fy = Math.max(30, Math.min(H - 30, fy));

        clients.push({
            x, y, tx: fx, ty: fy, r: 10,
            isAttacker: !!isAttacker,
            color: isAttacker ? "#ef4444" : "#0ea5e9",
            attack: isAttacker ? OSI_ATTACKS[Math.floor(Math.random() * OSI_ATTACKS.length)] : null,
            alive: true, entered: false, alpha: 0,
            bobPhase: Math.random() * Math.PI * 2
        });
        updateStats();
    }

    function removeClient() {
        if (clients.length > 0) { clients.pop(); updateStats(); }
    }

    function updateStats() {
        const el = document.getElementById("clientCount");
        if (el) el.innerText = clients.filter(c => !c.isAttacker).length;
        const atk = document.getElementById("attackerCount");
        if (atk) atk.innerText = clients.filter(c => c.isAttacker).length;
    }

    function addLog(msg, type) {
        logLines.unshift({ msg, type, time: Date.now(), alpha: 1 });
        if (logLines.length > 6) logLines.pop();
        const logEl = document.getElementById("serverLog");
        if (logEl) {
            logEl.innerHTML = logLines.map(l => {
                const cls = l.type === "block" ? "sv-log-line--block" : l.type === "ok" ? "sv-log-line--ok" : "sv-log-line--info";
                return `<div class="sv-log-line ${cls}" style="opacity:${l.alpha}">${l.msg}</div>`;
            }).join("");
        }
    }

    // Buttons
    const btnAdd = document.getElementById("addClientBtn");
    const btnRem = document.getElementById("removeClientBtn");
    const btnAtk = document.getElementById("addAttackerBtn");
    const btnFw = document.getElementById("toggleFwBtn");

    if (btnAdd) btnAdd.addEventListener("click", () => addClient(false));
    if (btnRem) btnRem.addEventListener("click", removeClient);
    if (btnAtk) btnAtk.addEventListener("click", () => { for(let i=0, total = isLiteMode() ? 2 : 3; i < total; i++) addClient(true); });
    if (btnFw) btnFw.addEventListener("click", () => {
        fwEnabled = !fwEnabled;
        btnFw.innerHTML = fwEnabled
            ? '<i class="fas fa-shield-alt"></i> Phòng thủ: ON'
            : '<i class="fas fa-shield-alt"></i> Bật phòng thủ';
        btnFw.classList.toggle("active-fw", fwEnabled);
        if (fwEnabled) addLog("[DEFENSE] All protection layers activated", "ok");
        else addLog("[DEFENSE] Protection layers disabled", "block");
    });

    // Spawn packets
    setInterval(() => {
        if (!shouldAnimate()) return;
        clients.forEach(c => {
            if (!c.entered || !c.alive) return;
            if (Math.random() > 0.85) {
                if (c.isAttacker) {
                    const atk = c.attack || OSI_ATTACKS[0];
                    packets.push({
                        x: c.x, y: c.y,
                        tx: server.x, ty: server.y,
                        speed: 2.5 + Math.random() * 2,
                        color: atk.color, malicious: true,
                        attack: atk, size: 3, trail: [], toServer: true
                    });
                } else {
                    packets.push({
                        x: c.x, y: c.y,
                        tx: server.x, ty: server.y,
                        speed: 2 + Math.random(),
                        color: "#0ea5e9", malicious: false,
                        size: 2.5, trail: [], toServer: true
                    });
                }
                packetCounter++;
            }
        });
        // Server responses
        const normals = clients.filter(c => !c.isAttacker && c.entered && c.alive);
        if (normals.length > 0 && Math.random() > 0.6) {
            const c = normals[Math.floor(Math.random() * normals.length)];
            packets.push({
                x: server.x, y: server.y,
                tx: c.x, ty: c.y,
                speed: 2.5 + Math.random(),
                color: "#10b981", malicious: false,
                size: 2.5, trail: [], toServer: false
            });
        }
    }, isLiteMode() ? 120 : 75);

    // Stats updater
    setInterval(() => {
        const pRate = document.getElementById("packetRate");
        const fwBlock = document.getElementById("fwBlockedRate");
        const sStatus = document.getElementById("serverStatus");
        if (pRate) pRate.innerText = packetCounter;
        if (fwBlock) fwBlock.innerText = blockedCounter;
        if (sStatus) {
            sStatus.classList.remove("status-online", "status-warning", "status-danger");
            sStatus.style.removeProperty("color");
            if (server.stress > 60 && !fwEnabled) {
                sStatus.innerText = "⚠ High Threat";
                sStatus.classList.add("status-danger");
            } else if (server.stress > 30 && !fwEnabled) {
                sStatus.innerText = "⚡ High Load";
                sStatus.classList.add("status-warning");
            } else {
                sStatus.innerText = "● Online";
                sStatus.classList.add("status-online");
            }
        }
        packetCounter = 0; blockedCounter = 0;
        if (server.stress > 0) server.stress = Math.max(0, server.stress - 8);
        // Fade log
        logLines.forEach(l => { l.alpha = Math.max(0.3, l.alpha - 0.05); });
    }, 1000);

    // Background particles
    for (let i = 0, total = isLiteMode() ? 16 : 32; i < total; i++) {
        particles.push({
            x: Math.random() * 2000, y: Math.random() * 1000,
            vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
            r: Math.random() * 1.5 + 0.5, alpha: Math.random() * 0.3 + 0.1
        });
    }

    // === DRAWING ===
    function drawHexagon(x, y, r) {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const a = (Math.PI / 3) * i - Math.PI / 6;
            const px = x + r * Math.cos(a), py = y + r * Math.sin(a);
            i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
    }

    function draw(now = 0) {
        requestAnimationFrame(draw);
        if (!shouldAnimate()) return;
        if (now - lastFrameTime < getFrameMs()) return;
        lastFrameTime = now;
        ctx.clearRect(0, 0, W, H);
        tick++;
        server.x = W / 2; server.y = H / 2;

        // Background grid
        ctx.strokeStyle = "rgba(255,255,255,0.02)";
        ctx.lineWidth = 1;
        const gs = 40;
        for (let x = 0; x < W; x += gs) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
        for (let y = 0; y < H; y += gs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

        // Background particles
        particles.forEach(p => {
            p.x += p.vx; p.y += p.vy;
            if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
            if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(124,58,237,${p.alpha})`;
            ctx.fill();
        });

        // === FIREWALL LAYERS ===
        if (fwEnabled) {
            const baseR = 75;
            ANTI_LAYERS.forEach((layer, i) => {
                const r = baseR + i * 30;
                layer.radius = r;
                const dashOffset = tick * (i % 2 === 0 ? 1 : -1);
                
                ctx.beginPath();
                ctx.arc(server.x, server.y, r, 0, Math.PI * 2);
                ctx.strokeStyle = layer.color + "40";
                ctx.lineWidth = 2;
                ctx.setLineDash([8 + i * 2, 6 + i]);
                ctx.lineDashOffset = dashOffset;
                ctx.stroke();
                ctx.setLineDash([]);

                // Fill
                ctx.fillStyle = layer.color + "08";
                ctx.fill();

                // Label on top
                const labelAngle = -Math.PI / 2 + i * 0.4;
                const lx = server.x + Math.cos(labelAngle) * r;
                const ly = server.y + Math.sin(labelAngle) * r;
                ctx.font = "bold 7px Inter";
                ctx.fillStyle = layer.color + "cc";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(layer.name, lx, ly - 8);
            });
        }

        // === CONNECTION LINES ===
        clients.forEach(c => {
            if (!c.entered || !c.alive) return;
            ctx.beginPath();
            ctx.moveTo(server.x, server.y);
            ctx.lineTo(c.x, c.y);
            const grad = ctx.createLinearGradient(server.x, server.y, c.x, c.y);
            if (c.isAttacker) {
                grad.addColorStop(0, "rgba(239,68,68,0.0)");
                grad.addColorStop(1, "rgba(239,68,68,0.15)");
            } else {
                grad.addColorStop(0, "rgba(124,58,237,0.0)");
                grad.addColorStop(1, "rgba(14,165,233,0.08)");
            }
            ctx.strokeStyle = grad;
            ctx.lineWidth = c.isAttacker ? 1.5 : 0.8;
            ctx.stroke();
        });

        // === PACKETS ===
        for (let i = packets.length - 1; i >= 0; i--) {
            const p = packets[i];
            const dx = p.tx - p.x, dy = p.ty - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;

            if (dist < p.speed + 3) {
                if (p.toServer && p.malicious) server.stress += 3;
                packets.splice(i, 1);
                // arrival burst
                explosions.push({ x: p.tx, y: p.ty, r: 0, maxR: 12, color: p.color, alpha: 0.6 });
                continue;
            }

            // Firewall check
            if (fwEnabled && p.toServer && p.malicious) {
                const ds = Math.sqrt((p.x - server.x) ** 2 + (p.y - server.y) ** 2);
                const outerR = ANTI_LAYERS[ANTI_LAYERS.length - 1].radius;
                if (ds <= outerR + 3) {
                    blockedCounter++;
                    packets.splice(i, 1);
                    explosions.push({ x: p.x, y: p.y, r: 0, maxR: 18, color: "#ef4444", alpha: 0.8 });
                    if (Math.random() > 0.7) {
                        addLog(`[BLOCKED] ${p.attack?.name || "Attack"} — Layer ${p.attack?.layer || "?"}`, "block");
                    }
                    continue;
                }
            }

            p.trail.push({ x: p.x, y: p.y });
            if (p.trail.length > getTrailLimit()) p.trail.shift();
            p.x += (dx / dist) * p.speed;
            p.y += (dy / dist) * p.speed;

            // Draw trail
            for (let t = 0; t < p.trail.length; t++) {
                const a = (t / p.trail.length) * 0.4;
                ctx.beginPath();
                ctx.arc(p.trail[t].x, p.trail[t].y, p.size * 0.6, 0, Math.PI * 2);
                ctx.fillStyle = p.color + Math.floor(a * 255).toString(16).padStart(2, "0");
                ctx.fill();
            }

            // Draw packet
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.shadowBlur = 8; ctx.shadowColor = p.color;
            ctx.fill();
            ctx.shadowBlur = 0;

            // Attack label on malicious
            if (p.malicious && p.attack) {
                ctx.font = "bold 6px Inter";
                ctx.fillStyle = p.color;
                ctx.textAlign = "center";
                ctx.fillText(p.attack.icon, p.x, p.y - 7);
            }
        }

        // === EXPLOSIONS ===
        for (let i = explosions.length - 1; i >= 0; i--) {
            const e = explosions[i];
            e.r += 1.5; e.alpha -= 0.04;
            if (e.alpha <= 0) { explosions.splice(i, 1); continue; }
            ctx.beginPath();
            ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
            ctx.strokeStyle = e.color + Math.floor(e.alpha * 255).toString(16).padStart(2, "0");
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        // === SUB SERVERS ===
        subServers.forEach(s => {
            s.x = server.x + Math.cos(s.angle + tick * 0.003) * s.dist;
            s.y = server.y + Math.sin(s.angle + tick * 0.003) * s.dist;
            
            // Connection line to main
            ctx.beginPath();
            ctx.moveTo(server.x, server.y);
            ctx.lineTo(s.x, s.y);
            ctx.strokeStyle = s.color + "30";
            ctx.lineWidth = 1.5;
            ctx.setLineDash([3, 3]);
            ctx.stroke();
            ctx.setLineDash([]);

            drawHexagon(s.x, s.y, s.r);
            ctx.fillStyle = s.color + "20";
            ctx.fill();
            ctx.strokeStyle = s.color + "60";
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.font = "9px Inter";
            ctx.fillStyle = "#fff";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(s.icon, s.x, s.y - 3);
            ctx.font = "bold 7px Inter";
            ctx.fillStyle = s.color;
            ctx.fillText(s.label, s.x, s.y + 9);
        });

        // === MAIN SERVER ===
        // Outer glow
        const glowR = server.r + 12 + Math.sin(tick * 0.05) * 4;
        const grd = ctx.createRadialGradient(server.x, server.y, server.r, server.x, server.y, glowR);
        if (server.stress > 40 && !fwEnabled) {
            grd.addColorStop(0, "rgba(239,68,68,0.3)");
            grd.addColorStop(1, "rgba(239,68,68,0)");
        } else {
            grd.addColorStop(0, "rgba(124,58,237,0.2)");
            grd.addColorStop(1, "rgba(124,58,237,0)");
        }
        ctx.beginPath();
        ctx.arc(server.x, server.y, glowR, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();

        // Server body
        drawHexagon(server.x, server.y, server.r);
        if (server.stress > 40 && !fwEnabled) {
            ctx.fillStyle = "rgba(239,68,68,0.25)";
            ctx.strokeStyle = "#ef4444";
            // Shake
            server.x += (Math.random() - 0.5) * 3;
            server.y += (Math.random() - 0.5) * 3;
        } else {
            ctx.fillStyle = "rgba(124,58,237,0.15)";
            ctx.strokeStyle = "#7c3aed";
        }
        ctx.lineWidth = 2.5;
        ctx.fill();
        ctx.stroke();

        // Server icon + text
        ctx.font = "16px Inter";
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("🖥", server.x, server.y - 6);
        ctx.font = "bold 7px Inter";
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.fillText(server.label, server.x, server.y + 12);
        if (fwEnabled) {
            ctx.font = "6px Inter";
            ctx.fillStyle = "#10b981";
            ctx.fillText("IP HIDDEN", server.x, server.y + 21);
        } else {
            ctx.font = "6px Inter";
            ctx.fillStyle = "#ef4444";
            ctx.fillText("IP: 103.x.x.x", server.x, server.y + 21);
        }

        // === CLIENTS ===
        clients.forEach(c => {
            if (!c.alive) return;
            // Animate entrance
            if (!c.entered) {
                c.x += (c.tx - c.x) * 0.06;
                c.y += (c.ty - c.y) * 0.06;
                c.alpha = Math.min(1, c.alpha + 0.04);
                if (Math.abs(c.x - c.tx) < 2 && Math.abs(c.y - c.ty) < 2) c.entered = true;
            } else {
                // Gentle bob
                c.bobPhase += 0.02;
                c.x = c.tx + Math.sin(c.bobPhase) * 2;
                c.y = c.ty + Math.cos(c.bobPhase * 0.7) * 2;
                c.alpha = 1;
            }

            ctx.globalAlpha = c.alpha;
            ctx.beginPath();
            ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
            ctx.fillStyle = c.color + "20";
            ctx.fill();
            ctx.strokeStyle = c.color;
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Icon
            ctx.font = "8px Inter";
            ctx.fillStyle = "#fff";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(c.isAttacker ? "💀" : "👤", c.x, c.y);

            // Attack label
            if (c.isAttacker && c.attack) {
                ctx.font = "bold 6px Inter";
                ctx.fillStyle = c.attack.color;
                ctx.fillText(c.attack.name, c.x, c.y + c.r + 8);
            }
            ctx.globalAlpha = 1;
        });

        // === OSI LEGEND (right side) ===
        if (showOSI && W > 600) {
            const lx = W - 135, ly = 20;
            ctx.fillStyle = "rgba(10,14,26,0.85)";
            ctx.strokeStyle = "rgba(255,255,255,0.08)";
            ctx.lineWidth = 1;
            roundRect(ctx, lx - 10, ly - 5, 140, 175, 8);
            ctx.fill(); ctx.stroke();

            ctx.font = "bold 8px Inter";
            ctx.fillStyle = "#fff";
            ctx.textAlign = "left";
            ctx.fillText("OSI ATTACK LAYERS", lx, ly + 8);

            const layers = [
                { n: "L7 - Application", c: "#f43f5e", ex: "HTTP/Slow Request" },
                { n: "L4 - Transport",   c: "#f59e0b", ex: "SYN/UDP Spike" },
                { n: "L3 - Network",     c: "#ef4444", ex: "ICMP/IP Anomaly" },
                { n: "L2 - Data Link",   c: "#a855f7", ex: "ARP Spoof" },
                { n: "L1 - Physical",    c: "#6366f1", ex: "Physical" },
            ];
            layers.forEach((l, i) => {
                const yy = ly + 22 + i * 28;
                ctx.fillStyle = l.c + "30";
                roundRect(ctx, lx - 4, yy - 6, 128, 22, 4);
                ctx.fill();
                ctx.fillStyle = l.c;
                ctx.beginPath(); ctx.arc(lx + 4, yy + 4, 3, 0, Math.PI * 2); ctx.fill();
                ctx.font = "bold 7px Inter";
                ctx.fillStyle = "#fff";
                ctx.textAlign = "left";
                ctx.fillText(l.n, lx + 12, yy + 2);
                ctx.font = "6px Inter";
                ctx.fillStyle = "rgba(255,255,255,0.5)";
                ctx.fillText(l.ex, lx + 12, yy + 12);
            });
        }

        // === ANTI LEGEND (left-bottom) ===
        if (fwEnabled && W > 600) {
            const lx = 15, ly = H - 145;
            ctx.fillStyle = "rgba(10,14,26,0.85)";
            ctx.strokeStyle = "rgba(255,255,255,0.08)";
            ctx.lineWidth = 1;
            roundRect(ctx, lx, ly, 155, 130, 8);
            ctx.fill(); ctx.stroke();

            ctx.font = "bold 8px Inter";
            ctx.fillStyle = "#10b981";
            ctx.textAlign = "left";
            ctx.fillText("🛡 ACTIVE DEFENSES", lx + 10, ly + 14);

            ANTI_LAYERS.forEach((l, i) => {
                const yy = ly + 28 + i * 24;
                ctx.fillStyle = l.color;
                ctx.beginPath(); ctx.arc(lx + 16, yy + 3, 4, 0, Math.PI * 2); ctx.fill();
                ctx.font = "bold 7px Inter";
                ctx.fillStyle = "#fff";
                ctx.fillText(l.name, lx + 26, yy + 2);
                ctx.font = "6px Inter";
                ctx.fillStyle = "rgba(255,255,255,0.5)";
                ctx.fillText(l.desc, lx + 26, yy + 12);
            });
        }

    }

    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    requestAnimationFrame(draw);
});
