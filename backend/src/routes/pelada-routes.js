import { authenticate, authorize } from '../middleware/auth.js';
import { Pelada } from '../models/Pelada.js';
import { User } from '../models/User.js';
import { recalculateAllUsersStats } from '../services/stats-service.js';
import { getParticipantIdSet, validateTeamsShape } from '../utils/pelada.js';
import {
  buildTournamentInfo,
  generateDoubleRoundRobinMatches,
  syncTeamResultsFromMatches
} from '../utils/tournament.js';

const CRAQUE_WEIGHTS = {
  firstUser: 5,
  secondUser: 3,
  thirdUser: 1
};

function formatPeladaSummary(pelada) {
  const date = new Date(pelada.date);
  return {
    id: String(pelada._id),
    date,
    type: pelada.type || 'NORMAL',
    happened: date.getTime() <= Date.now(),
    status: pelada.status || 'OPEN',
    votingStatus: pelada.votingStatus,
    teamsCount: (pelada.teams || []).length
  };
}

function buildPlayerStatsMap(playerStats = []) {
  const map = new Map();
  for (const stat of playerStats) {
    map.set(String(stat.player), {
      goals: Number(stat.goals || 0),
      assists: Number(stat.assists || 0)
    });
  }
  return map;
}

function buildTeamResultByPlayer(teams = []) {
  const map = new Map();
  for (const team of teams) {
    for (const playerId of team.players || []) {
      map.set(String(playerId), {
        wins: Number(team.wins || 0),
        draws: Number(team.draws || 0),
        losses: Number(team.losses || 0)
      });
    }
  }
  return map;
}

function isConcluded(pelada) {
  return (pelada?.status || 'OPEN') === 'CONCLUDED';
}

function ensureEditableRacha(pelada, reply) {
  if (!isConcluded(pelada)) {
    return true;
  }

  reply.code(409).send({
    message: 'Este racha ja foi concluido e nao permite mais ajustes.'
  });
  return false;
}

function buildCraquePodium(craqueVotes = [], usersById = new Map()) {
  const ranking = new Map();

  function ensurePlayerEntry(playerId) {
    if (!ranking.has(playerId)) {
      ranking.set(playerId, {
        playerId,
        points: 0,
        firstPlaces: 0,
        secondPlaces: 0,
        thirdPlaces: 0
      });
    }

    return ranking.get(playerId);
  }

  for (const vote of craqueVotes) {
    const firstId = String(vote.firstUser);
    const secondId = String(vote.secondUser);
    const thirdId = String(vote.thirdUser);

    const first = ensurePlayerEntry(firstId);
    const second = ensurePlayerEntry(secondId);
    const third = ensurePlayerEntry(thirdId);

    first.points += CRAQUE_WEIGHTS.firstUser;
    first.firstPlaces += 1;

    second.points += CRAQUE_WEIGHTS.secondUser;
    second.secondPlaces += 1;

    third.points += CRAQUE_WEIGHTS.thirdUser;
    third.thirdPlaces += 1;
  }

  const top3 = Array.from(ranking.values())
    .map((item) => ({
      ...item,
      playerName: usersById.get(item.playerId)?.name || 'Jogador removido'
    }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.firstPlaces !== a.firstPlaces) return b.firstPlaces - a.firstPlaces;
      if (b.secondPlaces !== a.secondPlaces) return b.secondPlaces - a.secondPlaces;
      if (b.thirdPlaces !== a.thirdPlaces) return b.thirdPlaces - a.thirdPlaces;
      return a.playerName.localeCompare(b.playerName);
    })
    .slice(0, 3)
    .map((item, index) => ({
      position: index + 1,
      ...item
    }));

  return {
    totalBallots: craqueVotes.length,
    top3
  };
}

