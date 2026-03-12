import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { PeladaSummary } from '../../models/pelada';
import { AuthService } from '../../core/services/auth.service';
import { PeladaService } from '../../core/services/pelada.service';
import { UserService } from '../../core/services/user.service';
import { User } from '../../models/user';

@Component({
  selector: 'app-pelada-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatTableModule,
    MatSnackBarModule,
    MatProgressBarModule
  ],
  templateUrl: './pelada-list.component.html',
  styleUrls: ['./pelada-list.component.scss']
})
export class PeladaListComponent implements OnInit {
  loading = false;
  summaryLoading = false;
  peladas: PeladaSummary[] = [];
  readonly displayedColumns = ['date', 'status', 'votingStatus', 'actions'];
  mySummary: User | null = null;

  readonly createForm = this.formBuilder.group({
    date: ['', Validators.required]
  });

  constructor(
    public readonly authService: AuthService,
    private readonly peladaService: PeladaService,
    private readonly userService: UserService,
    private readonly formBuilder: FormBuilder,
    private readonly snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadPeladas();
    if (!this.authService.isAdmin) {
      this.loadMySummary();
    }
  }

  loadPeladas(): void {
    this.loading = true;
    this.peladaService.listPeladas().subscribe({
      next: (peladas) => {
        this.peladas = peladas;
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        this.snackBar.open(error?.error?.message || 'Falha ao carregar rachas.', 'Fechar', {
          duration: 3000
        });
      }
    });
  }

  createPelada(): void {
    if (this.createForm.invalid || this.loading) {
      this.createForm.markAllAsTouched();
      return;
    }

    const date = this.createForm.value.date;
    if (!date) {
      return;
    }

    this.loading = true;

    this.peladaService.createPelada({ date }).subscribe({
      next: () => {
        this.createForm.reset();
        this.snackBar.open('Racha criado com sucesso.', 'Fechar', { duration: 2500 });
        this.loadPeladas();
      },
      error: (error) => {
        this.loading = false;
        this.snackBar.open(error?.error?.message || 'Falha ao criar racha.', 'Fechar', {
          duration: 3000
        });
      }
    });
  }

  loadMySummary(): void {
    this.summaryLoading = true;
    this.userService.getMe().subscribe({
      next: (user) => {
        this.mySummary = user;
        this.summaryLoading = false;
      },
      error: () => {
        this.summaryLoading = false;
      }
    });
  }

  votingStatusLabel(votingStatus: PeladaSummary['votingStatus']): string {
    if (votingStatus === 'OPEN') return 'Aberta';
    if (votingStatus === 'FINISHED') return 'Finalizada';
    return 'Fechada';
  }

  rachaStatusLabel(status: PeladaSummary['status']): string {
    return status === 'CONCLUDED' ? 'Concluido' : 'Aberto';
  }
}
