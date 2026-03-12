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

  fastify.get('/', { preHandler: [authenticate] }, async () => {
    const users = await User.find({ role: 'JOGADOR' })
      .sort({ totalGoals: -1, totalAssists: -1, ratingAverage: -1, name: 1 })
      .lean();

    return users.map((user) => ({
      id: String(user._id),
      name: user.name,
      username: user.username,
      role: user.role,
      ratingAverage: user.ratingAverage,
      totalGoals: user.totalGoals,
      totalAssists: user.totalAssists,
      totalWins: user.totalWins,
      totalDraws: user.totalDraws,
      totalLosses: user.totalLosses
    }));
  });

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
