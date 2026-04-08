export interface NotificationPollingState<T> {
  hasSeeded: boolean;
  previous: T[];
}

export function seedOrNotify<T>(
  state: NotificationPollingState<T>,
  next: T[],
  onNotify: (previous: T[], current: T[]) => void
): NotificationPollingState<T> {
  if (state.hasSeeded) {
    onNotify(state.previous, next);
  }

  return {
    hasSeeded: true,
    previous: next,
  };
}
