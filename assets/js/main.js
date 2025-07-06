// main.js for Durable Object 聊天室（升级版，兼容动态 include，支持房间切换、用户列表、群聊/私聊）

// 等待所有 include 加载完毕再初始化
document.addEventListener('includes-loaded', initChat);

function getRoomFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get('room');
}

function initChat() {
  const nick = localStorage.getItem('nickname') || "匿名用户";
  const roomFromUrl = getRoomFromURL();
  const room = roomFromUrl || localStorage.getItem('room') || "city";
  const roomNames = { city: "同城聊天室", love: "感情聊天室", crypto: "加密货币聊天室" };
  localStorage.setItem('room', room);

  let privateTarget = null;

  // 填充昵称和房间名
  const myNickEl = document.getElementById('my-nick');
  const roomNameEl = document.getElementById('room-name');
  if (myNickEl) myNickEl.innerText = nick;
  if (roomNameEl) roomNameEl.innerText = roomNames[room] || "聊天室";

  // 房间切换逻辑
  const roomList = document.querySelector('.room-list');
  if (roomList) {
    roomList.querySelectorAll('li').forEach(li => {
      if (li.dataset.room === room) li.classList.add('active');
      li.onclick = () => {
        if (li.dataset.room === room) return;
        window.location.href = `/chat?room=${encodeURIComponent(li.dataset.room)}`;
      }
    });
  }

  // 注销
  const logoutBtn = document.getElementById('logout');
  if (logoutBtn) {
    logoutBtn.onclick = () => {
      localStorage.removeItem('nickname');
      localStorage.removeItem('room');
      location.href = "index.html";
    }
  }

  const chatArea = document.getElementById('chat-area');
  const input = document.getElementById('msg-input');
  const sendBtn = document.getElementById('send-btn');
  const userList = document.getElementById('user-list');
  const chatModeTip = document.getElementById('chat-mode-tip');

  function updateChatModeTip() {
    if (!chatModeTip) return;
    if (privateTarget) {
      chatModeTip.innerHTML = `你对 <b>${privateTarget}</b> 说... <a href="#" id="cancel-private">(取消私聊)</a>`;
      const cancelBtn = document.getElementById('cancel-private');
      if (cancelBtn) {
        cancelBtn.onclick = () => {
          privateTarget = null;
          updateChatModeTip();
          input && input.focus();
          if (userList) userList.querySelectorAll('li').forEach(li => li.classList.remove('active'));
          return false;
        }
      }
    } else {
      chatModeTip.innerHTML = `房间：${roomNames[room] || room}（公开发言）`;
    }
  }

  function addMsg(nickname, text, isMe = false, time = null, isPrivate = false, peer = "") {
    if (!chatArea) return;
    const msg = document.createElement('div');
    msg.className = "msg-item" + (isMe ? " msg-me" : "") + (isPrivate ? " msg-private" : "");
    let privateInfo = "";
    if (isPrivate) {
      if (isMe) {
        privateInfo = `<span class="msg-private-tag">[私聊 ${peer}]</span>`;
      } else {
        privateInfo = `<span class="msg-private-tag">[私聊你]</span>`;
      }
    }
    msg.innerHTML = `
      <div class="msg-avatar">${nickname[0]}</div>
      <div>
        <div class="msg-nick">${nickname}${isMe ? "（我）" : ""} ${privateInfo}</div>
        <div class="msg-content">${escapeHTML(text)}</div>
        ${time ? `<div class="msg-time">${new Date(time).toLocaleTimeString()}</div>` : ""}
      </div>
    `;
    chatArea.appendChild(msg);
    chatArea.scrollTop = chatArea.scrollHeight;
  }

  function escapeHTML(s) {
    return String(s).replace(/[<>"'&]/g, c => ({
      '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '&': '&amp;'
    })[c]);
  }

  // 连接 Durable Object 的 WebSocket
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${location.host}/room/${encodeURIComponent(room)}`;
  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: "join", nickname }));
  };

  ws.onmessage = evt => {
    let msg;
    try { msg = JSON.parse(evt.data); } catch (e) { return; }
    if (msg.type === "chat") {
      addMsg(msg.nickname, msg.text, msg.nickname === nick, msg.time, false);
    } else if (msg.type === "private") {
      const isMe = msg.nickname === nick;
      const peer = isMe ? msg.target : msg.nickname;
      addMsg(msg.nickname, msg.text, isMe, msg.time, true, peer);
    } else if (msg.type === "system") {
      addMsg("系统", msg.text, false, msg.time || Date.now());
    } else if (msg.type === "userlist") {
      // 渲染在线用户列表
      if (!userList) return;
      userList.innerHTML = '';
      (msg.users || []).forEach(u => {
        if (u === nick) return; // 不显示自己
        const li = document.createElement('li');
        li.innerText = u;
        if (u === privateTarget) li.classList.add('active');
        li.onclick = () => {
          privateTarget = u;
          updateChatModeTip();
          userList.querySelectorAll('li').forEach(x => x.classList.remove('active'));
          li.classList.add('active');
          input && input.focus();
        };
        userList.appendChild(li);
      });
    }
  };

  ws.onerror = () => addMsg("系统", "连接服务器出错，请稍后重试", false);
  ws.onclose = () => addMsg("系统", "与服务器连接已断开", false);

  // 心跳保活
  setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "ping" }));
    }
  }, 20000);

  // 发送消息
  if (sendBtn && input) {
    sendBtn.onclick = () => {
      const txt = input.value.trim();
      if (!txt || ws.readyState !== WebSocket.OPEN) return;
      if (privateTarget) {
        ws.send(JSON.stringify({
          type: "private",
          text: txt,
          target: privateTarget
        }));
      } else {
        ws.send(JSON.stringify({
          type: "chat",
          text: txt
        }));
      }
      input.value = "";
    };
    input.onkeydown = e => { if (e.key === "Enter") sendBtn.onclick(); }
  }

  // 初始化
  updateChatModeTip();
}
