import crypto from 'node:crypto';
import { User } from '../models/User.js';
import { comparePassword, hashPassword } from '../utils/password.js';
import { sanitizeUserPayloadForRole } from '../utils/user-visibility.js';

const DURATION_UNITS_MS = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000
};

function parseDurationToMs(value, fallbackMs) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }

  const raw = String(value || '').trim().toLowerCase();
  const matched = raw.match(/^(\d+)(ms|s|m|h|d)$/);
  if (!matched) {
    return fallbackMs;
  }

  const amount = Number(matched[1]);
  const unit = matched[2];
  const multiplier = DURATION_UNITS_MS[unit];
  if (!Number.isFinite(amount) || amount <= 0 || !multiplier) {
    return fallbackMs;
  }

  return amount * multiplier;
}

function issueAccessToken(fastify, user) {
  return fastify.jwt.sign(
    {
      id: String(user._id),
      username: user.username,
      role: user.role,
      name: user.name
    },
    {
      expiresIn: fastify.config.jwtAccessExpiresIn
    }
  );
}

function generateRefreshTokenValue() {
  return crypto.randomBytes(48).toString('base64url');
}

function hashRefreshToken(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function readCookie(request, cookieName) {
  const rawCookie = String(request.headers?.cookie || '');
  if (!rawCookie || !cookieName) {
    return '';
  }

  for (const part of rawCookie.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === cookieName) {
      return decodeURIComponent(rest.join('=') || '');
    }
  }

  return '';
}

function resolveCookieSecurity(request) {
  const host = String(request.headers.host || '').toLowerCase();
  const isLocalHost = host.includes('localhost') || host.includes('127.0.0.1');

  return {
    secure: !isLocalHost,
    sameSite: isLocalHost ? 'Lax' : 'None'
  };
}

function serializeCookie(name, value, options = {}) {
  const segments = [`${name}=${encodeURIComponent(value)}`];
  if (typeof options.maxAge === 'number') {
    segments.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  }
  if (options.expires instanceof Date) {
    segments.push(`Expires=${options.expires.toUTCString()}`);
  }
  segments.push(`Path=${options.path || '/'}`);
  if (options.httpOnly !== false) {
    segments.push('HttpOnly');
  }
  if (options.secure) {
    segments.push('Secure');
  }
  if (options.sameSite) {
    segments.push(`SameSite=${options.sameSite}`);
  }
  return segments.join('; ');
}

function setRefreshCookie(reply, request, cookieName, refreshToken, refreshDurationMs) {
  const { secure, sameSite } = resolveCookieSecurity(request);
  reply.header(
    'Set-Cookie',
    serializeCookie(cookieName, refreshToken, {
      path: '/',
      httpOnly: true,
      secure,
      sameSite,
      maxAge: Math.floor(refreshDurationMs / 1_000),
      expires: new Date(Date.now() + refreshDurationMs)
    })
  );
}

function clearRefreshCookie(reply, request, cookieName) {
  const { secure, sameSite } = resolveCookieSecurity(request);
  reply.header(
    'Set-Cookie',
    serializeCookie(cookieName, '', {
      path: '/',
      httpOnly: true,
      secure,
      sameSite,
      maxAge: 0,
      expires: new Date(0)
    })
  );
}

async function persistAndSetRefreshToken({
  user,
  request,
  reply,
  cookieName,
  refreshDurationMs
}) {
  const refreshTokenValue = generateRefreshTokenValue();
  user.refreshTokenHash = hashRefreshToken(refreshTokenValue);
  user.refreshTokenExpiresAt = new Date(Date.now() + refreshDurationMs);
  await user.save();
  setRefreshCookie(reply, request, cookieName, refreshTokenValue, refreshDurationMs);
}

async function buildAuthSuccessResponse({ fastify, user }) {
  const token = issueAccessToken(fastify, user);
  return {
    token,
    user: sanitizeUserPayloadForRole(user.toJSON(), user.role, {
      includeOwnRatings: true
    })
  };
}

export async function authRoutes(fastify) {
  const refreshDurationMs = parseDurationToMs(fastify.config.jwtRefreshExpiresIn, 30 * 86_400_000);
  const refreshCookieName = String(fastify.config.authRefreshCookieName || 'pelada_manager_refresh');

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

    await persistAndSetRefreshToken({
      user,
      request,
      reply,
      cookieName: refreshCookieName,
      refreshDurationMs
    });

    return buildAuthSuccessResponse({ fastify, user });
  });

  fastify.post('/refresh', async (request, reply) => {
    const refreshToken = readCookie(request, refreshCookieName);
    if (!refreshToken) {
      clearRefreshCookie(reply, request, refreshCookieName);
      return reply.code(401).send({ message: 'Sessao expirada. Faca login novamente.' });
    }

    const refreshTokenHash = hashRefreshToken(refreshToken);
    const user = await User.findOne({ refreshTokenHash });
    if (!user) {
      request.log.warn('Refresh token nao encontrado na base.');
      clearRefreshCookie(reply, request, refreshCookieName);
      return reply.code(401).send({ message: 'Sessao expirada. Faca login novamente.' });
    }

    const expiresAt = new Date(user.refreshTokenExpiresAt || 0);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      request.log.warn(
        {
          userId: String(user._id),
          username: user.username
        },
        'Refresh token expirado.'
      );
      user.refreshTokenHash = undefined;
      user.refreshTokenExpiresAt = undefined;
      await user.save();
      clearRefreshCookie(reply, request, refreshCookieName);
      return reply.code(401).send({ message: 'Sessao expirada. Faca login novamente.' });
    }

    const approvalStatus = user.approvalStatus || 'APPROVED';
    if (user.role === 'JOGADOR' && approvalStatus !== 'APPROVED') {
      clearRefreshCookie(reply, request, refreshCookieName);
      return reply.code(403).send({
        message: 'Seu cadastro ainda nao foi aprovado por um ADM.'
      });
    }

    await persistAndSetRefreshToken({
      user,
      request,
      reply,
      cookieName: refreshCookieName,
      refreshDurationMs
    });

    return buildAuthSuccessResponse({ fastify, user });
  });

  fastify.post('/logout', async (request, reply) => {
    const refreshToken = readCookie(request, refreshCookieName);
    if (refreshToken) {
      const refreshTokenHash = hashRefreshToken(refreshToken);
      await User.updateOne(
        { refreshTokenHash },
        {
          $unset: {
            refreshTokenHash: 1,
            refreshTokenExpiresAt: 1
          }
        }
      );
    }

    clearRefreshCookie(reply, request, refreshCookieName);
    return { message: 'Sessao encerrada com sucesso.' };
  });
}
