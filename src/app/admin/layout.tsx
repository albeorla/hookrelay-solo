import { ErrorBoundary } from "~/components/error-boundary";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error("Admin layout error:", { error, errorInfo });
        // In production, you might want to send this to your error reporting service
      }}
      resetOnPropsChange={true}
    >
      {children}
    </ErrorBoundary>
  );
}
