export type UserRole = 'ADM' | 'JOGADOR';
export type ApprovalStatus = 'PENDING' | 'APPROVED';
export type PlayerPosition = 'ZAGUEIRO' | 'MEIA' | 'ATACANTE';

export interface User {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  position?: PlayerPosition;
  approvalStatus?: ApprovalStatus;
  createdAt?: string;
  initialRating: number;
  ratingAverage: number;
  totalGoals: number;
  totalAssists: number;
  totalWins: number;
  totalDraws: number;
  totalLosses: number;
  totalCraquePoints: number;
  totalCraqueFirstPlaces: number;
  totalCraqueSecondPlaces: number;
  totalCraqueThirdPlaces: number;
}

export interface PendingApprovalUser {
  id: string;
  name: string;
  username: string;
  role: 'JOGADOR';
  approvalStatus: 'PENDING';
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface SignupResponse {
  message: string;
}
