import { buildApp } from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';

async function start() {
  try {
    await connectDB();

    const app = buildApp();
    await app.listen({ port: env.port, host: '0.0.0.0' });

    app.log.info(`Servidor iniciado na porta ${env.port}`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  }
}

start();
