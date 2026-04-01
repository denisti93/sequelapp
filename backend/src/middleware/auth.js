import { User } from '../models/User.js';

export async function authenticate(request, reply) {
  try {
    await request.jwtVerify();

    const dbUser = await User.findById(request.user.id, 'role approvalStatus name username').lean();
    if (!dbUser) {
      request.log.warn(
        {
          authUserId: request.user?.id
        },
        'Token JWT validado, mas o usuario nao foi encontrado no banco.'
      );
      return reply.code(401).send({ message: 'Token invalido ou ausente.' });
    }

    const approvalStatus = dbUser.approvalStatus || 'APPROVED';
    if (dbUser.role === 'JOGADOR' && approvalStatus !== 'APPROVED') {
      return reply.code(403).send({
        message: 'Seu cadastro ainda nao foi aprovado por um ADM.'
      });
    }

    request.user = {
      ...request.user,
      role: dbUser.role,
      approvalStatus,
      name: dbUser.name,
      username: dbUser.username
    };
  } catch (error) {
    request.log.warn(
      {
        jwtErrorCode: error?.code,
        jwtErrorName: error?.name,
        jwtErrorMessage: error?.message
      },
      'Falha na validacao do token JWT.'
    );
    return reply.code(401).send({ message: 'Token invalido ou ausente.' });
  }
}

export function authorize(...roles) {
  return async function roleGuard(request, reply) {
    if (!request.user || !roles.includes(request.user.role)) {
      return reply.code(403).send({ message: 'Sem permissao para esta operacao.' });
    }
  };
}
