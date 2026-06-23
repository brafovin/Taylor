'use strict';
window.Terrain = (function() {

    const WORLD_SIZE = 600;
    const SEGMENTS = 300;
    let noise, heightData = [], scene, terrainMesh, waterMesh, scene_ref;

    // Biome constants
    const BEACH_H = 1.5, GRASS_H = 18, HILL_H = 32, ROCK_H = 50, SNOW_H = 65;

    function getHeight(wx, wz) {
        const x = wx / WORLD_SIZE;
        const z = wz / WORLD_SIZE;
        const continent = noise.octave(x * 2, z * 2, 4, 0.5, 1) * 0.5 + 0.5;
        const detail    = noise.octave(x * 6, z * 6, 6, 0.55, 1) * 0.5 + 0.5;
        const mountain  = noise.ridged(x * 4 + 5, z * 4 + 5, 4, 0.5, 1);
        const flatness  = Math.max(0, 1.0 - continent * 2.5);
        let h = continent * 30 + detail * 20 + mountain * flatness * 45 - 8;
        // Smooth out center area for spawn safety
        const dist = Math.sqrt(wx * wx + wz * wz);
        if (dist < 40) h = h * (dist / 40) + 2 * (1 - dist / 40);
        return h;
    }

    function getBiome(h, wx, wz) {
        if (h < BEACH_H)  return 'beach';
        if (h < GRASS_H)  return 'forest';
        if (h < HILL_H)   return 'highland';
        if (h < ROCK_H)   return 'mountain';
        return 'snow';
    }

    // Realistic earth palette (linear-ish sRGB values)
    const PAL = {
        sandLow:  new THREE.Color(0.76, 0.68, 0.45),
        sand:     new THREE.Color(0.85, 0.78, 0.55),
        grass:    new THREE.Color(0.20, 0.46, 0.12),
        grassDry: new THREE.Color(0.34, 0.44, 0.16),
        highland: new THREE.Color(0.30, 0.40, 0.18),
        rock:     new THREE.Color(0.42, 0.39, 0.36),
        rockDark: new THREE.Color(0.30, 0.28, 0.26),
        snow:     new THREE.Color(0.94, 0.95, 0.98),
    };
    function smoothstep(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

    function heightToColor(h, ny, tint, out) {
        // ny ~1 => flat, ~0 => vertical cliff. Slope drives exposed rock.
        const slope = 1 - Math.max(0, Math.min(1, ny));
        const c = out || new THREE.Color();

        // Base ground colour by altitude, with smooth band transitions
        c.copy(PAL.sandLow).lerp(PAL.sand, smoothstep(-1, BEACH_H, h));
        c.lerp(PAL.grass,    smoothstep(BEACH_H - 0.5, BEACH_H + 2, h));
        c.lerp(PAL.highland, smoothstep(GRASS_H - 4, HILL_H, h));
        c.lerp(PAL.rock,     smoothstep(HILL_H - 2, ROCK_H, h));
        c.lerp(PAL.snow,     smoothstep(ROCK_H + 4, SNOW_H, h));

        // Steep ground turns to rock regardless of altitude (above the beach)
        if (h > BEACH_H + 1) {
            const rockMix = smoothstep(0.35, 0.62, slope);
            const rk = (h > ROCK_H) ? PAL.rock : PAL.rockDark;
            c.lerp(rk, rockMix * 0.85);
        }

        // Per-vertex coherent tint (from noise) for natural mottling, not random fuzz
        c.r = Math.max(0, Math.min(1, c.r * (1 + tint * 0.18)));
        c.g = Math.max(0, Math.min(1, c.g * (1 + tint * 0.16)));
        c.b = Math.max(0, Math.min(1, c.b * (1 + tint * 0.12)));
        return c;
    }

    function build(scene_in, seed) {
        scene_ref = scene_in;
        noise = new PerlinNoise(seed || 42);

        const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, SEGMENTS, SEGMENTS);
        geo.rotateX(-Math.PI / 2);

        const positions = geo.attributes.position;
        const colors = new Float32Array(positions.count * 3);
        const normals = geo.attributes.normal;

        heightData = [];
        // compute heights
        for (let i = 0; i < positions.count; i++) {
            const wx = positions.getX(i);
            const wz = positions.getZ(i);
            const h = getHeight(wx, wz);
            positions.setY(i, h);
            heightData.push({ x: wx, h, z: wz });
        }
        geo.computeVertexNormals();

        // vertex colors based on height + slope + coherent noise tint
        const tintNoise = new PerlinNoise((seed || 42) + 777);
        const tmpCol = new THREE.Color();
        for (let i = 0; i < positions.count; i++) {
            const wx = positions.getX(i), wz = positions.getZ(i);
            const h = positions.getY(i);
            const ny = normals.getY(i);
            const tint = tintNoise.octave(wx / 12, wz / 12, 3, 0.55, 1); // -1..1 coherent
            const col = heightToColor(h, ny, tint, tmpCol);
            colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
        }
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const mat = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.95,
            metalness: 0.0,
            envMapIntensity: 0.35,
            flatShading: false,
        });

        terrainMesh = new THREE.Mesh(geo, mat);
        terrainMesh.receiveShadow = true;
        terrainMesh.castShadow = false;
        scene_ref.add(terrainMesh);

        return terrainMesh;
    }

    function getHeightAt(wx, wz) {
        return getHeight(wx, wz);
    }

    function getBiomeAt(wx, wz) {
        return getBiome(getHeight(wx, wz), wx, wz);
    }

    // Returns array of good positions for vegetation/buildings
    function getSurfacePoints(count, minH, maxH, minDist) {
        const pts = [];
        const half = WORLD_SIZE * 0.45;
        let attempts = 0;
        while (pts.length < count && attempts < count * 20) {
            attempts++;
            const x = (Math.random() * 2 - 1) * half;
            const z = (Math.random() * 2 - 1) * half;
            const h = getHeight(x, z);
            if (h < minH || h > maxH) continue;
            if (Math.sqrt(x * x + z * z) < 15) continue; // keep spawn clear
            const tooClose = pts.some(p => Math.hypot(p.x - x, p.z - z) < (minDist || 2));
            if (tooClose) continue;
            pts.push({ x, y: h, z, biome: getBiome(h, x, z) });
        }
        return pts;
    }

    function getWorldSize() { return WORLD_SIZE; }

    return { build, getHeightAt, getBiomeAt, getSurfacePoints, getWorldSize };
})();
