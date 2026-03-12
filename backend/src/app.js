import cors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import Fastify from 'fastify';
import { env } from './config/env.js';
import { authRoutes } from './routes/auth-routes.js';
import { peladaRoutes } from './routes/pelada-routes.js';
import { userRoutes } from './routes/user-routes.js';

export function buildApp() {
  const app = Fastify({ logger: true });

  app.decorate('config', {
    jwtExpiresIn: env.jwtExpiresIn
  });

  app.register(cors, {
    origin: true
  });

  app.register(fastifyJwt, {
    secret: env.jwtSecret
  });

  app.get('/health', async () => ({ ok: true }));

  app.register(authRoutes, { prefix: '/auth' });
  app.register(userRoutes, { prefix: '/users' });
  app.register(peladaRoutes, { prefix: '/peladas' });

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);

    if (error.validation) {
      return reply.code(400).send({ message: 'Payload invalido.', details: error.validation });
    }

    return reply.code(error.statusCode || 500).send({
      message: error.message || 'Erro interno do servidor.'
    });
  });

  return app;
}
