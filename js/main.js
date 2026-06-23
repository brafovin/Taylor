'use strict';

// ──────────────────────────────────────────────────────────────────────────────
// Game State Manager
// ──────────────────────────────────────────────────────────────────────────────
window.GameState = (function() {
    const state = {
        scene: null, renderer: null, camera: null, composer: null,
        playerBody: null, playerVel: new THREE.Vector3(),
        onGround: false, wasOnGround: false,
        hp: 20, maxHp: 20, alive: true,
        timeOfDay: 0.28, // start just after sunrise
        dayCycle: true,
        daySpeed: 1 / 1200, // full day in 20 min
        isNight: false,
        killCount: 0, surviveTime: 0,
        maxMonsters: 18,
        spawnTimer: 0, spawnInterval: 8,
        debugMode: false,
        paused: false, gameActive: false,
        regenTimer: 0, regenInterval: 5,
        seed: Math.random() * 999999 | 0,
    };

    return {
        get: () => state,
        pause() { state.paused = true; GameUI.showPause(true); Controls.unlock(); },
        resume() { state.paused = false; GameUI.showPause(false); if (!Controls.getIsMobile()) Controls.lock(); },
        showMenu() { location.reload(); },
        respawn() {
            state.hp = state.maxHp; state.alive = true; state.killCount = 0; state.surviveTime = 0;
            GameUI.showGameOver(false);
            const x = 0, z = 0;
            const y = Terrain.getHeightAt(x, z) + 2;
            state.playerBody.position.set(x, y, z);
            state.playerVel.set(0, 0, 0);
            GameUI.updateHealth(state.hp, state.maxHp);
            GameUI.showNotification('Willkommen zurück, Kämpfer!');
            if (!Controls.getIsMobile()) Controls.lock();
        },
        startGame() {
            GameUI.showStart(false);
            GameUI.showHUD(true);
            state.gameActive = true;
            if (!Controls.getIsMobile()) Controls.lock();
            GameUI.showNotification('Überlebe die Nacht! 🌙');
        },
        toggleDebug() { state.debugMode = !state.debugMode; },
        onMonsterAttack(dmg) {
            if (!state.alive || !state.gameActive) return;
            state.hp = Math.max(0, state.hp - dmg);
            GameUI.updateHealth(state.hp, state.maxHp);
            GameUI.showDamage();
            if (state.hp <= 0) {
                state.alive = false;
                setTimeout(() => {
                    GameUI.showGameOver(true, state.killCount, state.surviveTime);
                    GameUI.showHUD(false);
                    Controls.unlock();
                }, 800);
            }
        },
        playerAttack() {
            if (!state.alive || !state.gameActive) return;
            const ppos = state.camera.getWorldPosition(new THREE.Vector3());
            const dir  = new THREE.Vector3(0, 0, -1).applyQuaternion(state.camera.getWorldQuaternion(new THREE.Quaternion()));
            const ray  = new THREE.Ray(ppos, dir);
            let closest = null, closestDist = 6;
            Monsters.getActive().forEach(m => {
                if (!m.alive || m.isVillager) return;
                const d = ray.distanceToPoint(m.mesh.position);
                const dist = ppos.distanceTo(m.mesh.position);
                if (d < 1.5 && dist < closestDist) { closest = m; closestDist = dist; }
            });
            if (closest) {
                const dmg = 7 + Math.floor(Math.random() * 5);
                closest.takeDamage(dmg);
                if (!closest.alive) {
                    state.killCount++;
                    GameUI.showNotification(`${closest.type} besiegt! (${state.killCount} total)`);
                }
            }
        },
    };
})();

