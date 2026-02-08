import { getSlack } from './slack';

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const LOG_LEVELS: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

const globalForLogger = global as unknown as { isLoggerInitialized: boolean };

function getConfiguredLogLevel(): number {
  const level = process.env.SLACK_LOG_LEVEL?.toUpperCase() as LogLevel;
  return LOG_LEVELS[level] ?? LOG_LEVELS.ERROR; // Default to ERROR
}

function shouldLogToSlack(level: LogLevel): boolean {
  const configLevel = getConfiguredLogLevel();
  return LOG_LEVELS[level] >= configLevel;
}

function sendToSlack(level: LogLevel, args: any[]) {
  // Prevent recursion: if the log comes from SlackClient itself, don't send it back to Slack
  // SlackClient logs start with [SlackClient:...]
  const firstArg = args[0];
  if (typeof firstArg === 'string' && firstArg.startsWith('[SlackClient')) {
    return;
  }

  // Fire and forget - don't await to avoid blocking other logs
  (async () => {
    try {
      const slack = getSlack('ALERTS_BOT_WEBHOOK');

      if (!slack) {
        // Create a one-time warning if not configured, but don't spam
        if (!globalForLogger.isLoggerInitialized) {
          process.stdout.write(
            '[Logger] SLACK_ALERTS_BOT_WEBHOOK not configured. Slack logging disabled.\n',
          );
        }
        return;
      }

      const message = args
        .map((arg) => {
          if (arg instanceof Error) {
            return `${arg.message}\n${arg.stack}`;
          }
          if (typeof arg === 'object') {
            try {
              return JSON.stringify(arg, null, 2);
            } catch (e) {
              return String(arg);
            }
          }
          return String(arg);
        })
        .join(' ');

      let icon = ':information_source:';

      if (level === 'ERROR') {
        icon = ':rotating_light:';
      } else if (level === 'WARN') {
        icon = ':warning:';
      }
      await slack.send(`${icon} *[${level}]* ${message}`);
    } catch (error) {
      // If we fail to send to Slack, fall back to stdout but don't try to log via ourselves
      process.stderr.write(`[Logger] Failed to send log to Slack: ${error}\n`);
    }
  })();
}

export function initSlackLogger() {
  if (globalForLogger.isLoggerInitialized) return;
  globalForLogger.isLoggerInitialized = true;

  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  const originalConsoleLog = console.log;

  console.error = (...args: any[]) => {
    originalConsoleError.apply(console, args);
    if (shouldLogToSlack('ERROR')) {
      sendToSlack('ERROR', args);
    }
  };

  console.warn = (...args: any[]) => {
    originalConsoleWarn.apply(console, args);
    if (shouldLogToSlack('WARN')) {
      sendToSlack('WARN', args);
    }
  };

  console.log = (...args: any[]) => {
    originalConsoleLog.apply(console, args);
    if (shouldLogToSlack('INFO')) {
      sendToSlack('INFO', args);
    }
  };

  // Create a debug method if needed, though console.debug usually maps to log
  // We'll leave it as is or override if specific debug intent is needed

  console.log(
    '[Logger] Slack logger initialized. Level:',
    process.env.SLACK_LOG_LEVEL || 'ERROR (default)',
  );
}
