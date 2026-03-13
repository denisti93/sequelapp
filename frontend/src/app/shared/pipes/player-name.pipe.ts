import { Pipe, PipeTransform } from '@angular/core';
import { toPlayerDisplayName } from '../utils/player-name';

@Pipe({
  name: 'playerName',
  standalone: true
})
export class PlayerNamePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return toPlayerDisplayName(value);
  }
}
