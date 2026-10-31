import { createApp, listen } from './app.js';
import { readPort } from './config.js';

const port = readPort(process.env);
await listen(createApp(), port);
