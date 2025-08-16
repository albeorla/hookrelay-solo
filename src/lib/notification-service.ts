import { toast } from "sonner";

export interface NotificationChannel {
  type: "email" | "slack" | "sms" | "webhook" | "browser";
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface NotificationTemplate {
  title: string;
  message: string;
  severity: "low" | "medium" | "high" | "critical";
  metadata?: Record<string, unknown>;
}

export class NotificationService {
  private channels = new Map<string, NotificationChannel>();

  constructor() {
    // Register default channels
    this.registerChannel("browser", {
      type: "browser",
      enabled: true,
      config: {},
    });

    this.registerChannel("email", {
      type: "email",
      enabled: false,
      config: {
        smtpHost: process.env.SMTP_HOST,
        smtpPort: process.env.SMTP_PORT,
        username: process.env.SMTP_USERNAME,
        password: process.env.SMTP_PASSWORD,
        from: process.env.NOTIFICATION_EMAIL_FROM ?? "alerts@hookrelay.com",
        to: process.env.NOTIFICATION_EMAIL_TO?.split(",") ?? [],
      },
    });

    this.registerChannel("slack", {
      type: "slack",
      enabled: false,
      config: {
        webhookUrl: process.env.SLACK_WEBHOOK_URL,
        channel: process.env.SLACK_CHANNEL ?? "#alerts",
        username: process.env.SLACK_USERNAME ?? "HookRelay",
        iconEmoji: process.env.SLACK_ICON_EMOJI ?? ":warning:",
      },
    });

    this.registerChannel("sms", {
      type: "sms",
      enabled: false,
      config: {
        provider: process.env.SMS_PROVIDER ?? "twilio",
        accountSid: process.env.TWILIO_ACCOUNT_SID,
        authToken: process.env.TWILIO_AUTH_TOKEN,
        from: process.env.TWILIO_FROM_NUMBER,
        to: process.env.SMS_ALERT_NUMBERS?.split(",") ?? [],
      },
    });
  }

  registerChannel(id: string, channel: NotificationChannel): void {
    this.channels.set(id, channel);
  }

  updateChannel(id: string, updates: Partial<NotificationChannel>): void {
    const existing = this.channels.get(id);
    if (existing) {
      this.channels.set(id, { ...existing, ...updates });
    }
  }

  async sendNotification(
    channelIds: string[],
    template: NotificationTemplate,
  ): Promise<{
    success: boolean;
    results: Array<{ channel: string; success: boolean; error?: string }>;
  }> {
    const results = [];

    for (const channelId of channelIds) {
      const channel = this.channels.get(channelId);
      if (!channel?.enabled) {
        results.push({
          channel: channelId,
          success: false,
          error: "Channel not found or disabled",
        });
        continue;
      }

      try {
        await this.sendToChannel(channel, template);
        results.push({
          channel: channelId,
          success: true,
        });
      } catch (error) {
        results.push({
          channel: channelId,
          success: false,
          error: String(error),
        });
      }
    }

    const success = results.some((r) => r.success);
    return { success, results };
  }

  private async sendToChannel(
    channel: NotificationChannel,
    template: NotificationTemplate,
  ): Promise<void> {
    switch (channel.type) {
      case "browser":
        return this.sendBrowserNotification(template);
      case "email":
        return this.sendEmailNotification(channel.config, template);
      case "slack":
        return this.sendSlackNotification(channel.config, template);
      case "sms":
        return this.sendSmsNotification(channel.config, template);
      case "webhook":
        return this.sendWebhookNotification(channel.config, template);
      default:
        throw new Error("Unsupported notification channel");
    }
  }

  private async sendBrowserNotification(
    template: NotificationTemplate,
  ): Promise<void> {
    const toastVariant = this.getSeverityToastVariant(template.severity);

    toast[toastVariant](template.title, {
      description: template.message,
      duration: template.severity === "critical" ? 0 : 5000, // Critical alerts don't auto-dismiss
      action:
        template.severity === "critical"
          ? {
              label: "Acknowledge",
              onClick: () => {
                // Handle acknowledgment
                toast.info("Alert acknowledged");
              },
            }
          : undefined,
    });
  }

