const AUTH_DEBUG_STORAGE_KEY = "coffee-shop-auth-debug-events";
const AUTH_DEBUG_EVENT_NAME = "coffee-shop-auth-debug";
const MAX_EVENTS = 20;

export interface AuthDebugEvent {
  title: string;
  body: string;
  timestamp: number;
}

function readEvents(): AuthDebugEvent[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = sessionStorage.getItem(AUTH_DEBUG_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as AuthDebugEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeEvents(events: AuthDebugEvent[]) {
  if (typeof window === "undefined") {
    return;
  }

  sessionStorage.setItem(
    AUTH_DEBUG_STORAGE_KEY,
    JSON.stringify(events.slice(-MAX_EVENTS))
  );
}

export function pushAuthDebug(title: string, body: string) {
  if (typeof window === "undefined") {
    return;
  }

  const event: AuthDebugEvent = {
    title,
    body,
    timestamp: Date.now(),
  };

  const events = readEvents();
  events.push(event);
  writeEvents(events);
  window.dispatchEvent(
    new CustomEvent<AuthDebugEvent>(AUTH_DEBUG_EVENT_NAME, { detail: event })
  );
}

export function consumeAuthDebugEvents(): AuthDebugEvent[] {
  const events = readEvents();
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(AUTH_DEBUG_STORAGE_KEY);
  }
  return events;
}

export function getAuthDebugEvents(): AuthDebugEvent[] {
  return readEvents();
}

export function clearAuthDebugEvents() {
  if (typeof window === "undefined") {
    return;
  }

  sessionStorage.removeItem(AUTH_DEBUG_STORAGE_KEY);
}

export function formatAuthDebugEvents(events: AuthDebugEvent[]): string {
  if (events.length === 0) {
    return "No auth debug events recorded.";
  }

  return events
    .map((event) => {
      const time = new Date(event.timestamp).toISOString();
      return `[${time}] ${event.title}\n${event.body}`;
    })
    .join("\n\n");
}

export function getAuthDebugEventName(): string {
  return AUTH_DEBUG_EVENT_NAME;
}
