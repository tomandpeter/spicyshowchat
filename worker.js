export class ChatRoomDurableObject {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.clients = [];
  }

  async fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected websocket", { status: 400 });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    this.clients.push(server);

    server.addEventListener("message", evt => {
      for (const c of this.clients) {
        if (c !== server) {
          c.send(evt.data);
        }
      }
    });
    server.addEventListener("close", () => {
      this.clients = this.clients.filter(c => c !== server);
    });
    return new Response(null, { status: 101, webSocket: server });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const room = url.pathname.split("/").pop();
    const id = env.CHATROOM.idFromName(room);
    return env.CHATROOM.get(id).fetch(request);
  }
};
