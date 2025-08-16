import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  NotificationService,
  notificationService,
} from "../notification-service";

// Mock sonner toast using vi.hoisted to avoid initialization issues
const { mockToast } = vi.hoisted(() => ({
  mockToast: {
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: mockToast,
}));

// Mock fetch globally
global.fetch = vi.fn();

describe("NotificationService", () => {
  let service: NotificationService;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    service = new NotificationService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetAllMocks();
  });

  describe("Constructor and Channel Registration", () => {
    it("should register default channels", () => {
      const channels = service.getChannels();
      const channelIds = channels.map((c) => c.id);

      expect(channelIds).toContain("browser");
      expect(channelIds).toContain("email");
      expect(channelIds).toContain("slack");
      expect(channelIds).toContain("sms");
    });

    it("should have browser channel enabled by default", () => {
      const browserChannel = service.getChannel("browser");
      expect(browserChannel?.enabled).toBe(true);
    });

    it("should have other channels disabled by default", () => {
      const emailChannel = service.getChannel("email");
      const slackChannel = service.getChannel("slack");
      const smsChannel = service.getChannel("sms");

      expect(emailChannel?.enabled).toBe(false);
      expect(slackChannel?.enabled).toBe(false);
      expect(smsChannel?.enabled).toBe(false);
    });

    it("should configure email channel from environment variables", () => {
      process.env.SMTP_HOST = "smtp.example.com";
      process.env.SMTP_PORT = "587";
      process.env.SMTP_USERNAME = "user@example.com";
      process.env.SMTP_PASSWORD = "password";
      process.env.NOTIFICATION_EMAIL_FROM = "alerts@test.com";
      process.env.NOTIFICATION_EMAIL_TO = "admin1@test.com,admin2@test.com";

      const testService = new NotificationService();
      const emailChannel = testService.getChannel("email");

      expect(emailChannel?.config).toEqual({
        smtpHost: "smtp.example.com",
        smtpPort: "587",
        username: "user@example.com",
        password: "password",
        from: "alerts@test.com",
        to: ["admin1@test.com", "admin2@test.com"],
      });
    });

    it("should configure Slack channel from environment variables", () => {
      process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/test";
      process.env.SLACK_CHANNEL = "#custom-alerts";
      process.env.SLACK_USERNAME = "CustomBot";
      process.env.SLACK_ICON_EMOJI = ":fire:";

      const testService = new NotificationService();
      const slackChannel = testService.getChannel("slack");

      expect(slackChannel?.config).toEqual({
        webhookUrl: "https://hooks.slack.com/test",
        channel: "#custom-alerts",
        username: "CustomBot",
        iconEmoji: ":fire:",
      });
    });
  });

  describe("Channel Management", () => {
    it("should register new channel", () => {
      service.registerChannel("test-channel", {
        type: "webhook",
        enabled: true,
        config: { url: "https://example.com/webhook" },
      });

      const channel = service.getChannel("test-channel");
      expect(channel).toBeDefined();
      expect(channel?.type).toBe("webhook");
      expect(channel?.enabled).toBe(true);
    });

    it("should update existing channel", () => {
      service.updateChannel("browser", { enabled: false });

      const channel = service.getChannel("browser");
      expect(channel?.enabled).toBe(false);
    });

    it("should not update non-existent channel", () => {
      const originalChannels = service.getChannels();
      service.updateChannel("non-existent", { enabled: true });

      const newChannels = service.getChannels();
      expect(newChannels).toHaveLength(originalChannels.length);
    });

    it("should return undefined for non-existent channel", () => {
      const channel = service.getChannel("non-existent");
      expect(channel).toBeUndefined();
    });
  });

  describe("Browser Notifications", () => {
    it("should send browser notification with correct toast variant", async () => {
      const template = {
        title: "Test Alert",
        message: "Test message",
        severity: "high" as const,
      };

      const result = await service.sendNotification(["browser"], template);

      expect(result.success).toBe(true);
      expect(mockToast.error).toHaveBeenCalledWith("Test Alert", {
        description: "Test message",
        duration: 5000,
        action: undefined,
      });
    });

    it("should create critical alert with acknowledgment", async () => {
      const template = {
        title: "Critical Alert",
        message: "System down",
        severity: "critical" as const,
      };

      await service.sendNotification(["browser"], template);

      expect(mockToast.error).toHaveBeenCalledWith("Critical Alert", {
        description: "System down",
        duration: 0,
        action: {
          label: "Acknowledge",
          onClick: expect.any(Function),
        },
      });
    });

    it("should handle different severity levels correctly", async () => {
      const severities = [
        { severity: "low" as const, expectedVariant: "info" },
        { severity: "medium" as const, expectedVariant: "warning" },
        { severity: "high" as const, expectedVariant: "error" },
        { severity: "critical" as const, expectedVariant: "error" },
      ];

      for (const { severity, expectedVariant } of severities) {
        vi.clearAllMocks();

        await service.sendNotification(["browser"], {
          title: "Test",
          message: "Test",
          severity,
        });

        expect(mockToast[expectedVariant]).toHaveBeenCalled();
      }
    });
  });

  describe("Email Notifications", () => {
    beforeEach(() => {
      service.updateChannel("email", {
        enabled: true,
        config: {
          smtpHost: "smtp.test.com",
          to: ["admin@test.com"],
        },
      });
    });

    it("should send email notification successfully", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const result = await service.sendNotification(["email"], {
        title: "Test Email",
        message: "Test message",
        severity: "medium",
      });

      expect(result.success).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        "Sending email notification:",
        expect.objectContaining({
          to: ["admin@test.com"],
          subject: "[MEDIUM] Test Email",
          body: expect.stringContaining("Test Email"),
        }),
      );

      consoleSpy.mockRestore();
    });

    it("should fail email notification with incomplete config", async () => {
      service.updateChannel("email", {
        enabled: true,
        config: { smtpHost: "" }, // Missing required config
      });

      const result = await service.sendNotification(["email"], {
        title: "Test",
        message: "Test",
        severity: "low",
      });

      expect(result.success).toBe(false);
      expect(result.results[0]?.error).toContain(
        "Email configuration incomplete",
      );
    });
  });

  describe("Slack Notifications", () => {
    beforeEach(() => {
      service.updateChannel("slack", {
        enabled: true,
        config: {
          webhookUrl: "https://hooks.slack.com/test",
          channel: "#alerts",
          username: "HookRelay",
          iconEmoji: ":warning:",
        },
      });
    });

    it("should send Slack notification successfully", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
      });

      const result = await service.sendNotification(["slack"], {
        title: "Slack Test",
        message: "Test message",
        severity: "high",
      });

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        "https://hooks.slack.com/test",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: expect.stringContaining("Slack Test"),
        },
      );
    });

    it("should handle Slack API failure", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      const result = await service.sendNotification(["slack"], {
        title: "Test",
        message: "Test",
        severity: "low",
      });

      expect(result.success).toBe(false);
      expect(result.results[0]?.error).toContain("Slack notification failed");
    });

    it("should fail when webhook URL is missing", async () => {
      service.updateChannel("slack", {
        enabled: true,
        config: { webhookUrl: "" },
      });

      const result = await service.sendNotification(["slack"], {
        title: "Test",
        message: "Test",
        severity: "low",
      });

      expect(result.success).toBe(false);
      expect(result.results[0]?.error).toContain(
        "Slack webhook URL not configured",
      );
    });
  });

  describe("SMS Notifications", () => {
    beforeEach(() => {
      service.updateChannel("sms", {
        enabled: true,
        config: {
          to: ["+1234567890", "+0987654321"],
        },
      });
    });

    it("should send SMS notification successfully", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const result = await service.sendNotification(["sms"], {
        title: "SMS Test",
        message: "Test message",
        severity: "critical",
      });

      expect(result.success).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith("Sending SMS notification:", {
        to: ["+1234567890", "+0987654321"],
        message: "SMS Test: Test message",
      });

      consoleSpy.mockRestore();
    });

    it("should fail when no recipients configured", async () => {
      service.updateChannel("sms", {
        enabled: true,
        config: { to: [] },
      });

      const result = await service.sendNotification(["sms"], {
        title: "Test",
        message: "Test",
        severity: "low",
      });

      expect(result.success).toBe(false);
      expect(result.results[0]?.error).toContain(
        "SMS recipients not configured",
      );
    });
  });

  describe("Webhook Notifications", () => {
    beforeEach(() => {
      service.registerChannel("webhook-test", {
        type: "webhook",
        enabled: true,
        config: {
          url: "https://api.example.com/webhook",
          headers: {
            Authorization: "Bearer token123",
          },
        },
      });
    });

    it("should send webhook notification successfully", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
      });

      const result = await service.sendNotification(["webhook-test"], {
        title: "Webhook Test",
        message: "Test message",
        severity: "medium",
        metadata: { sourceSystem: "health-monitor" },
      });

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.example.com/webhook",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer token123",
          },
          body: expect.stringContaining("health_alert"),
        },
      );
    });

    it("should fail when webhook URL is missing", async () => {
      service.registerChannel("webhook-no-url", {
        type: "webhook",
        enabled: true,
        config: {},
      });

      const result = await service.sendNotification(["webhook-no-url"], {
        title: "Test",
        message: "Test",
        severity: "low",
      });

      expect(result.success).toBe(false);
      expect(result.results[0]?.error).toContain("Webhook URL not configured");
    });
  });

  describe("Multiple Channel Notifications", () => {
    it("should send to multiple channels", async () => {
      (global.fetch as any).mockResolvedValue({ ok: true });
      service.updateChannel("slack", {
        enabled: true,
        config: { webhookUrl: "https://hooks.slack.com/test" },
      });

      const result = await service.sendNotification(["browser", "slack"], {
        title: "Multi-channel Test",
        message: "Test message",
        severity: "high",
      });

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results.every((r) => r.success)).toBe(true);
    });

    it("should handle partial failures", async () => {
      service.updateChannel("email", {
        enabled: true,
        config: {}, // Invalid config
      });

      const result = await service.sendNotification(["browser", "email"], {
        title: "Partial Failure Test",
        message: "Test message",
        severity: "medium",
      });

      expect(result.success).toBe(true); // At least one succeeded
      expect(result.results).toHaveLength(2);
      expect(result.results[0]?.success).toBe(true); // browser
      expect(result.results[1]?.success).toBe(false); // email
    });

    it("should handle disabled channels", async () => {
      const result = await service.sendNotification(["email"], {
        title: "Disabled Channel Test",
        message: "Test message",
        severity: "low",
      });

      expect(result.success).toBe(false);
      expect(result.results[0]?.error).toContain(
        "Channel not found or disabled",
      );
    });
  });

  describe("Test Channel Functionality", () => {
    it("should test browser channel successfully", async () => {
      const result = await service.testChannel("browser");

      expect(result.success).toBe(true);
      expect(mockToast.info).toHaveBeenCalledWith(
        "Test Notification",
        expect.objectContaining({
          description:
            "This is a test notification from HookRelay Health Monitoring.",
        }),
      );
    });

    it("should test disabled channel", async () => {
      const result = await service.testChannel("email");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Channel not found or disabled");
    });
  });

  describe("Helper Methods", () => {
    it("should generate proper email body", () => {
      const template = {
        title: "Test Alert",
        message: "Test message",
        severity: "high" as const,
        metadata: {
          endpoint: "ep_123",
          errorCount: 5,
        },
      };

      // Access private method through any cast for testing
      const emailBody = (service as any).generateEmailBody(template);

      expect(emailBody).toContain("Test Alert");
      expect(emailBody).toContain("Test message");
      expect(emailBody).toContain("HIGH");
      expect(emailBody).toContain("endpoint");
      expect(emailBody).toContain("errorCount");
    });

    it("should map severity to correct colors", () => {
      const testCases = [
        { severity: "critical", expected: "danger" },
        { severity: "high", expected: "warning" },
        { severity: "medium", expected: "warning" },
        { severity: "low", expected: "good" },
        { severity: "unknown", expected: "good" },
      ];

      testCases.forEach(({ severity, expected }) => {
        const color = (service as any).getSeverityColor(severity);
        expect(color).toBe(expected);
      });
    });
  });

  describe("Global Service Instance", () => {
    it("should export global notification service instance", () => {
      expect(notificationService).toBeInstanceOf(NotificationService);
      expect(notificationService.getChannels()).toBeDefined();
    });
  });

  describe("Unsupported Channel Type", () => {
    it("should throw error for unsupported channel type", async () => {
      service.registerChannel("invalid", {
        type: "unsupported" as any,
        enabled: true,
        config: {},
      });

      const result = await service.sendNotification(["invalid"], {
        title: "Test",
        message: "Test",
        severity: "low",
      });

      expect(result.success).toBe(false);
      expect(result.results[0]?.error).toContain(
        "Unsupported notification channel",
      );
    });
  });
});
