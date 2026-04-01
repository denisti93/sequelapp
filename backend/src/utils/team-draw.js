const POSITION_ORDER = ['ZAGUEIRO', 'MEIA', 'ATACANTE'];
const FALLBACK_ORDER = {
  ZAGUEIRO: ['MEIA', 'ATACANTE'],
  MEIA: ['ATACANTE', 'ZAGUEIRO'],
  ATACANTE: ['MEIA', 'ZAGUEIRO']
};

function normalizedRating(player) {
  const rating = Number(player?.rating);
  if (Number.isFinite(rating) && rating >= 1 && rating <= 5) {
    return rating;
  }
  return 3;
}

function normalizePosition(position) {
  const normalized = String(position || '')
    .trim()
    .toUpperCase();
  return POSITION_ORDER.includes(normalized) ? normalized : null;
}

function shuffle(items) {
  const list = [...items];
  for (let index = list.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [list[index], list[swapIndex]] = [list[swapIndex], list[index]];
  }
  return list;
}

function cloneTeams(teams) {
  return teams.map((team) => team.slice());
}

function buildTeamCapacities(totalPlayers, teamCount) {
  const baseSize = Math.floor(totalPlayers / teamCount);
  const remainder = totalPlayers % teamCount;
  return Array.from({ length: teamCount }, (_, index) => baseSize + (index < remainder ? 1 : 0));
}

function buildSnakePickOrder(capacities) {
  const teamCount = capacities.length;
  const remaining = [...capacities];
  const totalSlots = capacities.reduce((sum, value) => sum + value, 0);
  const order = [];
  let direction = 1;

  while (order.length < totalSlots) {
    const indexes =
      direction === 1
        ? Array.from({ length: teamCount }, (_, index) => index)
        : Array.from({ length: teamCount }, (_, index) => teamCount - 1 - index);

    for (const teamIndex of indexes) {
      if (remaining[teamIndex] <= 0) {
        continue;
      }
      remaining[teamIndex] -= 1;
      order.push(teamIndex);
      if (order.length >= totalSlots) {
        break;
      }
    }

    direction *= -1;
  }

  return order;
}

function countPositions(teamPlayers) {
  const counts = {
    ZAGUEIRO: 0,
    MEIA: 0,
    ATACANTE: 0,
    FLEX: 0
  };

  for (const player of teamPlayers) {
    if (!player.position) {
      counts.FLEX += 1;
      continue;
    }
    counts[player.position] += 1;
  }

  return counts;
}

function missingPositionPenalty(role, counts) {
  const [firstFallback, secondFallback] = FALLBACK_ORDER[role];
  if (counts[firstFallback] > 0) {
    return 0.4;
  }
  if (counts[secondFallback] > 0) {
    return 0.85;
  }
  if (counts.FLEX > 0) {
    return 0.55;
  }
  return 1.25;
}

function teamPositionPenalty(teamPlayers) {
  if (!Array.isArray(teamPlayers) || teamPlayers.length === 0) {
    return 0;
  }

  const counts = countPositions(teamPlayers);
  let penalty = 0;

  if (teamPlayers.length >= 3) {
    for (const role of POSITION_ORDER) {
      if (counts[role] > 0) {
        continue;
      }
      penalty += missingPositionPenalty(role, counts);
    }
  }

  for (const role of POSITION_ORDER) {
    if (counts[role] > 2) {
      penalty += (counts[role] - 2) * 0.45;
    }
  }

  return penalty;
}

function roleVariancePenalty(teams) {
  let penalty = 0;

  for (const role of POSITION_ORDER) {
    const counts = teams.map((team) => team.filter((player) => player.position === role).length);
    const average = counts.reduce((sum, value) => sum + value, 0) / counts.length;
    const variance =
      counts.reduce((sum, value) => sum + (value - average) * (value - average), 0) / counts.length;
    penalty += Math.sqrt(variance);
  }

  return penalty;
}

function calculateAssignmentCost(teams) {
  const teamAverages = teams.map((team) => {
    if (team.length === 0) {
      return 0;
    }
    const total = team.reduce((sum, player) => sum + player.rating, 0);
    return total / team.length;
  });

  const maxAverage = Math.max(...teamAverages);
  const minAverage = Math.min(...teamAverages);
  const averageOfAverages = teamAverages.reduce((sum, value) => sum + value, 0) / teamAverages.length;
  const stdDeviation = Math.sqrt(
    teamAverages.reduce((sum, value) => sum + (value - averageOfAverages) ** 2, 0) / teamAverages.length
  );
  const positionPenalty = teams.reduce((sum, team) => sum + teamPositionPenalty(team), 0);
  const variancePenalty = roleVariancePenalty(teams);

  return {
    value: (maxAverage - minAverage) * 3 + stdDeviation * 2 + positionPenalty * 2 + variancePenalty * 0.7,
    spread: maxAverage - minAverage
  };
}

