import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import React from "react";
import { Sidebar } from "~/components/layout/sidebar";
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
  // ISO string in the future
  expires: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
};

const meta = {
  title: "Layout/Sidebar",
  component: Sidebar,
  parameters: {
    layout: "fullscreen",
    viewport: {
      defaultViewport: "responsive",
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
  argTypes: {
    open: { control: "boolean" },
  },
} satisfies Meta<typeof Sidebar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Expanded: Story = {
  args: {
    open: true,
    onOpenChange: () => undefined,
  },
};

export const Collapsed: Story = {
  args: {
    open: false,
    onOpenChange: () => undefined,
  },
};

// Debug-friendly playground that renders a content area next to the fixed sidebar
const SidebarPlayground = ({ initialOpen }: { initialOpen: boolean }) => {
  const [open, setOpen] = React.useState(initialOpen);
  const leftPadClass = open
    ? "md:pl-[calc(16rem+1rem)] pl-16"
    : "md:pl-[calc(4rem+1rem)] pl-16";
  return (
    <div className="min-h-screen">
      <Sidebar open={open} onOpenChange={setOpen} />
      <main className={`${leftPadClass} p-6 transition-all`}>
        <div className="bg-card rounded-lg border p-6 shadow-sm">
          <h2 className="mb-2 text-xl font-semibold">Main Content</h2>
          <p className="text-muted-foreground text-sm">
            This area helps visualize how the fixed sidebar impacts page layout.
            Toggle the sidebar with the button in its header to see spacing
            adjust.
          </p>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="bg-grid-pattern h-24 rounded-md border" />
            <div className="bg-grid-pattern h-24 rounded-md border" />
            <div className="bg-grid-pattern h-24 rounded-md border" />
            <div className="bg-grid-pattern h-24 rounded-md border" />
          </div>
        </div>
      </main>
    </div>
  );
};

export const PlaygroundExpanded: Story = {
  render: () => <SidebarPlayground initialOpen={true} />,
  args: { open: true, onOpenChange: () => undefined },
};

export const PlaygroundCollapsed: Story = {
  render: () => <SidebarPlayground initialOpen={false} />,
  args: { open: false, onOpenChange: () => undefined },
};
