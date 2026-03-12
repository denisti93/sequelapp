import { Pelada } from '../models/Pelada.js';
import { User } from '../models/User.js';

function toIdString(id) {
  return String(id);
}

export async function recalculateAllUsersStats() {
  const users = await User.find({}, '_id initialRating').lean();

  const totals = new Map();
  const ratings = new Map();

  for (const user of users) {
    const key = toIdString(user._id);
    totals.set(key, {
      totalGoals: 0,
      totalAssists: 0,
      totalWins: 0,
      totalDraws: 0,
      totalLosses: 0,
      initialRating: Number(user.initialRating || 3)
    });
    ratings.set(key, {
      sum: 0,
      count: 0
    });
  }

  const peladas = await Pelada.find({}, 'teams playerStats votes').lean();

  for (const pelada of peladas) {
    for (const team of pelada.teams || []) {
      for (const playerId of team.players || []) {
        const key = toIdString(playerId);
        const stat = totals.get(key);
        if (!stat) continue;

        stat.totalWins += Number(team.wins || 0);
        stat.totalDraws += Number(team.draws || 0);
        stat.totalLosses += Number(team.losses || 0);
      }
    }

    for (const playerStat of pelada.playerStats || []) {
      const key = toIdString(playerStat.player);
      const stat = totals.get(key);
      if (!stat) continue;

      stat.totalGoals += Number(playerStat.goals || 0);
      stat.totalAssists += Number(playerStat.assists || 0);
    }

    for (const vote of pelada.votes || []) {
      const key = toIdString(vote.toUser);
      const rating = ratings.get(key);
      if (!rating) continue;

      rating.sum += Number(vote.score || 0);
      rating.count += 1;
    }
  }

  const operations = [];

  for (const [userId, stat] of totals.entries()) {
    const rating = ratings.get(userId);
    const ratingAverage =
      rating && rating.count > 0
        ? Number((rating.sum / rating.count).toFixed(2))
        : stat.initialRating;

    operations.push({
      updateOne: {
        filter: { _id: userId },
        update: {
          $set: {
            totalGoals: stat.totalGoals,
            totalAssists: stat.totalAssists,
            totalWins: stat.totalWins,
            totalDraws: stat.totalDraws,
            totalLosses: stat.totalLosses,
            ratingAverage
          }
        }
      }
    });
  }

  if (operations.length > 0) {
    await User.bulkWrite(operations);
  }
}
