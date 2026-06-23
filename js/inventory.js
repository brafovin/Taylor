'use strict';
window.Inventory = (function () {

    // ── Item catalogue ─────────────────────────────────────────────────────────
    const ITEMS = {
        sword:       { name: 'Diamant-Schwert',               icon: '⚔️',  type: 'weapon',  damage: 7,  rarity: 'rare',      durMax: 1562 },
        axe:         { name: 'Diamant-Axt',                   icon: '🪓',  type: 'weapon',  damage: 9,  rarity: 'rare',      durMax: 1562 },
        pickaxe:     { name: 'Diamant-Spitzhacke',            icon: '⛏️',  type: 'tool',               rarity: 'uncommon',  durMax: 1562 },
        bow:         { name: 'Bogen',                         icon: '🏹',  type: 'ranged',  damage: 5,  rarity: 'common',    durMax: 384  },
        arrow:       { name: 'Pfeil',                         icon: '↗️',  type: 'ammo',    stackable: true,  rarity: 'common'  },
        crystal:     { name: 'End-Kristall',                  icon: '💎',  type: 'crystal', stackable: true,  rarity: 'epic'    },
        gapple:      { name: 'Verzauberter Goldapfel',        icon: '🍏',  type: 'food',    heal: 4, absorption: 4, stackable: true, rarity: 'epic' },
        apple:       { name: 'Goldapfel',                     icon: '🍎',  type: 'food',    heal: 2, stackable: true, rarity: 'uncommon' },
        potion:      { name: 'Heiltrank II',                  icon: '🧪',  type: 'potion',  heal: 8,  stackable: true, rarity: 'uncommon' },
        strPotion:   { name: 'Stärketrank II',                icon: '🟥',  type: 'buff',    damageBuff: 4, duration: 60, stackable: true, rarity: 'uncommon' },
        speedPotion: { name: 'Schnelligkeit II',              icon: '🟦',  type: 'buff',    speedBuff: 2,  duration: 60, stackable: true, rarity: 'uncommon' },
        totem:       { name: 'Totem der Unsterblichkeit',     icon: '🗿',  type: 'totem',              rarity: 'epic'    },
        helmet:      { name: 'Diamanthelm',                   icon: '⛑️',  type: 'armor',   slot: 'head',  defense: 3, rarity: 'rare', durMax: 363 },
        chestplate:  { name: 'Diamant-Brustplatte',           icon: '🛡️',  type: 'armor',   slot: 'chest', defense: 8, rarity: 'rare', durMax: 528 },
        leggings:    { name: 'Diamant-Beinschutz',            icon: '👖',  type: 'armor',   slot: 'legs',  defense: 6, rarity: 'rare', durMax: 495 },
        boots:       { name: 'Diamant-Stiefel',               icon: '👢',  type: 'armor',   slot: 'feet',  defense: 3, rarity: 'rare', durMax: 429 },
        obsidian:    { name: 'Obsidian',                      icon: '⬛',  type: 'block',   stackable: true,  rarity: 'rare'    },
        enderpearl:  { name: 'Ender-Perle',                   icon: '🟢',  type: 'teleport', stackable: true, rarity: 'uncommon' },
    };

    const RARITY = { common: '#aaaaaa', uncommon: '#55ff55', rare: '#5599ff', epic: '#cc00ff', legendary: '#ffaa00' };

    // ── Data ───────────────────────────────────────────────────────────────────
    const HOTBAR_SIZE = 9, MAIN_ROWS = 3;
    let hotbar  = new Array(HOTBAR_SIZE).fill(null);
    let main    = new Array(HOTBAR_SIZE * MAIN_ROWS).fill(null);
    let armor   = { head: null, chest: null, legs: null, feet: null };
    let offhand = null;
    let selectedSlot = 0;
    let isOpen  = false;
    let dragging = null; // { item, fromGroup, fromIdx, origCount }

    const buffs = { damageBuff: 0, speedBuff: 0, absorption: 0 };
    const buffTimers = { damageBuff: 0, speedBuff: 0 };

    function initDefault() {
        hotbar[0] = { type: 'sword',       count: 1, dur: 1562 };
        hotbar[1] = { type: 'crystal',     count: 64 };
        hotbar[2] = { type: 'gapple',      count: 8  };
        hotbar[3] = { type: 'potion',      count: 4  };
        hotbar[4] = { type: 'totem',       count: 1  };
        hotbar[5] = { type: 'bow',         count: 1, dur: 384 };
        hotbar[6] = { type: 'obsidian',    count: 64 };
        hotbar[7] = { type: 'arrow',       count: 64 };
        hotbar[8] = { type: 'axe',         count: 1, dur: 1562 };
        armor.head  = { type: 'helmet',     count: 1, dur: 363 };
        armor.chest = { type: 'chestplate', count: 1, dur: 528 };
        armor.legs  = { type: 'leggings',   count: 1, dur: 495 };
        armor.feet  = { type: 'boots',      count: 1, dur: 429 };
        offhand     = { type: 'totem',      count: 1 };
        main[0] = { type: 'crystal',    count: 32 };
        main[1] = { type: 'apple',      count: 16 };
        main[2] = { type: 'strPotion',  count: 2  };
        main[3] = { type: 'speedPotion',count: 2  };
        main[4] = { type: 'enderpearl', count: 8  };
    }

    // ── Accessors ──────────────────────────────────────────────────────────────
    function getSelectedItem()  { return hotbar[selectedSlot]; }
    function getIsOpen()        { return isOpen; }
    function getBuffs()         { return buffs; }
    function getTotalDefense()  {
        return Object.values(armor).reduce((sum, a) => sum + (a ? (ITEMS[a.type]?.defense || 0) : 0), 0);
    }
    function hasCrystals() {
        return [...hotbar, ...main].some(s => s?.type === 'crystal' && s.count > 0);
    }
    function countCrystals() {
        return [...hotbar, ...main].reduce((n, s) => n + (s?.type === 'crystal' ? s.count : 0), 0);
    }
    function consumeCrystal() {
        const arr = [...hotbar.map((s,i) => ({s,g:'hotbar',i})), ...main.map((s,i) => ({s,g:'main',i}))];
        const f = arr.find(x => x.s?.type === 'crystal' && x.s.count > 0);
        if (!f) return false;
        f.s.count--;
        if (f.s.count <= 0) setSlot(f.g, f.i, null);
        renderHotbar();
        return true;
    }
    function consumeSelected() {
        const s = hotbar[selectedSlot];
        if (!s) return false;
        if (s.count > 1) { s.count--; } else { hotbar[selectedSlot] = null; }
        renderHotbar();
        return true;
    }
    function selectSlot(n) {
        selectedSlot = ((n % HOTBAR_SIZE) + HOTBAR_SIZE) % HOTBAR_SIZE;
        renderHotbar();
        if (isOpen) renderHotbarInv();
    }

    // ── Use item ───────────────────────────────────────────────────────────────
    function useItem(item) {
        if (!item) return false;
        const def = ITEMS[item.type];
        if (!def) return false;
        const S = window.GameState?.get();
        if (def.type === 'food' || def.type === 'potion') {
            if (S) { S.hp = Math.min(S.maxHp + (buffs.absorption || 0), S.hp + (def.heal || 2)); window.GameUI?.updateHealth(S.hp, S.maxHp); window.GameUI?.showHeal(); }
            if (def.absorption) { buffs.absorption = def.absorption; setTimeout(() => { buffs.absorption = 0; }, 30000); }
            window.GameUI?.showNotification(`${def.icon} ${def.name} (${def.heal > 0 ? '+' + def.heal + ' ❤️' : ''})`);
            return true;
        }
        if (def.type === 'buff') {
            if (def.damageBuff) { buffs.damageBuff = def.damageBuff; buffTimers.damageBuff = def.duration || 60; window.GameUI?.showNotification(`⚡ ${def.name} aktiv! (+${def.damageBuff} Schaden)`); }
            if (def.speedBuff)  { buffs.speedBuff  = def.speedBuff;  buffTimers.speedBuff  = def.duration || 60; window.GameUI?.showNotification(`💨 ${def.name} aktiv!`); }
            return true;
        }
        if (def.type === 'teleport') {
            if (S?.playerBody) {
                const angle = Math.random() * Math.PI * 2, dist = 8 + Math.random() * 8;
                const x = S.playerBody.position.x + Math.cos(angle) * dist;
                const z = S.playerBody.position.z + Math.sin(angle) * dist;
                S.playerBody.position.set(x, Terrain.getHeightAt(x, z) + 1, z);
                window.GameUI?.showNotification('🟢 Ender-Perle geworfen!');
            }
            return true;
        }
        return false;
    }

    function updateBuffs(dt) {
        ['damageBuff', 'speedBuff'].forEach(k => {
            if (buffTimers[k] > 0) { buffTimers[k] -= dt; if (buffTimers[k] <= 0) { buffTimers[k] = 0; buffs[k] = 0; } }
        });
    }

    // ── Totem pop ──────────────────────────────────────────────────────────────
    function tryTotemPop() {
        // Check offhand, then hotbar
        const slots = [{ s: offhand, g: 'offhand', i: 0 }, ...hotbar.map((s, i) => ({ s, g: 'hotbar', i }))];
        const t = slots.find(x => x.s?.type === 'totem');
        if (!t) return false;
        setSlot(t.g, t.i, t.s.count > 1 ? { ...t.s, count: t.s.count - 1 } : null);
        renderHotbar();
        window.GameUI?.showNotification('🗿 Totem der Unsterblichkeit hat dich gerettet!');
        window.GameUI?.showHeal();
        return true;
    }

    // ── Slot helpers ───────────────────────────────────────────────────────────
    function getFromSlot(g, i) {
        if (g === 'hotbar')  return hotbar[+i] ?? null;
        if (g === 'main')    return main[+i]   ?? null;
        if (g === 'armor')   return armor[i]   ?? null;
        if (g === 'offhand') return offhand;
        return null;
    }
    function setSlot(g, i, item) {
        if (g === 'hotbar')  { hotbar[+i] = item; renderHotbar(); }
        else if (g === 'main')    main[+i] = item;
        else if (g === 'armor')   armor[i] = item;
        else if (g === 'offhand') offhand  = item;
    }

    // ── Keyboard & wheel ───────────────────────────────────────────────────────
    document.addEventListener('keydown', e => {
        if (window.Chat?.getIsOpen()) return;
        if (e.code === 'KeyE') { toggle(); e.preventDefault(); return; }
        if (isOpen && e.code === 'Escape') { close(); e.preventDefault(); return; }
        if (isOpen) return;
        const n = parseInt(e.key) - 1;
        if (n >= 0 && n <= 8) { selectSlot(n); e.preventDefault(); }
        if (e.code === 'KeyF') {
            const item = getSelectedItem();
            const def  = item ? ITEMS[item.type] : null;
            if (def && (def.type === 'food' || def.type === 'potion' || def.type === 'buff' || def.type === 'teleport')) {
                if (useItem(item)) consumeSelected();
            }
        }
    });
    document.addEventListener('wheel', e => {
        if (isOpen || (window.Chat?.getIsOpen())) return;
        selectSlot(selectedSlot + (e.deltaY > 0 ? 1 : -1));
        e.preventDefault();
    }, { passive: false });

    // ── Open / Close ───────────────────────────────────────────────────────────
    function open() {
        if (isOpen) return;
        isOpen = true;
        document.getElementById('inventory-screen').style.display = 'flex';
        window.Controls?.unlock();
        renderAll();
    }
    function close() {
        if (!isOpen) return;
        isOpen = false;
        document.getElementById('inventory-screen').style.display = 'none';
        dragging = null;
        const ghost = document.getElementById('inv-drag-ghost');
        if (ghost) ghost.style.display = 'none';
        const S = window.GameState?.get();
        if (S?.gameActive && !window.Controls?.getIsMobile()) setTimeout(() => window.Controls?.lock(), 80);
    }
    function toggle() { isOpen ? close() : open(); }

    // ── Rendering helpers ──────────────────────────────────────────────────────
    function slotHTML(item, idx, group, extra) {
        const cls = `inv-slot${extra ? ' ' + extra : ''}`;
        if (!item) return `<div class="${cls} empty" data-idx="${idx}" data-group="${group}"></div>`;
        const def = ITEMS[item.type] || { icon: '❓', name: '?', rarity: 'common' };
        const col = RARITY[def.rarity] || '#aaa';
        const cnt = item.count > 1 ? `<span class="inv-cnt">${item.count}</span>` : '';
        const durPct = (item.dur !== undefined && def.durMax) ? Math.round(item.dur / def.durMax * 100) : null;
        const durBar = durPct !== null ? `<div class="inv-dur"><div class="inv-dur-fill" style="width:${durPct}%;background:${durPct>50?'#4caf50':durPct>25?'#ff9800':'#f44336'}"></div></div>` : '';
        return `<div class="${cls}" data-idx="${idx}" data-group="${group}" title="${def.name}" style="--rc:${col}">
            <span class="inv-icon">${def.icon}</span>${cnt}${durBar}
        </div>`;
    }

    function renderMainGrid() {
        const el = document.getElementById('inv-main-grid'); if (!el) return;
        el.innerHTML = main.map((s, i) => slotHTML(s, i, 'main')).join('');
    }
    function renderHotbarInv() {
        const el = document.getElementById('inv-hotbar-grid'); if (!el) return;
        el.innerHTML = hotbar.map((s, i) => slotHTML(s, i, 'hotbar', i === selectedSlot ? 'inv-selected' : '')).join('');
    }
    function renderArmorSlots() {
        const el = document.getElementById('inv-armor-slots'); if (!el) return;
        const keys = ['head','chest','legs','feet'];
        const placeholder = { head:'🪖', chest:'📦', legs:'📏', feet:'👟' };
        el.innerHTML = keys.map(k => armor[k]
            ? slotHTML(armor[k], k, 'armor')
            : `<div class="inv-slot empty" data-idx="${k}" data-group="armor" title="${k}"><span style="opacity:.2">${placeholder[k]}</span></div>`
        ).join('') +
        (offhand
            ? slotHTML(offhand, 'off', 'offhand', 'inv-offhand')
            : `<div class="inv-slot empty inv-offhand" data-idx="off" data-group="offhand" title="Nebenhand"><span style="opacity:.2">🖐️</span></div>`);
    }
    function renderStats() {
        const el = document.getElementById('inv-stats'); if (!el) return;
        const S = window.GameState?.get();
        const hp = S?.hp ?? 20, maxHp = S?.maxHp ?? 20;
        const sel = getSelectedItem(); const selDef = sel ? ITEMS[sel.type] : null;
        const atk = (selDef?.damage ?? 0) + (buffs.damageBuff || 0);
        el.innerHTML = `
            <div class="stat-line">❤️ <b>${hp}</b> / ${maxHp}${buffs.absorption ? ` <span style="color:#ffcc00">+${buffs.absorption}💛</span>` : ''}</div>
            <div class="stat-line">🛡️ <b>${getTotalDefense()}</b> Rüstung</div>
            <div class="stat-line">⚔️ <b>${atk || '—'}</b> Schaden</div>
            <div class="stat-line">💎 <b>${countCrystals()}</b> Kristalle</div>
            ${buffs.damageBuff  ? `<div class="stat-line buff">⚡ Stärke +${buffs.damageBuff}</div>` : ''}
            ${buffs.speedBuff   ? `<div class="stat-line buff">💨 Schnelligkeit</div>` : ''}
        `;
    }

    // Hotbar in game HUD
    function renderHotbar() {
        const el = document.getElementById('hotbar'); if (!el) return;
        el.innerHTML = hotbar.map((s, i) => {
            const def = s ? ITEMS[s.type] : null;
            const col = def ? (RARITY[def.rarity] || '#aaa') : 'transparent';
            const active = i === selectedSlot;
            const cnt = (s && s.count > 1) ? `<span class="hb-count">${s.count}</span>` : '';
            return `<div class="hotbar-slot${active ? ' active' : ''}" title="${def?.name||''}"
                style="border-color:${active ? 'rgba(255,255,255,.9)' : col + '55'}">
                <span class="icon">${def?.icon || ''}</span>${cnt}
                <span class="hb-num">${i+1}</span>
            </div>`;
        }).join('');
    }

    function renderAll() { renderMainGrid(); renderArmorSlots(); renderHotbarInv(); renderStats(); }

    // ── Drag & drop ────────────────────────────────────────────────────────────
    function setupDragDrop() {
        const inv = document.getElementById('inventory-screen'); if (!inv) return;
        const ghost = document.getElementById('inv-drag-ghost');

        function getSlot(e) { return e.target.closest?.('.inv-slot'); }

        inv.addEventListener('mousedown', e => {
            const slot = getSlot(e); if (!slot) return;
            const g = slot.dataset.group, i = slot.dataset.idx;
            const item = getFromSlot(g, i); if (!item) return;
            if (e.button === 2) { e.preventDefault(); useItemFromSlot(g, i); renderAll(); return; }
            const half = e.shiftKey && item.count > 1;
            const taken = half ? Math.ceil(item.count / 2) : item.count;
            dragging = { item: { ...item, count: taken }, fromGroup: g, fromIdx: i, origCount: item.count };
            setSlot(g, i, item.count - taken > 0 ? { ...item, count: item.count - taken } : null);
            ghost.textContent = ITEMS[item.type]?.icon || '❓';
            ghost.style.cssText = `display:block;position:fixed;pointer-events:none;z-index:9999;font-size:2em;left:${e.clientX-20}px;top:${e.clientY-20}px`;
            renderAll(); e.preventDefault();
        });
        document.addEventListener('mousemove', e => {
            if (!dragging) return;
            ghost.style.left = e.clientX - 20 + 'px'; ghost.style.top = e.clientY - 20 + 'px';
        });
        document.addEventListener('mouseup', e => {
            if (!dragging) return;
            const slot = getSlot(e);
            if (slot) {
                const g = slot.dataset.group, i = slot.dataset.idx;
                const existing = getFromSlot(g, i);
                if (!existing) { setSlot(g, i, dragging.item); }
                else if (existing.type === dragging.item.type && ITEMS[existing.type]?.stackable) {
                    setSlot(g, i, { ...existing, count: existing.count + dragging.item.count });
                } else {
                    setSlot(g, i, dragging.item);
                    setSlot(dragging.fromGroup, dragging.fromIdx, existing);
                }
            } else {
                setSlot(dragging.fromGroup, dragging.fromIdx, { ...dragging.item, count: dragging.origCount });
            }
            dragging = null; ghost.style.display = 'none'; renderAll();
        });
        inv.addEventListener('contextmenu', e => e.preventDefault());
    }

    function useItemFromSlot(g, i) {
        const item = getFromSlot(g, i); if (!item) return;
        const def = ITEMS[item.type]; if (!def) return;
        if (def.type === 'food' || def.type === 'potion' || def.type === 'buff' || def.type === 'teleport') {
            if (useItem(item)) setSlot(g, i, item.count > 1 ? { ...item, count: item.count - 1 } : null);
        } else if (def.type === 'armor') {
            const old = armor[def.slot];
            armor[def.slot] = { ...item, count: 1 };
            setSlot(g, i, item.count > 1 ? { ...item, count: item.count - 1 } : old || null);
        }
    }

    // ── Init ───────────────────────────────────────────────────────────────────
    function init() {
        initDefault();
        setupDragDrop();
        renderHotbar();
        document.getElementById('inv-close-btn')?.addEventListener('click', close);
    }

    return {
        init, open, close, toggle, getIsOpen,
        getSelectedItem, getSelectedSlot: () => selectedSlot, selectSlot,
        getTotalDefense, getBuffs, updateBuffs,
        consumeSelected, consumeCrystal, hasCrystals, countCrystals,
        useItem, tryTotemPop, renderHotbar, renderAll, ITEMS, RARITY,
    };
})();
