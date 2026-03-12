export async function authenticate(request, reply) {
  try {
    await request.jwtVerify();
  } catch {
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
