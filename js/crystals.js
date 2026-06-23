'use strict';
window.Crystals = (function () {
    const EXPLODE_RADIUS = 7;
    const MAX_DAMAGE = 60;
    const BEAM_HEIGHT = 18;
    const MAX_CRYSTALS = 32;

    let scene = null;
    const crystalList = [];
    let autoCrystal = false;
    let autoCooldown = 0;
    let shakeTimer = 0;

    function init(sc) {
        scene = sc;
        document.addEventListener('keydown', e => {
            if (e.code === 'KeyG') toggleAuto();
            if (e.code === 'KeyR' && !e.repeat) placeFront();
        });
        document.addEventListener('contextmenu', e => { e.preventDefault(); placeFront(); });
    }

    function makeMesh() {
        const group = new THREE.Group();

        // Wireframe cage
        const cageGeo = new THREE.BoxGeometry(0.85, 0.85, 0.85);
        const cageMat = new THREE.MeshBasicMaterial({ color: 0x88ccff, wireframe: true, transparent: true, opacity: 0.55 });
        const cage = new THREE.Mesh(cageGeo, cageMat);
        group.add(cage);

        // Inner glowing octahedron
        const octGeo = new THREE.OctahedronGeometry(0.38);
        const octMat = new THREE.MeshStandardMaterial({
            color: 0xee88ff, emissive: 0xdd44ff, emissiveIntensity: 2.5,
            transparent: true, opacity: 0.92, roughness: 0.1, metalness: 0.2,
        });
        const oct = new THREE.Mesh(octGeo, octMat);
        group.add(oct);

        // Vertical beam
        const beamGeo = new THREE.CylinderGeometry(0.025, 0.025, BEAM_HEIGHT, 5);
        const beamMat = new THREE.MeshBasicMaterial({ color: 0xee88ff, transparent: true, opacity: 0.38 });
        const beam = new THREE.Mesh(beamGeo, beamMat);
        beam.position.y = BEAM_HEIGHT / 2;
        group.add(beam);

        // Base platform
        const baseGeo = new THREE.CylinderGeometry(0.55, 0.65, 0.14, 8);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x333344, roughness: 0.85 });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.y = -0.5;
        group.add(base);

        // Glow light
        const light = new THREE.PointLight(0xdd44ff, 10, 9, 2);
        group.add(light);

        group._cage = cage;
        group._oct = oct;
        group._beam = beam;
        group._light = light;
        return group;
    }

    function placeFront() {
        if (!window.GameState) return;
        const S = GameState.get();
        if (!S.alive || !S.gameActive) return;
        if (window.Inventory && !Inventory.consumeCrystal()) {
            GameUI.showNotification('Keine End-Kristalle im Inventar!');
            return;
        }
        if (crystalList.length >= MAX_CRYSTALS) {
            const old = crystalList.shift();
            scene.remove(old.mesh);
        }
        const pb = S.playerBody;
        const dir = new THREE.Vector3(-Math.sin(pb.rotation.y), 0, -Math.cos(pb.rotation.y));
        const pos = pb.position.clone().addScaledVector(dir, 2.6);
        pos.y = Terrain.getHeightAt(pos.x, pos.z) + 0.65;

        const mesh = makeMesh();
        mesh.position.copy(pos);
        scene.add(mesh);
        crystalList.push({ mesh, pos: pos.clone(), age: 0, alive: true });
        window.Multiplayer && Multiplayer.sendCrystal(pos);
    }

    function explodeCrystal(crystal, _source) {
        if (!crystal.alive) return;
        crystal.alive = false;
        scene.remove(crystal.mesh);

        const S = GameState.get();
        const ep = crystal.pos;

        // Damage player
        const dist = S.playerBody.position.distanceTo(ep);
        if (dist < EXPLODE_RADIUS) {
            const rawDmg = Math.round(MAX_DAMAGE * Math.pow(1 - dist / EXPLODE_RADIUS, 1.4));
            if (rawDmg > 0) {
                const def = window.Inventory ? Inventory.getTotalDefense() : 0;
                const dmg = Math.max(1, rawDmg - Math.floor(def * 0.4));
                const popped = window.Inventory && Inventory.tryTotemPop();
                if (!popped) GameState.onMonsterAttack(dmg);
                spawnDmgNumber(dmg);
            }
        }

        // Hurt monsters
        if (window.Monsters) {
            Monsters.getActive().forEach(m => {
                if (!m.alive) return;
                const d = m.mesh.position.distanceTo(ep);
                if (d < EXPLODE_RADIUS) {
                    const dmg = Math.round(40 * Math.pow(1 - d / EXPLODE_RADIUS, 1.2));
                    if (dmg > 0) m.takeDamage(dmg);
                }
            });
        }

        // Chain nearby crystals
        for (const c of crystalList) {
            if (c.alive && c !== crystal && c.pos.distanceTo(ep) < EXPLODE_RADIUS * 1.6) {
                setTimeout(() => explodeCrystal(c, 'chain'), 80 + Math.random() * 120);
            }
        }

        window.Multiplayer && Multiplayer.sendExplosion(ep);
        triggerVFX(ep);
        shakeTimer = 0.45;

        const idx = crystalList.indexOf(crystal);
        if (idx !== -1) crystalList.splice(idx, 1);
    }

    function triggerVFX(pos) {
        window.GameUI && GameUI.showExplosionEffect();

        const flash = new THREE.PointLight(0xffaa44, 90, 22, 2);
        flash.position.copy(pos);
        scene.add(flash);
        let f = 1;
        const tick = setInterval(() => {
            f -= 0.1;
            flash.intensity = 90 * f;
            if (f <= 0) { scene.remove(flash); clearInterval(tick); }
        }, 16);

        for (let i = 0; i < 14; i++) {
            const geo = new THREE.SphereGeometry(0.1 + Math.random() * 0.18, 4, 4);
            const mat = new THREE.MeshBasicMaterial({
                color: new THREE.Color().setHSL(0.72 + Math.random() * 0.22, 1, 0.68),
                transparent: true,
            });
            const mesh = new THREE.Mesh(geo, mat);
            const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.2, Math.random() - 0.5).normalize();
            const spd = 5 + Math.random() * 7;
            mesh.position.copy(pos);
            scene.add(mesh);
            let t = 0;
            const iv = setInterval(() => {
                t += 0.016;
                mesh.position.addScaledVector(dir, spd * 0.016);
                mesh.position.y -= 5 * t * 0.016;
                mat.opacity = Math.max(0, 1 - t * 2.2);
                if (t > 0.55) { scene.remove(mesh); clearInterval(iv); }
            }, 16);
        }
    }

    function spawnDmgNumber(dmg) {
        const el = document.createElement('div');
        el.textContent = '-' + dmg;
        el.style.cssText = [
            'position:fixed',
            `font-size:${16 + Math.min(dmg, 44)}px`,
            'font-weight:bold',
            'color:#ff4455',
            'text-shadow:1px 1px 4px #000',
            'pointer-events:none',
            'z-index:800',
            `left:${42 + Math.random() * 16}%`,
            `top:${34 + Math.random() * 14}%`,
            'transition:transform 0.9s ease-out,opacity 0.9s ease-out',
        ].join(';');
        document.body.appendChild(el);
        requestAnimationFrame(() => { el.style.transform = 'translateY(-55px)'; el.style.opacity = '0'; });
        setTimeout(() => el.remove(), 950);
    }

    function toggleAuto() {
        autoCrystal = !autoCrystal;
        const btn = document.getElementById('auto-crystal-btn');
        if (btn) btn.style.background = autoCrystal ? 'rgba(180,60,255,0.5)' : '';
        window.GameUI && GameUI.showNotification(autoCrystal ? '⚡ Auto-Crystal AN (G)' : '⚡ Auto-Crystal AUS (G)');
    }

    function tryHit(cam) {
        const S = GameState.get();
        if (!S.alive || !S.gameActive) return false;
        const ray = new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2(0, 0), cam);
        ray.far = 9;
        for (const c of crystalList) {
            if (!c.alive) continue;
            if (ray.intersectObject(c.mesh, true).length > 0) {
                explodeCrystal(c, 'player');
                return true;
            }
        }
        return false;
    }

    function addRemoteCrystal(pos) {
        const v = new THREE.Vector3(pos.x, pos.y, pos.z);
        if (crystalList.length >= MAX_CRYSTALS) { const old = crystalList.shift(); scene.remove(old.mesh); }
        const mesh = makeMesh();
        mesh.position.copy(v);
        scene.add(mesh);
        crystalList.push({ mesh, pos: v, age: 0, alive: true });
    }

    function triggerRemoteExplosion(pos) {
        const v = new THREE.Vector3(pos.x, pos.y, pos.z);
        let nearest = null, nearDist = 2.5;
        for (const c of crystalList) {
            const d = c.pos.distanceTo(v);
            if (c.alive && d < nearDist) { nearest = c; nearDist = d; }
        }
        if (nearest) explodeCrystal(nearest, 'remote');
        else triggerVFX(v);
    }

    function update(dt, playerBody, camera) {
        shakeTimer = Math.max(0, shakeTimer - dt);
        if (shakeTimer > 0) {
            const mag = Math.min(shakeTimer, 0.35) * 0.07;
            camera.position.x += (Math.random() - 0.5) * mag;
            camera.position.z += (Math.random() - 0.5) * mag;
        }

        if (autoCrystal) {
            autoCooldown = Math.max(0, autoCooldown - dt);
            if (autoCooldown === 0) { autoCooldown = 0.21; placeFront(); }
        }

        for (const c of crystalList) {
            if (!c.alive) continue;
            c.age += dt;
            const t = c.age;
            c.mesh._cage.rotation.y = t * 1.15;
            c.mesh._cage.rotation.x = t * 0.58;
            c.mesh._oct.rotation.y  = -t * 1.9;
            c.mesh._oct.position.y  = Math.sin(t * 2.1) * 0.09;
            c.mesh._light.intensity = 9 + Math.sin(t * 4.2) * 3;
            c.mesh._beam.material.opacity = 0.28 + Math.sin(t * 3.1) * 0.14;
        }

        const counter = document.getElementById('crystal-count');
        if (counter && window.Inventory) counter.textContent = Inventory.countCrystals();
    }

    return { init, update, placeFront, tryHit, explodeCrystal, addRemoteCrystal, triggerRemoteExplosion, toggleAuto };
})();
