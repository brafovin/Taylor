'use strict';

// ──────────────────────────────────────────────────────────────────────────────
// Helper: Build a humanoid from boxes
// ──────────────────────────────────────────────────────────────────────────────
function makeHumanoid(opts) {
    const g = new THREE.Group();
    const M = opts.materials || {};

    const bodyMat  = M.body  || new THREE.MeshStandardMaterial({ color: opts.bodyColor  || 0x44aa44 });
    const headMat  = M.head  || new THREE.MeshStandardMaterial({ color: opts.headColor  || opts.bodyColor || 0x44aa44 });
    const limbMat  = M.limb  || new THREE.MeshStandardMaterial({ color: opts.limbColor  || opts.bodyColor || 0x44aa44 });
    const legMat   = M.leg   || new THREE.MeshStandardMaterial({ color: opts.legColor   || opts.limbColor || opts.bodyColor || 0x44aa44 });

    const sx = opts.scale || 1;

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.6*sx, 0.6*sx, 0.6*sx), headMat);
    head.position.y = 1.65 * sx; head.castShadow = true; g.add(head);
    g.userData.head = head;

    // Eyes
    if (opts.eyeColor !== undefined) {
        const eyeMat = new THREE.MeshBasicMaterial({ color: opts.eyeColor });
        const eyeGeo = new THREE.BoxGeometry(0.08*sx, 0.08*sx, 0.01);
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat); leftEye.position.set(-0.15*sx, 1.68*sx, 0.31*sx); g.add(leftEye);
        const rightEye = new THREE.Mesh(eyeGeo, eyeMat); rightEye.position.set(0.15*sx, 1.68*sx, 0.31*sx); g.add(rightEye);
    }

    // Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55*sx, 0.75*sx, 0.3*sx), bodyMat);
    body.position.y = 1.1 * sx; body.castShadow = true; g.add(body);
    g.userData.body = body;

    // Arms
    const armGeo = new THREE.BoxGeometry(0.22*sx, 0.6*sx, 0.22*sx);
    const leftArm  = new THREE.Mesh(armGeo, limbMat); leftArm.position.set(-0.4*sx, 1.1*sx, 0); leftArm.castShadow = true; g.add(leftArm);
    const rightArm = new THREE.Mesh(armGeo, limbMat); rightArm.position.set( 0.4*sx, 1.1*sx, 0); rightArm.castShadow = true; g.add(rightArm);
    g.userData.leftArm = leftArm; g.userData.rightArm = rightArm;

    // Legs
    const legGeo = new THREE.BoxGeometry(0.24*sx, 0.7*sx, 0.24*sx);
    const leftLeg  = new THREE.Mesh(legGeo, legMat); leftLeg.position.set(-0.15*sx, 0.35*sx, 0); leftLeg.castShadow = true; g.add(leftLeg);
    const rightLeg = new THREE.Mesh(legGeo, legMat); rightLeg.position.set( 0.15*sx, 0.35*sx, 0); rightLeg.castShadow = true; g.add(rightLeg);
    g.userData.leftLeg = leftLeg; g.userData.rightLeg = rightLeg;

    return g;
}

// ──────────────────────────────────────────────────────────────────────────────
// Monster base class
// ──────────────────────────────────────────────────────────────────────────────
function Monster(type, mesh, hp, dmg, speed, aggroRange) {
    this.type = type;
    this.mesh = mesh;
    this.hp = hp;
    this.maxHp = hp;
    this.dmg = dmg;
    this.speed = speed;
    this.aggroRange = aggroRange;
    this.state = 'wander';
    this.attackCd = 0;
    this.attackRate = 1.5;
    this.vel = new THREE.Vector3();
    this.wanderTarget = new THREE.Vector3();
    this.wanderTimer = 0;
    this.alive = true;
    this.animTime = Math.random() * Math.PI * 2;
    this.deathTimer = 0;
    this.projectiles = [];
}

