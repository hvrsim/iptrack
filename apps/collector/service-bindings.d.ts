interface ExampleWorkflowParmas {
  dataToPassIn;
}

interface Env extends Cloudflare.Env {
  DB: D1Database;
}
