export type VotingStatus = 'CLOSED' | 'OPEN' | 'FINISHED';
export type RachaStatus = 'OPEN' | 'CONCLUDED';
export type RachaType = 'NORMAL' | 'TOURNAMENT';

export interface PeladaSummary {
  id: string;
  date: string;
  type: RachaType;
  happened: boolean;
  status: RachaStatus;
  votingStatus: VotingStatus;
  teamsCount: number;
}

export interface PeladaPlayer {
  id: string;
  name: string;
  username: string;
  role: 'ADM' | 'JOGADOR';
  ratingAverage: number;
}

export interface PeladaTeam {
  id: string;
  name: string;
  goalkeepers: string[];
  wins: number;
  draws: number;
  losses: number;
  players: PeladaPlayer[];
}

export interface PeladaPlayerStat {
  playerId: string;
  playerName?: string;
  goals: number;
  assists: number;
}

export interface CraquePodiumItem {
  position: number;
  playerId: string;
  playerName: string;
  points: number;
  firstPlaces: number;
  secondPlaces: number;
  thirdPlaces: number;
}

export interface CraquePodium {
  totalBallots: number;
  top3: CraquePodiumItem[];
}

export interface TournamentMatch {
  id: string;
  round: number;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeGoals: number | null;
  awayGoals: number | null;
  isFinished: boolean;
}

export interface TournamentStanding {
  position: number;
  teamId: string;
  teamName: string;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  directPoints: number;
}

export interface TournamentInfo {
  standings: TournamentStanding[];
  matches: TournamentMatch[];
  isCompleted: boolean;
  championTeamId: string | null;
  championTeamName: string | null;
  totalMatches: number;
}

export interface PeladaDetail {
  id: string;
  date: string;
  type: RachaType;
  happened: boolean;
  status: RachaStatus;
  votingStatus: VotingStatus;
  teams: PeladaTeam[];
  playerStats: PeladaPlayerStat[];
  votesCount: number;
  tournament: TournamentInfo | null;
  craquePodium: CraquePodium;
}

export interface CraqueVoteSelection {
  firstUserId: string;
  secondUserId: string;
  thirdUserId: string;
}

export interface RatingCard {
  playerId: string;
  name: string;
  username: string;
  ratingAverage: number;
  matchGoals: number;
  matchAssists: number;
  matchWins: number;
  matchDraws: number;
  matchLosses: number;
  alreadyRatedByMe: boolean;
  canVote: boolean;
}

export interface RatingCardsResponse {
  peladaId: string;
  status: RachaStatus;
  votingStatus: VotingStatus;
  canCurrentUserVote: boolean;
  canCurrentUserVoteCraque: boolean;
  myCraqueVote: CraqueVoteSelection | null;
  cards: RatingCard[];
}

export interface VoteDetail {
  voteId: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  score: number;
  createdAt: string;
  updatedAt: string;
}

export interface VoteDetailsResponse {
  peladaId: string;
  status: RachaStatus;
  votingStatus: VotingStatus;
  votes: VoteDetail[];
}
