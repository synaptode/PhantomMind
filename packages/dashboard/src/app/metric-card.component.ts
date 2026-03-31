import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgIf } from '@angular/common';

@Component({
  selector: 'pm-metric-card',
  standalone: true,
  imports: [NgIf],
  templateUrl: './metric-card.component.html',
  styleUrl: './metric-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetricCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly hint = input<string>('');
  readonly tone = input<'neutral' | 'good' | 'warn' | 'bad'>('neutral');
  readonly delay = input<number>(0);
}
