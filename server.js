'use strict';
const WebSocket = require('ws');

const PORT = 8080;
const wss  = new WebSocket.Server({ port: PORT });
let   nextId = 1;
const players = new Map(); // id -> { id, name, ws }

wss.on('connection', ws => {
    const id = nextId++;
    const player = { id, name: 'Spieler' + id, ws };
    players.set(id, player);

    // Welcome this client
    send(ws, { type: 'welcome', id });

    // Tell newcomer about existing players
    for (const [pid, p] of players) {
        if (pid !== id) send(ws, { type: 'playerJoin', id: pid, name: p.name });
    }

    // Announce newcomer to everyone else
    broadcast({ type: 'playerJoin', id, name: player.name }, id);

    ws.on('message', raw => {
        let msg; try { msg = JSON.parse(raw); } catch { return; }
        msg.id = id;

        if (msg.type === 'join') {
            player.name = String(msg.name || player.name).slice(0, 32);
            broadcast({ type: 'playerJoin', id, name: player.name }, id);
            return;
        }
        if (msg.type === 'chat') msg.name = player.name;

        // Relay everything else verbatim
        broadcast(msg, id);
    });

    ws.on('close', () => {
        broadcast({ type: 'playerLeave', id, name: player.name }, id);
        players.delete(id);
        console.log(`Player ${id} (${player.name}) disconnected. Online: ${players.size}`);
    });

    ws.on('error', err => {
        console.error(`Player ${id} error:`, err.message);
        ws.terminate();
    });

    console.log(`Player ${id} connected as "${player.name}". Online: ${players.size}`);
});

function send(ws, obj) {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}

function broadcast(obj, excludeId) {
    const data = JSON.stringify(obj);
    for (const [id, p] of players) {
        if (id !== excludeId && p.ws.readyState === WebSocket.OPEN) p.ws.send(data);
    }
}

console.log(`Multiplayer-Server läuft auf ws://localhost:${PORT}`);
console.log('Starten: node server.js');
