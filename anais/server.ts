import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";
import { attachSocket } from "./socket/io";
import { setIo } from "./socket/singleton";
import { runRetentionTick } from "@/lib/retention-tick";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "0.0.0.0";
const port = parseInt(process.env.PORT ?? "3000", 10);

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    try {
      const parsedUrl = parse(req.url ?? "", true);
      void handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Request error", err);
      res.statusCode = 500;
      res.end("internal error");
    }
  });

  const io = new Server(httpServer, {
    path: "/socket.io",
    cors: {
      origin: process.env.NEXTAUTH_URL ?? true,
      credentials: true,
    },
  });

  setIo(io);
  attachSocket(io, httpServer);

  httpServer.listen(port, hostname, () => {
    console.log(`> Anaïs ready on http://${hostname}:${port}`);
  });

  const retentionMs = Number(process.env.RETENTION_TICK_MS ?? 15 * 60 * 1000);
  setInterval(() => {
    void runRetentionTick().catch((e) => console.error("retention", e));
  }, retentionMs);
});
