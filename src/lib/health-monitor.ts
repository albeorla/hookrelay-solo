export interface HealthThreshold {
  id: string;
  name: string;
  description: string;
  type: "failure_rate" | "queue_depth" | "response_time" | "endpoint_down";
  threshold: number;
  timeWindow: number; // in minutes
  severity: "low" | "medium" | "high" | "critical";
  enabled: boolean;
  notifications: {
    email: boolean;
    slack: boolean;
    sms: boolean;
  };
}

export interface HealthAlert {
  id: string;
  thresholdId: string;
  type: HealthThreshold["type"];
  severity: HealthThreshold["severity"];
  title: string;
  message: string;
  value: number;
  threshold: number;
  endpointId?: string;
  createdAt: Date;
  resolvedAt?: Date;
  acknowledged?: boolean;
  acknowledgedBy?: string;
  metadata?: Record<string, unknown>;
}

export interface HealthMetrics {
  timestamp: Date;
  endpointId?: string;
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  averageResponseTime: number;
  queueDepth: number;
  activeEndpoints: number;
  unhealthyEndpoints: string[];
}

export const DEFAULT_HEALTH_THRESHOLDS: HealthThreshold[] = [
  {
    id: "failure_rate_critical",
    name: "Critical Failure Rate",
    description: "Alert when failure rate exceeds 50% over 5 minutes",
    type: "failure_rate",
    threshold: 50, // percentage
    timeWindow: 5, // minutes
    severity: "critical",
    enabled: true,
    notifications: {
      email: true,
      slack: true,
      sms: true,
    },
  },
  {
    id: "failure_rate_high",
    name: "High Failure Rate",
    description: "Alert when failure rate exceeds 25% over 10 minutes",
    type: "failure_rate",
    threshold: 25,
    timeWindow: 10,
    severity: "high",
    enabled: true,
    notifications: {
      email: true,
      slack: true,
      sms: false,
    },
  },
  {
    id: "queue_depth_critical",
    name: "Critical Queue Depth",
    description: "Alert when queue depth exceeds 1000 messages",
    type: "queue_depth",
    threshold: 1000,
    timeWindow: 1,
    severity: "critical",
    enabled: true,
    notifications: {
      email: true,
      slack: true,
      sms: true,
    },
  },
  {
    id: "queue_depth_high",
    name: "High Queue Depth",
    description: "Alert when queue depth exceeds 500 messages",
    type: "queue_depth",
    threshold: 500,
    timeWindow: 5,
    severity: "high",
    enabled: true,
    notifications: {
      email: true,
      slack: true,
      sms: false,
    },
  },
  {
    id: "response_time_critical",
    name: "Critical Response Time",
    description: "Alert when average response time exceeds 10 seconds",
    type: "response_time",
    threshold: 10000, // milliseconds
    timeWindow: 5,
    severity: "critical",
    enabled: true,
    notifications: {
      email: true,
      slack: true,
      sms: false,
    },
  },
  {
    id: "endpoint_down",
    name: "Endpoint Down",
    description: "Alert when endpoint has 100% failure rate for 5 minutes",
    type: "endpoint_down",
    threshold: 100, // percentage
    timeWindow: 5,
    severity: "critical",
    enabled: true,
    notifications: {
      email: true,
      slack: true,
      sms: true,
    },
  },
];

export class HealthMonitor {
  private metrics: HealthMetrics[] = [];
  private alerts: HealthAlert[] = [];
  private thresholds: HealthThreshold[] = [...DEFAULT_HEALTH_THRESHOLDS];

  constructor(
    private onAlert?: (alert: HealthAlert) => Promise<void>,
    private onResolve?: (alert: HealthAlert) => Promise<void>,
  ) {}

  addMetric(metric: HealthMetrics): void {
    this.metrics.push(metric);

    // Keep only last 24 hours of metrics
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    this.metrics = this.metrics.filter((m) => m.timestamp > twentyFourHoursAgo);

    // Check thresholds
    this.checkThresholds(metric);
  }

  private checkThresholds(metric: HealthMetrics): void {
    for (const threshold of this.thresholds) {
      if (!threshold.enabled) continue;

      const shouldAlert = this.evaluateThreshold(threshold, metric);

      if (shouldAlert) {
        const existingAlert = this.alerts.find(
          (a) =>
            a.thresholdId === threshold.id &&
            a.endpointId === metric.endpointId &&
            !a.resolvedAt,
        );

        if (!existingAlert) {
          const alert = this.createAlert(threshold, metric);
          this.alerts.push(alert);
          void this.onAlert?.(alert);
        }
      } else {
        // Check if we should resolve any existing alerts
        const activeAlerts = this.alerts.filter(
          (a) =>
            a.thresholdId === threshold.id &&
            a.endpointId === metric.endpointId &&
            !a.resolvedAt,
        );

        for (const alert of activeAlerts) {
          alert.resolvedAt = new Date();
          void this.onResolve?.(alert);
        }
      }
    }
  }

