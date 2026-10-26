import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { environment: "jsdom", environmentOptions: { jsdom: { pretendToBeVisual: true } }, include: ["test/**/*.test.{ts,tsx}"] },
});
