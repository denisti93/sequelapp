import cors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import Fastify from 'fastify';
import { env } from './config/env.js';
import { authRoutes } from './routes/auth-routes.js';
import { peladaRoutes } from './routes/pelada-routes.js';
import { userRoutes } from './routes/user-routes.js';
import { getProfileImageObjectByFilename, validateProfileImageFilename } from './utils/profile-image.js';

export function buildApp() {
  const app = Fastify({
    logger: true,
    bodyLimit: 6 * 1024 * 1024
  });

  app.decorate('config', {
    jwtAccessExpiresIn: env.jwtAccessExpiresIn,
    jwtRefreshExpiresIn: env.jwtRefreshExpiresIn,
    authRefreshCookieName: env.authRefreshCookieName
  });

  app.register(cors, {
    origin: true,
    credentials: true
  });

  app.register(fastifyJwt, {
    secret: env.jwtSecret
  });

  app.get('/health', async () => ({ ok: true }));

  app.get('/uploads/profiles/:filename', async (request, reply) => {
    const filename = decodeURIComponent(String(request.params?.filename || ''));

    if (!validateProfileImageFilename(filename)) {
      return reply.code(400).send({ message: 'Arquivo de imagem invalido.' });
    }

    const imageObject = await getProfileImageObjectByFilename(filename);
    if (!imageObject?.body) {
      return reply.code(404).send({ message: 'Imagem nao encontrada.' });
    }

    reply.type(imageObject.contentType || 'application/octet-stream');
    reply.header('Cache-Control', imageObject.cacheControl || 'public, max-age=31536000, immutable');
    return reply.send(imageObject.body);
  });

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