  private async sendEmailNotification(
    config: Record<string, unknown>,
    template: NotificationTemplate,
  ): Promise<void> {
    const smtpHost = config.smtpHost as string | undefined;
    const to = config.to as string[] | undefined;
    if (!smtpHost || !to?.length) {
      throw new Error("Email configuration incomplete");
    }

    // In a real implementation, you would use nodemailer or similar
    console.log("Sending email notification:", {
      to,
      subject: `[${template.severity.toUpperCase()}] ${template.title}`,
      body: this.generateEmailBody(template),
    });

    // Simulate email sending
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  private async sendSlackNotification(
    config: Record<string, unknown>,
    template: NotificationTemplate,
  ): Promise<void> {
    const webhookUrl = config.webhookUrl as string | undefined;
    if (!webhookUrl) {
      throw new Error("Slack webhook URL not configured");
    }

    const payload = {
      channel: config.channel as string | undefined,
      username: config.username as string | undefined,
      icon_emoji: config.iconEmoji as string | undefined,
      text: `*${template.title}*`,
      attachments: [
        {
          color: this.getSeverityColor(template.severity),
          fields: [
            {
              title: "Severity",
              value: template.severity.toUpperCase(),
              short: true,
            },
            {
              title: "Message",
              value: template.message,
              short: false,
            },
          ],
          footer: "HookRelay Health Monitor",
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Slack notification failed: ${response.statusText}`);
    }
  }

  private async sendSmsNotification(
    config: Record<string, unknown>,
    template: NotificationTemplate,
  ): Promise<void> {
    const to = config.to as string[] | undefined;
    if (!to?.length) {
      throw new Error("SMS recipients not configured");
    }

    // In a real implementation, you would use Twilio SDK or similar
    console.log("Sending SMS notification:", {
      to,
      message: `${template.title}: ${template.message}`,
    });

    // Simulate SMS sending
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  private async sendWebhookNotification(
    config: Record<string, unknown>,
    template: NotificationTemplate,
  ): Promise<void> {
    const url = config.url as string | undefined;
    if (!url) {
      throw new Error("Webhook URL not configured");
    }

    const payload = {
      type: "health_alert",
      timestamp: new Date().toISOString(),
      alert: template,
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...((config.headers as Record<string, string>) ?? {}),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Webhook notification failed: ${response.statusText}`);
    }
  }

  private getSeverityToastVariant(
    severity: string,
  ): "success" | "info" | "warning" | "error" {
    switch (severity) {
      case "critical":
        return "error";
      case "high":
        return "error";
      case "medium":
        return "warning";
      case "low":
        return "info";
      default:
        return "info";
    }
  }

  private getSeverityColor(severity: string): string {
    switch (severity) {
      case "critical":
        return "danger";
      case "high":
        return "warning";
      case "medium":
        return "warning";
      case "low":
        return "good";
      default:
        return "good";
    }
  }

  private generateEmailBody(template: NotificationTemplate): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>HookRelay Health Alert</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .header { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .alert { padding: 15px; border-radius: 5px; margin: 10px 0; }
    .alert-critical { background-color: #ffeaea; border-left: 4px solid #dc3545; }
    .alert-high { background-color: #fff3cd; border-left: 4px solid #fd7e14; }
    .alert-medium { background-color: #fff3cd; border-left: 4px solid #ffc107; }
    .alert-low { background-color: #d1ecf1; border-left: 4px solid #17a2b8; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🚨 HookRelay Health Alert</h1>
    <p>A health monitoring alert has been triggered in your webhook system.</p>
  </div>
  
  <div class="alert alert-${template.severity}">
    <h2>${template.title}</h2>
    <p><strong>Severity:</strong> ${template.severity.toUpperCase()}</p>
    <p><strong>Message:</strong> ${template.message}</p>
    <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
  </div>

  ${
    template.metadata
      ? `
    <div class="metadata">
      <h3>Additional Information:</h3>
      <ul>
        ${Object.entries(template.metadata)
          .map(
            ([key, value]) =>
              `<li><strong>${key}:</strong> ${String(value)}</li>`,
          )
          .join("")}
      </ul>
    </div>
  `
      : ""
  }

  <div class="footer">
    <p>This alert was generated by HookRelay Health Monitoring System.</p>
    <p>Please log in to your dashboard to acknowledge this alert and take appropriate action.</p>
  </div>
</body>
</html>
    `.trim();
  }

  getChannels(): Array<{ id: string; channel: NotificationChannel }> {
    return Array.from(this.channels.entries()).map(([id, channel]) => ({
      id,
      channel,
    }));
  }

  getChannel(id: string): NotificationChannel | undefined {
    return this.channels.get(id);
  }

  testChannel(
    channelId: string,
  ): Promise<{ success: boolean; error?: string }> {
    return this.sendNotification([channelId], {
      title: "Test Notification",
      message: "This is a test notification from HookRelay Health Monitoring.",
      severity: "low",
      metadata: {
        testId: `test_${Date.now()}`,
        timestamp: new Date().toISOString(),
      },
    }).then((result) => ({
      success: result.success,
      error: result.results[0]?.error,
    }));
  }
}

// Global notification service instance
export const notificationService = new NotificationService();
