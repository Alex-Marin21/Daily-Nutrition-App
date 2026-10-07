// Vercel serverless entry: every /api/* request is routed here (see vercel.json).
import { handleRequest } from '../server/app.js';

export default handleRequest;
