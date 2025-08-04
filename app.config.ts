import { defineConfig } from "@solidjs/start/config";

export default defineConfig({
  server: {
    preset: "deno-deploy"
  },
  vite: {
    server: {
      host: true,
      allowedHosts: ['311661ab5901.ngrok-free.app', '.ngrok-free.app']
    }
  }
});
