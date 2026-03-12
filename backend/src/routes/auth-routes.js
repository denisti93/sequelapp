import { User } from '../models/User.js';
import { comparePassword, hashPassword } from '../utils/password.js';

function issueToken(fastify, user) {
  return fastify.jwt.sign(
    {
      id: String(user._id),
      username: user.username,
      role: user.role,
      name: user.name
    },
    {
      expiresIn: fastify.config.jwtExpiresIn
    }
  );
}

export async function authRoutes(fastify) {
  fastify.post('/signup', async (request, reply) => {
    const { name, username, password } = request.body || {};

    if (!name || !username || !password) {
      return reply
        .code(400)
        .send({ message: 'Campos obrigatorios: name, username e password.' });
    }

    if (String(password).length < 6) {
      return reply
        .code(400)
        .send({ message: 'A senha deve ter no minimo 6 caracteres.' });
    }

    const existingUser = await User.findOne({ username }).lean();
    if (existingUser) {
      return reply.code(409).send({ message: 'Username ja cadastrado.' });
    }

    const user = await User.create({
      name,
      username,
      role: 'JOGADOR',
      passwordHash: await hashPassword(password),
      initialRating: 3,
      ratingAverage: 3
    });

    const token = issueToken(fastify, user);

    return reply.code(201).send({
      token,
      user: user.toJSON()
    });
  });

  fastify.post('/login', async (request, reply) => {
    const { username, password } = request.body || {};

    if (!username || !password) {
      return reply
        .code(400)
        .send({ message: 'Campos obrigatorios: username e password.' });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return reply.code(401).send({ message: 'Credenciais invalidas.' });
    }

    const isPasswordValid = await comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return reply.code(401).send({ message: 'Credenciais invalidas.' });
    }

    const token = issueToken(fastify, user);
    return {
      token,
      user: user.toJSON()
    };
  });
}
