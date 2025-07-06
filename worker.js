export default {
  async fetch(request, env, ctx) {
    if (request.headers.get("Upgrade") === "websocket") {
      // WebSocket handshake
      const [client, server] = Object.values(new WebSocketPair());
      server.accept();
      server.addEventListener("message", async (event) => {
        // 简单地广播消息到 KV
        await env.KV_BINDING.put("last_message", event.data);
      });
      // 推送上次消息
      const last = await env.KV_BINDING.get("last_message");
      if (last) server.send(last);
      return new Response(null, { status: 101, webSocket: client });
    }
    return new Response("Hello from spicyshowchat Worker!", { status: 200 });
  }
};
