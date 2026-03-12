function toId(value) {
  if (!value) return '';
  if (typeof value === 'object' && value._id) {
    return String(value._id);
  }
  return String(value);
}

export function isScoreFilled(value) {
  return Number.isInteger(value) && value >= 0;
}

export function isMatchFinished(match) {
  return isScoreFilled(match.homeGoals) && isScoreFilled(match.awayGoals);
}

export function generateDoubleRoundRobinMatches(teams = []) {
  const ids = teams.map((team) => toId(team._id || team.id)).filter(Boolean);
  const matches = [];

  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      const teamA = ids[i];
      const teamB = ids[j];

      matches.push({
        homeTeamId: teamA,
        awayTeamId: teamB,
        round: 1,
        homeGoals: null,
        awayGoals: null
      });

      matches.push({
        homeTeamId: teamB,
        awayTeamId: teamA,
        round: 2,
        homeGoals: null,
        awayGoals: null
      });
    }
  }

  return matches;
}

function buildBaseStats(teams = []) {
  const stats = new Map();

  for (const team of teams) {
    const teamId = toId(team._id || team.id);
    stats.set(teamId, {
      teamId,
      teamName: team.name,
      points: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDiff: 0,
      directPoints: 0
    });
  }

  return stats;
}

function applyMatchesToStats(statsMap, matches = []) {
  for (const match of matches) {
    if (!isMatchFinished(match)) {
      continue;
    }

    const homeId = toId(match.homeTeamId);
    const awayId = toId(match.awayTeamId);
    const home = statsMap.get(homeId);
    const away = statsMap.get(awayId);

    if (!home || !away) {
      continue;
    }

    home.goalsFor += Number(match.homeGoals);
    home.goalsAgainst += Number(match.awayGoals);
    away.goalsFor += Number(match.awayGoals);
    away.goalsAgainst += Number(match.homeGoals);

    if (match.homeGoals > match.awayGoals) {
      home.wins += 1;
      home.points += 3;
      away.losses += 1;
    } else if (match.homeGoals < match.awayGoals) {
      away.wins += 1;
      away.points += 3;
      home.losses += 1;
    } else {
      home.draws += 1;
      away.draws += 1;
      home.points += 1;
      away.points += 1;
    }
  }

  for (const stat of statsMap.values()) {
    stat.goalDiff = stat.goalsFor - stat.goalsAgainst;
  }
}

function computeHeadToHeadPoints(teamId, tiedSet, matches = []) {
  let points = 0;

  for (const match of matches) {
    if (!isMatchFinished(match)) {
      continue;
    }

    const homeId = toId(match.homeTeamId);
    const awayId = toId(match.awayTeamId);

    if (!tiedSet.has(homeId) || !tiedSet.has(awayId)) {
      continue;
    }

    if (teamId === homeId) {
      if (match.homeGoals > match.awayGoals) points += 3;
      else if (match.homeGoals === match.awayGoals) points += 1;
    }

    if (teamId === awayId) {
      if (match.awayGoals > match.homeGoals) points += 3;
      else if (match.awayGoals === match.homeGoals) points += 1;
    }
  }

  return points;
}

export function computeTournamentStandings(teams = [], matches = []) {
  const statsMap = buildBaseStats(teams);
  applyMatchesToStats(statsMap, matches);

  const byPoints = new Map();
  for (const stat of statsMap.values()) {
    if (!byPoints.has(stat.points)) {
      byPoints.set(stat.points, []);
    }
    byPoints.get(stat.points).push(stat.teamId);
  }

  for (const group of byPoints.values()) {
    if (group.length <= 1) {
      continue;
    }

    const tiedSet = new Set(group);
    for (const teamId of group) {
      const stat = statsMap.get(teamId);
      if (!stat) continue;
      stat.directPoints = computeHeadToHeadPoints(teamId, tiedSet, matches);
    }
  }

  const standings = Array.from(statsMap.values())
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.directPoints !== a.directPoints) return b.directPoints - a.directPoints;
      if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return a.teamName.localeCompare(b.teamName);
    })
    .map((team, index) => ({
      position: index + 1,
      ...team
    }));

  return standings;
}

export function syncTeamResultsFromMatches(teams = [], matches = []) {
  const standings = computeTournamentStandings(teams, matches);
  const statsByTeam = new Map(standings.map((item) => [item.teamId, item]));

  for (const team of teams) {
    const teamId = toId(team._id || team.id);
    const stat = statsByTeam.get(teamId);

    team.wins = stat?.wins || 0;
    team.draws = stat?.draws || 0;
    team.losses = stat?.losses || 0;
  }
}

export function mapTournamentMatchesForResponse(teams = [], matches = []) {
  const teamNameById = new Map(
    teams.map((team) => [toId(team._id || team.id), team.name])
  );

  return matches.map((match) => {
    const homeTeamId = toId(match.homeTeamId);
    const awayTeamId = toId(match.awayTeamId);

    return {
      id: toId(match._id),
      round: Number(match.round || 1),
      homeTeamId,
      awayTeamId,
      homeTeamName: teamNameById.get(homeTeamId) || 'Time removido',
      awayTeamName: teamNameById.get(awayTeamId) || 'Time removido',
      homeGoals: isScoreFilled(match.homeGoals) ? Number(match.homeGoals) : null,
      awayGoals: isScoreFilled(match.awayGoals) ? Number(match.awayGoals) : null,
      isFinished: isMatchFinished(match)
    };
  });
}

export function buildTournamentInfo(teams = [], matches = []) {
  const standings = computeTournamentStandings(teams, matches);
  const responseMatches = mapTournamentMatchesForResponse(teams, matches).sort((a, b) => {
    if (a.round !== b.round) return a.round - b.round;
    const homeCompare = a.homeTeamName.localeCompare(b.homeTeamName);
    if (homeCompare !== 0) return homeCompare;
    return a.awayTeamName.localeCompare(b.awayTeamName);
  });

  const isCompleted = responseMatches.length > 0 && responseMatches.every((match) => match.isFinished);
  const champion = isCompleted ? standings[0] : null;

  return {
    standings,
    matches: responseMatches,
    isCompleted,
    championTeamId: champion?.teamId || null,
    championTeamName: champion?.teamName || null,
    totalMatches: responseMatches.length
  };
}
