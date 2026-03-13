import { Pelada } from '../models/Pelada.js';
import { User } from '../models/User.js';
import { buildTournamentInfo } from '../utils/tournament.js';

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
      totalCraquePoints: 0,
      totalCraqueFirstPlaces: 0,
      totalCraqueSecondPlaces: 0,
      totalCraqueThirdPlaces: 0,
      totalTournamentTitles: 0,
      initialRating: Number(user.initialRating || 3)
    });
    ratings.set(key, {
      sum: 0,
      count: 0
    });
  }

  const peladas = await Pelada.find({}, 'type teams tournamentMatches playerStats votes craqueVotes').lean();

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

    for (const craqueVote of pelada.craqueVotes || []) {
      const firstStat = totals.get(toIdString(craqueVote.firstUser));
      if (firstStat) {
        firstStat.totalCraquePoints += 5;
        firstStat.totalCraqueFirstPlaces += 1;
      }

      const secondStat = totals.get(toIdString(craqueVote.secondUser));
      if (secondStat) {
        secondStat.totalCraquePoints += 3;
        secondStat.totalCraqueSecondPlaces += 1;
      }

      const thirdStat = totals.get(toIdString(craqueVote.thirdUser));
      if (thirdStat) {
        thirdStat.totalCraquePoints += 1;
        thirdStat.totalCraqueThirdPlaces += 1;
      }
    }

    if ((pelada.type || 'NORMAL') === 'TOURNAMENT') {
      const tournamentInfo = buildTournamentInfo(pelada.teams || [], pelada.tournamentMatches || []);
      if (tournamentInfo?.isCompleted && tournamentInfo?.championTeamId) {
        const championTeam = (pelada.teams || []).find(
          (team) => toIdString(team._id) === tournamentInfo.championTeamId
        );

        for (const playerId of championTeam?.players || []) {
          const key = toIdString(playerId);
          const stat = totals.get(key);
          if (!stat) continue;
          stat.totalTournamentTitles += 1;
        }
      }
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
            totalCraquePoints: stat.totalCraquePoints,
            totalCraqueFirstPlaces: stat.totalCraqueFirstPlaces,
            totalCraqueSecondPlaces: stat.totalCraqueSecondPlaces,
            totalCraqueThirdPlaces: stat.totalCraqueThirdPlaces,
            totalTournamentTitles: stat.totalTournamentTitles,
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