// ──────────────────────────────────────────────────────────────────────────────
// Main Entry Point
// ──────────────────────────────────────────────────────────────────────────────
(async function main() {
    const S = GameState.get();
    GameUI.showLoading(true);
    GameUI.setLoadingProgress(5, 'Three.js wird geladen...');

    await tick(); // let browser paint loading screen

    // ── Renderer ───────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', stencil: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputEncoding = THREE.sRGBEncoding;
    // Physically correct light falloff for more believable shading
    renderer.physicallyCorrectLights = true;
    document.body.appendChild(renderer.domElement);
    S.renderer = renderer;

    // Build a soft sky environment map so PBR materials pick up realistic
    // ambient reflections instead of looking flat.
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    S.pmrem = pmrem;

    // ── Scene ──────────────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    // Exponential fog reads as real atmospheric haze (denser with distance)
    scene.fog = new THREE.FogExp2(0xaaccee, 0.0035);
    S.scene = scene;

    // ── Camera ─────────────────────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 800);
    S.camera = camera;

    // Player body (invisible, used for movement)
    const playerBody = new THREE.Object3D();
    scene.add(playerBody);
    playerBody.add(camera);
    camera.position.set(0, 1.7, 0); // eye height
    S.playerBody = playerBody;

    GameUI.setLoadingProgress(15, 'Welt wird generiert...');
    await tick();

    // ── Terrain ────────────────────────────────────────────────────────────────
    Terrain.build(scene, S.seed);
    GameUI.setLoadingProgress(35, 'Himmel und Wasser...');
    await tick();

    // ── Sky & Atmosphere ───────────────────────────────────────────────────────
    World.buildSky(scene);
    World.buildWater(scene);

    // Capture the procedural sky into an environment map so every PBR material
    // gets believable ambient reflections / image-based lighting.
    World.updateSky(S.timeOfDay);
    try {
        if (World.sky) {
            const envRT = pmrem.fromScene(World.sky, 0, 1, 1000);
            scene.environment = envRT.texture;
        }
    } catch (e) { console.warn('Env map generation failed:', e); }

    GameUI.setLoadingProgress(50, 'Wald und Pflanzen...');
    await tick();

    // ── Vegetation ─────────────────────────────────────────────────────────────
    World.buildVegetation(scene);
    GameUI.setLoadingProgress(65, 'Dorf wird gebaut...');
    await tick();

    // ── Village ────────────────────────────────────────────────────────────────
    World.buildVillage(scene);
    GameUI.setLoadingProgress(78, 'Monster werden beschworen...');
    await tick();

    // ── Monsters & Villagers ───────────────────────────────────────────────────
    Monsters.init(scene, playerBody);
    Monsters.spawnVillagers(6);
    // Spawn initial monsters away from spawn
    for (let i = 0; i < 8; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist  = 50 + Math.random() * 80;
        Monsters.spawnMonster(null, Math.cos(angle) * dist, Math.sin(angle) * dist);
    }

    GameUI.setLoadingProgress(88, 'Steuerung wird geladen...');
    await tick();

    // ── Controls ───────────────────────────────────────────────────────────────
    Controls.init(camera, renderer.domElement, playerBody);

    // ── Post-processing ────────────────────────────────────────────────────────
    let composer = null;
    if (THREE.EffectComposer && THREE.RenderPass && THREE.UnrealBloomPass) {
        try {
            composer = new THREE.EffectComposer(renderer);
            composer.addPass(new THREE.RenderPass(scene, camera));
            // Subtle bloom: only bright highlights (sun, glow) bloom, not the whole scene
            const bloom = new THREE.UnrealBloomPass(
                new THREE.Vector2(window.innerWidth, window.innerHeight),
                0.22,  // strength
                0.4,   // radius
                0.85   // threshold (only bright pixels)
            );
            composer.addPass(bloom);
            S.composer = composer;
        } catch (e) { console.warn('Post-processing unavailable:', e); }
    }

    // Set spawn position
    const spawnY = Terrain.getHeightAt(0, 0) + 2;
    playerBody.position.set(0, spawnY, 0);

    GameUI.setLoadingProgress(100, 'Bereit!');
    GameUI.init();
    await tick(300);

    GameUI.showLoading(false);
    GameUI.showStart(true);

    // ── Resize ──────────────────────────────────────────────────────────────────
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        if (composer) composer.setSize(window.innerWidth, window.innerHeight);
    });

    // ── Game Loop ───────────────────────────────────────────────────────────────
    let lastTime = 0;
    function animate(now) {
        requestAnimationFrame(animate);
        const dt = Math.min(0.05, (now - lastTime) / 1000);
        lastTime = now;

        if (!S.gameActive || S.paused) {
            if (composer) composer.render();
            else renderer.render(scene, camera);
            return;
        }

        S.surviveTime += dt;
        S.timeOfDay = (S.timeOfDay + S.daySpeed * dt) % 1;

        updateSkyAndTime(dt);
        updatePlayer(dt);
        updateMonsters(dt);
        updateRegen(dt);
        updateSpawner(dt);

        if (S.debugMode) GameUI.updateDebug(playerBody, Monsters.getCount());

        if (composer) composer.render();
        else renderer.render(scene, camera);
    }
    requestAnimationFrame(animate);

    // ── Update functions ────────────────────────────────────────────────────────
    function updateSkyAndTime(dt) {
        World.setFocus(playerBody.position);
        World.updateSky(S.timeOfDay);
        World.updateWater(dt);
        World.animateClouds(dt);
        GameUI.updateTime(S.timeOfDay);

        const hour = (S.timeOfDay * 24 + 6) % 24;
        const newNight = hour < 5 || hour > 20;
        if (newNight !== S.isNight) {
            S.isNight = newNight;
            if (S.isNight) {
                GameUI.showNotification('🌙 Die Nacht bricht an - Monster erscheinen!');
                S.spawnInterval = 4;
                S.maxMonsters = 24;
            } else {
                GameUI.showNotification('☀️ Ein neuer Tag beginnt!');
                S.spawnInterval = 8;
                S.maxMonsters = 12;
            }
        }
        GameUI.setNightVignette(S.isNight ? 0.6 : 0);
        World.updateWindowLights(S.isNight);
    }

    function updatePlayer(dt) {
        if (!S.alive) return;
        const mv = Controls.getMovement();
        const SPEED = (mv.sprint ? 9 : 5);
        const GRAVITY = -22;
        const JUMP   = 7.5;
        const PLAYER_H = 1.8;

        // Horizontal movement in camera direction
        const forward = new THREE.Vector3(-Math.sin(playerBody.rotation.y), 0, -Math.cos(playerBody.rotation.y));
        const right   = new THREE.Vector3( Math.cos(playerBody.rotation.y), 0, -Math.sin(playerBody.rotation.y));

        const hv = new THREE.Vector3();
        hv.addScaledVector(forward, mv.forward * SPEED);
        hv.addScaledVector(right,   mv.right   * SPEED);
        playerBody.position.addScaledVector(hv, dt);

        // Gravity
        S.playerVel.y += GRAVITY * dt;

        // Jump
        if (mv.jump && S.onGround) {
            S.playerVel.y = JUMP;
            S.onGround = false;
        }

        playerBody.position.y += S.playerVel.y * dt;

        // Ground collision
        const groundY = Terrain.getHeightAt(playerBody.position.x, playerBody.position.z);
        if (playerBody.position.y <= groundY + 0.05) {
            playerBody.position.y = groundY;
            S.playerVel.y = 0;
            S.onGround = true;
        } else {
            S.onGround = playerBody.position.y <= groundY + 0.15;
        }

        // Footstep bob
        if (S.onGround && (Math.abs(mv.forward) > 0.1 || Math.abs(mv.right) > 0.1)) {
            const t = S.surviveTime * (mv.sprint ? 10 : 6);
            camera.position.y = 1.7 + Math.sin(t) * 0.04;
        } else {
            camera.position.y += (1.7 - camera.position.y) * 0.2;
        }

        // World boundary (soft bounce)
        const limit = Terrain.getWorldSize() * 0.47;
        playerBody.position.x = Math.max(-limit, Math.min(limit, playerBody.position.x));
        playerBody.position.z = Math.max(-limit, Math.min(limit, playerBody.position.z));
    }

    function updateMonsters(dt) {
        const playerPos = playerBody.position.clone();
        playerPos.y += 1;
        Monsters.update(dt, playerPos, camera, S.isNight);
    }

    function updateRegen(dt) {
        if (S.hp >= S.maxHp || !S.alive) return;
        S.regenTimer += dt;
        if (S.regenTimer >= S.regenInterval) {
            S.regenTimer = 0;
            S.hp = Math.min(S.maxHp, S.hp + 1);
            GameUI.updateHealth(S.hp, S.maxHp);
            if (S.hp > S.maxHp * 0.3) GameUI.showHeal();
        }
    }

    function updateSpawner(dt) {
        S.spawnTimer += dt;
        if (S.spawnTimer < S.spawnInterval) return;
        S.spawnTimer = 0;

        const currentCount = Monsters.getCount();
        if (currentCount >= S.maxMonsters) return;

        const canSpawn = S.isNight || Math.random() < 0.3;
        if (!canSpawn) return;

        const angle = Math.random() * Math.PI * 2;
        const dist  = 45 + Math.random() * 35;
        const px = playerBody.position.x + Math.cos(angle) * dist;
        const pz = playerBody.position.z + Math.sin(angle) * dist;

        const h = Terrain.getHeightAt(px, pz);
        if (h < 1.5) return;

        let type = null;
        if (S.isNight) {
            type = Monsters.TYPES[Math.floor(Math.random() * Monsters.TYPES.length)];
        } else {
            type = ['spider', 'zombie', 'slime'][Math.floor(Math.random() * 3)];
        }

        Monsters.spawnMonster(type, px, pz);
    }
})();

// Global async helper
function tick(ms) { return new Promise(r => setTimeout(r, ms || 0)); }
