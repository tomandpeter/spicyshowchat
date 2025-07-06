// 适合demo的简单房间&在线用户管理
const roomConnections = {}; // { roomName: Set of ws }
const roomUsers = {}; // { roomName: Set of nickname }

export default {
  async fetch(request, env, ctx) {
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      server.accept();

      let room = null;
      let nickname = null;

      function broadcastUserList(room) {
        if (roomConnections[room]) {
          const users = Array.from(roomUsers[room] || []);
          const msg = JSON.stringify({ type: "userlist", users });
          for (const ws of roomConnections[room]) {
            try { ws.send(msg); } catch (e) {}
          }
        }
      }

      server.addEventListener("message", async (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "join") {
            // data: { type: "join", nickname, room }
            room = data.room;
            nickname = data.nickname;

            if (!roomConnections[room]) roomConnections[room] = new Set();
            if (!roomUsers[room]) roomUsers[room] = new Set();
            roomConnections[room].add(server);
            roomUsers[room].add(nickname);

            // 广播用户列表
            broadcastUserList(room);

            // 可选: 发送欢迎消息
            const welcome = { type: "system", text: `${nickname} 加入了房间` };
            for (const ws of roomConnections[room]) {
              try { ws.send(JSON.stringify(welcome)); } catch (e) {}
            }

          } else if (data.type === "chat") {
            // 群聊消息
            const msg = {
              type: "chat",
              nickname,
              text: data.text,
              time: Date.now()
            };
            for (const ws of roomConnections[room] || []) {
              try { ws.send(JSON.stringify(msg)); } catch (e) {}
            }

          } else if (data.type === "private") {
            // 私聊消息，只发给当前用户和目标用户
            const msg = {
              type: "private",
              nickname,
              text: data.text,
              time: Date.now(),
              target: data.target
            };

            for (const ws of roomConnections[room] || []) {
              if (ws._nickname === data.target || ws === server) {
                try { ws.send(JSON.stringify(msg)); } catch (e) {}
              }
            }
          }
        } catch (e) {
          // 可记录日志
        }
      });

      // 给ws挂载nickname用于私聊
      server._nickname = nickname;

      server.addEventListener("close", () => {
        if (room && roomConnections[room]) {
          roomConnections[room].delete(server);
          if (nickname && roomUsers[room]) roomUsers[room].delete(nickname);
          broadcastUserList(room);
          // 可选: 广播离开消息
          const bye = { type: "system", text: `${nickname} 离开了房间` };
          for (const ws of roomConnections[room] || []) {
            try { ws.send(JSON.stringify(bye)); } catch (e) {}
          }
        }
      });

      server.addEventListener("error", () => {
        if (room && roomConnections[room]) {
          roomConnections[room].delete(server);
          if (nickname && roomUsers[room]) roomUsers[room].delete(nickname);
          broadcastUserList(room);
        }
      });

      return new Response(null, { status: 101, webSocket: server });
    }

    // HTTP 访问返回说明
    return new Response("Hello from spicyshowchat Worker (rooms demo)!", { status: 200 });
  }
};
