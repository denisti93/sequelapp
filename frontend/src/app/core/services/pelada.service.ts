import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  PeladaDetail,
  PeladaSummary,
  RatingCardsResponse,
  VoteDetailsResponse
} from '../../models/pelada';

interface CreatePeladaInput {
  date: string;
}

interface TeamInput {
  name: string;
  players: string[];
  goalkeepers: string[];
}

interface TeamResultInput {
  teamId: string;
  wins: number;
  draws: number;
  losses: number;
}

interface PlayerStatsInput {
  playerId: string;
  goals: number;
  assists: number;
}

@Injectable({ providedIn: 'root' })
export class PeladaService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  listPeladas(): Observable<PeladaSummary[]> {
    return this.http.get<PeladaSummary[]>(`${this.apiUrl}/peladas`);
  }

  getPelada(id: string): Observable<PeladaDetail> {
    return this.http.get<PeladaDetail>(`${this.apiUrl}/peladas/${id}`);
  }

  createPelada(payload: CreatePeladaInput): Observable<PeladaDetail> {
    return this.http.post<PeladaDetail>(`${this.apiUrl}/peladas`, payload);
  }

  updateTeams(id: string, teams: TeamInput[]): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(`${this.apiUrl}/peladas/${id}/teams`, {
      teams
    });
  }

  updateResults(id: string, results: TeamResultInput[]): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(`${this.apiUrl}/peladas/${id}/results`, {
      results
    });
  }

  updatePlayerStats(id: string, stats: PlayerStatsInput[]): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(`${this.apiUrl}/peladas/${id}/player-stats`, {
      stats
    });
  }

  openVoting(id: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/peladas/${id}/voting/open`, {});
  }

  finishVoting(id: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/peladas/${id}/voting/finish`, {});
  }

  concludeRacha(id: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/peladas/${id}/conclude`, {});
  }

  getRatingCards(id: string): Observable<RatingCardsResponse> {
    return this.http.get<RatingCardsResponse>(`${this.apiUrl}/peladas/${id}/rating-cards`);
  }

  vote(id: string, toUserId: string, score: number): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/peladas/${id}/votes`, {
      toUserId,
      score
    });
  }

  submitCraqueVote(
    id: string,
    payload: { firstUserId: string; secondUserId: string; thirdUserId: string }
  ): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/peladas/${id}/craque-vote`, payload);
  }

  getVoteDetails(id: string): Observable<VoteDetailsResponse> {
    return this.http.get<VoteDetailsResponse>(`${this.apiUrl}/peladas/${id}/votes/details`);
  }

  adminEditVote(
    id: string,
    fromUserId: string,
    toUserId: string,
    score: number
  ): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(`${this.apiUrl}/peladas/${id}/votes/admin-edit`, {
      fromUserId,
      toUserId,
      score
    });
  }
}
