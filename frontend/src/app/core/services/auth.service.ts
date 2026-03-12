import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, SignupResponse, User } from '../../models/user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = environment.apiUrl;
  private readonly tokenKey = 'pelada_manager_token';
  private readonly userKey = 'pelada_manager_user';

  private readonly userSubject = new BehaviorSubject<User | null>(null);
  readonly user$ = this.userSubject.asObservable();

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router
  ) {
    this.restoreSession();
  }

  get currentUser(): User | null {
    return this.userSubject.value;
  }

  get token(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  get isLoggedIn(): boolean {
    return Boolean(this.token && this.currentUser);
  }

  get isAdmin(): boolean {
    return this.currentUser?.role === 'ADM';
  }

  login(username: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/auth/login`, { username, password })
      .pipe(tap((response) => this.saveSession(response)));
  }

  signup(name: string, lastName: string, username: string, password: string): Observable<SignupResponse> {
    return this.http.post<SignupResponse>(`${this.apiUrl}/auth/signup`, {
      name,
      lastName,
      username,
      password
    });
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    this.userSubject.next(null);
    this.router.navigate(['/login']);
  }

  syncCurrentUser(user: User): void {
    localStorage.setItem(this.userKey, JSON.stringify(user));
    this.userSubject.next(user);
  }

  private saveSession(response: AuthResponse): void {
    localStorage.setItem(this.tokenKey, response.token);
    localStorage.setItem(this.userKey, JSON.stringify(response.user));
    this.userSubject.next(response.user);
  }

  private restoreSession(): void {
    const rawUser = localStorage.getItem(this.userKey);
    if (!rawUser) {
      return;
    }

    try {
      const user = JSON.parse(rawUser) as User;
      this.userSubject.next(user);
    } catch {
      localStorage.removeItem(this.userKey);
      localStorage.removeItem(this.tokenKey);
      this.userSubject.next(null);
    }
  }
}
