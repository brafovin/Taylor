'use strict';
window.Multiplayer = (function () {
    let ws = null;
    let connected = false;
    let myId = null;
    const myName = 'Spieler' + (Math.random() * 9999 | 0);
    const others = new Map(); // id -> { mesh, nameEl, pos }
    let _scene = null;
    let sendTimer = 0;
    const SEND_RATE = 0.05; // 20 Hz

    function init(sc) {
        _scene = sc;
        connect();
    }

    function connect() {
        const host = location.hostname || 'localhost';
        let sock;
        try { sock = new WebSocket(`ws://${host}:8080`); }
        catch (e) { Chat.systemMessage('Kein Multiplayer-Server gefunden.'); return; }
        ws = sock;

        sock.onopen = () => {
            connected = true;
            sock.send(JSON.stringify({ type: 'join', name: myName }));
            Chat.systemMessage(`Verbunden als "${myName}"`);
        };
        sock.onclose = () => {
            connected = false;
            for (const id of [...others.keys()]) removePlayer(id);
            Chat.systemMessage('Verbindung zum Server getrennt. Neuverbindung in 5s…');
            setTimeout(connect, 5000);
        };
        sock.onerror = () => { /* silent – server not running = single-player */ };
        sock.onmessage = e => {
            let msg; try { msg = JSON.parse(e.data); } catch { return; }
            handle(msg);
        };
    }

    function handle(msg) {
        switch (msg.type) {
            case 'welcome':   myId = msg.id; break;
            case 'playerJoin':
                if (msg.id !== myId) { addPlayer(msg.id, msg.name); Chat.systemMessage(`${msg.name} ist beigetreten.`); }
                break;
            case 'playerLeave':
                removePlayer(msg.id);
                Chat.systemMessage(`${msg.name || 'Spieler'} hat das Spiel verlassen.`);
                break;
            case 'move':
                if (msg.id !== myId) updatePos(msg.id, msg.pos, msg.rot);
                break;
            case 'chat':
                if (msg.id !== myId) Chat.addMessage(msg.name || 'Spieler', msg.text, '#87ceeb');
                break;
            case 'crystal':
                if (msg.id !== myId && window.Crystals) Crystals.addRemoteCrystal(msg.pos);
                break;
            case 'explosion':
                if (msg.id !== myId && window.Crystals) Crystals.triggerRemoteExplosion(msg.pos);
                break;
            case 'damage':
                if (msg.targetId === myId) window.GameState && GameState.onMonsterAttack(msg.amount);
                break;
        }
    }

    function addPlayer(id, name) {
        if (others.has(id) || !_scene) return;
        const g = new THREE.Group();

        const bodyM = new THREE.MeshStandardMaterial({ color: 0x3366ff });
        const headM = new THREE.MeshStandardMaterial({ color: 0xffcc99 });
        const legM  = new THREE.MeshStandardMaterial({ color: 0x223388 });

        const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.75, 0.28), bodyM); body.position.y = 0.92; g.add(body);
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), headM);   head.position.y = 1.67; g.add(head);
        [[-0.17, 0], [0.17, 0]].forEach(([x]) => {
            const leg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.76, 0.24), legM);
            leg.position.set(x, 0.38, 0); g.add(leg);
        });
        [[-0.38, 0.92], [0.38, 0.92]].forEach(([x, y]) => {
            const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.24), bodyM);
            arm.position.set(x, y, 0); g.add(arm);
        });

        _scene.add(g);

        // DOM name tag
        const tag = document.createElement('div');
        tag.className = 'mp-nametag';
        tag.textContent = name;
        document.body.appendChild(tag);

        others.set(id, { mesh: g, nameEl: tag, name, pos: new THREE.Vector3() });
    }

    function removePlayer(id) {
        const p = others.get(id);
        if (!p) return;
        if (_scene) _scene.remove(p.mesh);
        p.nameEl && p.nameEl.remove();
        others.delete(id);
    }

    function updatePos(id, pos, rot) {
        let p = others.get(id);
        if (!p) { addPlayer(id, 'Spieler'); p = others.get(id); }
        if (!p) return;
        p.mesh.position.set(pos.x, pos.y, pos.z);
        if (rot != null) p.mesh.rotation.y = rot;
        p.pos.set(pos.x, pos.y, pos.z);
    }

    function send(obj) {
        if (connected && ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
    }

    function sendChat(text)       { send({ type: 'chat', text }); }
    function sendCrystal(pos)     { send({ type: 'crystal',   pos: compact(pos) }); }
    function sendExplosion(pos)   { send({ type: 'explosion', pos: compact(pos) }); }
    function compact(v)           { return { x: +v.x.toFixed(2), y: +v.y.toFixed(2), z: +v.z.toFixed(2) }; }

    function update(dt, playerBody, camera) {
        sendTimer -= dt;
        if (sendTimer <= 0) {
            sendTimer = SEND_RATE;
            send({ type: 'move', pos: compact(playerBody.position), rot: +playerBody.rotation.y.toFixed(3) });
        }

        // Project name tags to screen
        for (const [, p] of others) {
            if (!p.nameEl) continue;
            const wp = p.mesh.position.clone(); wp.y += 2.3;
            const sp = wp.project(camera);
            if (sp.z > 1 || sp.z < -1) { p.nameEl.style.display = 'none'; continue; }
            p.nameEl.style.display = 'block';
            p.nameEl.style.left = ((sp.x * 0.5 + 0.5) * window.innerWidth)  + 'px';
            p.nameEl.style.top  = ((-sp.y * 0.5 + 0.5) * window.innerHeight) + 'px';
        }
    }

    function isConnected() { return connected; }

    return { init, update, sendChat, sendCrystal, sendExplosion, isConnected };
})();
