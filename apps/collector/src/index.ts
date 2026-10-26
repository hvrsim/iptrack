import { WorkerEntrypoint } from "cloudflare:workers";
import { maintain } from "./lib/maintenance";
import { app } from "@/hono/app";

export default class DataService extends WorkerEntrypoint<Env> {
  async scheduled() { await maintain(this.env); }

  fetch(request: Request) {
    return app.fetch(request, this.env, this.ctx);
  }
}
