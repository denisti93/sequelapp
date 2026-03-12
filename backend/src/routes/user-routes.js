import { authenticate, authorize } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { recalculateAllUsersStats } from '../services/stats-service.js';

export async function userRoutes(fastify) {
  fastify.get('/me', { preHandler: [authenticate] }, async (request) => {
    const user = await User.findById(request.user.id);
    if (!user) {
      return { message: 'Usuario nao encontrado.' };
    }

    return user.toJSON();
  });

  fastify.patch('/me/position', { preHandler: [authenticate] }, async (request, reply) => {
    if (request.user.role !== 'JOGADOR') {
      return reply.code(403).send({ message: 'Apenas jogadores podem definir posicao.' });
    }

    const { position } = request.body || {};
    const normalizedPosition = String(position || '').trim().toUpperCase();
    const validPositions = ['ZAGUEIRO', 'MEIA', 'ATACANTE'];

    if (!validPositions.includes(normalizedPosition)) {
      return reply
        .code(400)
        .send({ message: 'Posicao invalida. Use ZAGUEIRO, MEIA ou ATACANTE.' });
    }

    const user = await User.findByIdAndUpdate(
      request.user.id,
      { $set: { position: normalizedPosition } },
      { new: true }
    );

    if (!user) {
      return reply.code(404).send({ message: 'Usuario nao encontrado.' });
    }

    return {
      message: 'Posicao atualizada com sucesso.',
      user: user.toJSON()
    };
  });

  fastify.get(
    '/pending',
    {
      preHandler: [authenticate, authorize('ADM')]
    },
    async () => {
      const pendingUsers = await User.find(
        {
          role: 'JOGADOR',
          approvalStatus: 'PENDING'
        },
        'name username role approvalStatus createdAt'
      )
        .sort({ createdAt: 1, name: 1 })
        .lean();

      return pendingUsers.map((user) => ({
        id: String(user._id),
        name: user.name,
        username: user.username,
        role: user.role,
        approvalStatus: user.approvalStatus,
        createdAt: user.createdAt
      }));
    }
  );

  fastify.get('/', { preHandler: [authenticate] }, async () => {
    const users = await User.find({
      role: 'JOGADOR',
      $or: [{ approvalStatus: 'APPROVED' }, { approvalStatus: { $exists: false } }]
    })
      .sort({ totalGoals: -1, totalAssists: -1, ratingAverage: -1, name: 1 })
      .lean();

    return users.map((user) => ({
      id: String(user._id),
      name: user.name,
      username: user.username,
      role: user.role,
      position: user.position,
      approvalStatus: user.approvalStatus || 'APPROVED',
      ratingAverage: user.ratingAverage,
      totalGoals: user.totalGoals,
      totalAssists: user.totalAssists,
      totalWins: user.totalWins,
      totalDraws: user.totalDraws,
      totalLosses: user.totalLosses,
      totalCraquePoints: user.totalCraquePoints || 0,
      totalCraqueFirstPlaces: user.totalCraqueFirstPlaces || 0,
      totalCraqueSecondPlaces: user.totalCraqueSecondPlaces || 0,
      totalCraqueThirdPlaces: user.totalCraqueThirdPlaces || 0
    }));
  });

  fastify.patch(
    '/:id/approve',
    {
      preHandler: [authenticate, authorize('ADM')]
    },
    async (request, reply) => {
      const { id } = request.params;

      const user = await User.findOneAndUpdate(
        {
          _id: id,
          role: 'JOGADOR'
        },
        { $set: { approvalStatus: 'APPROVED' } },
        { new: true }
      );

      if (!user) {
        return reply.code(404).send({ message: 'Jogador nao encontrado.' });
      }

      return {
        message: 'Jogador aprovado com sucesso.',
        user: user.toJSON()
      };
    }
  );

  fastify.patch(
    '/:id/initial-rating',
    {
      preHandler: [authenticate, authorize('ADM')]
    },
    async (request, reply) => {
      const { id } = request.params;
      const { initialRating } = request.body || {};

      if (typeof initialRating !== 'number' || initialRating < 1 || initialRating > 5) {
        return reply
          .code(400)
          .send({ message: 'A nota inicial deve ser um numero entre 1 e 5.' });
      }

      const user = await User.findByIdAndUpdate(
        id,
        { $set: { initialRating, ratingAverage: initialRating } },
        { new: true }
      );

      if (!user) {
        return reply.code(404).send({ message: 'Usuario nao encontrado.' });
      }

      await recalculateAllUsersStats();

      return user.toJSON();
    }
  );
}
