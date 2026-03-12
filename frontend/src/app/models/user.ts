export type UserRole = 'ADM' | 'JOGADOR';

export interface User {
  id: string;
  name: string;
  username: string;
  role: UserRole;
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

export interface AuthResponse {
  token: string;
  user: User;
}