Monster.prototype.update = function(dt, playerPos, camera) {
    if (!this.alive) {
        this.deathTimer += dt;
        this.mesh.position.y -= dt * 2;
        this.mesh.traverse(o => { if (o.material) { o.material.opacity = Math.max(0, 1 - this.deathTimer * 2); o.material.transparent = true; } });
        return;
    }

    const dist = this.mesh.position.distanceTo(playerPos);
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.animTime += dt * 3;

    // Wander timer
    this.wanderTimer = Math.max(0, this.wanderTimer - dt);

    if (dist < this.aggroRange) {
        this.state = 'chase';
    } else if (dist > this.aggroRange * 1.5) {
        this.state = 'wander';
    }

    if (this.state === 'chase') {
        this._chasePlayer(dt, playerPos);
    } else {
        this._wander(dt);
    }

    // Gravity
    const groundY = Terrain.getHeightAt(this.mesh.position.x, this.mesh.position.z);
    if (this.mesh.position.y > groundY + 0.05) {
        this.mesh.position.y -= dt * 9;
    } else {
        this.mesh.position.y = groundY;
    }

    // Animate limbs
    this._animateLimbs();
};

Monster.prototype._chasePlayer = function(dt, playerPos) {
    const dir = new THREE.Vector3().subVectors(playerPos, this.mesh.position);
    dir.y = 0;
    const dist = dir.length();
    if (dist > 1.5) {
        dir.normalize();
        this.mesh.position.addScaledVector(dir, this.speed * dt);
        this.mesh.lookAt(playerPos.x, this.mesh.position.y, playerPos.z);
    }
};

Monster.prototype._wander = function(dt) {
    if (this.wanderTimer <= 0) {
        const angle = Math.random() * Math.PI * 2;
        this.wanderTarget.set(
            this.mesh.position.x + Math.cos(angle) * (10 + Math.random() * 20),
            0,
            this.mesh.position.z + Math.sin(angle) * (10 + Math.random() * 20)
        );
        this.wanderTimer = 3 + Math.random() * 5;
    }
    const dir = new THREE.Vector3().subVectors(this.wanderTarget, this.mesh.position);
    dir.y = 0;
    if (dir.length() > 1) {
        dir.normalize();
        this.mesh.position.addScaledVector(dir, this.speed * 0.4 * dt);
        this.mesh.lookAt(this.mesh.position.x + dir.x, this.mesh.position.y, this.mesh.position.z + dir.z);
    }
};

Monster.prototype._animateLimbs = function() {
    const h = this.mesh.userData;
    if (!h) return;
    const sw = Math.sin(this.animTime) * 0.4;
    if (h.leftArm)  h.leftArm.rotation.x  =  sw;
    if (h.rightArm) h.rightArm.rotation.x = -sw;
    if (h.leftLeg)  h.leftLeg.rotation.x  = -sw;
    if (h.rightLeg) h.rightLeg.rotation.x  = sw;
};

Monster.prototype.takeDamage = function(dmg) {
    this.hp -= dmg;
    // Flash red
    this.mesh.traverse(o => {
        if (o.isMesh && o.material) {
            const orig = o.userData.origColor || (o.userData.origColor = o.material.color.clone());
            o.material.color.set(0xff0000);
            setTimeout(() => { if (o.material) o.material.color.copy(orig); }, 180);
        }
    });
    if (this.hp <= 0) this.alive = false;
};

Monster.prototype.canAttack = function(playerPos) {
    return this.alive && this.attackCd <= 0 && this.mesh.position.distanceTo(playerPos) < 2.5;
};

Monster.prototype.attack = function() {
    this.attackCd = this.attackRate;
    return this.dmg;
};

