import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { AuthService } from '../../core/services/auth.service';
import { UserService } from '../../core/services/user.service';
import { PendingApprovalUser, User } from '../../models/user';

@Component({
  selector: 'app-ranking',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatTableModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatProgressBarModule
  ],
  templateUrl: './ranking.component.html',
  styleUrls: ['./ranking.component.scss']
})
export class RankingComponent implements OnInit {
  loading = false;
  users: User[] = [];
  pendingUsers: PendingApprovalUser[] = [];
  approvingUserId: string | null = null;
  readonly displayedColumns = [
    'name',
    'totalGoals',
    'totalAssists',
    'totalWins',
    'totalDraws',
    'totalLosses',
    'ratingAverage'
  ];

  readonly ratingForm = this.formBuilder.group({
    userId: ['', Validators.required],
    initialRating: [3, [Validators.required, Validators.min(1), Validators.max(5)]]
  });

  constructor(
    public readonly authService: AuthService,
    private readonly userService: UserService,
    private readonly formBuilder: FormBuilder,
    private readonly snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadUsers();
    if (this.authService.isAdmin) {
      this.loadPendingUsers();
    }
  }

  loadUsers(): void {
    this.loading = true;
    this.userService.getUsers().subscribe({
      next: (users) => {
        this.users = users;
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        this.snackBar.open(error?.error?.message || 'Falha ao carregar ranking.', 'Fechar', {
          duration: 3000
        });
      }
    });
  }

  loadPendingUsers(): void {
    if (!this.authService.isAdmin) {
      return;
    }

    this.userService.getPendingUsers().subscribe({
      next: (users) => {
        this.pendingUsers = users;
      },
      error: (error) => {
        this.snackBar.open(error?.error?.message || 'Falha ao carregar aprovações pendentes.', 'Fechar', {
          duration: 3000
        });
      }
    });
  }

  approveUser(userId: string): void {
    if (!this.authService.isAdmin || this.approvingUserId) {
      return;
    }

    this.approvingUserId = userId;
    this.userService.approveUser(userId).subscribe({
      next: (response) => {
        this.snackBar.open(response?.message || 'Jogador aprovado com sucesso.', 'Fechar', {
          duration: 2500
        });
        this.approvingUserId = null;
        this.loadPendingUsers();
        this.loadUsers();
      },
      error: (error) => {
        this.approvingUserId = null;
        this.snackBar.open(error?.error?.message || 'Falha ao aprovar jogador.', 'Fechar', {
          duration: 3000
        });
      }
    });
  }

  updateInitialRating(): void {
    if (!this.authService.isAdmin || this.ratingForm.invalid || this.loading) {
      this.ratingForm.markAllAsTouched();
      return;
    }

    const { userId, initialRating } = this.ratingForm.getRawValue();
    if (!userId || initialRating === null || initialRating === undefined) {
      return;
    }

    this.loading = true;
    this.userService.updateInitialRating(userId, Number(initialRating)).subscribe({
      next: () => {
        this.snackBar.open('Nota inicial atualizada.', 'Fechar', { duration: 2500 });
        this.loadUsers();
      },
      error: (error) => {
        this.loading = false;
        this.snackBar.open(error?.error?.message || 'Falha ao atualizar nota inicial.', 'Fechar', {
          duration: 3000
        });
      }
    });
  }
}
