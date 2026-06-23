'use strict';
window.Controls = (function() {
    const keys = {};
    let controls, camera, playerBody;
    let isLocked = false;
    let isMobile = false;

    // Joystick state
    const joystick = { active: false, id: null, dx: 0, dy: 0, startX: 0, startY: 0 };
    // Look touch state
    const look = { active: false, id: null, lastX: 0, lastY: 0 };
    // Mobile buttons
    let mobileJump = false, mobileAttack = false, mobileSprint = false;

    let mouseSensitivity = 0.002;
    let yaw = 0, pitch = 0;

    function init(camera_in, domElement, player_in) {
        camera = camera_in;
        playerBody = player_in;
        isMobile = /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) || window.innerWidth < 768;

        // PC: PointerLockControls
        if (THREE.PointerLockControls) {
            controls = new THREE.PointerLockControls(camera, document.body);
        }

        document.addEventListener('keydown', e => {
            keys[e.code] = true;
            if (e.code === 'Escape' && isLocked) { unlock(); window.GameState && window.GameState.pause(); }
            if (e.code === 'KeyF') window.GameState && window.GameState.toggleDebug();
            e.preventDefault && e.code !== 'F5' && e.code !== 'F12' && e.preventDefault();
        });
        document.addEventListener('keyup', e => { keys[e.code] = false; });

        // Mouse click = attack
        document.addEventListener('mousedown', e => {
            if (e.button === 0 && isLocked) { window.GameState && window.GameState.playerAttack(); }
        });

        // Play button -> lock
        document.getElementById('play-btn').addEventListener('click', () => {
            window.GameState && window.GameState.startGame();
        });
        document.getElementById('resume-btn').addEventListener('click', () => { window.GameState && window.GameState.resume(); });
        document.getElementById('menu-btn').addEventListener('click', () => { window.GameState && window.GameState.showMenu(); });
        document.getElementById('new-world-btn').addEventListener('click', () => { location.reload(); });
        document.getElementById('respawn-btn').addEventListener('click', () => { window.GameState && window.GameState.respawn(); });
        document.getElementById('go-menu-btn').addEventListener('click', () => { window.GameState && window.GameState.showMenu(); });

        if (controls) {
            controls.addEventListener('lock', () => { isLocked = true; });
            controls.addEventListener('unlock', () => { isLocked = false; });
        }

        // Mobile controls
        if (isMobile) {
            document.getElementById('mobile-controls').style.display = 'block';
            document.getElementById('crosshair').style.display = 'none';
            setupJoystick();
            setupLookZone();
            setupMobileButtons();
        }
    }

    function lock() {
        if (controls) { controls.lock(); }
        isLocked = true;
    }
    function unlock() {
        if (controls) { controls.unlock(); }
        isLocked = false;
    }

    function setupJoystick() {
        const zone = document.getElementById('joystick-zone');
        const knob = document.getElementById('joystick-knob');
        const R = 48;

        function start(e) {
            const touch = e.changedTouches ? e.changedTouches[0] : e;
            joystick.active = true; joystick.id = touch.identifier;
            const rect = zone.getBoundingClientRect();
            joystick.startX = rect.left + rect.width / 2;
            joystick.startY = rect.top  + rect.height / 2;
            e.preventDefault();
        }
        function move(e) {
            if (!joystick.active) return;
            let touch = null;
            if (e.changedTouches) { for (const t of e.changedTouches) if (t.identifier === joystick.id) { touch=t; break; } }
            else touch = e;
            if (!touch) return;
            let dx = touch.clientX - joystick.startX;
            let dy = touch.clientY - joystick.startY;
            const d = Math.sqrt(dx*dx+dy*dy);
            if (d > R) { dx = dx/d*R; dy = dy/d*R; }
            joystick.dx = dx / R; joystick.dy = dy / R;
            knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
            e.preventDefault();
        }
        function end(e) {
            let found = false;
            if (e.changedTouches) { for (const t of e.changedTouches) if (t.identifier === joystick.id) found=true; }
            else found = true;
            if (!found) return;
            joystick.active = false; joystick.dx = 0; joystick.dy = 0;
            knob.style.transform = 'translate(-50%, -50%)';
        }
        zone.addEventListener('touchstart', start, { passive: false });
        document.addEventListener('touchmove', move, { passive: false });
        document.addEventListener('touchend', end, { passive: false });
        zone.addEventListener('mousedown', start);
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', end);
    }

    function setupLookZone() {
        const zone = document.getElementById('look-zone');
        zone.addEventListener('touchstart', e => {
            for (const t of e.changedTouches) {
                if (!look.active) {
                    look.active = true; look.id = t.identifier;
                    look.lastX = t.clientX; look.lastY = t.clientY;
                }
            }
            e.preventDefault();
        }, { passive: false });
        zone.addEventListener('touchmove', e => {
            for (const t of e.changedTouches) {
                if (t.identifier === look.id) {
                    const dx = t.clientX - look.lastX;
                    const dy = t.clientY - look.lastY;
                    look.lastX = t.clientX; look.lastY = t.clientY;
                    yaw   -= dx * 0.006;
                    pitch -= dy * 0.006;
                    pitch = Math.max(-Math.PI/2.1, Math.min(Math.PI/2.1, pitch));
                    applyYawPitch();
                }
            }
            e.preventDefault();
        }, { passive: false });
        zone.addEventListener('touchend', e => {
            for (const t of e.changedTouches) if (t.identifier === look.id) { look.active = false; }
        });
        // Tap = attack
        let tapStart = 0;
        zone.addEventListener('touchstart', () => { tapStart = Date.now(); });
        zone.addEventListener('touchend', e => {
            if (Date.now() - tapStart < 200) window.GameState && window.GameState.playerAttack();
        });
    }

    function setupMobileButtons() {
        const jumpBtn   = document.getElementById('jump-btn');
        const attackBtn = document.getElementById('attack-btn');
        const sprintBtn = document.getElementById('sprint-btn');

        function btn(el, onDown, onUp) {
            el.addEventListener('touchstart', e => { onDown(); e.preventDefault(); }, { passive: false });
            el.addEventListener('touchend',   e => { onUp();   e.preventDefault(); }, { passive: false });
            el.addEventListener('mousedown', onDown); el.addEventListener('mouseup', onUp);
        }
        btn(jumpBtn,   () => { mobileJump = true; }, () => { mobileJump = false; });
        btn(attackBtn, () => { mobileAttack = true; window.GameState && window.GameState.playerAttack(); }, () => { mobileAttack = false; });
        btn(sprintBtn, () => { mobileSprint = !mobileSprint; sprintBtn.style.background = mobileSprint ? 'rgba(100,200,100,0.4)' : ''; }, () => {});
    }

    function applyYawPitch() {
        if (!playerBody || !camera) return;
        playerBody.rotation.y = yaw;
        camera.rotation.x = pitch;
    }

    // Called from game loop – returns movement input
    function getMovement() {
        const mv = { forward: 0, right: 0, jump: false, sprint: false, attack: false };
        // Block movement when overlays are open
        const uiOpen = (window.Inventory && Inventory.getIsOpen()) ||
                       (window.Chat && Chat.getIsOpen());
        if (uiOpen) return mv;
        if (isMobile) {
            mv.forward = -joystick.dy;
            mv.right   =  joystick.dx;
            mv.jump    = mobileJump;
            mv.sprint  = mobileSprint;
        } else {
            if (keys['KeyW'] || keys['ArrowUp'])    mv.forward  =  1;
            if (keys['KeyS'] || keys['ArrowDown'])  mv.forward  = -1;
            if (keys['KeyA'] || keys['ArrowLeft'])  mv.right    = -1;
            if (keys['KeyD'] || keys['ArrowRight']) mv.right    =  1;
            if (keys['Space'])   mv.jump   = true;
            if (keys['ShiftLeft'] || keys['ShiftRight']) mv.sprint = true;
        }
        return mv;
    }

    function onMouseMove(event) {
        if (!isLocked || isMobile) return;
        yaw   -= event.movementX * mouseSensitivity;
        pitch -= event.movementY * mouseSensitivity;
        pitch = Math.max(-Math.PI/2.1, Math.min(Math.PI/2.1, pitch));
        applyYawPitch();
    }
    document.addEventListener('mousemove', onMouseMove);

    function getIsLocked() { return isLocked || isMobile; }
    function getIsMobile() { return isMobile; }

    return { init, lock, unlock, getMovement, getIsLocked, getIsMobile };
})();
