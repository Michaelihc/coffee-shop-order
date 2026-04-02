import fs from "fs";
import path from "path";

function getProjectRoot() {
  return path.resolve(__dirname, "../..");
}

function parseEnvFile(filePath: string) {
  const values: Record<string, string> = {};

  if (!fs.existsSync(filePath)) {
    return values;
  }

  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const normalized = line.startsWith("export ") ? line.slice(7).trim() : line;
    const separatorIndex = normalized.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = normalized.slice(0, separatorIndex).trim();
    let value = normalized.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

function loadRuntimeEnv() {
  const root = getProjectRoot();
  const teamsEnv = process.env.TEAMSFX_ENV || process.env.ENV_NAME || "local";
  const candidateFiles = [
    path.join(root, "env", ".env.dev"),
    path.join(root, "env", `.env.${teamsEnv}`),
    path.join(root, "env", `.env.${teamsEnv}.user`),
    path.join(root, ".localConfigs"),
  ];

  const mergedValues: Record<string, string> = {};
  const loadedFiles: string[] = [];

  for (const filePath of candidateFiles) {
    if (!fs.existsSync(filePath)) {
      continue;
    }

    Object.assign(mergedValues, parseEnvFile(filePath));
    loadedFiles.push(path.relative(root, filePath));
  }

  for (const [key, value] of Object.entries(mergedValues)) {
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }

  if (loadedFiles.length > 0) {
    console.log(`[Config] Loaded runtime env from: ${loadedFiles.join(", ")}`);
  }
}

loadRuntimeEnv();
