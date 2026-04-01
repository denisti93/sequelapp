import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn) {
    return true;
  }

  return authService.refreshAccessToken().pipe(
    map((refreshed) => {
      if (refreshed && authService.isLoggedIn) {
        return true;
      }

      return router.createUrlTree(['/login']);
    })
  );
};
