import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import {
  AbstractControl,
  ReactiveFormsModule,
  UntypedFormArray,
  UntypedFormBuilder,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { PeladaService } from '../../core/services/pelada.service';
import { UserService } from '../../core/services/user.service';
import {
  CraqueVoteSelection,
  PeladaDetail,
  RatingCard,
  RatingCardsResponse,
  VoteDetail
} from '../../models/pelada';
import { User } from '../../models/user';

function exactLengthValidator(length: number) {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (!Array.isArray(value)) {
      return { invalidArray: true };
    }

    return value.length === length ? null : { exactLength: { required: length } };
  };
}

@Component({
  selector: 'app-pelada-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatIconModule,
    MatProgressBarModule,
    MatChipsModule
  ],
  templateUrl: './pelada-detail.component.html',
  styleUrls: ['./pelada-detail.component.scss']
})
export class PeladaDetailComponent implements OnInit {
  peladaId = '';
  pelada: PeladaDetail | null = null;
  users: User[] = [];

  loading = false;
  actionLoading = false;

  ratingCards: RatingCard[] = [];
  canCurrentUserVote = false;
  canCurrentUserVoteCraque = false;
  voteSelections: Record<string, number> = {};
  craqueVoteSelections: CraqueVoteSelection = this.emptyCraqueVoteSelections();
  voteGroups: Array<{ toUserId: string; toUserName: string; votes: VoteDetail[] }> = [];
  adminVoteSelections: Record<string, number> = {};
  tournamentRoundGroups: Array<{ round: number; matchIndexes: number[] }> = [];

  readonly teamForm = this.formBuilder.group({
    teams: this.formBuilder.array([])
  });

  readonly resultsForm = this.formBuilder.group({
    results: this.formBuilder.array([])
  });

  readonly statsForm = this.formBuilder.group({
    stats: this.formBuilder.array([])
  });

  readonly tournamentForm = this.formBuilder.group({
    matches: this.formBuilder.array([])
  });

  constructor(
    private readonly route: ActivatedRoute,
    private readonly formBuilder: UntypedFormBuilder,
    private readonly peladaService: PeladaService,
    private readonly userService: UserService,
    private readonly snackBar: MatSnackBar,
    public readonly authService: AuthService
  ) {}

  get teamsArray(): UntypedFormArray {
    return this.teamForm.get('teams') as UntypedFormArray;
  }

  get resultsArray(): UntypedFormArray {
    return this.resultsForm.get('results') as UntypedFormArray;
  }

  get statsArray(): UntypedFormArray {
    return this.statsForm.get('stats') as UntypedFormArray;
  }

  get tournamentMatchesArray(): UntypedFormArray {
    return this.tournamentForm.get('matches') as UntypedFormArray;
  }

  get isTournament(): boolean {
    return (this.pelada?.type || 'NORMAL') === 'TOURNAMENT';
  }

  ngOnInit(): void {
    this.peladaId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.peladaId) {
      return;
    }

