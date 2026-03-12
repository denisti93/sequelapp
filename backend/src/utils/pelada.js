function normalizeUserId(userRef) {
  if (!userRef) {
    return null;
  }

  if (typeof userRef === 'object' && userRef._id) {
    return String(userRef._id);
  }

  return String(userRef);
}

export function getParticipantIdSet(pelada) {
  const participants = new Set();

  for (const team of pelada.teams || []) {
    for (const playerRef of team.players || []) {
      const normalized = normalizeUserId(playerRef);
      if (!normalized || normalized === '[object Object]') {
        continue;
      }
      participants.add(normalized);
    }
  }

  return participants;
}

export function validateTeamsShape(teams) {
  if (!Array.isArray(teams) || teams.length !== 4) {
    return 'Uma pelada deve possuir exatamente 4 times.';
  }

  const usedPlayers = new Set();

  for (const team of teams) {
    if (!team?.name || typeof team.name !== 'string') {
      return 'Cada time precisa de um nome valido.';
    }

    if (!Array.isArray(team.players) || team.players.length !== 5) {
      return `O time ${team.name} deve ter exatamente 5 jogadores.`;
    }

    for (const playerId of team.players) {
      const key = String(playerId);
      if (usedPlayers.has(key)) {
        return 'Um jogador nao pode estar em mais de um time na mesma pelada.';
      }
      usedPlayers.add(key);
    }

    if (team.goalkeepers && !Array.isArray(team.goalkeepers)) {
      return `Os goleiros do time ${team.name} devem ser uma lista.`;
    }
  }

  return null;
}
