import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PendingApprovalUser, User } from '../../models/user';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/users`);
  }

  getPendingUsers(): Observable<PendingApprovalUser[]> {
    return this.http.get<PendingApprovalUser[]>(`${this.apiUrl}/users/pending`);
  }

  getMe(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/users/me`);
  }

  approveUser(userId: string): Observable<{ message: string; user: User }> {
    return this.http.patch<{ message: string; user: User }>(`${this.apiUrl}/users/${userId}/approve`, {});
  }

  updateInitialRating(userId: string, initialRating: number): Observable<User> {
    return this.http.patch<User>(`${this.apiUrl}/users/${userId}/initial-rating`, {
      initialRating
    });
  }
}
