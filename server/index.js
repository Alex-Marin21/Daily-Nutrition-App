// Runs the app as a normal long-lived server (local development, Docker, Render).
import http from 'node:http';
import { handleRequest } from './app.js';

const PORT = Number(process.env.PORT || 3000);

http.createServer(handleRequest).listen(PORT, () => {
  console.log(`Daily Nutrition running on http://localhost:${PORT}`);
});
