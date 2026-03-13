import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { AuthService } from '../../core/services/auth.service';
import { UserService } from '../../core/services/user.service';
import { User } from '../../models/user';

@Component({
  selector: 'app-ranking',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatTableModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
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
  searchTerm = '';
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

  onSearchChange(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    this.searchTerm = target?.value || '';
  }

  clearSearch(): void {
    this.searchTerm = '';
  }

  get filteredUsers(): User[] {
    const query = this.normalize(this.searchTerm);
    if (!query) {
      return this.users;
    }

    return this.users.filter((user) => {
      const name = this.normalize(user.name);
      const username = this.normalize(user.username);
      return name.includes(query) || username.includes(query);
    });
  }

  averageRating(): number {
    if (this.users.length === 0) {
      return 0;
    }

    const total = this.users.reduce((sum, user) => sum + Number(user.ratingAverage || 0), 0);
    return Number((total / this.users.length).toFixed(2));
  }

  private normalize(value: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }
}
