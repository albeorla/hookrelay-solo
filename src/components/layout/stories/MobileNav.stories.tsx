import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import React from "react";
import { MobileNav } from "~/components/layout/mobile-nav";
import { ThemeProvider } from "~/components/providers/theme-provider";
import "~/styles/globals.css";
import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";

const mockSession: Session = {
  user: {
    id: "1",
    name: "Admin User",
    email: "admin@example.com",
    image: "https://github.com/ghost.png",
    roles: ["ADMIN", "USER"],
  },
  expires: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
};

const meta = {
  title: "Layout/MobileNav",
  component: MobileNav,
  parameters: {
    layout: "fullscreen",
    viewport: {
      defaultViewport: "mobile",
    },
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/admin/webhooks",
      },
    },
  },
  decorators: [
    (Story) => (
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <SessionProvider session={mockSession}>
          <div style={{ minHeight: "100vh" }}>
            <Story />
          </div>
        </SessionProvider>
      </ThemeProvider>
    ),
  ],
} satisfies Meta<typeof MobileNav>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { defaultOpen: false } };

export const Opened: Story = {
  args: { defaultOpen: true },
  play: async ({ canvasElement }) => {
    // click the trigger to open the sheet
    const button = canvasElement.querySelector<HTMLButtonElement>(
      'button[aria-label="Open navigation"]',
    );
    button?.click();
  },
};