// ──────────────────────────────────────────────────────────────────────────────
// Monster Factory
// ──────────────────────────────────────────────────────────────────────────────
window.Monsters = (function() {
    const active = [];
    let scene, playerRef;

    function buildZombie() {
        const mesh = makeHumanoid({
            bodyColor: 0x2d7a2d, headColor: 0x5aaa5a, limbColor: 0x225522,
            legColor: 0x1a3a8a, eyeColor: 0xdd2222, scale: 1
        });
        const m = new Monster('zombie', mesh, 20, 3, 2.8, 25);
        return m;
    }

    function buildSkeleton() {
        const mesh = makeHumanoid({
            bodyColor: 0xe8e0cc, headColor: 0xf2ecda, limbColor: 0xe0d8c0,
            legColor: 0xd8d0b8, eyeColor: 0x111111, scale: 1
        });
        // Bow (right arm extra)
        const bowMat = new THREE.MeshStandardMaterial({ color: 0x6a4010 });
        const bow = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.04, 6, 12, Math.PI), bowMat);
        bow.position.set(0.55, 1.1, 0.3); bow.rotation.z = Math.PI / 2;
        mesh.add(bow);
        const m = new Monster('skeleton', mesh, 20, 4, 2.5, 35);
        m.attackRate = 2;
        m.ranged = true;
        return m;
    }

    function buildCreeper() {
        const g = new THREE.Group();
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3aaa3a });
        const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a5a1a });
        // Body (tall box)
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.4, 0.7), bodyMat);
        body.position.y = 0.7; body.castShadow = true; g.add(body);
        // Head
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), bodyMat);
        head.position.y = 1.8; head.castShadow = true; g.add(head); g.userData.head = head;
        // Face spots
        const spots = [[-.2,.07,-.15],[.2,.07,-.15],[-.12,-.1,-.12],[.12,-.1,-.12]];
        spots.forEach(([x,y,z]) => {
            const s = new THREE.Mesh(new THREE.BoxGeometry(0.12,0.12,0.05), darkMat);
            s.position.set(x, 1.8+y, 0.42+z); g.add(s);
        });
        // Legs
        const legGeo = new THREE.BoxGeometry(0.3, 0.5, 0.3);
        [[-0.2,0.25,0.18],[0.2,0.25,0.18],[-0.2,0.25,-0.18],[0.2,0.25,-0.18]].forEach(([x,y,z]) => {
            const leg = new THREE.Mesh(legGeo, bodyMat); leg.position.set(x,y,z); leg.castShadow=true; g.add(leg);
        });
        const m = new Monster('creeper', g, 20, 30, 3.2, 20);
        m.willExplode = true; m.fuseTimer = 1.5;
        return m;
    }

    function buildSpider() {
        const g = new THREE.Group();
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
        const eyeMat  = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 0.8), bodyMat);
        body.position.y = 0.5; body.castShadow = true; g.add(body); g.userData.body = body;
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.6), bodyMat);
        head.position.set(0, 0.5, 0.6); head.castShadow = true; g.add(head); g.userData.head = head;
        // Eyes
        const eyeGeo = new THREE.SphereGeometry(0.07, 6, 6);
        [[-0.12,0.08,0.35],[0.12,0.08,0.35],[-.25,.05,.3],[.25,.05,.3]].forEach(([x,y,z]) => {
            const e = new THREE.Mesh(eyeGeo, eyeMat); e.position.set(x, y+.5, z+.6); g.add(e);
        });
        // 8 legs
        const legMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
        for (let i = 0; i < 4; i++) {
            const side = i < 2 ? -1 : 1;
            const z = (i % 2 === 0) ? 0.15 : -0.15;
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.04, 1.1, 5), legMat);
            leg.position.set(side * 0.85, 0.35, z); leg.rotation.z = side * 1.2; leg.rotation.x = (i%2-.5)*0.5; leg.castShadow=true; g.add(leg);
        }
        const m = new Monster('spider', g, 16, 2, 4.5, 22);
        m.attackRate = 1;
        return m;
    }

    function buildEnderman() {
        const mesh = makeHumanoid({
            bodyColor: 0x111111, headColor: 0x111111, limbColor: 0x111111,
            legColor: 0x111111, eyeColor: 0xcc00ff, scale: 1.6
        });
        // Purple particles (simple glowing spheres)
        const particleMat = new THREE.MeshBasicMaterial({ color: 0x9900ff, transparent: true, opacity: 0.7 });
        for (let i = 0; i < 8; i++) {
            const p = new THREE.Mesh(new THREE.SphereGeometry(0.06, 4, 4), particleMat);
            p.userData.isParticle = true;
            p.userData.t = Math.random() * Math.PI * 2;
            mesh.add(p);
        }
        const m = new Monster('enderman', mesh, 40, 7, 4.8, 30);
        m.canTeleport = true; m.teleportCd = 0;
        return m;
    }

    function buildWitch() {
        const mesh = makeHumanoid({
            bodyColor: 0x2a2a4a, headColor: 0x4a3a2a, limbColor: 0x2a4a2a,
            legColor: 0x2a2a4a, eyeColor: 0x00ff00, scale: 1
        });
        const hatMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 12), hatMat);
        brim.position.y = 2.02; mesh.add(brim);
        const top = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.45, 0.7, 10), hatMat);
        top.position.y = 2.45; mesh.add(top);
        const m = new Monster('witch', mesh, 26, 6, 3, 28);
        m.ranged = true; m.attackRate = 2.5;
        return m;
    }

    function buildGhast() {
        const g = new THREE.Group();
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffeedd });
        const body = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), bodyMat);
        body.position.y = 3; body.castShadow = true; g.add(body); g.userData.body = body; g.userData.head = body;
        // Tentacles
        const tenMat = new THREE.MeshStandardMaterial({ color: 0xeeddcc });
        for (let i = 0; i < 9; i++) {
            const len = 0.8 + Math.random() * 1.2;
            const ten = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.06, len, 5), tenMat);
            ten.position.set((i%3-1)*0.6, 3 - 1 - len/2, ((i/3|0)-1)*0.6); g.add(ten);
        }
        // Eyes
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
        const eyeGeo = new THREE.BoxGeometry(0.18, 0.18, 0.05);
        [[-0.35,0.1],[-0.05,0.1],[0.35,0.1],[-0.5,-0.2],[0,-0.2],[0.5,-0.2]].forEach(([x,y]) => {
            const e = new THREE.Mesh(eyeGeo, eyeMat); e.position.set(x, 3+y, 1.05); g.add(e);
        });
        const m = new Monster('ghast', g, 10, 12, 0, 50);
        m.flying = true; m.flyHeight = 8 + Math.random() * 6;
        m.ranged = true; m.attackRate = 3;
        return m;
    }

    function buildSlime() {
        const g = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({ color: 0x44cc44, transparent: true, opacity: 0.82, roughness: 0.3, metalness: 0.1 });
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), mat);
        body.position.y = 0.6; body.castShadow = true; g.add(body); g.userData.body = body; g.userData.head = body;
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x114411 });
        const eyeGeo = new THREE.BoxGeometry(0.15, 0.15, 0.05);
        const le = new THREE.Mesh(eyeGeo, eyeMat); le.position.set(-0.2, 0.72, 0.62); g.add(le);
        const re = new THREE.Mesh(eyeGeo, eyeMat); re.position.set( 0.2, 0.72, 0.62); g.add(re);
        const m = new Monster('slime', g, 16, 4, 2.2, 20);
        m.bouncing = true; m.bounceTimer = 0;
        return m;
    }

    function buildBlaze() {
        const g = new THREE.Group();
        const rodMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0xff6600, emissiveIntensity: 0.8 });
        const fireMat = new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.7 });
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), rodMat);
        head.position.y = 2.5; g.add(head); g.userData.head = head; g.userData.body = head;
        // Rotating rods
        for (let i = 0; i < 12; i++) {
            const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 4), rodMat);
            rod.position.set(Math.cos(i/12*Math.PI*2)*0.8, 2 - Math.floor(i/4)*0.5, Math.sin(i/12*Math.PI*2)*0.8);
            rod.rotation.z = Math.PI / 2 + (i/4|0)*0.5;
            rod.userData.blazeRod = true; rod.userData.rodIdx = i;
            g.add(rod);
        }
        // Fire particles
        const fireGeo = new THREE.SphereGeometry(0.15, 4, 4);
        for (let i = 0; i < 6; i++) {
            const f = new THREE.Mesh(fireGeo, fireMat);
            f.userData.isFireParticle = true; f.userData.pt = i / 6 * Math.PI * 2;
            g.add(f);
        }
        const light = new THREE.PointLight(0xff8800, 18, 10, 2);
        light.position.y = 2.5; g.add(light);
        const m = new Monster('blaze', g, 20, 5, 0, 40);
        m.flying = true; m.flyHeight = 5 + Math.random() * 3;
        m.ranged = true; m.attackRate = 2;
        return m;
    }

    function buildZombiePiglin() {
        const mesh = makeHumanoid({
            bodyColor: 0xcc7788, headColor: 0xdd8899, limbColor: 0xbb6677,
            legColor: 0x886644, eyeColor: 0xffcc00, scale: 1
        });
        // Gold sword
        const swordMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, metalness: 0.8, roughness: 0.2 });
        const sword = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.8, 0.08), swordMat);
        sword.position.set(0.5, 1.15, 0.35); mesh.add(sword);
        // Snout
        const snoutMat = new THREE.MeshStandardMaterial({ color: 0xffaaaa });
        const snout = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.15), snoutMat);
        snout.position.set(0, 1.6, 0.35); mesh.add(snout);
        const m = new Monster('zombiePiglin', mesh, 20, 5, 3.5, 22);
        return m;
    }

    function buildIronGolem() {
        const g = new THREE.Group();
        const ironMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.6, metalness: 0.5 });
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.4, 0.6), ironMat);
        body.position.y = 1.4; body.castShadow = true; g.add(body); g.userData.body = body;
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), ironMat);
        head.position.y = 2.5; head.castShadow = true; g.add(head); g.userData.head = head;
        const armGeo = new THREE.BoxGeometry(0.4, 1.2, 0.4);
        const la = new THREE.Mesh(armGeo, ironMat); la.position.set(-0.8, 1.2, 0); la.castShadow=true; g.add(la); g.userData.leftArm=la;
        const ra = new THREE.Mesh(armGeo, ironMat); ra.position.set(0.8, 1.2, 0); ra.castShadow=true; g.add(ra); g.userData.rightArm=ra;
        const legGeo = new THREE.BoxGeometry(0.44, 0.8, 0.44);
        const ll = new THREE.Mesh(legGeo, ironMat); ll.position.set(-0.25, 0.4, 0); g.add(ll); g.userData.leftLeg=ll;
        const rl = new THREE.Mesh(legGeo, ironMat); rl.position.set(0.25, 0.4, 0); g.add(rl); g.userData.rightLeg=rl;
        // Nose
        const nose = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.24), ironMat);
        nose.position.set(0, 2.5, 0.46); g.add(nose);
        const m = new Monster('ironGolem', g, 100, 15, 1.8, 20);
        m.friendly = true;
        return m;
    }

    // ── Villager ───────────────────────────────────────────────────────────────
    function buildVillager() {
        const g = makeHumanoid({
            bodyColor: 0x7a5a30, headColor: 0xd4a07a, limbColor: 0x7a5a30,
            legColor: 0x4a3a20, eyeColor: 0x442211, scale: 1
        });
        // Robe (over body)
        const robeMat = new THREE.MeshStandardMaterial({ color: 0x8a6a3a });
        const robe = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.8, 0.38), robeMat);
        robe.position.y = 1.1; g.add(robe);
        // Nose
        const noseMat = new THREE.MeshStandardMaterial({ color: 0xc08860 });
        const nose = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.15), noseMat);
        nose.position.set(0, 1.6, 0.35); g.add(nose);
        return g;
    }

    // ── Public API ─────────────────────────────────────────────────────────────
    function init(scene_in, player_in) {
        scene = scene_in;
        playerRef = player_in;
    }

    const TYPES = ['zombie','skeleton','creeper','spider','enderman','witch','ghast','slime','blaze','zombiePiglin'];
    const BUILDERS = { zombie:buildZombie, skeleton:buildSkeleton, creeper:buildCreeper, spider:buildSpider,
        enderman:buildEnderman, witch:buildWitch, ghast:buildGhast, slime:buildSlime,
        blaze:buildBlaze, zombiePiglin:buildZombiePiglin };

    function spawnMonster(type, x, z) {
        if (!type) type = TYPES[Math.floor(Math.random() * TYPES.length)];
        const builder = BUILDERS[type];
        if (!builder) return null;
        const m = builder();
        const y = Terrain.getHeightAt(x, z);
        m.mesh.position.set(x, y, z);
        if (m.flying) m.mesh.position.y = y + m.flyHeight;
        scene.add(m.mesh);
        active.push(m);
        return m;
    }

    function spawnVillagers(n) {
        const pts = Terrain.getSurfacePoints(n, 2, 14, 5);
        pts.forEach(p => {
            const v = buildVillager();
            v.position.set(p.x, p.y, p.z);
            v.userData.isVillager = true;
            v.userData.wanderTarget = v.position.clone();
            v.userData.wanderTimer = 0;
            v.userData.animTime = Math.random() * Math.PI * 2;
            scene.add(v);
            active.push({ type: 'villager', mesh: v, alive: true, isVillager: true });
        });
    }

    function update(dt, playerPos, camera, isNight) {
        const toRemove = [];
        active.forEach((m, idx) => {
            if (m.isVillager) { updateVillager(m, dt); return; }
            if (!m.alive && m.deathTimer > 2) { toRemove.push(idx); return; }

            // Special monster behaviors
            if (m.type === 'enderman' && m.canTeleport) {
                m.teleportCd = Math.max(0, m.teleportCd - dt);
                if (m.state === 'chase' && m.teleportCd <= 0) {
                    const td = m.mesh.position.distanceTo(playerPos);
                    if (td > 6) {
                        const dir = new THREE.Vector3().subVectors(playerPos, m.mesh.position).normalize();
                        m.mesh.position.add(dir.multiplyScalar(Math.min(10, td - 3)));
                        m.mesh.position.y = Terrain.getHeightAt(m.mesh.position.x, m.mesh.position.z);
                        m.teleportCd = 3;
                    }
                }
            }

            if (m.type === 'ghast' || m.type === 'blaze') {
                const gh = Terrain.getHeightAt(m.mesh.position.x, m.mesh.position.z) + m.flyHeight;
                m.mesh.position.y += (gh - m.mesh.position.y) * dt * 2;
                if (m.type === 'blaze') updateBlazeAnimation(m, dt);
            }

            if (m.type === 'slime' && m.bouncing) {
                m.bounceTimer += dt * 2.5;
                if (m.mesh.userData.body) m.mesh.userData.body.position.y = 0.6 + Math.abs(Math.sin(m.bounceTimer)) * 0.4;
            }

            if (m.type === 'creeper' && m.state === 'chase') {
                const dist = m.mesh.position.distanceTo(playerPos);
                if (dist < 2) {
                    m.fuseTimer -= dt;
                    if (m.fuseTimer <= 0 && typeof window.GameUI !== 'undefined') {
                        window.GameUI.showExplosionEffect();
                        m.alive = false;
                        window.GameState && window.GameState.onMonsterAttack(m.dmg);
                    }
                } else {
                    m.fuseTimer = 1.5;
                }
            }

            m.update(dt, playerPos, camera);

            // Ranged attack
            if (m.ranged && m.state === 'chase' && m.attackCd <= 0) {
                const dist = m.mesh.position.distanceTo(playerPos);
                if (dist < m.aggroRange && dist > 3) {
                    m.attackCd = m.attackRate;
                    fireProjectile(m, playerPos);
                }
            }

            // Melee attack
            if (!m.ranged && m.canAttack(playerPos)) {
                const dmg = m.attack();
                window.GameState && window.GameState.onMonsterAttack(dmg);
            }
        });

        // Remove dead monsters
        toRemove.sort((a,b)=>b-a).forEach(i => {
            scene.remove(active[i].mesh);
            active.splice(i, 1);
        });

        // Update projectiles
        updateProjectiles(dt, playerPos);
    }

    function updateVillager(v, dt) {
        const mesh = v.mesh;
        mesh.userData.wanderTimer = Math.max(0, (mesh.userData.wanderTimer || 0) - dt);
        if (mesh.userData.wanderTimer <= 0) {
            const angle = Math.random() * Math.PI * 2;
            mesh.userData.wanderTarget = new THREE.Vector3(
                mesh.position.x + Math.cos(angle) * (3 + Math.random() * 8),
                0,
                mesh.position.z + Math.sin(angle) * (3 + Math.random() * 8)
            );
            mesh.userData.wanderTimer = 4 + Math.random() * 6;
        }
        const target = mesh.userData.wanderTarget;
        const dir = new THREE.Vector3().subVectors(target, mesh.position); dir.y = 0;
        if (dir.length() > 0.5) {
            dir.normalize();
            mesh.position.addScaledVector(dir, 1.2 * dt);
            mesh.lookAt(mesh.position.x + dir.x, mesh.position.y, mesh.position.z + dir.z);
        }
        // Leg animation
        mesh.userData.animTime = (mesh.userData.animTime || 0) + dt * 2;
        const sw = Math.sin(mesh.userData.animTime) * 0.3;
        if (mesh.userData.leftLeg)  mesh.userData.leftLeg.rotation.x  = -sw;
        if (mesh.userData.rightLeg) mesh.userData.rightLeg.rotation.x =  sw;
        // Stick to ground
        const gy = Terrain.getHeightAt(mesh.position.x, mesh.position.z);
        mesh.position.y = gy;
    }

    // Projectile system
    const projectiles = [];
    function fireProjectile(monster, playerPos) {
        const projGeo = new THREE.SphereGeometry(0.2, 6, 6);
        const color = monster.type === 'blaze' ? 0xff6600 : monster.type === 'ghast' ? 0xffffff : 0x00ffaa;
        const projMat = new THREE.MeshBasicMaterial({ color });
        const proj = new THREE.Mesh(projGeo, projMat);
        proj.position.copy(monster.mesh.position).add(new THREE.Vector3(0, 1.5, 0));
        const dir = new THREE.Vector3().subVectors(playerPos, proj.position).normalize();
        proj.userData.velocity = dir.multiplyScalar(12);
        proj.userData.life = 4;
        proj.userData.damage = monster.dmg;
        if (monster.type === 'blaze') {
            proj.add(new THREE.PointLight(0xff8800, 10, 6, 2));
        }
        scene.add(proj);
        projectiles.push(proj);
    }

    function updateProjectiles(dt, playerPos) {
        for (let i = projectiles.length - 1; i >= 0; i--) {
            const p = projectiles[i];
            p.userData.life -= dt;
            p.position.addScaledVector(p.userData.velocity, dt);
            const gy = Terrain.getHeightAt(p.position.x, p.position.z);
            if (p.position.y < gy || p.userData.life < 0) {
                scene.remove(p); projectiles.splice(i, 1); continue;
            }
            if (p.position.distanceTo(playerPos) < 1.0) {
                window.GameState && window.GameState.onMonsterAttack(p.userData.damage);
                scene.remove(p); projectiles.splice(i, 1);
            }
        }
    }

    function updateBlazeAnimation(m, dt) {
        m.animTime = (m.animTime || 0) + dt;
        m.mesh.children.forEach(c => {
            if (c.userData.isFireParticle) {
                c.userData.pt += dt * 2;
                c.position.set(Math.cos(c.userData.pt) * 0.9, 2 + Math.sin(c.userData.pt * 1.5) * 0.4, Math.sin(c.userData.pt) * 0.9);
                c.material.opacity = 0.5 + Math.sin(c.userData.pt * 3) * 0.3;
            }
            if (c.userData.blazeRod) {
                c.rotation.y = m.animTime * 1.5;
            }
        });
    }

    function getActive() { return active; }
    function getCount() { return active.filter(m => !m.isVillager && m.alive).length; }

    return { init, spawnMonster, spawnVillagers, update, getActive, getCount, TYPES };
})();
