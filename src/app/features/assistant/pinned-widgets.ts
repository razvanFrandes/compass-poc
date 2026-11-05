import { computed, Service, signal } from '@angular/core';

import type { Widget } from '../../core/compass-api';

export interface PinnedWidget {
  id: number;
  /** The chat message the widget came from, so the chat can show it as pinned. */
  sourceId: number;
  question: string;
  widget: Widget;
}

/** Widgets the user pinned from the assistant onto the dashboard. Shared by the chat and the page. */
@Service()
export class PinnedWidgets {
  private nextId = 1;
  private readonly items = signal<readonly PinnedWidget[]>([]);

  readonly widgets = this.items.asReadonly();
  readonly sourceIds = computed(() => new Set(this.items().map((item) => item.sourceId)));

  pin(sourceId: number, question: string, widget: Widget): void {
    if (this.sourceIds().has(sourceId)) return;
    this.items.update((list) => [{ id: this.nextId++, sourceId, question, widget }, ...list]);
  }

  unpin(id: number): void {
    this.items.update((list) => list.filter((item) => item.id !== id));
  }
}
