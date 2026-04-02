function parseBoolean(value: string | undefined): boolean | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes") {
    return true;
  }
  if (normalized === "0" || normalized === "false" || normalized === "no") {
    return false;
  }

  return undefined;
}

export function getRuntimeEnvironment(): string {
  return (
    process.env.TEAMSFX_ENV ||
    process.env.ENV_NAME ||
    process.env.NODE_ENV ||
    ""
  )
    .trim()
    .toLowerCase();
}

export function isLocalDevMode(): boolean {
  const env = getRuntimeEnvironment();
  return env === "local" || env === "dev" || env === "development";
}

export function allowUnsafeHeaderAuth(): boolean {
  const override = parseBoolean(process.env.ALLOW_UNSAFE_HEADER_AUTH);
  return override ?? isLocalDevMode();
}

export function enableNotificationDebugRoutes(): boolean {
  const override = parseBoolean(process.env.ENABLE_NOTIFICATION_DEBUG_ROUTES);
  return override ?? isLocalDevMode();
}
