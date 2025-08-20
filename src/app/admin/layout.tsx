import { ErrorBoundary } from "~/components/error-boundary";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary showDetails={process.env.NODE_ENV === "development"}>
      {children}
    </ErrorBoundary>
  );
}