  private evaluateThreshold(
    threshold: HealthThreshold,
    metric: HealthMetrics,
  ): boolean {
    const timeWindowStart = new Date(
      Date.now() - threshold.timeWindow * 60 * 1000,
    );
    const relevantMetrics = this.metrics.filter(
      (m) =>
        m.timestamp >= timeWindowStart &&
        (threshold.type !== "endpoint_down" ||
          m.endpointId === metric.endpointId),
    );

    switch (threshold.type) {
      case "failure_rate": {
        const totalDeliveries = relevantMetrics.reduce(
          (sum, m) => sum + m.totalDeliveries,
          0,
        );
        const failedDeliveries = relevantMetrics.reduce(
          (sum, m) => sum + m.failedDeliveries,
          0,
        );
        const failureRate =
          totalDeliveries > 0 ? (failedDeliveries / totalDeliveries) * 100 : 0;
        return failureRate >= threshold.threshold;
      }

      case "queue_depth": {
        return metric.queueDepth >= threshold.threshold;
      }

      case "response_time": {
        const avgResponseTime =
          relevantMetrics.length > 0
            ? relevantMetrics.reduce(
                (sum, m) => sum + m.averageResponseTime,
                0,
              ) / relevantMetrics.length
            : 0;
        return avgResponseTime >= threshold.threshold;
      }

      case "endpoint_down": {
        const endpointMetrics = relevantMetrics.filter(
          (m) => m.endpointId === metric.endpointId,
        );
        const totalDeliveries = endpointMetrics.reduce(
          (sum, m) => sum + m.totalDeliveries,
          0,
        );
        const failedDeliveries = endpointMetrics.reduce(
          (sum, m) => sum + m.failedDeliveries,
          0,
        );
        const failureRate =
          totalDeliveries > 0 ? (failedDeliveries / totalDeliveries) * 100 : 0;
        return totalDeliveries > 0 && failureRate >= threshold.threshold;
      }

      default:
        return false;
    }
  }

  private createAlert(
    threshold: HealthThreshold,
    metric: HealthMetrics,
  ): HealthAlert {
    const value = this.getMetricValue(threshold.type, metric);

    let title = "";
    let message = "";

    switch (threshold.type) {
      case "failure_rate":
        title = `High Failure Rate Alert`;
        message = `Webhook failure rate has reached ${value.toFixed(1)}%, exceeding the ${threshold.threshold}% threshold over ${threshold.timeWindow} minutes.`;
        break;
      case "queue_depth":
        title = `High Queue Depth Alert`;
        message = `Message queue depth has reached ${value} messages, exceeding the ${threshold.threshold} message threshold.`;
        break;
      case "response_time":
        title = `Slow Response Time Alert`;
        message = `Average response time has reached ${(value / 1000).toFixed(2)}s, exceeding the ${threshold.threshold / 1000}s threshold.`;
        break;
      case "endpoint_down":
        title = `Endpoint Down Alert`;
        message = `Endpoint ${metric.endpointId} appears to be down with ${value.toFixed(1)}% failure rate over ${threshold.timeWindow} minutes.`;
        break;
    }

    return {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      thresholdId: threshold.id,
      type: threshold.type,
      severity: threshold.severity,
      title,
      message,
      value,
      threshold: threshold.threshold,
      endpointId: metric.endpointId,
      createdAt: new Date(),
      metadata: {
        timeWindow: threshold.timeWindow,
        totalDeliveries: metric.totalDeliveries,
        failedDeliveries: metric.failedDeliveries,
        queueDepth: metric.queueDepth,
      },
    };
  }

  private getMetricValue(
    type: HealthThreshold["type"],
    metric: HealthMetrics,
  ): number {
    switch (type) {
      case "failure_rate":
      case "endpoint_down":
        return metric.totalDeliveries > 0
          ? (metric.failedDeliveries / metric.totalDeliveries) * 100
          : 0;
      case "queue_depth":
        return metric.queueDepth;
      case "response_time":
        return metric.averageResponseTime;
      default:
        return 0;
    }
  }

  getActiveAlerts(): HealthAlert[] {
    return this.alerts.filter((a) => !a.resolvedAt);
  }

  getAllAlerts(): HealthAlert[] {
    return [...this.alerts].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedBy = acknowledgedBy;
      return true;
    }
    return false;
  }

  updateThresholds(newThresholds: HealthThreshold[]): void {
    this.thresholds = [...newThresholds];
  }

  getThresholds(): HealthThreshold[] {
    return [...this.thresholds];
  }

  getHealthStatus(): {
    status: "healthy" | "warning" | "critical";
    activeAlerts: number;
    criticalAlerts: number;
    lastCheck: Date;
  } {
    const activeAlerts = this.getActiveAlerts();
    const criticalAlerts = activeAlerts.filter(
      (a) => a.severity === "critical",
    );

    let status: "healthy" | "warning" | "critical" = "healthy";
    if (criticalAlerts.length > 0) {
      status = "critical";
    } else if (activeAlerts.length > 0) {
      status = "warning";
    }

    return {
      status,
      activeAlerts: activeAlerts.length,
      criticalAlerts: criticalAlerts.length,
      lastCheck: new Date(),
    };
  }
}
