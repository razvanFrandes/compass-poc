import { formatNumber } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  afterRenderEffect,
  Component,
  ElementRef,
  inject,
  input,
  LOCALE_ID,
  signal,
  viewChild,
} from '@angular/core';
import { form, FormField, maxLength, required } from '@angular/forms/signals';

import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowUp, lucideCheck, lucideChevronDown, lucidePin, lucideSparkles } from '@ng-icons/lucide';

import { ZardBubbleImports } from '@/shared/components/bubble/bubble.imports';
import { ZardButtonComponent } from '@/shared/components/button/button.component';
import { ZardCardImports } from '@/shared/components/card/card.imports';
import { ZardCollapsibleImports } from '@/shared/components/collapsible/collapsible.imports';
import { ZardEmptyComponent } from '@/shared/components/empty/empty.component';
import { ZardInputGroupImports } from '@/shared/components/input-group/input-group.imports';
import { ZardMessageImports } from '@/shared/components/message/message.imports';
import { ZardTextareaComponent } from '@/shared/components/textarea/textarea.component';

import { type AskResult, CompassApi } from '../../core/compass-api';
import { AiWidget } from './ai-widget';
import { PinnedWidgets } from './pinned-widgets';

interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  question?: string;
  result?: AskResult;
  error?: boolean;
}

const SUGGESTIONS = [
  'Compară ocuparea în Cluj și Brașov în august 2026 față de august 2025',
  'Cum arată mixul de canale în ultimele 90 de zile, după comision?',
  'În ce nopți din următoarele 30 de zile suntem sub concurență?',
  'Ce pickup avem pe weekendurile din decembrie, pe hoteluri?',
];

/** The chat with Compass: asks the API, shows the answer, the generated widget and the SQL behind it. */
@Component({
  selector: 'app-assistant-panel',
  imports: [
    ...ZardCardImports,
    ...ZardMessageImports,
    ...ZardBubbleImports,
    ...ZardInputGroupImports,
    ...ZardCollapsibleImports,
    ZardButtonComponent,
    ZardEmptyComponent,
    ZardTextareaComponent,
    FormField,
    NgIcon,
    AiWidget,
  ],
  viewProviders: [provideIcons({ lucideArrowUp, lucideCheck, lucideChevronDown, lucidePin, lucideSparkles })],
  templateUrl: './assistant-panel.html',
})
export class AssistantPanel {
  /** `all` or the hotel the dashboard is filtered on; sent with every question. */
  readonly hotel = input('all');

  private readonly api = inject(CompassApi);
  private readonly locale = inject(LOCALE_ID);
  protected readonly pinned = inject(PinnedWidgets);

  protected readonly suggestions = SUGGESTIONS;
  protected readonly messages = signal<readonly ChatMessage[]>([]);
  protected readonly pending = signal(false);
  protected readonly pinnedIds = signal<ReadonlySet<number>>(new Set());

  protected readonly draft = signal({ question: '' });
  protected readonly askForm = form(this.draft, (path) => {
    required(path.question);
    maxLength(path.question, 500);
  });

  private nextId = 1;
  private readonly thread = viewChild<ElementRef<HTMLElement>>('thread');

  constructor() {
    // Keep the newest turn in view whenever the thread grows.
    afterRenderEffect(() => {
      this.messages();
      this.pending();
      const el = this.thread()?.nativeElement;
      el?.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    });
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    this.send(this.draft().question);
  }

  protected onEnter(event: Event): void {
    if ((event as KeyboardEvent).shiftKey) return;
    event.preventDefault();
    this.send(this.draft().question);
  }

  protected async send(raw: string): Promise<void> {
    const question = raw.trim();
    if (!question || question.length > 500 || this.pending()) return;

    this.push({ role: 'user', text: question });
    this.draft.set({ question: '' });
    this.pending.set(true);
    try {
      const result = await this.api.ask(question, this.hotel());
      this.push({ role: 'assistant', text: result.answer, question, result });
    } catch (err) {
      const message =
        err instanceof HttpErrorResponse && typeof err.error?.error === 'string'
          ? err.error.error
          : 'Nu am putut contacta serverul. Verifică dacă API-ul rulează pe portul 3001.';
      this.push({ role: 'assistant', text: message, error: true });
    } finally {
      this.pending.set(false);
    }
  }

  protected pin(message: ChatMessage): void {
    if (!message.result?.widget || this.pinnedIds().has(message.id)) return;
    this.pinned.pin(message.question ?? '', message.result.widget);
    this.pinnedIds.update((ids) => new Set(ids).add(message.id));
  }

  protected footer(result: AskResult): string {
    const seconds = formatNumber(result.durationMs / 1000, this.locale, '1.1-1');
    return `${result.source === 'claude' ? 'Claude Code' : 'Mod demo'} · ${seconds} s`;
  }

  private push(message: Omit<ChatMessage, 'id'>): void {
    this.messages.update((list) => [...list, { ...message, id: this.nextId++ }]);
  }
}
