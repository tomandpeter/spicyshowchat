// 简单的内存在线连接记录，每台实例独立，适合入门和 demo
const activeConnections = {}; // { chatId: Set of ws }

function getChatId(userA, userB) {
  // 保证 chatId 唯一且顺序无关
  return [userA, userB].sort().join("_");
}

export default {
  async fetch(request, env, ctx) {
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      server.accept();

      // 记录连接归属 chatId
      let chatId = null;

      server.addEventListener("message", async (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "join") {
            // data: { type: "join", userId: "A", targetId: "B" }
            chatId = getChatId(data.userId, data.targetId);

            if (!activeConnections[chatId]) activeConnections[chatId] = new Set();
            activeConnections[chatId].add(server);

            // 推送历史消息
            const historyRaw = await env.KV_BINDING.get(chatId);
            if (historyRaw) {
              const history = JSON.parse(historyRaw);
              for (const msg of history) {
                server.send(JSON.stringify({ type: "message", ...msg }));
              }
            }

          } else if (data.type === "message") {
            // data: { type: "message", chatId, from, to, content }
            const msg = {
              from: data.from,
              to: data.to,
              content: data.content,
              timestamp: Date.now(),
            };

            // 持久化到 KV
            let messages = [];
            const oldRaw = await env.KV_BINDING.get(data.chatId);
            if (oldRaw) {
              messages = JSON.parse(oldRaw);
            }
            messages.push(msg);
            await env.KV_BINDING.put(data.chatId, JSON.stringify(messages));

            // 实时推送给当前房间的所有连接
            if (activeConnections[data.chatId]) {
              for (const ws of activeConnections[data.chatId]) {
                try {
                  ws.send(JSON.stringify({ type: "message", ...msg }));
                } catch (e) {/* 忽略发送失败 */}
              }
            }
          }
        } catch (e) {
          // 可记录日志
        }
      });

      server.addEventListener("close", () => {
        if (chatId && activeConnections[chatId]) {
          activeConnections[chatId].delete(server);
          if (activeConnections[chatId].size === 0) delete activeConnections[chatId];
        }
      });

      server.addEventListener("error", () => {
        if (chatId && activeConnections[chatId]) {
          activeConnections[chatId].delete(server);
          if (activeConnections[chatId].size === 0) delete activeConnections[chatId];
        }
      });

      return new Response(null, { status: 101, webSocket: server });
    }

    // HTTP 访问返回说明
    return new Response("Hello from spicyshowchat Worker!", { status: 200 });
  }
};