    this.loadData();
  }

  get isConcluded(): boolean {
    return (this.pelada?.status || 'OPEN') === 'CONCLUDED';
  }

  loadData(): void {
    this.loading = true;

    forkJoin({
      pelada: this.peladaService.getPelada(this.peladaId),
      users: this.userService.getUsers(),
      rating: this.peladaService.getRatingCards(this.peladaId),
      votes: this.authService.isAdmin ? this.peladaService.getVoteDetails(this.peladaId) : of(null)
    }).subscribe({
      next: ({ pelada, users, rating, votes }) => {
        this.pelada = pelada;
        this.users = users;

        this.buildTeamForm(pelada);
        this.buildResultsForm(pelada);
        this.buildStatsForm(pelada);
        this.buildTournamentForm(pelada);
        this.applyRatingCards(rating);
        this.applyVoteDetails(votes?.votes || []);
        this.updateFormEditability();

        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        this.snackBar.open(error?.error?.message || 'Falha ao carregar detalhes do racha.', 'Fechar', {
          duration: 3200
        });
      }
    });
  }

  private buildTeamForm(pelada: PeladaDetail): void {
    this.teamsArray.clear();

    const existingTeams = pelada.teams || [];
    const totalTeams = Math.max(4, existingTeams.length || 0);

    for (let index = 0; index < totalTeams; index += 1) {
      const team = existingTeams[index];
      this.teamsArray.push(
        this.formBuilder.group({
          name: [team?.name || `Time ${index + 1}`, [Validators.required]],
          players: [team?.players?.map((player) => player.id) || [], [exactLengthValidator(5)]],
          goalkeepersText: [team?.goalkeepers?.join(', ') || '']
        })
      );
    }

    this.normalizeTeamSelections();
  }

  private getTeamPlayerIds(teamIndex: number): string[] {
    const control = this.teamsArray.at(teamIndex)?.get('players');
    const value = control?.value;

    if (!Array.isArray(value)) {
      return [];
    }

    return value.map((playerId) => String(playerId));
  }

  private normalizeTeamSelections(): void {
    const usedPlayers = new Set<string>();

    for (let index = 0; index < this.teamsArray.length; index += 1) {
      const control = this.teamsArray.at(index)?.get('players');
      const currentPlayers = this.getTeamPlayerIds(index);
      const uniquePlayers: string[] = [];

      for (const playerId of currentPlayers) {
        if (usedPlayers.has(playerId)) {
          continue;
        }
        usedPlayers.add(playerId);
        uniquePlayers.push(playerId);
      }

      if (uniquePlayers.length !== currentPlayers.length) {
        control?.setValue(uniquePlayers, { emitEvent: false });
      }
    }
  }

  isPlayerUnavailableForTeam(playerId: string, currentTeamIndex: number): boolean {
    const normalizedPlayerId = String(playerId);
    const currentTeamPlayers = this.getTeamPlayerIds(currentTeamIndex);

    if (currentTeamPlayers.includes(normalizedPlayerId)) {
      return false;
    }

    for (let index = 0; index < this.teamsArray.length; index += 1) {
      if (index === currentTeamIndex) {
        continue;
      }

      if (this.getTeamPlayerIds(index).includes(normalizedPlayerId)) {
        return true;
      }
    }

    return false;
  }

  onTeamPlayersChanged(changedTeamIndex: number): void {
    const selectedOnChangedTeam = new Set(this.getTeamPlayerIds(changedTeamIndex));

    for (let index = 0; index < this.teamsArray.length; index += 1) {
      if (index === changedTeamIndex) {
        continue;
      }

      const control = this.teamsArray.at(index)?.get('players');
      const currentPlayers = this.getTeamPlayerIds(index);
      const filteredPlayers = currentPlayers.filter((playerId) => !selectedOnChangedTeam.has(playerId));

      if (filteredPlayers.length !== currentPlayers.length) {
        control?.setValue(filteredPlayers, { emitEvent: false });
      }
    }
  }

  getSelectedPlayersForTeam(teamIndex: number): string[] {
    const selectedIds = this.getTeamPlayerIds(teamIndex);
    const usersById = new Map(this.users.map((user) => [user.id, user]));

    return selectedIds
      .map((userId) => usersById.get(userId)?.name)
      .filter((name): name is string => Boolean(name))
      .sort((a, b) => a.localeCompare(b));
  }

  private buildResultsForm(pelada: PeladaDetail): void {
    this.resultsArray.clear();

    for (const team of pelada.teams || []) {
      this.resultsArray.push(
        this.formBuilder.group({
          teamId: [team.id],
          teamName: [team.name],
          wins: [team.wins || 0, [Validators.min(0)]],
          draws: [team.draws || 0, [Validators.min(0)]],
          losses: [team.losses || 0, [Validators.min(0)]]
        })
      );
    }
  }

  private buildStatsForm(pelada: PeladaDetail): void {
    this.statsArray.clear();

    const participantMap = new Map<string, { name: string }>();
    for (const team of pelada.teams || []) {
      for (const player of team.players || []) {
        participantMap.set(player.id, { name: player.name });
      }
    }

    const currentStats = new Map(pelada.playerStats.map((stat) => [stat.playerId, stat]));

    for (const [playerId, player] of participantMap.entries()) {
      const stat = currentStats.get(playerId);
      this.statsArray.push(
        this.formBuilder.group({
          playerId: [playerId],
          playerName: [player.name],
          goals: [stat?.goals || 0, [Validators.min(0)]],
          assists: [stat?.assists || 0, [Validators.min(0)]]
        })
      );
    }
  }

  private buildTournamentForm(pelada: PeladaDetail): void {
    this.tournamentMatchesArray.clear();
    this.tournamentRoundGroups = [];

    if (pelada.type !== 'TOURNAMENT') {
      return;
    }

    const roundMap = new Map<number, number[]>();

    for (const match of pelada.tournament?.matches || []) {
      const formIndex = this.tournamentMatchesArray.length;
      this.tournamentMatchesArray.push(
        this.formBuilder.group({
          matchId: [match.id],
          round: [match.round],
          homeTeamName: [match.homeTeamName],
          awayTeamName: [match.awayTeamName],
          homeGoals: [match.homeGoals, [Validators.min(0)]],
          awayGoals: [match.awayGoals, [Validators.min(0)]]
        })
      );

      const round = Number(match.round || 1);
      if (!roundMap.has(round)) {
        roundMap.set(round, []);
      }
      roundMap.get(round)?.push(formIndex);
    }

    this.tournamentRoundGroups = Array.from(roundMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([round, matchIndexes]) => ({ round, matchIndexes }));
  }

  private applyRatingCards(rating: RatingCardsResponse): void {
    this.ratingCards = rating.cards;
    this.canCurrentUserVote = rating.canCurrentUserVote;
    this.canCurrentUserVoteCraque = rating.canCurrentUserVoteCraque;
    this.voteSelections = {};
    this.craqueVoteSelections = rating.myCraqueVote
      ? { ...rating.myCraqueVote }
      : this.emptyCraqueVoteSelections();
  }

  private applyVoteDetails(votes: VoteDetail[]): void {
    this.adminVoteSelections = {};
    for (const vote of votes) {
      this.adminVoteSelections[this.voteEditKey(vote)] = vote.score;
    }

    const groupsMap = new Map<string, { toUserId: string; toUserName: string; votes: VoteDetail[] }>();

    for (const vote of votes) {
      const key = vote.toUserId;
      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          toUserId: vote.toUserId,
          toUserName: vote.toUserName,
          votes: []
        });
      }
      groupsMap.get(key)?.votes.push(vote);
    }

    this.voteGroups = Array.from(groupsMap.values())
      .map((group) => ({
        ...group,
        votes: group.votes.sort((a, b) => a.fromUserName.localeCompare(b.fromUserName))
      }))
      .sort((a, b) => a.toUserName.localeCompare(b.toUserName));
  }

  private updateFormEditability(): void {
    if (this.isConcluded) {
      this.teamForm.disable({ emitEvent: false });
      this.resultsForm.disable({ emitEvent: false });
      this.statsForm.disable({ emitEvent: false });
      this.tournamentForm.disable({ emitEvent: false });
      return;
    }

    this.teamForm.enable({ emitEvent: false });
    this.resultsForm.enable({ emitEvent: false });
    this.statsForm.enable({ emitEvent: false });
    this.tournamentForm.enable({ emitEvent: false });
  }

  private ensureNotConcluded(): boolean {
    if (!this.isConcluded) {
      return true;
    }

    this.snackBar.open('Este racha foi concluído e não permite novos ajustes.', 'Fechar', {
      duration: 2800
    });
    return false;
  }

  private emptyCraqueVoteSelections(): CraqueVoteSelection {
    return {
      firstUserId: '',
      secondUserId: '',
      thirdUserId: ''
    };
  }

  isCraqueOptionDisabled(
    playerId: string,
    slot: keyof CraqueVoteSelection
  ): boolean {
    const currentSlotValue = this.craqueVoteSelections[slot];
    if (currentSlotValue === playerId) {
      return false;
    }

    return (
      this.craqueVoteSelections.firstUserId === playerId ||
      this.craqueVoteSelections.secondUserId === playerId ||
      this.craqueVoteSelections.thirdUserId === playerId
    );
  }

  saveTeams(): void {
    if (!this.ensureNotConcluded()) {
      return;
    }

    if (!this.authService.isAdmin || this.teamForm.invalid || this.actionLoading || !this.pelada) {
      this.teamForm.markAllAsTouched();
      return;
    }

    const rawTeams = this.teamsArray.getRawValue() as Array<{
      name: string;
      players: string[];
      goalkeepersText: string;
    }>;

    const players = rawTeams.flatMap((team) => team.players || []);
    if (new Set(players).size !== players.length) {
      this.snackBar.open('Um jogador não pode estar em mais de um time.', 'Fechar', {
        duration: 2800
      });
      return;
    }

    this.actionLoading = true;

    const payload = rawTeams.map((team) => ({
      name: team.name,
      players: team.players,
      goalkeepers: String(team.goalkeepersText || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    }));

    this.peladaService.updateTeams(this.peladaId, payload).subscribe({
      next: () => {
        this.snackBar.open('Times atualizados.', 'Fechar', { duration: 2200 });
        this.actionLoading = false;
        this.loadData();
      },
      error: (error) => {
        this.actionLoading = false;
        this.snackBar.open(error?.error?.message || 'Falha ao atualizar times.', 'Fechar', {
          duration: 3200
        });
      }
    });
  }

  saveResults(): void {
    if (!this.ensureNotConcluded()) {
      return;
    }

    if (this.isTournament) {
      this.snackBar.open(
        'No torneio, os resultados por time são calculados automaticamente pelos confrontos.',
        'Fechar',
        { duration: 3200 }
      );
      return;
    }

    if (!this.authService.isAdmin || this.resultsForm.invalid || this.actionLoading || !this.pelada) {
      this.resultsForm.markAllAsTouched();
      return;
    }

    this.actionLoading = true;
    this.peladaService.updateResults(this.peladaId, this.resultsArray.getRawValue()).subscribe({
      next: () => {
        this.snackBar.open('Resultados atualizados.', 'Fechar', { duration: 2200 });
        this.actionLoading = false;
        this.loadData();
      },
      error: (error) => {
        this.actionLoading = false;
        this.snackBar.open(error?.error?.message || 'Falha ao atualizar resultados.', 'Fechar', {
          duration: 3200
        });
      }
    });
  }

  saveTournamentMatch(matchIndex: number): void {
    if (!this.ensureNotConcluded()) {
      return;
    }

    if (!this.authService.isAdmin || this.actionLoading || !this.pelada || !this.isTournament) {
      return;
    }

    const control = this.tournamentMatchesArray.at(matchIndex);
    if (!control) {
      return;
    }

    const matchId = String(control.get('matchId')?.value || '');
    const homeGoalsRaw = control.get('homeGoals')?.value;
    const awayGoalsRaw = control.get('awayGoals')?.value;

    if (
      homeGoalsRaw === null ||
      homeGoalsRaw === undefined ||
      homeGoalsRaw === '' ||
      awayGoalsRaw === null ||
      awayGoalsRaw === undefined ||
      awayGoalsRaw === ''
    ) {
      this.snackBar.open('Preencha os dois lados do placar para salvar.', 'Fechar', {
        duration: 2800
      });
      return;
    }

    const homeGoals = Number(homeGoalsRaw);
    const awayGoals = Number(awayGoalsRaw);

    if (!matchId || !Number.isInteger(homeGoals) || !Number.isInteger(awayGoals) || homeGoals < 0 || awayGoals < 0) {
      this.snackBar.open('Informe placar com números inteiros >= 0 para os dois times.', 'Fechar', {
        duration: 2800
      });
      return;
    }

    this.actionLoading = true;
    this.peladaService.updateTournamentMatch(this.peladaId, matchId, homeGoals, awayGoals).subscribe({
      next: () => {
        this.snackBar.open('Placar atualizado.', 'Fechar', { duration: 2200 });
        this.actionLoading = false;
        this.loadData();
      },
      error: (error) => {
        this.actionLoading = false;
        this.snackBar.open(error?.error?.message || 'Falha ao atualizar placar.', 'Fechar', {
          duration: 3200
        });
      }
    });
  }

  savePlayerStats(): void {
    if (!this.ensureNotConcluded()) {
      return;
    }

    if (!this.authService.isAdmin || this.statsForm.invalid || this.actionLoading || !this.pelada) {
      this.statsForm.markAllAsTouched();
      return;
    }

    const payload = this.statsArray.getRawValue().map((item: { playerId: string; goals: number; assists: number }) => ({
      playerId: item.playerId,
      goals: Number(item.goals || 0),
      assists: Number(item.assists || 0)
    }));

    this.actionLoading = true;
    this.peladaService.updatePlayerStats(this.peladaId, payload).subscribe({
      next: () => {
        this.snackBar.open('Gols e assistências atualizados.', 'Fechar', { duration: 2200 });
        this.actionLoading = false;
        this.loadData();
      },
      error: (error) => {
        this.actionLoading = false;
        this.snackBar.open(error?.error?.message || 'Falha ao atualizar estatísticas.', 'Fechar', {
          duration: 3200
        });
      }
    });
  }

  openVoting(): void {
    if (!this.ensureNotConcluded()) {
      return;
    }

    if (!this.authService.isAdmin || this.actionLoading) {
      return;
    }

    this.actionLoading = true;
    this.peladaService.openVoting(this.peladaId).subscribe({
      next: () => {
        this.snackBar.open('Votação aberta.', 'Fechar', { duration: 2200 });
        this.actionLoading = false;
        this.loadData();
      },
      error: (error) => {
        this.actionLoading = false;
        this.snackBar.open(error?.error?.message || 'Falha ao abrir votação.', 'Fechar', {
          duration: 3200
        });
      }
    });
  }

  finishVoting(): void {
    if (!this.ensureNotConcluded()) {
      return;
    }

    if (!this.authService.isAdmin || this.actionLoading) {
      return;
    }

    this.actionLoading = true;
    this.peladaService.finishVoting(this.peladaId).subscribe({
      next: () => {
        this.snackBar.open('Votação finalizada.', 'Fechar', { duration: 2200 });
        this.actionLoading = false;
        this.loadData();
      },
      error: (error) => {
        this.actionLoading = false;
        this.snackBar.open(error?.error?.message || 'Falha ao finalizar votação.', 'Fechar', {
          duration: 3200
        });
      }
    });
  }

  submitVote(card: RatingCard): void {
    if (!this.ensureNotConcluded()) {
      return;
    }

    const score = this.voteSelections[card.playerId];

    if (!score || score < 1 || score > 5) {
      this.snackBar.open('Selecione uma nota entre 1 e 5.', 'Fechar', { duration: 2200 });
      return;
    }

    if (!card.canVote || this.actionLoading) {
      return;
    }

    this.actionLoading = true;
    this.peladaService.vote(this.peladaId, card.playerId, score).subscribe({
      next: () => {
        this.snackBar.open('Nota registrada.', 'Fechar', { duration: 2200 });
        this.actionLoading = false;
        this.loadData();
      },
      error: (error) => {
        this.actionLoading = false;
        this.snackBar.open(error?.error?.message || 'Falha ao registrar nota.', 'Fechar', {
          duration: 3200
        });
      }
    });
  }

  submitCraqueVote(): void {
    if (!this.ensureNotConcluded()) {
      return;
    }

    if (!this.canCurrentUserVoteCraque || this.actionLoading) {
      return;
    }

    const { firstUserId, secondUserId, thirdUserId } = this.craqueVoteSelections;
    if (!firstUserId || !secondUserId || !thirdUserId) {
      this.snackBar.open('Selecione 1º, 2º e 3º lugar do craque do racha.', 'Fechar', {
        duration: 2400
      });
      return;
    }

    if (new Set([firstUserId, secondUserId, thirdUserId]).size !== 3) {
      this.snackBar.open('Os três colocados devem ser jogadores diferentes.', 'Fechar', {
        duration: 2400
      });
      return;
    }

    if (
      this.authService.currentUser &&
      [firstUserId, secondUserId, thirdUserId].includes(this.authService.currentUser.id)
    ) {
      this.snackBar.open('Não é permitido colocar a si mesmo no pódio de craque.', 'Fechar', {
        duration: 2400
      });
      return;
    }

    this.actionLoading = true;
    this.peladaService
      .submitCraqueVote(this.peladaId, {
        firstUserId,
        secondUserId,
        thirdUserId
      })
      .subscribe({
        next: () => {
          this.snackBar.open('Pódio de craque registrado.', 'Fechar', { duration: 2200 });
          this.actionLoading = false;
          this.loadData();
        },
        error: (error) => {
          this.actionLoading = false;
          this.snackBar.open(error?.error?.message || 'Falha ao registrar pódio de craque.', 'Fechar', {
            duration: 3200
          });
        }
      });
  }

  concludeRacha(): void {
    if (!this.authService.isAdmin || this.actionLoading || this.isConcluded) {
      return;
    }

    this.actionLoading = true;
    this.peladaService.concludeRacha(this.peladaId).subscribe({
      next: () => {
        this.snackBar.open('Racha concluído. Ajustes e notas foram bloqueados.', 'Fechar', {
          duration: 2600
        });
        this.actionLoading = false;
        this.loadData();
      },
      error: (error) => {
        this.actionLoading = false;
        this.snackBar.open(error?.error?.message || 'Falha ao concluir racha.', 'Fechar', {
          duration: 3200
        });
      }
    });
  }

  voteEditKey(vote: VoteDetail): string {
    return `${vote.fromUserId}:${vote.toUserId}`;
  }

  saveAdminVote(vote: VoteDetail): void {
    if (!this.ensureNotConcluded()) {
      return;
    }

    if (!this.authService.isAdmin || this.actionLoading) {
      return;
    }

    const score = Number(this.adminVoteSelections[this.voteEditKey(vote)]);
    if (Number.isNaN(score) || score < 1 || score > 5) {
      this.snackBar.open('Selecione uma nota entre 1 e 5.', 'Fechar', { duration: 2200 });
      return;
    }

    this.actionLoading = true;
    this.peladaService.adminEditVote(this.peladaId, vote.fromUserId, vote.toUserId, score).subscribe({
      next: () => {
        this.snackBar.open('Nota corrigida com sucesso.', 'Fechar', { duration: 2200 });
        this.actionLoading = false;
        this.loadData();
      },
      error: (error) => {
        this.actionLoading = false;
        this.snackBar.open(error?.error?.message || 'Falha ao corrigir nota.', 'Fechar', {
          duration: 3200
        });
      }
    });
  }

  ratingStatusLabel(): string {
    if (!this.pelada) {
      return '-';
    }

    if (this.pelada.votingStatus === 'OPEN') {
      return 'Aberta';
    }

    if (this.pelada.votingStatus === 'FINISHED') {
      return 'Finalizada';
    }

    return 'Fechada';
  }

  rachaTypeLabel(): string {
    if (!this.pelada) {
      return '-';
    }

    return this.pelada.type === 'TOURNAMENT' ? 'Torneio' : 'Racha comum';
  }

  tournamentLeaderName(): string {
    if (!this.pelada?.tournament?.standings?.length) {
      return '-';
    }

    return this.pelada.tournament.standings[0].teamName;
  }

  isChampionTeam(teamId: string): boolean {
    return Boolean(this.isTournament && this.pelada?.tournament?.championTeamId === teamId);
  }

  formatMatchScore(homeGoals: number | null, awayGoals: number | null): string {
    if (homeGoals === null || awayGoals === null) {
      return 'x';
    }

    return `${homeGoals} x ${awayGoals}`;
  }
}