function createInitialAssignment(players, capacities) {
  const orderedPlayers = [...players].sort((a, b) => {
    if (b.rating !== a.rating) {
      return b.rating - a.rating;
    }
    return Math.random() < 0.5 ? -1 : 1;
  });

  const teams = capacities.map(() => []);
  const pickOrder = buildSnakePickOrder(capacities);

  for (let index = 0; index < orderedPlayers.length; index += 1) {
    const teamIndex = pickOrder[index];
    teams[teamIndex].push(orderedPlayers[index]);
  }

  return teams;
}

function optimizeAssignment(initialTeams, iterations = 2200) {
  let currentTeams = cloneTeams(initialTeams);
  let currentScore = calculateAssignmentCost(currentTeams).value;
  let bestTeams = cloneTeams(initialTeams);
  let bestScore = currentScore;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const teamA = Math.floor(Math.random() * currentTeams.length);
    let teamB = Math.floor(Math.random() * currentTeams.length);
    if (teamA === teamB) {
      teamB = (teamB + 1) % currentTeams.length;
    }

    if (currentTeams[teamA].length === 0 || currentTeams[teamB].length === 0) {
      continue;
    }

    const playerAIndex = Math.floor(Math.random() * currentTeams[teamA].length);
    const playerBIndex = Math.floor(Math.random() * currentTeams[teamB].length);

    [currentTeams[teamA][playerAIndex], currentTeams[teamB][playerBIndex]] = [
      currentTeams[teamB][playerBIndex],
      currentTeams[teamA][playerAIndex]
    ];

    const nextScore = calculateAssignmentCost(currentTeams).value;
    const cooling = 0.28 * (1 - iteration / iterations) + 0.02;
    const acceptance = Math.exp((currentScore - nextScore) / cooling);

    if (nextScore < currentScore || Math.random() < acceptance) {
      currentScore = nextScore;
      if (nextScore < bestScore) {
        bestScore = nextScore;
        bestTeams = cloneTeams(currentTeams);
      }
    } else {
      [currentTeams[teamA][playerAIndex], currentTeams[teamB][playerBIndex]] = [
        currentTeams[teamB][playerBIndex],
        currentTeams[teamA][playerAIndex]
      ];
    }
  }

  return {
    teams: bestTeams,
    score: bestScore
  };
}

function buildTeamSummary(teamPlayers, index) {
  const totalRating = teamPlayers.reduce((sum, player) => sum + player.rating, 0);
  const averageRating = teamPlayers.length > 0 ? totalRating / teamPlayers.length : 0;
  const counts = countPositions(teamPlayers);

  return {
    name: `Time ${index + 1}`,
    players: teamPlayers
      .map((player) => ({
        id: player.id,
        name: player.name,
        position: player.position,
        isGuest: Boolean(player.isGuest),
        rating: Number(player.rating.toFixed(2))
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    totalRating: Number(totalRating.toFixed(2)),
    averageRating: Number(averageRating.toFixed(2)),
    positionCounts: {
      ZAGUEIRO: counts.ZAGUEIRO,
      MEIA: counts.MEIA,
      ATACANTE: counts.ATACANTE,
      FLEX: counts.FLEX
    }
  };
}

export function drawBalancedTeams(players, teamCount, { maxPlayersPerTeam = 5 } = {}) {
  if (!Array.isArray(players) || players.length === 0) {
    throw new Error('Selecione jogadores para realizar o sorteio.');
  }

  if (!Number.isInteger(teamCount) || teamCount < 2 || teamCount > 4) {
    throw new Error('O sorteio deve ter entre 2 e 4 times.');
  }

  if (players.length < teamCount) {
    throw new Error('Selecione ao menos um jogador por time para sortear.');
  }

  if (players.length > teamCount * maxPlayersPerTeam) {
    throw new Error(
      `Com ${teamCount} times, selecione no máximo ${teamCount * maxPlayersPerTeam} jogadores para o sorteio.`
    );
  }

  const normalizedPlayers = shuffle(players).map((player) => ({
    id: String(player.id),
    name: String(player.name || 'Jogador'),
    rating: normalizedRating(player),
    position: normalizePosition(player.position)
  }));

  const capacities = buildTeamCapacities(normalizedPlayers.length, teamCount);
  let best = null;

  for (let restart = 0; restart < 28; restart += 1) {
    const initialTeams = createInitialAssignment(shuffle(normalizedPlayers), capacities);
    const optimized = optimizeAssignment(initialTeams, 1800);

    if (!best || optimized.score < best.score) {
      best = optimized;
    }
  }

  const teams = (best?.teams || []).map((teamPlayers, index) => buildTeamSummary(teamPlayers, index));
  const averages = teams.map((team) => team.averageRating);
  const maxAverage = Math.max(...averages);
  const minAverage = Math.min(...averages);
  const spread = Number((maxAverage - minAverage).toFixed(2));

  return {
    teams,
    balance: {
      minAverageRating: Number(minAverage.toFixed(2)),
      maxAverageRating: Number(maxAverage.toFixed(2)),
      spread
    }
  };
}
