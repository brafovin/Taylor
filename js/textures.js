'use strict';
// Procedural texture generation via Canvas API
window.GameTextures = (function() {
    function makeCanvas(size) {
        const c = document.createElement('canvas');
        c.width = c.height = size;
        return { c, ctx: c.getContext('2d') };
    }

    function canvasToTexture(canvas, repeat, wrapS, wrapT) {
        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        if (repeat) { tex.repeat.set(repeat, repeat); }
        tex.needsUpdate = true;
        return tex;
    }

    function grassTexture() {
        const { c, ctx } = makeCanvas(256);
        const noise = new PerlinNoise(101);
        const img = ctx.createImageData(256, 256);
        for (let y = 0; y < 256; y++) {
            for (let x = 0; x < 256; x++) {
                const n = noise.octave(x / 40, y / 40, 4, 0.5, 1);
                const v = Math.floor(80 + n * 60);
                const r = Math.max(0, v * 0.35 - 10 + (Math.random() * 4 | 0));
                const g = Math.min(255, v + 30 + (Math.random() * 8 | 0));
                const b = Math.max(0, v * 0.2 + (Math.random() * 4 | 0));
                const i = (y * 256 + x) * 4;
                img.data[i] = r; img.data[i+1] = g; img.data[i+2] = b; img.data[i+3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
        // Add subtle blade lines
        ctx.strokeStyle = 'rgba(0,80,0,0.15)';
        for (let i = 0; i < 60; i++) {
            ctx.beginPath();
            const px = Math.random() * 256, py = Math.random() * 256;
            ctx.moveTo(px, py);
            ctx.lineTo(px + (Math.random() - 0.5) * 6, py - Math.random() * 12);
            ctx.lineWidth = 1; ctx.stroke();
        }
        return canvasToTexture(c, 20);
    }

    function dirtTexture() {
        const { c, ctx } = makeCanvas(128);
        const noise = new PerlinNoise(202);
        const img = ctx.createImageData(128, 128);
        for (let y = 0; y < 128; y++) {
            for (let x = 0; x < 128; x++) {
                const n = noise.octave(x / 20, y / 20, 3, 0.6, 1);
                const v = Math.floor(90 + n * 50);
                const i = (y * 128 + x) * 4;
                img.data[i]   = Math.min(255, v);
                img.data[i+1] = Math.floor(v * 0.55);
                img.data[i+2] = Math.floor(v * 0.2);
                img.data[i+3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
        return canvasToTexture(c, 15);
    }

    function rockTexture() {
        const { c, ctx } = makeCanvas(128);
        const noise = new PerlinNoise(303);
        const img = ctx.createImageData(128, 128);
        for (let y = 0; y < 128; y++) {
            for (let x = 0; x < 128; x++) {
                const n = noise.octave(x / 15, y / 15, 4, 0.5, 1);
                const v = Math.floor(110 + n * 60);
                const i = (y * 128 + x) * 4;
                img.data[i] = img.data[i+1] = img.data[i+2] = v; img.data[i+3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
        return canvasToTexture(c, 10);
    }

    function sandTexture() {
        const { c, ctx } = makeCanvas(128);
        const noise = new PerlinNoise(404);
        const img = ctx.createImageData(128, 128);
        for (let y = 0; y < 128; y++) {
            for (let x = 0; x < 128; x++) {
                const n = noise.octave(x / 25, y / 25, 3, 0.4, 1);
                const v = Math.floor(200 + n * 40);
                const i = (y * 128 + x) * 4;
                img.data[i] = Math.min(255, v);
                img.data[i+1] = Math.floor(v * 0.88);
                img.data[i+2] = Math.floor(v * 0.5);
                img.data[i+3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
        return canvasToTexture(c, 12);
    }

    function snowTexture() {
        const { c, ctx } = makeCanvas(64);
        const noise = new PerlinNoise(505);
        const img = ctx.createImageData(64, 64);
        for (let y = 0; y < 64; y++) {
            for (let x = 0; x < 64; x++) {
                const n = noise.octave(x / 10, y / 10, 2, 0.5, 1);
                const v = Math.floor(230 + n * 25);
                const i = (y * 64 + x) * 4;
                img.data[i] = img.data[i+1] = img.data[i+2] = v; img.data[i+3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
        return canvasToTexture(c, 8);
    }

    function brickTexture() {
        const { c, ctx } = makeCanvas(256);
        ctx.fillStyle = '#c0785a';
        ctx.fillRect(0, 0, 256, 256);
        ctx.strokeStyle = '#8a5540';
        ctx.lineWidth = 3;
        const bh = 28;
        for (let row = 0; row < Math.ceil(256 / bh); row++) {
            const y = row * bh;
            const off = (row % 2) * 64;
            for (let col = 0; col < 5; col++) {
                const x = col * 128 - off;
                ctx.strokeRect(x + 2, y + 2, 122, bh - 4);
            }
        }
        const noise = new PerlinNoise(606);
        const img = ctx.getImageData(0, 0, 256, 256);
        for (let i = 0; i < img.data.length; i += 4) {
            const p = (Math.random() - 0.5) * 15;
            img.data[i] = Math.max(0, Math.min(255, img.data[i] + p));
            img.data[i+1] = Math.max(0, Math.min(255, img.data[i+1] + p));
            img.data[i+2] = Math.max(0, Math.min(255, img.data[i+2] + p));
        }
        ctx.putImageData(img, 0, 0);
        return canvasToTexture(c, 4);
    }

    function woodTexture() {
        const { c, ctx } = makeCanvas(256);
        const noise = new PerlinNoise(707);
        const img = ctx.createImageData(256, 256);
        for (let y = 0; y < 256; y++) {
            for (let x = 0; x < 256; x++) {
                const grain = noise.noise(x / 5, y / 60) * 0.5 + noise.noise(x / 2, y / 20) * 0.3;
                const ring = Math.sin((x * x + y * y) * 0.0002 + grain * 3) * 0.5 + 0.5;
                const v = 120 + ring * 60 + grain * 20;
                const i = (y * 256 + x) * 4;
                img.data[i]   = Math.min(255, v);
                img.data[i+1] = Math.floor(v * 0.6);
                img.data[i+2] = Math.floor(v * 0.3);
                img.data[i+3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
        return canvasToTexture(c, 3);
    }

    function windowTexture() {
        const { c, ctx } = makeCanvas(64);
        // Glass with frame
        const grad = ctx.createLinearGradient(0, 0, 64, 64);
        grad.addColorStop(0, 'rgba(180,220,255,0.85)');
        grad.addColorStop(0.5, 'rgba(220,240,255,0.70)');
        grad.addColorStop(1, 'rgba(160,210,255,0.80)');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, 64, 64);
        // Frame
        ctx.strokeStyle = '#5a4020'; ctx.lineWidth = 6;
        ctx.strokeRect(3, 3, 58, 58);
        ctx.beginPath(); ctx.moveTo(32, 3); ctx.lineTo(32, 61); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(3, 32); ctx.lineTo(61, 32); ctx.stroke();
        // Reflection
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(8, 8, 18, 18);
        const tex = new THREE.CanvasTexture(c);
        tex.needsUpdate = true;
        return tex;
    }

    function roofTexture() {
        const { c, ctx } = makeCanvas(128);
        ctx.fillStyle = '#8b3a2a'; ctx.fillRect(0, 0, 128, 128);
        ctx.strokeStyle = '#6b2518'; ctx.lineWidth = 2;
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                const rx = x * 16 + (y % 2 ? 8 : 0);
                const ry = y * 16;
                ctx.fillStyle = `hsl(10, ${40 + Math.random()*15}%, ${30 + Math.random()*10}%)`;
                ctx.fillRect(rx, ry, 15, 14);
                ctx.strokeRect(rx, ry, 15, 14);
            }
        }
        return canvasToTexture(c, 2);
    }

    function leafTexture() {
        const { c, ctx } = makeCanvas(128);
        const noise = new PerlinNoise(808);
        const img = ctx.createImageData(128, 128);
        for (let y = 0; y < 128; y++) {
            for (let x = 0; x < 128; x++) {
                const n = noise.octave(x / 15, y / 15, 3, 0.5, 1);
                const v = 50 + n * 60;
                const i = (y * 128 + x) * 4;
                img.data[i]   = Math.floor(v * 0.35);
                img.data[i+1] = Math.floor(v + 30);
                img.data[i+2] = Math.floor(v * 0.15);
                img.data[i+3] = 220;
            }
        }
        ctx.putImageData(img, 0, 0);
        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(2, 2);
        tex.needsUpdate = true;
        return tex;
    }

    function barkTexture() {
        const { c, ctx } = makeCanvas(64);
        const noise = new PerlinNoise(909);
        const img = ctx.createImageData(64, 64);
        for (let y = 0; y < 64; y++) {
            for (let x = 0; x < 64; x++) {
                const n = noise.noise(x / 4, y / 10);
                const v = 60 + n * 40;
                const i = (y * 64 + x) * 4;
                img.data[i]   = Math.floor(v);
                img.data[i+1] = Math.floor(v * 0.55);
                img.data[i+2] = Math.floor(v * 0.25);
                img.data[i+3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
        return canvasToTexture(c, 2);
    }

    function waterNormalsTexture() {
        const { c, ctx } = makeCanvas(256);
        const noise = new PerlinNoise(1010);
        const img = ctx.createImageData(256, 256);
        for (let y = 0; y < 256; y++) {
            for (let x = 0; x < 256; x++) {
                const nx = noise.noise(x / 30, y / 30) * 0.5 + 0.5;
                const ny = noise.noise(x / 30 + 100, y / 30 + 100) * 0.5 + 0.5;
                const i = (y * 256 + x) * 4;
                img.data[i]   = Math.floor(nx * 255);
                img.data[i+1] = Math.floor(ny * 255);
                img.data[i+2] = 200;
                img.data[i+3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
        return canvasToTexture(c, 4);
    }

    function moonTexture() {
        const { c, ctx } = makeCanvas(128);
        ctx.fillStyle = '#111'; ctx.fillRect(0, 0, 128, 128);
        const noise = new PerlinNoise(1111);
        const img = ctx.createImageData(128, 128);
        const cx = 64, cy = 64, r = 56;
        for (let y = 0; y < 128; y++) {
            for (let x = 0; x < 128; x++) {
                const dx = x - cx, dy = y - cy;
                if (dx * dx + dy * dy > r * r) { const i = (y * 128 + x) * 4; img.data[i+3] = 0; continue; }
                const n = noise.octave(x / 20, y / 20, 3, 0.5, 1);
                const v = 200 + n * 40;
                const i = (y * 128 + x) * 4;
                img.data[i] = img.data[i+1] = img.data[i+2] = Math.floor(v); img.data[i+3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
        // Craters
        ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2;
        [[45,40,10],[80,70,7],[30,80,5],[75,35,8]].forEach(([x,y,r]) => {
            ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
        });
        const tex = new THREE.CanvasTexture(c); tex.needsUpdate = true; return tex;
    }

    const _cache = {};
    return {
        get(name) {
            if (!_cache[name]) {
                const makers = { grass: grassTexture, dirt: dirtTexture, rock: rockTexture,
                    sand: sandTexture, snow: snowTexture, brick: brickTexture, wood: woodTexture,
                    window: windowTexture, roof: roofTexture, leaf: leafTexture, bark: barkTexture,
                    waterNormals: waterNormalsTexture, moon: moonTexture };
                _cache[name] = makers[name] ? makers[name]() : null;
            }
            return _cache[name];
        }
    };
})();
