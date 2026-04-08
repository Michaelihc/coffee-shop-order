type LogLevel = "info" | "warn" | "error";

function serializeError(error: Error) {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };
}

function sanitizeMetadata(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value instanceof Error) {
    return serializeError(value);
  }

  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeMetadata(entry, seen));
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return "[Circular]";
    }

    seen.add(value);
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      result[key] = sanitizeMetadata(entry, seen);
    }
    seen.delete(value);
    return result;
  }

  return String(value);
}

function writeLog(level: LogLevel, event: string, metadata?: Record<string, unknown>) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...(metadata ? { metadata: sanitizeMetadata(metadata) } : {}),
  };
  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}

export function logInfo(event: string, metadata?: Record<string, unknown>) {
  writeLog("info", event, metadata);
}

export function logWarn(event: string, metadata?: Record<string, unknown>) {
  writeLog("warn", event, metadata);
}

export function logError(event: string, metadata?: Record<string, unknown>) {
  writeLog("error", event, metadata);
}
