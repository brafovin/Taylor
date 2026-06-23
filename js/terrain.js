'use strict';
window.Terrain = (function() {

    const WORLD_SIZE = 600;
    const SEGMENTS = 220;
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

    function heightToColor(h, nx, ny) {
        const lighting = Math.max(0.4, ny * 0.6 + nx * 0.1 + 0.4);
        let r, g, b;
        if (h < -2) {         r = 0.06; g = 0.20; b = 0.55; }  // deep water (shouldn't show)
        else if (h < BEACH_H) { r = 0.82; g = 0.75; b = 0.50; } // sand
        else if (h < GRASS_H) { r = 0.22; g = 0.52; b = 0.12; } // grass
        else if (h < HILL_H)  { r = 0.30; g = 0.44; b = 0.18; } // highland grass
        else if (h < ROCK_H)  { r = 0.48; g = 0.44; b = 0.40; } // rock
        else                   { r = 0.92; g = 0.93; b = 0.96; } // snow

        // blend with actual noise-texture detail
        const jitter = (Math.random() - 0.5) * 0.04;
        return new THREE.Color(
            Math.max(0, Math.min(1, (r + jitter) * lighting)),
            Math.max(0, Math.min(1, (g + jitter) * lighting)),
            Math.max(0, Math.min(1, (b + jitter) * lighting))
        );
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

        // vertex colors based on height + normal
        for (let i = 0; i < positions.count; i++) {
            const h = positions.getY(i);
            const nx = normals.getX(i), ny = normals.getY(i);
            const col = heightToColor(h, nx, ny);
            colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
        }
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const mat = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.88,
            metalness: 0.04,
            envMapIntensity: 0.6,
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
