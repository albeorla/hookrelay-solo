import type { Page } from "@playwright/test";
import { logger } from "./logger";

export interface DebugInfo {
  url: string;
  title: string;
  screenshot?: Buffer;
  console: any[];
  network: any[];
  timestamp: string;
  testName: string;
}

export async function captureDebugInfo(
  page: Page,
  testName: string,
  includeScreenshot = true,
): Promise<DebugInfo> {
  const debugInfo: DebugInfo = {
    url: page.url(),
    title: await page.title(),
    console: [],
    network: [],
    timestamp: new Date().toISOString(),
    testName,
  };

  try {
    // Capture console messages
    debugInfo.console = await page.evaluate(() => {
      return (window as any).console?.messages || [];
    });
  } catch (error) {
    debugInfo.console = [
      {
        error: "Failed to capture console messages",
        details: error instanceof Error ? error.message : String(error),
      },
    ];
  }

  try {
    // Capture network requests
    debugInfo.network = await page.evaluate(() => {
      return window.performance.getEntriesByType("resource").map((entry) => ({
        name: entry.name,
        duration: entry.duration,
        transferSize: (entry as any).transferSize,
        initiatorType: (entry as any).initiatorType,
      }));
    });
  } catch (error) {
    debugInfo.network = [
      {
        error: "Failed to capture network data",
        details: error instanceof Error ? error.message : String(error),
      },
    ];
  }

  if (includeScreenshot) {
    try {
      debugInfo.screenshot = await page.screenshot({ fullPage: true });
    } catch (error) {
      logger.warn(
        "Failed to capture screenshot:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  return debugInfo;
}

export async function saveDebugInfo(debugInfo: DebugInfo): Promise<void> {
  try {
    const fs = await import("fs");
    const path = await import("path");

    const debugDir = path.join(process.cwd(), "test-results", "debug");
    await fs.promises.mkdir(debugDir, { recursive: true });

    const filename = `${debugInfo.testName}-${Date.now()}.json`;
    const filepath = path.join(debugDir, filename);

    // Remove screenshot buffer for JSON serialization
    const { screenshot, ...debugInfoWithoutScreenshot } = debugInfo;

    await fs.promises.writeFile(
      filepath,
      JSON.stringify(debugInfoWithoutScreenshot, null, 2),
    );

    // Save screenshot separately if available
    if (screenshot) {
      const screenshotPath = path.join(
        debugDir,
        `${debugInfo.testName}-${Date.now()}.png`,
      );
      await fs.promises.writeFile(screenshotPath, screenshot);
    }

    logger.debug(`📁 Debug info saved: ${filepath}`);
  } catch (error) {
    logger.error("Failed to save debug info:", error);
  }
}

export async function logTestStart(testName: string): Promise<void> {
  logger.testStart(testName);
}

export async function logTestEnd(
  testName: string,
  duration: number,
): Promise<void> {
  logger.testEnd(testName, duration);
}

export async function logTestFailure(
  testName: string,
  error: Error,
): Promise<void> {
  logger.testFail(testName, error);
}

// Performance tracking utility
export class TestPerformanceTracker {
  private startTimes = new Map<string, number>();
  private metrics: Map<string, number[]> = new Map();

  startTimer(testName: string): void {
    this.startTimes.set(testName, Date.now());
  }

  endTimer(testName: string): number {
    const startTime = this.startTimes.get(testName);
    if (!startTime) {
      logger.warn(`No start time found for test: ${testName}`);
      return 0;
    }

    const duration = Date.now() - startTime;

    if (!this.metrics.has(testName)) {
      this.metrics.set(testName, []);
    }
    this.metrics.get(testName)!.push(duration);

    this.startTimes.delete(testName);
    return duration;
  }

  getReport(): Record<
    string,
    { avg: number; min: number; max: number; count: number }
  > {
    const report: Record<
      string,
      { avg: number; min: number; max: number; count: number }
    > = {};

    for (const [testName, durations] of this.metrics) {
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      const min = Math.min(...durations);
      const max = Math.max(...durations);
      report[testName] = { avg, min, max, count: durations.length };
    }

    return report;
  }

  async saveReport(): Promise<void> {
    try {
      const fs = await import("fs");
      const path = await import("path");

      const reportDir = path.join(process.cwd(), "test-results");
      await fs.promises.mkdir(reportDir, { recursive: true });

      const reportPath = path.join(reportDir, "performance-report.json");
      await fs.promises.writeFile(
        reportPath,
        JSON.stringify(this.getReport(), null, 2),
      );

      logger.debug(`📊 Performance report saved: ${reportPath}`);
    } catch (error) {
      logger.error("Failed to save performance report:", error);
    }
  }
}

export const performanceTracker = new TestPerformanceTracker();
