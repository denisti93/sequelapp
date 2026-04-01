import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const homeGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const routeByRole = () => {
    if (!authService.isLoggedIn) {
      return router.createUrlTree(['/login']);
    }

    if (authService.isAdmin) {
      return true;
    }

    return router.createUrlTree(['/perfil']);
  };

  if (authService.isLoggedIn) {
    return routeByRole();
  }

  return authService.refreshAccessToken().pipe(map(() => routeByRole()));
};
