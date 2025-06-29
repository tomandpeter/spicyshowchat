// 聊天室核心逻辑（静态演示版，后续可对接WebSocket/API）

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

// 发送消息（静态演示，后续对接API）
const chatArea = document.getElementById('chat-area');
const input = document.getElementById('msg-input');
const sendBtn = document.getElementById('send-btn');

function addMsg(nick, text, isMe = false) {
  const msg = document.createElement('div');
  msg.className = "msg-item" + (isMe ? " msg-me" : "");
  msg.innerHTML = `
    <div class="msg-avatar">${nick[0]}</div>
    <div>
      <div class="msg-nick">${nick}${isMe ? "（我）" : ""}</div>
      <div class="msg-content">${text.replace(/[<>"']/g, '')}</div>
    </div>
  `;
  chatArea.appendChild(msg);
  chatArea.scrollTop = chatArea.scrollHeight;
}

if (sendBtn) {
  sendBtn.onclick = () => {
    const txt = input.value.trim();
    if (!txt) return;
    addMsg(nick, txt, true);
    input.value = "";
    // TODO: 这里可以调用API发送消息
    // fetch('/api/room?id=' + room, {method:'POST', body: JSON.stringify({nick, text: txt})})
  };
  input.onkeydown = e => { if (e.key === "Enter") sendBtn.onclick(); }
}

// 静态演示历史消息
if (chatArea && !chatArea.dataset.demoed) {
  chatArea.dataset.demoed = 1;
  addMsg("小辣椒", "欢迎来到辣聊聊天室，快来和大家打个招呼吧！");
  addMsg("区块链小王", "大家好，我是新来的，喜欢加密货币的朋友一起聊聊！", false);
}
