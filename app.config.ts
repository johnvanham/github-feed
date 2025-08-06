import { defineConfig } from "@solidjs/start/config";

export default defineConfig({
  server: {
    preset: "node-server"
  },
  vite: {
    server: {
      host: true,
      allowedHosts: ['311661ab5901.ngrok-free.app', '.ngrok-free.app']
    }
  }
});
