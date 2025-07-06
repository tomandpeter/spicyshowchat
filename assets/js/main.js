// 聊天室核心逻辑（对接 Cloudflare Worker WebSocket 版）

const nick = localStorage.getItem('nickname') || "匿名用户";
const room = localStorage.getItem('room') || "city";
const roomNames = { city: "同城聊天室", love: "感情聊天室", crypto: "加密货币聊天室" };

if (document.getElementById('my-nick')) {
  document.getElementById('my-nick').innerText = nick;
  document.getElementById('room-name').innerText = roomNames[room] || "聊天室";
}

// 高亮当前房间
if (document.querySelector('.room-list')) {
  document.querySelectorAll('.room-list li').forEach(li => {
    if (li.dataset.room === room) li.classList.add('active');
    li.onclick = () => {
      if (li.dataset.room === room) return;
      localStorage.setItem('room', li.dataset.room);
      location.reload();
    }
  });
}

// 注销切换
if (document.getElementById('logout')) {
  document.getElementById('logout').onclick = () => {
    localStorage.removeItem('nickname');
    localStorage.removeItem('room');
    location.href = "index.html";
  }
}

// 发送消息与渲染
const chatArea = document.getElementById('chat-area');
const input = document.getElementById('msg-input');
const sendBtn = document.getElementById('send-btn');

function addMsg(nick, text, isMe = false, time = null) {
  const msg = document.createElement('div');
  msg.className = "msg-item" + (isMe ? " msg-me" : "");
  msg.innerHTML = `
    <div class="msg-avatar">${nick[0]}</div>
    <div>
      <div class="msg-nick">${nick}${isMe ? "（我）" : ""}</div>
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

// 连接 WebSocket
const ws = new WebSocket("wss://ws.chat.spicyshow.xyz");

ws.onopen = () => {
  ws.send(JSON.stringify({ type: "join", nickname: nick, room }));
  // 加载历史消息（建议用 Worker 的 history 路径，跨域需代理或CORS）
  fetch(`/history/${room}`)
    .then(r => r.json())
    .then(history => {
      history.forEach(msg => addMsg(msg.nickname, msg.text, msg.nickname === nick, msg.time));
    });
};

ws.onmessage = evt => {
  const msg = JSON.parse(evt.data);
  if (msg.type === "chat") {
    addMsg(msg.nickname, msg.text, msg.nickname === nick, msg.time);
  } else if (msg.type === "system") {
    addMsg("系统", msg.text, false, msg.time || Date.now());
  }
};

ws.onerror = () => {
  addMsg("系统", "连接服务器出错，请稍后重试", false);
};

ws.onclose = () => {
  addMsg("系统", "与服务器连接已断开", false);
};

if (sendBtn) {
  sendBtn.onclick = () => {
    const txt = input.value.trim();
    if (!txt) return;
    ws.send(JSON.stringify({ type: "chat", text: txt }));
    input.value = "";
  };
  input.onkeydown = e => { if (e.key === "Enter") sendBtn.onclick(); }
}
