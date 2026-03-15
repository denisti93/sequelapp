import { User } from '../models/User.js';
import { comparePassword, hashPassword } from '../utils/password.js';
import { sanitizeUserPayloadForRole } from '../utils/user-visibility.js';

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
    const { name, lastName, username, password } = request.body || {};

    if (!name || !lastName || !username || !password) {
      return reply
        .code(400)
        .send({ message: 'Campos obrigatorios: name, lastName, username e password.' });
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

    await User.create({
      name: `${String(name).trim()} ${String(lastName).trim()}`.trim(),
      username,
      role: 'JOGADOR',
      approvalStatus: 'PENDING',
      passwordHash: await hashPassword(password),
      initialRating: 3,
      ratingAverage: 3
    });

    return reply.code(201).send({
      message:
        'Cadastro enviado com sucesso. Aguarde a aprovacao de um ADM para acessar o app.'
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

    const approvalStatus = user.approvalStatus || 'APPROVED';
    if (user.role === 'JOGADOR' && approvalStatus !== 'APPROVED') {
      return reply.code(403).send({
        message: 'Seu cadastro ainda nao foi aprovado por um ADM.'
      });
    }

    const token = issueToken(fastify, user);
    return {
      token,
      user: sanitizeUserPayloadForRole(user.toJSON(), user.role)
    };
  });
}
