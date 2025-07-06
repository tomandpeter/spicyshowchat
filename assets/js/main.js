// 聊天室核心逻辑（支持群聊和私聊）

const nick = localStorage.getItem('nickname') || "匿名用户";
const room = localStorage.getItem('room') || "city";
const roomNames = { city: "同城聊天室", love: "感情聊天室", crypto: "加密货币聊天室" };

let privateTarget = null; // 当前私聊对象，未选中时为null

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
const userList = document.getElementById('user-list'); // 右侧用户列表容器
const chatModeTip = document.getElementById('chat-mode-tip'); // 顶部提示容器

function updateChatModeTip() {
  if (!chatModeTip) return;
  if (privateTarget) {
    chatModeTip.innerHTML = `你对 <b>${privateTarget}</b> 说... <a href="#" id="cancel-private">(取消私聊)</a>`;
    document.getElementById('cancel-private').onclick = () => {
      privateTarget = null;
      updateChatModeTip();
      input.focus();
      // 高亮回归
      document.querySelectorAll('#user-list li').forEach(li => li.classList.remove('active'));
      return false;
    }
  } else {
    chatModeTip.innerHTML = `房间：${roomNames[room] || room}（公开发言）`;
  }
}

function addMsg(nickname, text, isMe = false, time = null, isPrivate = false, peer = "") {
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

// 连接 WebSocket
const ws = new WebSocket("wss://ws.chat.spicyshow.xyz");

ws.onopen = () => {
  ws.send(JSON.stringify({ type: "join", nickname: nick, room }));
};

ws.onmessage = evt => {
  const msg = JSON.parse(evt.data);
  if (msg.type === "chat") {
    addMsg(msg.nickname, msg.text, msg.nickname === nick, msg.time, false);
  } else if (msg.type === "private") {
    // 私聊消息，只有你或对方能收到
    const isMe = msg.nickname === nick;
    const peer = isMe ? msg.target : msg.nickname;
    addMsg(msg.nickname, msg.text, isMe, msg.time, true, peer);
  } else if (msg.type === "system") {
    addMsg("系统", msg.text, false, msg.time || Date.now());
  } else if (msg.type === "userlist") {
    // 更新在线用户列表
    userList.innerHTML = '';
    msg.users.forEach(u => {
      if (u === nick) return; // 不显示自己
      const li = document.createElement('li');
      li.innerText = u;
      if (u === privateTarget) li.classList.add('active');
      li.onclick = () => {
        privateTarget = u;
        updateChatModeTip();
        // 高亮
        userList.querySelectorAll('li').forEach(x => x.classList.remove('active'));
        li.classList.add('active');
        input.focus();
      };
      userList.appendChild(li);
    });
  }
};

ws.onerror = () => addMsg("系统", "连接服务器出错，请稍后重试", false);
ws.onclose = () => addMsg("系统", "与服务器连接已断开", false);

if (sendBtn) {
  sendBtn.onclick = () => {
    const txt = input.value.trim();
    if (!txt) return;
    if (privateTarget) {
      ws.send(JSON.stringify({
        type: "private",
        text: txt,
        target: privateTarget,
        nickname: nick,
        room
      }));
    } else {
      ws.send(JSON.stringify({
        type: "chat",
        text: txt,
        nickname: nick,
        room
      }));
    }
    input.value = "";
  };
  input.onkeydown = e => { if (e.key === "Enter") sendBtn.onclick(); }
}

// 初始化提示
updateChatModeTip();
