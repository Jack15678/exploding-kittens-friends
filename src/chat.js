import { CHAT_MAX_LENGTH } from './room.js';

export class RoomChat {
  constructor(root) {
    this.root = root; this.room = null; this.open = false; this.unread = 0; this.seen = new Set();
    root.innerHTML = `<button type="button" class="chat-peek" aria-live="polite" aria-atomic="true" hidden><span class="chat-peek-label">朋友捎来一句</span><strong></strong><span class="chat-peek-text"></span></button>
      <section id="room-chat-panel" class="chat-panel" aria-labelledby="room-chat-title" hidden>
        <header class="chat-heading"><div><h2 id="room-chat-title">厨房悄悄话</h2><p>本房间的朋友都能看到</p></div><button type="button" class="chat-close" aria-label="收起聊天">×</button></header>
        <div class="chat-feed"><p class="chat-empty">锅还没开，先聊两句吧。<br>消息只留在这间厨房。</p><ol class="chat-log" role="log" aria-label="房间聊天记录" aria-live="polite" aria-relevant="additions"></ol></div>
        <form class="chat-form"><label class="sr-only" for="room-chat-input">聊天消息</label><input id="room-chat-input" maxlength="${CHAT_MAX_LENGTH}" autocomplete="off" placeholder="和朋友说点什么…"/><button type="submit" class="chat-send" disabled>发送</button></form>
        <p class="chat-connection" role="status" hidden>连接恢复后就能继续聊天，草稿会留着。</p>
      </section>
      <button id="room-chat-toggle" type="button" class="chat-toggle" aria-controls="room-chat-panel" aria-expanded="false" aria-label="展开房间聊天"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 11.5a8 8 0 0 1-8 8H5l-3 2v-10a10 10 0 0 1 20 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="11" r="1" fill="currentColor"/><circle cx="12" cy="11" r="1" fill="currentColor"/><circle cx="16" cy="11" r="1" fill="currentColor"/></svg><span class="chat-toggle-label">聊聊</span><span class="chat-unread" hidden></span></button>`;
    const find = s => root.querySelector(s);
    this.panel = find('.chat-panel'); this.toggleButton = find('.chat-toggle'); this.badge = find('.chat-unread');
    this.peek = find('.chat-peek'); this.log = find('.chat-log'); this.feed = find('.chat-feed'); this.empty = find('.chat-empty');
    this.input = find('input'); this.sendButton = find('.chat-send'); this.connection = find('.chat-connection');
    this.toggleButton.addEventListener('click', () => this.setOpen(!this.open));
    this.peek.addEventListener('click', () => this.setOpen(true));
    find('.chat-close').addEventListener('click', () => this.setOpen(false));
    this.input.addEventListener('input', () => this.updateControls());
    this.input.addEventListener('compositionstart', () => { this.composing = true; });
    this.input.addEventListener('compositionend', () => { this.composing = false; this.updateControls(); });
    this.input.addEventListener('keydown', event => {
      if (event.key === 'Enter' && (event.isComposing || this.composing || event.keyCode === 229)) event.preventDefault();
    });
    find('form').addEventListener('submit', event => {
      event.preventDefault();
      if (!this.composing && this.input.value.trim() && this.room?.sendChat(this.input.value)) {
        this.input.value = ''; this.updateControls(); this.input.focus(); this.feed.scrollTop = this.feed.scrollHeight;
      }
    });
    root.addEventListener('keydown', event => {
      if (event.key === 'Escape' && this.open) { event.stopPropagation(); this.setOpen(false); }
    });
  }
  setOpen(open, focus = true) {
    this.open = open; this.panel.hidden = !open;
    this.toggleButton.setAttribute('aria-expanded', String(open));
    this.root.querySelector('.chat-toggle-label').textContent = open ? '收起' : '聊聊';
    if (open) {
      this.unread = 0; this.peek.hidden = true; clearTimeout(this.previewTimer);
      this.feed.scrollTop = this.feed.scrollHeight;
    }
    this.updateControls();
    if (focus) (open ? this.input : this.toggleButton).focus({ preventScroll: true });
  }
  updateControls() {
    const connected = this.room?.status === 'connected';
    this.sendButton.disabled = !connected || !this.input.value.trim();
    this.connection.hidden = connected;
    this.badge.hidden = !this.unread; this.badge.textContent = this.unread > 99 ? '99+' : String(this.unread);
    this.toggleButton.setAttribute('aria-label', this.open ? '收起房间聊天' : `展开房间聊天${this.unread ? `，${this.unread} 条未读` : ''}`);
  }
  update(room, modalOpen = false) {
    if (this.room !== room) {
      this.room = room; this.seen.clear(); this.initialized = false; this.unread = 0;
      this.input.value = ''; this.log.replaceChildren(); this.peek.hidden = true;
      clearTimeout(this.previewTimer); this.setOpen(false, false);
    }
    const active = !!room?.view && room.role !== 'practice';
    this.root.hidden = !active || modalOpen;
    document.body.dataset.chat = active ? 'on' : 'off';
    if (!active) return;
    const messages = room.chat;
    const incoming = this.initialized ? messages.filter(m => !this.seen.has(m.id) && m.from !== room.me) : [];
    const nearBottom = this.feed.scrollHeight - this.feed.scrollTop - this.feed.clientHeight < 40;
    const ids = new Set(messages.map(m => m.id));
    for (const node of [...this.log.children]) if (!ids.has(node.dataset.message)) node.remove();
    for (const message of messages.filter(m => !this.seen.has(m.id))) {
      const li = document.createElement('li'); li.dataset.message = message.id;
      li.className = message.from === room.me ? 'chat-message mine' : 'chat-message';
      const meta = document.createElement('div'); meta.className = 'chat-message-meta';
      const name = document.createElement('strong'); name.textContent = message.name;
      const time = document.createElement('time'); time.dateTime = new Date(message.createdAt).toISOString();
      time.textContent = new Date(message.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      const body = document.createElement('p'); body.textContent = message.text;
      meta.append(name, time); li.append(meta, body); this.log.append(li);
    }
    this.empty.hidden = messages.length > 0;
    if (nearBottom) this.feed.scrollTop = this.feed.scrollHeight;
    if (!this.open && incoming.length) {
      this.unread += incoming.length;
      const latest = incoming.at(-1);
      this.peek.querySelector('strong').textContent = latest.name;
      this.peek.querySelector('.chat-peek-text').textContent = latest.text;
      this.peek.hidden = false; clearTimeout(this.previewTimer);
      this.previewTimer = setTimeout(() => { this.peek.hidden = true; }, 6000);
    }
    this.seen = ids; this.initialized = true; this.updateControls();
  }
}
