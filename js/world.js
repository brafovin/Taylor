'use strict';
window.World = (function() {

    let scene, sky, water, sun, moon, stars, ambientLight, dirLight, hemiLight, waterMesh;
    let treeGroup, grassGroup, flowerGroup, villageGroup;
    const DAY_LENGTH = 1200; // seconds for full cycle
    let timeOfDay = 0.25; // 0=midnight 0.5=noon
    const _origin = new THREE.Vector3();

    // ── Sky & Atmosphere ──────────────────────────────────────────────────────
    function buildSky(scene_in) {
        scene = scene_in;

        // THREE.Sky
        if (THREE.Sky) {
            sky = new THREE.Sky();
            sky.scale.setScalar(10000);
            scene.add(sky);
            const skyUniforms = sky.material.uniforms;
            skyUniforms['turbidity'].value = 8;
            skyUniforms['rayleigh'].value = 2;
            skyUniforms['mieCoefficient'].value = 0.005;
            skyUniforms['mieDirectionalG'].value = 0.85;
        }

        // Sun sphere (visual only)
        const sunGeo = new THREE.SphereGeometry(14, 16, 16);
        const sunMat = new THREE.MeshBasicMaterial({ color: 0xfffde0 });
        sun = new THREE.Mesh(sunGeo, sunMat);
        scene.add(sun);

        // Moon sphere
        const moonGeo = new THREE.SphereGeometry(10, 16, 16);
        const moonMat = new THREE.MeshBasicMaterial({ map: GameTextures.get('moon'), color: 0xdde8ff });
        moon = new THREE.Mesh(moonGeo, moonMat);
        scene.add(moon);

        // Stars (visible at night)
        const starCount = 1800;
        const starGeo = new THREE.BufferGeometry();
        const starPos = new Float32Array(starCount * 3);
        for (let i = 0; i < starCount; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi   = Math.acos(2 * Math.random() - 1);
            const r = 4800 + Math.random() * 200;
            starPos[i*3]   = r * Math.sin(phi) * Math.cos(theta);
            starPos[i*3+1] = r * Math.cos(phi);
            starPos[i*3+2] = r * Math.sin(phi) * Math.sin(theta);
        }
        starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
        const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2.5, sizeAttenuation: true });
        stars = new THREE.Points(starGeo, starMat);
        scene.add(stars);

        // Clouds
        buildClouds();

        // Lights
        ambientLight = new THREE.AmbientLight(0x404060, 0.4);
        scene.add(ambientLight);

        dirLight = new THREE.DirectionalLight(0xfffbe0, 1.2);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.set(4096, 4096);
        dirLight.shadow.camera.near = 1;
        dirLight.shadow.camera.far = 600;
        // Tighter frustum focused near the player => crisper, higher-res shadows
        dirLight.shadow.camera.left = dirLight.shadow.camera.bottom = -120;
        dirLight.shadow.camera.right = dirLight.shadow.camera.top = 120;
        dirLight.shadow.bias = -0.0004;
        dirLight.shadow.normalBias = 0.04;
        dirLight.shadow.radius = 3; // soft penumbra
        scene.add(dirLight);
        scene.add(dirLight.target);

        // Soft sky/ground fill light (kept as a handle so it can follow the day cycle)
        hemiLight = new THREE.HemisphereLight(0x9ec8ff, 0x4a6b3c, 0.6);
        scene.add(hemiLight);
    }

    function buildClouds() {
        const cloudGroup = new THREE.Group();
        const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, transparent: true, opacity: 0.85 });
        for (let i = 0; i < 22; i++) {
            const cloud = new THREE.Group();
            const pieces = 4 + Math.random() * 5 | 0;
            for (let j = 0; j < pieces; j++) {
                const w = 30 + Math.random() * 60, h = 12 + Math.random() * 16, d = 20 + Math.random() * 40;
                const geo = new THREE.BoxGeometry(w, h, d);
                const m = new THREE.Mesh(geo, cloudMat);
                m.position.set((Math.random() - 0.5) * 50, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 30);
                cloud.add(m);
            }
            const angle = Math.random() * Math.PI * 2;
            const dist  = 80 + Math.random() * 220;
            cloud.position.set(Math.cos(angle) * dist, 130 + Math.random() * 50, Math.sin(angle) * dist);
            cloud.userData.speed = (Math.random() - 0.5) * 0.02;
            cloudGroup.add(cloud);
        }
        scene.add(cloudGroup);
        cloudGroup.userData.isClouds = true;
        World._clouds = cloudGroup;
    }

    function updateSky(t) {
        // t: 0-1 (0=midnight, 0.25=sunrise, 0.5=noon, 0.75=sunset)
        const angle = t * Math.PI * 2 - Math.PI / 2;
        const r = 1200;
        const sx = Math.cos(angle) * r;
        const sy = Math.sin(angle) * r;

        sun.position.set(sx, sy, -r * 0.3);
        moon.position.set(-sx, -sy, r * 0.3);

        const elev = Math.max(0.001, sy / r); // sun elevation 0-1

        // Sky shader sun direction
        if (sky) {
            const phi   = THREE.MathUtils.degToRad(90 - elev * 90);
            const theta = 0;
            sky.material.uniforms['sunPosition'].value.setFromSphericalCoords(1, phi, theta);
        }

        // Sun light direction follows the sun; anchor the shadow frustum on the
        // player so the tight (high-res) shadow map always covers what you see.
        const sunDir = sun.position.clone().normalize();
        const focus = World._focus || _origin;
        dirLight.target.position.copy(focus);
        dirLight.position.copy(focus).addScaledVector(sunDir, 150);

        const day = elev > 0;
        const dawn = t > 0.2 && t < 0.35;
        const dusk = t > 0.65 && t < 0.8;

        if (day) {
            // Warm, golden light low on the horizon; neutral white at noon
            const golden = (dawn || dusk) ? 1 : 0;
            const r1 = 1.0, g1 = 0.97 - golden * 0.22, b1 = 0.88 - golden * 0.45;
            dirLight.color.setRGB(r1, g1, b1);
            // Sun is brightest overhead; physically-correct-ish ramp
            dirLight.intensity = Math.min(2.8, 0.5 + elev * 3.0);
            // Sky bounce light kept modest because the env map already adds IBL
            ambientLight.intensity = 0.15 + elev * 0.2;
            ambientLight.color.setHex((dawn || dusk) ? 0xffc080 : 0x90b8e0);
            if (hemiLight) {
                hemiLight.intensity = 0.3 + elev * 0.35;
                hemiLight.color.setHex((dawn || dusk) ? 0xffd0a0 : 0xaed6ff);
            }
        } else {
            // Cool, dim moonlight
            dirLight.intensity = 0.12;
            dirLight.color.setHex(0x90a8d8);
            ambientLight.intensity = 0.08;
            ambientLight.color.setHex(0x101830);
            if (hemiLight) { hemiLight.intensity = 0.12; hemiLight.color.setHex(0x2a3a5a); }
        }

        // Stars visibility
        stars.material.opacity = Math.max(0, 1 - elev * 4);
        stars.material.transparent = true;
        sun.material.opacity = Math.max(0, Math.min(1, elev * 5));
        sun.material.transparent = true;

        // Moon glow at night
        moon.material.opacity = Math.max(0, Math.min(1, (-sy / r) * 3));
        moon.material.transparent = true;

        // Atmospheric haze (exponential): thin & blue by day, thick & dark at night
        if (dawn || dusk) {
            scene.fog.color.setHex(0xe8946a);
            scene.fog.density = 0.0042;
        } else if (day) {
            // Blend toward the actual sky tint at the horizon
            scene.fog.color.setRGB(0.62, 0.74, 0.88);
            scene.fog.density = 0.0026 + (1 - elev) * 0.002;
        } else {
            scene.fog.color.setHex(0x05060c);
            scene.fog.density = 0.0075;
        }
    }

    // ── Water ──────────────────────────────────────────────────────────────────
    function buildWater(scene_in) {
        const waterGeo = new THREE.PlaneGeometry(800, 800, 60, 60);
        let built = false;
        if (THREE.Water) {
            try {
                const w = new THREE.Water(waterGeo, {
                    textureWidth: 512, textureHeight: 512,
                    waterNormals: GameTextures.get('waterNormals'),
                    sunDirection: new THREE.Vector3(0.5, 0.8, 0).normalize(),
                    sunColor: 0xffffff,
                    waterColor: 0x0d4f7a,
                    distortionScale: 3.2,
                    fog: !!scene_in.fog,
                });
                w.rotation.x = -Math.PI / 2;
                w.position.y = 0.2;
                scene_in.add(w);
                waterMesh = w;
                built = true;
            } catch (e) {
                console.warn('THREE.Water failed, using fallback:', e);
            }
        }
        if (!built) {
            // Fallback: animated water plane with custom shader
            const mat = new THREE.ShaderMaterial({
                uniforms: {
                    time: { value: 0 },
                    color: { value: new THREE.Color(0x1a6fa8) },
                    sunDir: { value: new THREE.Vector3(0.5, 0.8, 0).normalize() },
                },
                vertexShader: `
                    uniform float time;
                    varying vec2 vUv;
                    varying vec3 vNormal;
                    void main() {
                        vUv = uv;
                        vec3 p = position;
                        p.z += sin(p.x * 0.3 + time) * 0.3 + sin(p.y * 0.2 + time * 1.3) * 0.2;
                        vNormal = normalMatrix * vec3(
                            -0.3 * cos(p.x * 0.3 + time),
                            1.0,
                            -0.2 * cos(p.y * 0.2 + time * 1.3)
                        );
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
                    }
                `,
                fragmentShader: `
                    uniform vec3 color;
                    uniform vec3 sunDir;
                    varying vec2 vUv;
                    varying vec3 vNormal;
                    void main() {
                        vec3 n = normalize(vNormal);
                        float diff = max(0.0, dot(n, sunDir));
                        float spec = pow(max(0.0, dot(reflect(-sunDir, n), vec3(0,0,1))), 32.0);
                        vec3 col = color * (0.5 + diff * 0.5) + vec3(spec * 0.6);
                        gl_FragColor = vec4(col, 0.84);
                    }
                `,
                transparent: true, side: THREE.FrontSide,
            });
            const m = new THREE.Mesh(waterGeo, mat);
            m.rotation.x = -Math.PI / 2;
            m.position.y = 0.2;
            scene_in.add(m);
            waterMesh = m;
        }
        return waterMesh;
    }

    function updateWater(dt) {
        if (!waterMesh || !waterMesh.material || !waterMesh.material.uniforms) return;
        const u = waterMesh.material.uniforms;
        if (u.time !== undefined) u.time.value += dt * 0.5;
        // Track the sun so glints/specular on the water move through the day
        if (sun) {
            const sd = sun.position.clone().normalize();
            if (u.sunDirection) u.sunDirection.value.copy(sd);
            else if (u.sunDir) u.sunDir.value.copy(sd);
            // Tint the water darker & cooler at night
            const day = sun.position.y > 0;
            if (u.waterColor) u.waterColor.value.setHex(day ? 0x0d4f7a : 0x06243a);
            else if (u.color) u.color.value.setHex(day ? 0x1a6fa8 : 0x0a3050);
        }
    }

    // ── Vegetation ──────────────────────────────────────────────────────────────
    function buildVegetation(scene_in) {
        treeGroup   = new THREE.Group();
        grassGroup  = new THREE.Group();
        flowerGroup = new THREE.Group();

        // Bark + leaf materials
        const barkMat = new THREE.MeshStandardMaterial({ map: GameTextures.get('bark'), roughness: 0.9 });
        const leafMat = new THREE.MeshStandardMaterial({ map: GameTextures.get('leaf'), roughness: 0.85, side: THREE.DoubleSide });
        const leafMat2 = new THREE.MeshStandardMaterial({ color: 0x1e6b1a, roughness: 0.9, side: THREE.DoubleSide });

        // Oak trees
        const treePts = Terrain.getSurfacePoints(160, 2, 18, 10);
        treePts.forEach(p => {
            const t = buildOakTree(barkMat, p.biome === 'forest' ? leafMat : leafMat2);
            t.position.set(p.x, p.y, p.z);
            treeGroup.add(t);
        });

        // Spruce trees (on higher ground)
        const sprucePts = Terrain.getSurfacePoints(80, 15, 35, 14);
        const spruceMat = new THREE.MeshStandardMaterial({ color: 0x124512, roughness: 0.9 });
        sprucePts.forEach(p => {
            const t = buildSpruceTree(barkMat, spruceMat);
            t.position.set(p.x, p.y, p.z);
            treeGroup.add(t);
        });

        // Grass tufts (instanced)
        const grassPts = Terrain.getSurfacePoints(2000, 1.5, 16, 1.5);
        const grassGeo = new THREE.PlaneGeometry(0.6, 1.2);
        const grassMat = new THREE.MeshStandardMaterial({ color: 0x3a8c2a, side: THREE.DoubleSide, alphaTest: 0.3 });
        const grassMesh = new THREE.InstancedMesh(grassGeo, grassMat, grassPts.length * 3);
        grassMesh.castShadow = false; grassMesh.receiveShadow = true;
        const dummy = new THREE.Object3D();
        let gi = 0;
        grassPts.forEach(p => {
            for (let k = 0; k < 3; k++) {
                dummy.position.set(p.x + (Math.random()-0.5)*1.5, p.y + 0.6, p.z + (Math.random()-0.5)*1.5);
                dummy.rotation.y = Math.random() * Math.PI * 2;
                dummy.scale.set(0.8 + Math.random()*0.5, 0.7 + Math.random()*0.6, 1);
                dummy.updateMatrix();
                grassMesh.setMatrixAt(gi++, dummy.matrix);
            }
        });
        grassMesh.instanceMatrix.needsUpdate = true;
        grassGroup.add(grassMesh);

        // Flowers (instanced, multiple colors)
        const flowerColors = [0xff4444, 0xff9900, 0xffdd00, 0xff66cc, 0xffffff, 0x9966ff];
        const flowerPts = Terrain.getSurfacePoints(400, 1.5, 14, 3);
        flowerPts.forEach(p => {
            const col = flowerColors[Math.floor(Math.random() * flowerColors.length)];
            const flower = buildFlower(col);
            flower.position.set(p.x, p.y, p.z);
            flowerGroup.add(flower);
        });

        scene_in.add(treeGroup);
        scene_in.add(grassGroup);
        scene_in.add(flowerGroup);
    }

    function buildOakTree(barkMat, leafMat) {
        const g = new THREE.Group();
        const scale = 0.8 + Math.random() * 0.6;
        const h = (7 + Math.random() * 4) * scale;

        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3*scale, 0.45*scale, h, 8), barkMat);
        trunk.position.y = h / 2;
        trunk.castShadow = true;
        g.add(trunk);

        // Leaf clusters
        const leafH = h + 1;
        const leavesMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(3.5 * scale, 1), leafMat);
        leavesMesh.position.y = leafH + 1;
        leavesMesh.castShadow = true;
        g.add(leavesMesh);
        const side = new THREE.Mesh(new THREE.IcosahedronGeometry(2.8 * scale, 1), leafMat);
        side.position.set(1.5*scale, leafH - 0.5, 0); g.add(side);
        const side2 = new THREE.Mesh(new THREE.IcosahedronGeometry(2.5 * scale, 1), leafMat);
        side2.position.set(-1.2*scale, leafH - 1, 1.2*scale); g.add(side2);

        return g;
    }

    function buildSpruceTree(barkMat, leafMat) {
        const g = new THREE.Group();
        const scale = 0.9 + Math.random() * 0.5;
        const h = (10 + Math.random() * 5) * scale;

        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25*scale, 0.38*scale, h, 7), barkMat);
        trunk.position.y = h / 2; trunk.castShadow = true; g.add(trunk);

        const layers = 5;
        for (let i = 0; i < layers; i++) {
            const t = i / (layers - 1);
            const r = (3 - t * 2) * scale;
            const cone = new THREE.Mesh(new THREE.ConeGeometry(r, 3 * scale, 8), leafMat);
            cone.position.y = h * 0.35 + i * h * 0.13;
            cone.castShadow = true; g.add(cone);
        }
        return g;
    }

    function buildFlower(color) {
        const g = new THREE.Group();
        const stemMat = new THREE.MeshStandardMaterial({ color: 0x3a7a20 });
        const petalMat = new THREE.MeshStandardMaterial({ color, roughness: 0.8, side: THREE.DoubleSide });
        const centerMat = new THREE.MeshStandardMaterial({ color: 0xffcc00 });

        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.7, 5), stemMat);
        stem.position.y = 0.35; g.add(stem);

        const petals = 5 + Math.floor(Math.random() * 3);
        for (let i = 0; i < petals; i++) {
            const petal = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.35), petalMat);
            petal.position.set(
                Math.cos(i / petals * Math.PI * 2) * 0.22, 0.72,
                Math.sin(i / petals * Math.PI * 2) * 0.22
            );
            petal.rotation.y = i / petals * Math.PI * 2;
            petal.rotation.x = Math.PI / 2.5;
            g.add(petal);
        }
        const center = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), centerMat);
        center.position.y = 0.75; g.add(center);
        return g;
    }

    // ── Houses / Village ───────────────────────────────────────────────────────
    function buildVillage(scene_in) {
        villageGroup = new THREE.Group();
        const villagePts = Terrain.getSurfacePoints(10, 3, 15, 25);

        const brickMat = new THREE.MeshStandardMaterial({ map: GameTextures.get('brick'), roughness: 0.85 });
        const woodMat  = new THREE.MeshStandardMaterial({ map: GameTextures.get('wood'),  roughness: 0.9 });
        const roofMat  = new THREE.MeshStandardMaterial({ map: GameTextures.get('roof'),  roughness: 0.85 });
        const winMat   = new THREE.MeshStandardMaterial({ map: GameTextures.get('window'), transparent: true, opacity: 0.85 });

        villagePts.forEach(p => {
            const house = buildHouse(brickMat, woodMat, roofMat, winMat);
            house.position.set(p.x, p.y, p.z);
            house.rotation.y = Math.random() * Math.PI * 2;
            villageGroup.add(house);
        });

        scene_in.add(villageGroup);
    }

    function buildHouse(brickMat, woodMat, roofMat, winMat) {
        const g = new THREE.Group();
        const w = 7 + Math.random() * 4;
        const d = 6 + Math.random() * 3;
        const h = 5 + Math.random() * 2;

        // Walls
        const wallGeo = new THREE.BoxGeometry(w, h, d);
        const walls = new THREE.Mesh(wallGeo, brickMat);
        walls.position.y = h / 2; walls.castShadow = true; walls.receiveShadow = true; g.add(walls);

        // Roof (tent/gable)
        const roofGeo = new THREE.ConeGeometry(Math.max(w, d) * 0.75, h * 0.6, 4);
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.y = h + h * 0.3;
        roof.rotation.y = Math.PI / 4;
        roof.castShadow = true; g.add(roof);

        // Door
        const doorMat = new THREE.MeshStandardMaterial({ color: 0x5a3010, roughness: 0.9 });
        const door = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.15), doorMat);
        door.position.set(0, 1.1, d / 2 + 0.05); g.add(door);

        // Windows (front)
        const positions = [
            [-w * 0.28, h * 0.55, d / 2 + 0.05],
            [ w * 0.28, h * 0.55, d / 2 + 0.05],
            [-w * 0.28, h * 0.55, -d / 2 - 0.05],
            [ w * 0.28, h * 0.55, -d / 2 - 0.05],
        ];
        positions.forEach((pos, i) => {
            const win = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), winMat);
            win.position.set(...pos);
            if (i >= 2) win.rotation.y = Math.PI;
            g.add(win);
        });

        // Side windows
        const sideWin1 = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), winMat);
        sideWin1.position.set(w / 2 + 0.05, h * 0.55, 0);
        sideWin1.rotation.y = Math.PI / 2; g.add(sideWin1);
        const sideWin2 = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), winMat);
        sideWin2.position.set(-w / 2 - 0.05, h * 0.55, 0);
        sideWin2.rotation.y = -Math.PI / 2; g.add(sideWin2);

        // Light inside (emissive window glow at night) - candela values for
        // physically correct falloff
        const glow = new THREE.PointLight(0xffb35a, 0, 14, 2);
        glow.position.set(0, h * 0.55, 0);
        glow.userData.isWindowLight = true;
        g.add(glow);

        // Foundation
        const foundGeo = new THREE.BoxGeometry(w + 0.5, 0.5, d + 0.5);
        const found = new THREE.Mesh(foundGeo, new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.95 }));
        found.position.y = 0.25; found.receiveShadow = true; g.add(found);

        return g;
    }

    function updateWindowLights(isNight) {
        if (!villageGroup) return;
        villageGroup.traverse(obj => {
            if (obj.userData.isWindowLight) {
                obj.intensity = isNight ? (28 + Math.sin(Date.now() * 0.001) * 4) : 0;
            }
        });
    }

    // ── Animate clouds ─────────────────────────────────────────────────────────
    function animateClouds(dt) {
        if (!World._clouds) return;
        World._clouds.children.forEach(cloud => {
            cloud.position.x += cloud.userData.speed * dt * 10;
            if (Math.abs(cloud.position.x) > 280) cloud.position.x *= -1;
        });
    }

    // Let the game loop tell us where the player is so shadows can follow them
    function setFocus(pos) {
        if (!World._focus) World._focus = new THREE.Vector3();
        World._focus.copy(pos);
    }

    return {
        buildSky, buildWater, buildVegetation, buildVillage,
        updateSky, updateWater, updateWindowLights, animateClouds, setFocus,
        get sky() { return sky; },
        get water() { return waterMesh; },
        get sun() { return sun; },
        get moon() { return moon; },
        get dirLight() { return dirLight; },
        get hemiLight() { return hemiLight; },
        _clouds: null,
        _focus: null,
    };
})();
