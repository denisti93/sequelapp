import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

function isAuthRequest(url: string): boolean {
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/signup') ||
    url.includes('/auth/refresh') ||
    url.includes('/auth/logout')
  );
}

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const authService = inject(AuthService);
  const token = authService.token;
  const authReq =
    token && !request.url.includes('/auth/refresh')
      ? request.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`
          }
        })
      : request;

  return next(authReq).pipe(
    catchError((error) => {
      if (error?.status !== 401 || isAuthRequest(request.url)) {
        return throwError(() => error);
      }

      return authService.refreshAccessToken().pipe(
        switchMap((refreshed) => {
          const newToken = authService.token;
          if (!refreshed || !newToken) {
            authService.handleAuthFailure('Sessão expirada. Faça login novamente.');
            return throwError(() => error);
          }

          return next(
            request.clone({
              setHeaders: {
                Authorization: `Bearer ${newToken}`
              }
            })
          ).pipe(
            catchError((retryError) => {
              if (retryError?.status === 401) {
                authService.handleAuthFailure('Sessão expirada. Faça login novamente.');
              }
              return throwError(() => retryError);
            })
          );
        })
      );
    })
  );
};
