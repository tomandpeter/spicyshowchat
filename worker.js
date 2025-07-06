// Cloudflare Worker Durable Object 聊天室模板
export class ChatRoomDurableObject {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.clients = new Set(); // { ws, nickname }
    this.nicknames = new Map(); // ws => nickname
  }

  // 广播消息给所有客户端
  broadcast(data) {
    const msg = JSON.stringify(data);
    for (const ws of this.clients) {
      try { ws.send(msg); } catch (e) {}
    }
  }

  // 广播在线用户列表
  broadcastUserList() {
    const users = Array.from(this.nicknames.values());
    this.broadcast({ type: "userlist", users });
  }

  async fetch(request) {
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      server.accept();

      let nickname = null;

      // 心跳保活
      let heartbeat = setInterval(() => {
        try { server.send(JSON.stringify({ type: "ping" })); } catch (e) {}
      }, 20000);

      server.addEventListener("message", async (event) => {
        try {
          const data = JSON.parse(event.data);

          // 加入房间
          if (data.type === "join") {
            nickname = data.nickname || "匿名用户";
            this.clients.add(server);
            this.nicknames.set(server, nickname);
            // 通知全员有人加入
            this.broadcast({
              type: "system",
              text: `${nickname} 加入了房间`
            });
            this.broadcastUserList();
          }
          // 普通聊天
          else if (data.type === "chat") {
            const msg = {
              type: "chat",
              nickname,
              text: data.text,
              time: Date.now()
            };
            this.broadcast(msg);
          }
          // 私聊
          else if (data.type === "private" && data.target) {
            const targetWs = Array.from(this.nicknames.entries())
              .find(([ws, nick]) => nick === data.target)?.[0];
            if (targetWs) {
              const msg = {
                type: "private",
                nickname,
                text: data.text,
                time: Date.now(),
                target: data.target
              };
              // 只发给目标和自己
              [targetWs, server].forEach(ws => {
                try { ws.send(JSON.stringify(msg)); } catch (e) {}
              });
            }
          }
        } catch (e) {
          // ignore
        }
      });

      // 断开、异常处理
      const closeConn = () => {
        clearInterval(heartbeat);
        this.clients.delete(server);
        if (nickname) {
          this.nicknames.delete(server);
          this.broadcast({
            type: "system",
            text: `${nickname} 离开了房间`
          });
          this.broadcastUserList();
        }
      };
      server.addEventListener("close", closeConn);
      server.addEventListener("error", closeConn);

      return new Response(null, { status: 101, webSocket: server });
    }

    return new Response("This endpoint only supports WebSocket connections.", { status: 400 });
  }
}

// Worker 入口
export default {
  async fetch(request, env) {
    // 路径格式: /room/<房间名>，如 /room/city
    const url = new URL(request.url);
    const roomMatch = url.pathname.match(/^\/room\/([\w-]+)$/);
    if (roomMatch && request.headers.get("Upgrade") === "websocket") {
      const roomName = roomMatch[1];
      const id = env.CHATROOM.idFromName(roomName);
      return env.CHATROOM.get(id).fetch(request);
    }
    return new Response("请通过 /room/<房间名> 连接 WebSocket 聊天室", { status: 200 });
  },
};
