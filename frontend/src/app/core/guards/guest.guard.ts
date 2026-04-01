import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const resolveGuestAccess = () => {
    if (!authService.isLoggedIn) {
      return true;
    }

    if (authService.isAdmin) {
      return router.createUrlTree(['/peladas']);
    }

    return router.createUrlTree(['/perfil']);
  };

  if (authService.isLoggedIn) {
    return resolveGuestAccess();
  }

  return authService.refreshAccessToken().pipe(map(() => resolveGuestAccess()));
};
