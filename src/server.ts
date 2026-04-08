import { start } from "./app";

start().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
