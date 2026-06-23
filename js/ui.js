'use strict';
window.GameUI = (function() {
    const MAX_HEARTS = 10;
    let heartEls = [];
    let notifTimer = null;
    let lastFpsTime = 0, frames = 0, fps = 0;

    function init() {
        const hbar = document.getElementById('health-bar');
        hbar.innerHTML = '';
        heartEls = [];
        for (let i = 0; i < MAX_HEARTS; i++) {
            const el = document.createElement('div');
            el.className = 'heart';
            el.innerHTML = `<svg viewBox="0 0 24 24"><path fill="COLOR" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.27 2 8.5 2 5.41 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.08C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.41 22 8.5c0 3.77-3.4 6.86-8.55 11.53L12 21.35z"/></svg>`;
            hbar.appendChild(el);
            heartEls.push(el);
        }
        updateHealth(10, 10);
        buildHotbar();
    }

    function buildHotbar() {
        const hotbar = document.getElementById('hotbar');
        const items = [
            { icon: '⚔', label: 'Schwert' }, { icon: '🪓', label: 'Axt' },
            { icon: '⛏', label: 'Spitzhacke' }, { icon: '🧱', label: 'Block' },
            { icon: '🍎', label: 'Apfel' }, { icon: '🧪', label: 'Trank' },
            { icon: '🪃', label: 'Bogen' }, { icon: '💣', label: 'TNT' },
            { icon: '🔦', label: 'Fackel' }
        ];
        hotbar.innerHTML = '';
        items.forEach((item, i) => {
            const slot = document.createElement('div');
            slot.className = 'hotbar-slot' + (i === 0 ? ' active' : '');
            slot.innerHTML = `<span class="icon">${item.icon}</span>`;
            slot.title = item.label;
            slot.addEventListener('click', () => {
                document.querySelectorAll('.hotbar-slot').forEach(s => s.classList.remove('active'));
                slot.classList.add('active');
            });
            hotbar.appendChild(slot);
        });
    }

    function updateHealth(hp, maxHp) {
        const hearts = maxHp / 2;
        const filled = hp / 2;
        heartEls.forEach((el, i) => {
            const svg = el.querySelector('path');
            if (i < hearts) {
                el.style.display = '';
                if (i + 1 <= filled) {
                    svg.setAttribute('fill', '#e53935');
                } else if (i + 0.5 <= filled) {
                    svg.setAttribute('fill', 'url(#half)');
                    svg.setAttribute('fill', '#e53935'); // simplified: just half opacity
                    el.style.opacity = '0.6';
                } else {
                    svg.setAttribute('fill', '#555');
                }
                if (i + 1 <= filled) el.style.opacity = '1';
                else if (i < filled) el.style.opacity = '0.6';
                else el.style.opacity = '0.3';
            } else {
                el.style.display = 'none';
            }
        });
    }

    function updateTime(t) {
        const hour = (t * 24 + 6) % 24;
        const h = Math.floor(hour);
        const m = Math.floor((hour - h) * 60);
        let phase;
        if (hour < 5 || hour > 21)  phase = '🌙 Nacht';
        else if (hour < 8)  phase = '🌅 Morgenröte';
        else if (hour < 17) phase = '☀️ Tag';
        else if (hour < 20) phase = '🌇 Abenddämmerung';
        else                phase = '🌆 Abend';
        document.getElementById('time-weather').innerHTML =
            `${phase}<br>${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    }

    function updateDebug(player, monsterCount) {
        const el = document.getElementById('debug-info');
        if (!el || !player) return;
        frames++;
        const now = performance.now();
        if (now - lastFpsTime > 500) { fps = Math.round(frames * 1000 / (now - lastFpsTime)); frames = 0; lastFpsTime = now; }
        const pos = player.position;
        const biome = Terrain.getBiomeAt(pos.x, pos.z);
        const biomeNames = { beach:'Strand', forest:'Wald', highland:'Hochland', mountain:'Berge', snow:'Schnee' };
        el.innerHTML = `FPS: ${fps}<br>X: ${pos.x.toFixed(1)} Y: ${pos.y.toFixed(1)} Z: ${pos.z.toFixed(1)}<br>Biom: ${biomeNames[biome]||biome}<br>Monster: ${monsterCount}`;
    }

    function showNotification(msg, duration) {
        const el = document.getElementById('notification');
        el.textContent = msg;
        el.style.opacity = '1';
        clearTimeout(notifTimer);
        notifTimer = setTimeout(() => { el.style.opacity = '0'; }, (duration || 3) * 1000);
    }

    function showDamage() {
        const ov = document.getElementById('damage-overlay');
        ov.style.background = 'rgba(200,0,0,0.35)';
        setTimeout(() => { ov.style.background = 'rgba(200,0,0,0)'; }, 400);
    }

    function showHeal() {
        const ov = document.getElementById('heal-overlay');
        ov.style.background = 'rgba(0,200,0,0.25)';
        setTimeout(() => { ov.style.background = 'rgba(0,200,0,0)'; }, 400);
    }

    function showExplosionEffect() {
        const ov = document.getElementById('damage-overlay');
        ov.style.background = 'rgba(255,140,0,0.6)';
        setTimeout(() => { ov.style.background = 'rgba(200,0,0,0.2)'; }, 100);
        setTimeout(() => { ov.style.background = 'rgba(200,0,0,0)'; }, 500);
    }

    function setNightVignette(intensity) {
        const el = document.getElementById('night-vignette');
        if (intensity > 0) {
            el.style.background = `radial-gradient(ellipse at center, transparent 30%, rgba(0,0,${Math.floor(intensity*30)},${intensity*0.7}) 100%)`;
        } else {
            el.style.background = 'none';
        }
    }

    function showHUD(show) { document.getElementById('hud').style.display = show ? 'block' : 'none'; }
    function showPause(show) { document.getElementById('pause-menu').style.display = show ? 'flex' : 'none'; }
    function showStart(show) { document.getElementById('start-screen').style.display = show ? 'flex' : 'none'; }
    function showLoading(show) { document.getElementById('loading').style.display = show ? 'flex' : 'none'; }
    function showGameOver(show, killCount, survived) {
        document.getElementById('game-over').style.display = show ? 'flex' : 'none';
        if (show) {
            document.getElementById('score-text').textContent =
                `${killCount} Monster besiegt | ${Math.floor(survived)}s überlebt`;
        }
    }

    function setLoadingProgress(pct, msg) {
        document.getElementById('progress-fill').style.width = pct + '%';
        if (msg) document.getElementById('loading-status').textContent = msg;
    }

    function updateBossBar(name, pct) {
        const bar = document.getElementById('boss-bar');
        if (pct !== null) {
            bar.style.display = 'block';
            document.getElementById('boss-name').textContent = name;
            document.getElementById('boss-fill').style.width = (pct * 100) + '%';
        } else {
            bar.style.display = 'none';
        }
    }

    return { init, updateHealth, updateTime, updateDebug, showNotification,
             showDamage, showHeal, showExplosionEffect, setNightVignette,
             showHUD, showPause, showStart, showLoading, showGameOver,
             setLoadingProgress, updateBossBar };
})();
