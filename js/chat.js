'use strict';
window.Chat = (function () {
    let isOpen = false;

    function init() {
        const input = document.getElementById('chat-input');
        if (!input) return;

        input.addEventListener('keydown', e => {
            e.stopPropagation();
            if (e.key === 'Enter') {
                const msg = input.value.trim();
                input.value = '';
                close();
                if (msg) send(msg);
            }
            if (e.key === 'Escape') { input.value = ''; close(); }
        });

        document.addEventListener('keydown', e => {
            if (e.code === 'KeyT' && !isOpen && !(window.Inventory && Inventory.getIsOpen())) {
                e.preventDefault();
                open();
            }
        });
    }

    function open() {
        isOpen = true;
        const wrap = document.getElementById('chat-input-area');
        if (wrap) wrap.style.display = 'flex';
        const input = document.getElementById('chat-input');
        if (input) { input.value = ''; input.focus(); }
    }

    function close() {
        isOpen = false;
        const wrap = document.getElementById('chat-input-area');
        if (wrap) wrap.style.display = 'none';
        const input = document.getElementById('chat-input');
        if (input) input.blur();
    }

    function getIsOpen() { return isOpen; }

    function send(text) {
        if (window.Multiplayer && Multiplayer.isConnected()) {
            Multiplayer.sendChat(text);
        }
        addMessage('Du', text, '#7ec97e');
    }

    function addMessage(name, text, color) {
        const log = document.getElementById('chat-log');
        if (!log) return;

        const line = document.createElement('div');
        line.className = 'chat-line';
        line.innerHTML = `<span style="color:${color || '#aaa'};font-weight:bold">${esc(name)}</span>: ${esc(text)}`;
        log.appendChild(line);
        log.scrollTop = log.scrollHeight;

        // Show chat area briefly if it was hidden
        const wrap = document.getElementById('chat-box');
        if (wrap) { wrap.style.opacity = '1'; clearTimeout(wrap._hideTimer); wrap._hideTimer = setTimeout(() => { if (!isOpen) wrap.style.opacity = '0.35'; }, 8000); }

        // Remove line after 15s
        setTimeout(() => {
            line.style.transition = 'opacity 0.6s';
            line.style.opacity = '0';
            setTimeout(() => line.remove(), 650);
        }, 15000);

        // Trim to 50 lines
        while (log.children.length > 50) log.removeChild(log.firstChild);
    }

    function systemMessage(text) { addMessage('System', text, '#ffaa33'); }

    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    return { init, open, close, getIsOpen, addMessage, send, systemMessage };
})();
