import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { LoginComponent } from './pages/login/login.component';
import { PeladaDetailComponent } from './pages/pelada-detail/pelada-detail.component';
import { PeladaListComponent } from './pages/pelada-list/pelada-list.component';
import { RankingComponent } from './pages/ranking/ranking.component';
import { SignupComponent } from './pages/signup/signup.component';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [guestGuard]
  },
  {
    path: 'signup',
    component: SignupComponent,
    canActivate: [guestGuard]
  },
  {
    path: 'peladas',
    component: PeladaListComponent,
    canActivate: [authGuard]
  },
  {
    path: 'peladas/:id',
    component: PeladaDetailComponent,
    canActivate: [authGuard]
  },
  {
    path: 'ranking',
    component: RankingComponent,
    canActivate: [authGuard]
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'peladas'
  },
  {
    path: '**',
    redirectTo: 'peladas'
  }
];
