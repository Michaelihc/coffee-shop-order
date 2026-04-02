import React from "react";
import {
  Button,
  MessageBar,
  MessageBarBody,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import {
  clearAuthDebugEvents,
  formatAuthDebugEvents,
  getAuthDebugEventName,
  getAuthDebugEvents,
  type AuthDebugEvent,
} from "../auth-debug";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    maxWidth: "900px",
    marginLeft: "auto",
    marginRight: "auto",
  },
  heading: {
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightBold,
    margin: 0,
  },
  copyRow: {
    display: "flex",
    gap: "8px",
  },
  textBox: {
    width: "100%",
    minHeight: "420px",
    padding: "16px",
    borderRadius: "12px",
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    backgroundColor: tokens.colorNeutralBackground1,
    fontFamily: "Consolas, 'Courier New', monospace",
    fontSize: tokens.fontSizeBase200,
    lineHeight: 1.5,
    whiteSpace: "pre-wrap" as const,
    resize: "vertical" as const,
  },
});

export function AuthDebugPage() {
  const styles = useStyles();
  const [events, setEvents] = React.useState<AuthDebugEvent[]>(() =>
    getAuthDebugEvents()
  );
  const [message, setMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<AuthDebugEvent>).detail;
      if (!detail) {
        return;
      }

      setEvents(getAuthDebugEvents());
    };

    window.addEventListener(getAuthDebugEventName(), listener);
    return () => window.removeEventListener(getAuthDebugEventName(), listener);
  }, []);

  const text = formatAuthDebugEvents(events);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setMessage("Copied auth debug logs to clipboard.");
    } catch {
      setMessage("Clipboard copy failed. You can still select and copy the text below.");
    }
  }

  function handleClear() {
    clearAuthDebugEvents();
    setEvents([]);
    setMessage("Cleared auth debug logs.");
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>Auth Debug</h2>
      {message && (
        <MessageBar intent="info">
          <MessageBarBody>{message}</MessageBarBody>
        </MessageBar>
      )}
      <div className={styles.copyRow}>
        <Button appearance="primary" onClick={handleCopy}>
          Copy Logs
        </Button>
        <Button appearance="secondary" onClick={handleClear}>
          Clear Logs
        </Button>
      </div>
      <textarea
        className={styles.textBox}
        value={text}
        readOnly
        spellCheck={false}
      />
    </div>
  );
}
