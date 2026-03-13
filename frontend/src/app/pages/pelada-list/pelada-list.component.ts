import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { PeladaSummary } from '../../models/pelada';
import { AuthService } from '../../core/services/auth.service';
import { PeladaService } from '../../core/services/pelada.service';
import { UserService } from '../../core/services/user.service';
import { PendingApprovalUser, PlayerPosition, User } from '../../models/user';

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
    MatSelectModule,
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
  positionLoading = false;
  peladas: PeladaSummary[] = [];
  pendingUsers: PendingApprovalUser[] = [];
  approvingUserId: string | null = null;
  readonly displayedColumns = ['date', 'type', 'status', 'votingStatus', 'actions'];
  mySummary: User | null = null;
  readonly playerPositionOptions: Array<{ value: PlayerPosition; label: string }> = [
    { value: 'ZAGUEIRO', label: 'Zagueiro' },
    { value: 'MEIA', label: 'Meia' },
    { value: 'ATACANTE', label: 'Atacante' }
  ];

  readonly createForm = this.formBuilder.group({
    date: ['', Validators.required],
    type: ['NORMAL', Validators.required]
  });

  readonly positionForm = this.formBuilder.group({
    position: ['', Validators.required]
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
    if (this.authService.isAdmin) {
      this.loadPendingUsers();
    } else {
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

    const { date, type } = this.createForm.getRawValue();
    if (!date || !type) {
      return;
    }

    this.loading = true;

    this.peladaService.createPelada({
      date,
      type: type as 'NORMAL' | 'TOURNAMENT'
    }).subscribe({
      next: () => {
        this.createForm.reset({
          date: '',
          type: 'NORMAL'
        });
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
        this.positionForm.patchValue(
          {
            position: user.position || ''
          },
          { emitEvent: false }
        );
        if (this.authService.currentUser?.id === user.id) {
          this.authService.syncCurrentUser(user);
        }
        this.summaryLoading = false;
      },
      error: () => {
        this.summaryLoading = false;
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
        this.approvingUserId = null;
        this.snackBar.open(response?.message || 'Jogador aprovado com sucesso.', 'Fechar', {
          duration: 2500
        });
        this.loadPendingUsers();
      },
      error: (error) => {
        this.approvingUserId = null;
        this.snackBar.open(error?.error?.message || 'Falha ao aprovar jogador.', 'Fechar', {
          duration: 3000
        });
      }
    });
  }

  saveMyPosition(): void {
    if (this.positionForm.invalid || this.positionLoading || this.summaryLoading || this.authService.isAdmin) {
      this.positionForm.markAllAsTouched();
      return;
    }

    const { position } = this.positionForm.getRawValue();
    if (!position) {
      return;
    }

    this.positionLoading = true;
    this.userService.updateMyPosition(position as PlayerPosition).subscribe({
      next: (response) => {
        this.positionLoading = false;
        this.mySummary = response.user;
        this.positionForm.patchValue(
          {
            position: response.user.position || ''
          },
          { emitEvent: false }
        );
        this.authService.syncCurrentUser(response.user);
        this.snackBar.open(response.message || 'Posição atualizada com sucesso.', 'Fechar', {
          duration: 2600
        });
      },
      error: (error) => {
        this.positionLoading = false;
        this.snackBar.open(error?.error?.message || 'Falha ao atualizar posição.', 'Fechar', {
          duration: 3000
        });
      }
    });
  }

  playerPositionLabel(position?: PlayerPosition): string {
    if (position === 'ZAGUEIRO') return 'Zagueiro';
    if (position === 'MEIA') return 'Meia';
    if (position === 'ATACANTE') return 'Atacante';
    return 'Não definida';
  }

  totalMatches(summary: User | null): number {
    if (!summary) {
      return 0;
    }

    return Number(summary.totalWins || 0) + Number(summary.totalDraws || 0) + Number(summary.totalLosses || 0);
  }

  totalTop3Appearances(summary: User | null): number {
    if (!summary) {
      return 0;
    }

    return (
      Number(summary.totalCraqueFirstPlaces || 0) +
      Number(summary.totalCraqueSecondPlaces || 0) +
      Number(summary.totalCraqueThirdPlaces || 0)
    );
  }

  totalRachasCount(): number {
    return this.peladas.length;
  }

  openRachasCount(): number {
    return this.peladas.filter((racha) => racha.status === 'OPEN').length;
  }

  concludedRachasCount(): number {
    return this.peladas.filter((racha) => racha.status === 'CONCLUDED').length;
  }

  tournamentRachasCount(): number {
    return this.peladas.filter((racha) => racha.type === 'TOURNAMENT').length;
  }

  votingStatusLabel(votingStatus: PeladaSummary['votingStatus']): string {
    if (votingStatus === 'OPEN') return 'Aberta';
    if (votingStatus === 'FINISHED') return 'Finalizada';
    return 'Fechada';
  }

  rachaStatusLabel(status: PeladaSummary['status']): string {
    return status === 'CONCLUDED' ? 'Concluído' : 'Aberto';
  }

  rachaTypeLabel(type: PeladaSummary['type']): string {
    return type === 'TOURNAMENT' ? 'Torneio' : 'Racha comum';
  }
}
