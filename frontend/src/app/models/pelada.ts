export type VotingStatus = 'CLOSED' | 'OPEN' | 'FINISHED';
export type RachaStatus = 'OPEN' | 'CONCLUDED';

export interface PeladaSummary {
  id: string;
  date: string;
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

export interface PeladaDetail {
  id: string;
  date: string;
  happened: boolean;
  status: RachaStatus;
  votingStatus: VotingStatus;
  teams: PeladaTeam[];
  playerStats: PeladaPlayerStat[];
  votesCount: number;
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
