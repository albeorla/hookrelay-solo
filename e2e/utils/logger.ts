/* eslint-disable @typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-argument,@typescript-eslint/unbound-method */
import config from "~/config";

export enum LogLevel {
  SILENT = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
  VERBOSE = 5,
}

class TestLogger {
  private level: LogLevel;

  constructor() {
    // Determine log level from configuration
    const envLevel = config.test.logLevel;
    const levelFromEnv = LogLevel[envLevel as keyof typeof LogLevel];
    const isCI = config.ci.isCI;
    const isVerbose = config.test.verboseLogs;

    if (levelFromEnv !== undefined) {
      this.level = levelFromEnv;
    } else if (isCI) {
      // In CI, be quiet by default unless verbose is explicitly requested
      this.level = isVerbose ? LogLevel.INFO : LogLevel.ERROR;
    } else {
      // Local development - show more by default
      this.level = isVerbose ? LogLevel.VERBOSE : LogLevel.INFO;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.level;
  }

  private formatMessage(
    level: string,
    message: string,
    ...args: any[]
  ): string {
    const timestamp = new Date().toISOString().slice(11, 23); // HH:mm:ss.SSS
    const formattedArgs =
      args.length > 0
        ? " " +
          args
            .map((arg) =>
              typeof arg === "object" ? JSON.stringify(arg) : String(arg),
            )
            .join(" ")
        : "";
    return `[${timestamp}] ${level}: ${message}${formattedArgs}`;
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage("ERROR", message, ...args));
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage("WARN", message, ...args));
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(this.formatMessage("INFO", message, ...args));
    }
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(this.formatMessage("DEBUG", message, ...args));
    }
  }

  verbose(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.VERBOSE)) {
      console.log(this.formatMessage("VERBOSE", message, ...args));
    }
  }

  // Special methods for common test scenarios
  testStart(testName: string): void {
    this.info(`🚀 Starting test: ${testName}`);
  }

  testEnd(testName: string, duration?: number): void {
    const durationText = duration ? ` (${duration}ms)` : "";
    this.info(`✅ Completed test: ${testName}${durationText}`);
  }

  testFail(testName: string, error: Error): void {
    this.error(`❌ Test failed: ${testName}`);
    this.error(`   Error: ${error.message}`);
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.debug(`   Stack: ${error.stack}`);
    }
  }

  dbOperation(operation: string, success = true): void {
    if (success) {
      this.debug(`✅ Database: ${operation}`);
    } else {
      this.error(`❌ Database: ${operation}`);
    }
  }

  authOperation(operation: string, details?: string): void {
    const detailsText = details ? ` - ${details}` : "";
    this.debug(`🔐 Auth: ${operation}${detailsText}`);
  }

  performance(operation: string, duration: number, threshold?: number): void {
    const emoji = threshold && duration > threshold ? "⚠️" : "📊";
    this.debug(`${emoji} Performance: ${operation} took ${duration}ms`);
  }

  // Utility method to create child loggers with prefixes
  createChild(prefix: string): TestLogger {
    const child = new TestLogger();
    const originalFormatMessage = child.formatMessage.bind(child);
    child.formatMessage = (level: string, message: string, ...args: any[]) => {
      return originalFormatMessage(level, `[${prefix}] ${message}`, ...args);
    };
    return child;
  }

  getLogLevel(): LogLevel {
    return this.level;
  }

  setLogLevel(level: LogLevel): void {
    this.level = level;
  }
}

// Export singleton instance
export const logger = new TestLogger();

// Export convenience functions for quick imports
export const {
  error,
  warn,
  info,
  debug,
  verbose,
  testStart,
  testEnd,
  testFail,
  dbOperation,
  authOperation,
  performance,
} = logger;

// Export class for creating child loggers
export { TestLogger };
