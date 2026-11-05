import { Service, signal } from '@angular/core';

import type { Widget } from '../../core/compass-api';

export interface PinnedWidget {
  id: number;
  question: string;
  widget: Widget;
}

/** Widgets the user pinned from the assistant onto the dashboard. Shared by the chat and the page. */
@Service()
export class PinnedWidgets {
  private nextId = 1;
  private readonly items = signal<readonly PinnedWidget[]>([]);

  readonly widgets = this.items.asReadonly();

  pin(question: string, widget: Widget): void {
    this.items.update((list) => [{ id: this.nextId++, question, widget }, ...list]);
  }

  unpin(id: number): void {
    this.items.update((list) => list.filter((item) => item.id !== id));
  }
}
