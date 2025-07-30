import { defineConfig } from "@solidjs/start/config";

export default defineConfig({
  vite: {
    server: {
      host: true,
      allowedHosts: ['311661ab5901.ngrok-free.app', '.ngrok-free.app']
    }
  }
});