export async function peladaRoutes(fastify) {
  fastify.get('/', { preHandler: [authenticate] }, async () => {
    const peladas = await Pelada.find({}, 'date type status votingStatus teams')
      .sort({ date: -1 })
      .lean();

    return peladas.map(formatPeladaSummary);
  });

  fastify.post(
    '/',
    {
      preHandler: [authenticate, authorize('ADM')]
    },
    async (request, reply) => {
      const { date, type } = request.body || {};
      if (!date) {
        return reply.code(400).send({ message: 'Informe a data da pelada.' });
      }

      const normalizedType = String(type || 'NORMAL').toUpperCase();
      if (!['NORMAL', 'TOURNAMENT'].includes(normalizedType)) {
        return reply.code(400).send({ message: 'Tipo invalido. Use NORMAL ou TOURNAMENT.' });
      }

      const parsedDate = new Date(date);
      if (Number.isNaN(parsedDate.getTime())) {
        return reply.code(400).send({ message: 'Data invalida.' });
      }

      const pelada = await Pelada.create({
        date: parsedDate,
        type: normalizedType,
        createdBy: request.user.id,
        teams: [],
        tournamentMatches: [],
        playerStats: [],
        votes: [],
        craqueVotes: [],
        votingStatus: 'CLOSED',
        status: 'OPEN'
      });

      return reply.code(201).send(pelada.toJSON());
    }
  );

  fastify.get('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const pelada = await Pelada.findById(request.params.id)
      .populate('teams.players', 'name username role ratingAverage position')
      .populate('playerStats.player', 'name username')
      .lean();

    if (!pelada) {
      return reply.code(404).send({ message: 'Pelada nao encontrada.' });
    }

    const participants = getParticipantIdSet(pelada);
    const participantIds = Array.from(participants);
    const users = await User.find({ _id: { $in: participantIds } }, 'name').lean();
    const usersById = new Map(users.map((user) => [String(user._id), user]));
    const craquePodium = buildCraquePodium(pelada.craqueVotes || [], usersById);
    const isTournament = (pelada.type || 'NORMAL') === 'TOURNAMENT';
    const tournamentInfo = isTournament
      ? buildTournamentInfo(pelada.teams || [], pelada.tournamentMatches || [])
      : null;

    return {
      id: String(pelada._id),
      date: pelada.date,
      type: pelada.type || 'NORMAL',
      happened: new Date(pelada.date).getTime() <= Date.now(),
      status: pelada.status || 'OPEN',
      votingStatus: pelada.votingStatus,
      teams: (pelada.teams || []).map((team) => ({
        id: String(team._id),
        name: team.name,
        goalkeepers: team.goalkeepers || [],
        wins: team.wins || 0,
        draws: team.draws || 0,
        losses: team.losses || 0,
        players: (team.players || []).map((player) => ({
          id: String(player._id),
          name: player.name,
          username: player.username,
          role: player.role,
          ratingAverage: player.ratingAverage,
          position: player.position
        }))
      })),
      playerStats: (pelada.playerStats || []).map((stat) => ({
        playerId: String(stat.player?._id || stat.player),
        playerName: stat.player?.name,
        goals: stat.goals || 0,
        assists: stat.assists || 0
      })),
      votesCount: (pelada.votes || []).length,
      tournament: tournamentInfo,
      craquePodium
    };
  });

  fastify.patch(
    '/:id/teams',
    {
      preHandler: [authenticate, authorize('ADM')]
    },
    async (request, reply) => {
      const { teams } = request.body || {};
      const shapeError = validateTeamsShape(teams);
      if (shapeError) {
        return reply.code(400).send({ message: shapeError });
      }

      const playerIds = Array.from(new Set(teams.flatMap((team) => team.players.map(String))));
      const validPlayers = await User.countDocuments({
        _id: { $in: playerIds },
        role: 'JOGADOR'
      });

      if (validPlayers !== playerIds.length) {
        return reply
          .code(400)
          .send({ message: 'Um ou mais jogadores informados nao existem ou nao sao JOGADOR.' });
      }

      const pelada = await Pelada.findById(request.params.id);
      if (!pelada) {
        return reply.code(404).send({ message: 'Pelada nao encontrada.' });
      }
      if (!ensureEditableRacha(pelada, reply)) {
        return;
      }

      pelada.teams = teams.map((team) => ({
        name: team.name.trim(),
        players: team.players,
        goalkeepers: Array.isArray(team.goalkeepers)
          ? team.goalkeepers.map((goalkeeper) => String(goalkeeper).trim()).filter(Boolean)
          : [],
        wins: 0,
        draws: 0,
        losses: 0
      }));

      // Reconfigurar os times invalida votos e estatisticas da pelada.
      pelada.playerStats = [];
      pelada.votes = [];
      pelada.craqueVotes = [];
      pelada.votingStatus = 'CLOSED';

      if ((pelada.type || 'NORMAL') === 'TOURNAMENT') {
        pelada.tournamentMatches = generateDoubleRoundRobinMatches(pelada.teams);
        syncTeamResultsFromMatches(pelada.teams, pelada.tournamentMatches);
      } else {
        pelada.tournamentMatches = [];
      }

      await pelada.save();
      await recalculateAllUsersStats();

      return {
        id: String(pelada._id),
        message: 'Times atualizados com sucesso.'
      };
    }
  );

  fastify.patch(
    '/:id/results',
    {
      preHandler: [authenticate, authorize('ADM')]
    },
    async (request, reply) => {
      const { results } = request.body || {};
      if (!Array.isArray(results)) {
        return reply.code(400).send({ message: 'Informe a lista de resultados por time.' });
      }

      const pelada = await Pelada.findById(request.params.id);
      if (!pelada) {
        return reply.code(404).send({ message: 'Pelada nao encontrada.' });
      }
      if (!ensureEditableRacha(pelada, reply)) {
        return;
      }

      if ((pelada.type || 'NORMAL') === 'TOURNAMENT') {
        return reply.code(400).send({
          message: 'Para torneio, os resultados sao calculados automaticamente pelos placares dos confrontos.'
        });
      }

      if (!pelada.teams || pelada.teams.length === 0) {
        return reply
          .code(400)
          .send({ message: 'Cadastre os times antes de informar resultados.' });
      }

      if (results.length !== pelada.teams.length) {
        return reply
          .code(400)
          .send({ message: 'Envie o resultado para todos os times da pelada.' });
      }

      const resultMap = new Map();
      for (const item of results) {
        if (!item.teamId) {
          return reply.code(400).send({ message: 'Cada resultado precisa de teamId.' });
        }

        const wins = Number(item.wins || 0);
        const draws = Number(item.draws || 0);
        const losses = Number(item.losses || 0);

        if ([wins, draws, losses].some((value) => Number.isNaN(value) || value < 0)) {
          return reply
            .code(400)
            .send({ message: 'Vitorias, empates e derrotas devem ser numeros >= 0.' });
        }

        resultMap.set(String(item.teamId), { wins, draws, losses });
      }

      for (const team of pelada.teams) {
        const result = resultMap.get(String(team._id));
        if (!result) {
          return reply
            .code(400)
            .send({ message: `Resultado ausente para o time ${team.name}.` });
        }

        team.wins = result.wins;
        team.draws = result.draws;
        team.losses = result.losses;
      }

      await pelada.save();
      await recalculateAllUsersStats();

      return { message: 'Resultados da pelada atualizados.' };
    }
  );

  fastify.patch(
    '/:id/tournament-matches/:matchId',
    {
      preHandler: [authenticate, authorize('ADM')]
    },
    async (request, reply) => {
      const { matchId, id } = request.params;
      const { homeGoals, awayGoals } = request.body || {};

      const parsedHomeGoals = Number(homeGoals);
      const parsedAwayGoals = Number(awayGoals);

      if (
        !Number.isInteger(parsedHomeGoals) ||
        !Number.isInteger(parsedAwayGoals) ||
        parsedHomeGoals < 0 ||
        parsedAwayGoals < 0
      ) {
        return reply.code(400).send({
          message: 'Informe homeGoals e awayGoals como inteiros >= 0.'
        });
      }

      const pelada = await Pelada.findById(id);
      if (!pelada) {
        return reply.code(404).send({ message: 'Pelada nao encontrada.' });
      }
      if (!ensureEditableRacha(pelada, reply)) {
        return;
      }

      if ((pelada.type || 'NORMAL') !== 'TOURNAMENT') {
        return reply.code(400).send({
          message: 'Este endpoint e exclusivo para rachas do tipo torneio.'
        });
      }

      const match = (pelada.tournamentMatches || []).find((item) => String(item._id) === String(matchId));
      if (!match) {
        return reply.code(404).send({ message: 'Confronto nao encontrado.' });
      }

      match.homeGoals = parsedHomeGoals;
      match.awayGoals = parsedAwayGoals;

      syncTeamResultsFromMatches(pelada.teams, pelada.tournamentMatches);

      await pelada.save();
      await recalculateAllUsersStats();

      return { message: 'Placar atualizado com sucesso.' };
    }
  );

  fastify.patch(
    '/:id/player-stats',
    {
      preHandler: [authenticate, authorize('ADM')]
    },
    async (request, reply) => {
      const { stats } = request.body || {};

      if (!Array.isArray(stats)) {
        return reply
          .code(400)
          .send({ message: 'Informe uma lista de estatisticas de jogadores.' });
      }

      const pelada = await Pelada.findById(request.params.id);
      if (!pelada) {
        return reply.code(404).send({ message: 'Pelada nao encontrada.' });
      }
      if (!ensureEditableRacha(pelada, reply)) {
        return;
      }

      const participants = getParticipantIdSet(pelada);
      if (participants.size === 0) {
        return reply
          .code(400)
          .send({ message: 'Cadastre os times antes de inserir estatisticas.' });
      }

      const seen = new Set();
      const parsedStats = [];

      for (const item of stats) {
        const playerId = String(item.playerId || '');
        const goals = Number(item.goals || 0);
        const assists = Number(item.assists || 0);

        if (!playerId) {
          return reply.code(400).send({ message: 'Cada item deve conter playerId.' });
        }

        if (!participants.has(playerId)) {
          return reply
            .code(400)
            .send({ message: 'Todos os jogadores das estatisticas devem estar na pelada.' });
        }

        if (seen.has(playerId)) {
          return reply
            .code(400)
            .send({ message: 'Um jogador nao pode ter estatistica duplicada na mesma pelada.' });
        }

        if ([goals, assists].some((value) => Number.isNaN(value) || value < 0)) {
          return reply.code(400).send({ message: 'Gols e assistencias devem ser numeros >= 0.' });
        }

        seen.add(playerId);
        parsedStats.push({
          player: playerId,
          goals,
          assists
        });
      }

      pelada.playerStats = parsedStats;
      await pelada.save();
      await recalculateAllUsersStats();

      return { message: 'Estatisticas de jogadores atualizadas.' };
    }
  );

  fastify.post(
    '/:id/voting/open',
    {
      preHandler: [authenticate, authorize('ADM')]
    },
    async (request, reply) => {
      const pelada = await Pelada.findById(request.params.id);
      if (!pelada) {
        return reply.code(404).send({ message: 'Pelada nao encontrada.' });
      }
      if (!ensureEditableRacha(pelada, reply)) {
        return;
      }

      if (!pelada.teams || pelada.teams.length === 0) {
        return reply
          .code(400)
          .send({ message: 'Cadastre os times da pelada antes de abrir votacao.' });
      }

      pelada.votingStatus = 'OPEN';
      await pelada.save();

      return { message: 'Votacao aberta para esta pelada.' };
    }
  );

  fastify.post(
    '/:id/voting/finish',
    {
      preHandler: [authenticate, authorize('ADM')]
    },
    async (request, reply) => {
      const pelada = await Pelada.findById(request.params.id);
      if (!pelada) {
        return reply.code(404).send({ message: 'Pelada nao encontrada.' });
      }
      if (!ensureEditableRacha(pelada, reply)) {
        return;
      }

      pelada.votingStatus = 'FINISHED';
      await pelada.save();

      return { message: 'Votacao finalizada para esta pelada.' };
    }
  );

  fastify.post(
    '/:id/conclude',
    {
      preHandler: [authenticate, authorize('ADM')]
    },
    async (request, reply) => {
      const pelada = await Pelada.findById(request.params.id);
      if (!pelada) {
        return reply.code(404).send({ message: 'Pelada nao encontrada.' });
      }

      if (isConcluded(pelada)) {
        return { message: 'Racha ja estava concluido.' };
      }

      pelada.status = 'CONCLUDED';
      pelada.votingStatus = 'FINISHED';
      await pelada.save();

      return { message: 'Racha concluido com sucesso.' };
    }
  );

  fastify.post('/:id/votes', { preHandler: [authenticate] }, async (request, reply) => {
    const { toUserId, score } = request.body || {};
    const fromUserId = String(request.user.id);

    const numericScore = Number(score);
    if (!toUserId || Number.isNaN(numericScore) || numericScore < 1 || numericScore > 5) {
      return reply
        .code(400)
        .send({ message: 'Informe toUserId e score valido entre 1 e 5.' });
    }

    const pelada = await Pelada.findById(request.params.id);
    if (!pelada) {
      return reply.code(404).send({ message: 'Pelada nao encontrada.' });
    }
    if (!ensureEditableRacha(pelada, reply)) {
      return;
    }

    if (pelada.votingStatus !== 'OPEN') {
      return reply.code(400).send({ message: 'A votacao desta pelada nao esta aberta.' });
    }

    const participants = getParticipantIdSet(pelada);
    const targetId = String(toUserId);

    if (!participants.has(fromUserId)) {
      return reply
        .code(403)
        .send({ message: 'Apenas jogadores participantes da pelada podem votar.' });
    }

    if (!participants.has(targetId)) {
      return reply.code(400).send({ message: 'O jogador avaliado deve participar da pelada.' });
    }

    if (fromUserId === targetId) {
      return reply.code(400).send({ message: 'Nao e permitido votar em si mesmo.' });
    }

    const alreadyVoted = pelada.votes.some(
      (vote) => String(vote.fromUser) === fromUserId && String(vote.toUser) === targetId
    );

    if (alreadyVoted) {
      return reply
        .code(409)
        .send({ message: 'Voce ja votou neste jogador para esta pelada.' });
    }

    pelada.votes.push({
      fromUser: fromUserId,
      toUser: targetId,
      score: numericScore
    });

    await pelada.save();
    await recalculateAllUsersStats();

    return reply.code(201).send({ message: 'Nota registrada com sucesso.' });
  });

  fastify.post('/:id/craque-vote', { preHandler: [authenticate] }, async (request, reply) => {
    const { firstUserId, secondUserId, thirdUserId } = request.body || {};
    const fromUserId = String(request.user.id);

    if (!firstUserId || !secondUserId || !thirdUserId) {
      return reply.code(400).send({
        message: 'Informe os 3 colocados do craque do racha.'
      });
    }

    const picks = [String(firstUserId), String(secondUserId), String(thirdUserId)];
    if (new Set(picks).size !== 3) {
      return reply.code(400).send({
        message: 'Os colocados de craque do racha devem ser jogadores diferentes.'
      });
    }

    if (picks.includes(fromUserId)) {
      return reply.code(400).send({
        message: 'Nao e permitido colocar a si mesmo no podio de craque.'
      });
    }

    const pelada = await Pelada.findById(request.params.id);
    if (!pelada) {
      return reply.code(404).send({ message: 'Pelada nao encontrada.' });
    }
    if (!ensureEditableRacha(pelada, reply)) {
      return;
    }

    if (pelada.votingStatus !== 'OPEN') {
      return reply.code(400).send({ message: 'A votacao desta pelada nao esta aberta.' });
    }

    const participants = getParticipantIdSet(pelada);
    if (!participants.has(fromUserId)) {
      return reply
        .code(403)
        .send({ message: 'Apenas jogadores participantes da pelada podem votar.' });
    }

    const hasInvalidPick = picks.some((pickId) => !participants.has(pickId));
    if (hasInvalidPick) {
      return reply.code(400).send({
        message: 'Todos os jogadores do podio devem participar da pelada.'
      });
    }

    const existingVote = pelada.craqueVotes.find((vote) => String(vote.fromUser) === fromUserId);
    if (existingVote) {
      existingVote.firstUser = String(firstUserId);
      existingVote.secondUser = String(secondUserId);
      existingVote.thirdUser = String(thirdUserId);
    } else {
      pelada.craqueVotes.push({
        fromUser: fromUserId,
        firstUser: String(firstUserId),
        secondUser: String(secondUserId),
        thirdUser: String(thirdUserId)
      });
    }

    await pelada.save();
    await recalculateAllUsersStats();

    return reply.code(201).send({ message: 'Podio de craque registrado com sucesso.' });
  });

  fastify.get(
    '/:id/votes/details',
    {
      preHandler: [authenticate, authorize('ADM')]
    },
    async (request, reply) => {
      const pelada = await Pelada.findById(request.params.id)
        .populate('votes.fromUser', 'name username')
        .populate('votes.toUser', 'name username')
        .lean();

      if (!pelada) {
        return reply.code(404).send({ message: 'Pelada nao encontrada.' });
      }

      const votes = (pelada.votes || [])
        .map((vote) => ({
          voteId: vote._id ? String(vote._id) : `${vote.fromUser}-${vote.toUser}`,
          fromUserId: String(vote.fromUser?._id || vote.fromUser),
          fromUserName: vote.fromUser?.name || 'Jogador removido',
          toUserId: String(vote.toUser?._id || vote.toUser),
          toUserName: vote.toUser?.name || 'Jogador removido',
          score: Number(vote.score || 0),
          createdAt: vote.createdAt,
          updatedAt: vote.updatedAt
        }))
        .sort((a, b) => {
          const targetCompare = a.toUserName.localeCompare(b.toUserName);
          if (targetCompare !== 0) return targetCompare;
          return a.fromUserName.localeCompare(b.fromUserName);
        });

      return {
        peladaId: String(pelada._id),
        status: pelada.status || 'OPEN',
        votingStatus: pelada.votingStatus,
        votes
      };
    }
  );

  fastify.patch(
    '/:id/votes/admin-edit',
    {
      preHandler: [authenticate, authorize('ADM')]
    },
    async (request, reply) => {
      const { fromUserId, toUserId, score } = request.body || {};
      const numericScore = Number(score);

      if (!fromUserId || !toUserId || Number.isNaN(numericScore) || numericScore < 1 || numericScore > 5) {
        return reply
          .code(400)
          .send({ message: 'Informe fromUserId, toUserId e score valido entre 1 e 5.' });
      }

      const pelada = await Pelada.findById(request.params.id);
      if (!pelada) {
        return reply.code(404).send({ message: 'Pelada nao encontrada.' });
      }
      if (!ensureEditableRacha(pelada, reply)) {
        return;
      }

      const targetVote = pelada.votes.find(
        (vote) =>
          String(vote.fromUser) === String(fromUserId) && String(vote.toUser) === String(toUserId)
      );

      if (!targetVote) {
        return reply.code(404).send({ message: 'Voto nao encontrado para este par de jogadores.' });
      }

      targetVote.score = numericScore;

      await pelada.save();
      await recalculateAllUsersStats();

      return { message: 'Nota atualizada com sucesso.' };
    }
  );

  fastify.get('/:id/rating-cards', { preHandler: [authenticate] }, async (request, reply) => {
    const pelada = await Pelada.findById(request.params.id).lean();
    if (!pelada) {
      return reply.code(404).send({ message: 'Pelada nao encontrada.' });
    }

    const participants = getParticipantIdSet(pelada);
    const participantIds = Array.from(participants);

    const users = await User.find(
      { _id: { $in: participantIds } },
      'name username ratingAverage totalGoals totalAssists totalWins totalDraws totalLosses'
    ).lean();

    const usersById = new Map(users.map((user) => [String(user._id), user]));
    const statsByPlayer = buildPlayerStatsMap(pelada.playerStats);
    const teamResultByPlayer = buildTeamResultByPlayer(pelada.teams);

    const votedByMe = new Set(
      (pelada.votes || [])
        .filter((vote) => String(vote.fromUser) === String(request.user.id))
        .map((vote) => String(vote.toUser))
    );

    const myCraqueVote = (pelada.craqueVotes || []).find(
      (vote) => String(vote.fromUser) === String(request.user.id)
    );

    const canCurrentUserVote =
      !isConcluded(pelada) &&
      pelada.votingStatus === 'OPEN' &&
      participants.has(String(request.user.id));
    const canCurrentUserVoteCraque = canCurrentUserVote;

    const cards = participantIds
      .map((participantId) => {
        const user = usersById.get(participantId);
        if (!user) return null;

        const playerStats = statsByPlayer.get(participantId) || { goals: 0, assists: 0 };
        const teamResult = teamResultByPlayer.get(participantId) || {
          wins: 0,
          draws: 0,
          losses: 0
        };

        return {
          playerId: participantId,
          name: user.name,
          username: user.username,
          ratingAverage: user.ratingAverage,
          matchGoals: playerStats.goals,
          matchAssists: playerStats.assists,
          matchWins: teamResult.wins,
          matchDraws: teamResult.draws,
          matchLosses: teamResult.losses,
          alreadyRatedByMe: votedByMe.has(participantId),
          canVote:
            canCurrentUserVote &&
            participantId !== String(request.user.id) &&
            !votedByMe.has(participantId)
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      peladaId: String(pelada._id),
      status: pelada.status || 'OPEN',
      votingStatus: pelada.votingStatus,
      canCurrentUserVote,
      canCurrentUserVoteCraque,
      myCraqueVote: myCraqueVote
        ? {
            firstUserId: String(myCraqueVote.firstUser),
            secondUserId: String(myCraqueVote.secondUser),
            thirdUserId: String(myCraqueVote.thirdUser)
          }
        : null,
      cards
    };
  });
}
