import type { Preview } from "@storybook/nextjs-vite";

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: "app-bg",
      values: [
        { name: "app-bg", value: "#0b0b0b" },
        { name: "light", value: "#ffffff" },
        { name: "grid", value: "#0f0f0f" },
      ],
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: "todo",
    },
    viewport: {
      viewports: {
        desktop: {
          name: "Desktop 1440",
          styles: { width: "1440px", height: "900px" },
        },
        laptop: {
          name: "Laptop 1280",
          styles: { width: "1280px", height: "800px" },
        },
        tablet: {
          name: "Tablet 768",
          styles: { width: "768px", height: "1024px" },
        },
        mobile: {
          name: "Mobile 375",
          styles: { width: "375px", height: "812px" },
        },
      },
      defaultViewport: "desktop",
    },
  },
};

export default preview;
