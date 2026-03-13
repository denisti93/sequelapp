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
  const validPositions = new Set(['ZAGUEIRO', 'MEIA', 'ATACANTE']);

  for (const team of teams) {
    if (!team?.name || typeof team.name !== 'string') {
      return 'Cada time precisa de um nome valido.';
    }

    if (!Array.isArray(team.players)) {
      return `O time ${team.name} deve informar os jogadores cadastrados em lista.`;
    }

    if (team.guestPlayers && !Array.isArray(team.guestPlayers)) {
      return `Os convidados do time ${team.name} devem ser uma lista.`;
    }

    const guestPlayers = Array.isArray(team.guestPlayers) ? team.guestPlayers : [];
    const totalPlayers = team.players.length + guestPlayers.length;
    if (totalPlayers !== 5) {
      return `O time ${team.name} deve ter exatamente 5 jogadores (cadastrados + convidados).`;
    }

    for (const guest of guestPlayers) {
      const guestName = String(guest?.name || '').trim();
      const guestPosition = String(guest?.position || '')
        .trim()
        .toUpperCase();

      if (!guestName) {
        return `Todo convidado do time ${team.name} precisa de nome.`;
      }

      if (!validPositions.has(guestPosition)) {
        return `Todo convidado do time ${team.name} precisa de posicao valida (ZAGUEIRO, MEIA ou ATACANTE).`;
      }
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
