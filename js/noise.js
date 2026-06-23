'use strict';
// Classic Perlin Noise
window.PerlinNoise = function(seed) {
    const p = [];
    for (let i = 0; i < 256; i++) p[i] = i;
    let s = ((seed || 42) * 1664525 + 1013904223) & 0xffffffff;
    for (let i = 255; i > 0; i--) {
        s = (Math.imul(s, 1664525) + 1013904223) & 0xffffffff;
        const j = (s >>> 0) % (i + 1);
        [p[i], p[j]] = [p[j], p[i]];
    }
    const perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

    const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
    const lerp = (t, a, b) => a + t * (b - a);
    const grad = (h, x, y, z) => {
        h &= 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : (h === 12 || h === 14) ? x : z;
        return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
    };

    this.noise = function(x, y, z) {
        z = z || 0;
        const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
        x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
        const u = fade(x), v = fade(y), w = fade(z);
        const A = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z;
        const B = perm[X + 1] + Y, BA = perm[B] + Z, BB = perm[B + 1] + Z;
        return lerp(w,
            lerp(v,
                lerp(u, grad(perm[AA], x, y, z),     grad(perm[BA], x - 1, y, z)),
                lerp(u, grad(perm[AB], x, y - 1, z),  grad(perm[BB], x - 1, y - 1, z))),
            lerp(v,
                lerp(u, grad(perm[AA + 1], x, y, z - 1),   grad(perm[BA + 1], x - 1, y, z - 1)),
                lerp(u, grad(perm[AB + 1], x, y - 1, z - 1), grad(perm[BB + 1], x - 1, y - 1, z - 1))));
    };

    this.octave = function(x, y, octaves, persistence, scale) {
        let val = 0, amp = 1, freq = scale || 1, max = 0;
        for (let i = 0; i < octaves; i++) {
            val += this.noise(x * freq, y * freq) * amp;
            max += amp; amp *= persistence; freq *= 2;
        }
        return val / max;
    };

    this.ridged = function(x, y, octaves, persistence, scale) {
        let val = 0, amp = 1, freq = scale || 1, max = 0;
        for (let i = 0; i < octaves; i++) {
            const n = 1.0 - Math.abs(this.noise(x * freq, y * freq));
            val += n * n * amp;
            max += amp; amp *= persistence; freq *= 2;
        }
        return val / max;
    };
};
