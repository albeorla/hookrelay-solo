"use client";

import React, { type ErrorInfo, type ReactNode, Component } from "react";
import { AlertTriangle, RefreshCw, Home, Bug } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  showDetails?: boolean;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetOnPropsChange?: boolean;
  resetKeys?: Array<string | number | boolean | null | undefined>;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  eventId: string | null;
}

/**
 * Enhanced Error Boundary Component
 * Provides graceful error handling with detailed error information and recovery options
 */
export class ErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: number | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      eventId: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null,
      eventId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details
    console.error("Error Boundary caught an error:", error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // In production, you might want to send this to an error reporting service
    if (process.env.NODE_ENV === "production") {
      this.logErrorToService(error, errorInfo);
    }
  }

  componentDidUpdate(prevProps: Props) {
    const { resetOnPropsChange, resetKeys } = this.props;
    const { hasError } = this.state;

    if (
      hasError &&
      prevProps.children !== this.props.children &&
      resetOnPropsChange
    ) {
      this.resetErrorBoundary();
    }

    if (hasError && resetKeys && prevProps.resetKeys) {
      const hasResetKeyChanged = resetKeys.some(
        (key, i) => key !== prevProps.resetKeys![i],
      );
      if (hasResetKeyChanged) {
        this.resetErrorBoundary();
      }
    }
  }

  private logErrorToService = (error: Error, errorInfo: ErrorInfo) => {
    // This is where you would integrate with your error reporting service
    // For example: Sentry, LogRocket, Bugsnag, etc.
    try {
      // Example: Send to your logging endpoint
      fetch("/api/errors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
          errorInfo,
          timestamp: new Date().toISOString(),
          url: window.location.href,
          userAgent: navigator.userAgent,
        }),
      }).catch(console.error);
    } catch (loggingError) {
      console.error("Failed to log error to service:", loggingError);
    }
  };

  private resetErrorBoundary = () => {
    if (this.resetTimeoutId) {
      window.clearTimeout(this.resetTimeoutId);
    }

    this.resetTimeoutId = window.setTimeout(() => {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        eventId: null,
      });
    }, 100);
  };

  private handleRetry = () => {
    this.resetErrorBoundary();
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = "/";
  };

  private getErrorSeverity = (error: Error): "low" | "medium" | "high" => {
    const errorMessage = error.message.toLowerCase();

    if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
      return "medium";
    }

    if (errorMessage.includes("syntax") || errorMessage.includes("reference")) {
      return "high";
    }

    return "low";
  };

  private getErrorCategory = (error: Error): string => {
    const errorMessage = error.message.toLowerCase();
    const stackTrace = error.stack?.toLowerCase() ?? "";

    if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
      return "Network Error";
    }

    if (errorMessage.includes("syntax")) {
      return "Syntax Error";
    }

    if (errorMessage.includes("reference")) {
      return "Reference Error";
    }

    if (stackTrace.includes("hook")) {
      return "React Hook Error";
    }

    if (stackTrace.includes("router")) {
      return "Navigation Error";
    }

    return "Application Error";
  };

  render() {
    if (this.state.hasError) {
      const { fallback, showDetails = false } = this.props;
      const { error, errorInfo, eventId } = this.state;

      // If a custom fallback is provided, use it
      if (fallback) {
        return fallback;
      }

      const severity = error ? this.getErrorSeverity(error) : "medium";
      const category = error ? this.getErrorCategory(error) : "Unknown Error";

      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
          <div className="w-full max-w-2xl">
            <Card className="border-destructive/20">
              <CardHeader className="text-center">
                <div className="bg-destructive/10 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
                  <AlertTriangle className="text-destructive h-6 w-6" />
                </div>
                <CardTitle className="text-2xl font-bold">
                  Something went wrong
                </CardTitle>
                <CardDescription>
                  We encountered an unexpected error. Our team has been notified
                  and is working on a fix.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Error Summary */}
                <div className="flex items-center justify-center gap-2">
                  <Badge
                    variant={
                      severity === "high"
                        ? "destructive"
                        : severity === "medium"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {category}
                  </Badge>
                  {eventId && (
                    <Badge variant="outline" className="font-mono text-xs">
                      ID: {eventId}
                    </Badge>
                  )}
                </div>

                {/* User-friendly error message */}
                <Alert>
                  <Bug className="h-4 w-4" />
                  <AlertDescription>
                    {error?.message.includes("network") ||
                    error?.message.includes("fetch")
                      ? "There seems to be a connection issue. Please check your internet connection and try again."
                      : error?.message.includes("syntax") ||
                          error?.message.includes("reference")
                        ? "We're experiencing a technical issue. Please try refreshing the page."
                        : "An unexpected error occurred. Please try again or contact support if the problem persists."}
                  </AlertDescription>
                </Alert>

                {/* Action Buttons */}
                <div className="flex flex-col justify-center gap-3 sm:flex-row">
                  <Button
                    onClick={this.handleRetry}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Try Again
                  </Button>
                  <Button
                    variant="outline"
                    onClick={this.handleReload}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Reload Page
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={this.handleGoHome}
                    className="flex items-center gap-2"
                  >
                    <Home className="h-4 w-4" />
                    Go Home
                  </Button>
                </div>

                {/* Developer Details (only in development or when explicitly enabled) */}
                {(showDetails || process.env.NODE_ENV === "development") &&
                  error && (
                    <details className="mt-6">
                      <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-sm font-medium">
                        Technical Details (for developers)
                      </summary>
                      <div className="mt-4 space-y-4">
                        <div>
                          <h4 className="text-sm font-semibold">
                            Error Message:
                          </h4>
                          <pre className="bg-muted mt-1 overflow-auto rounded p-2 text-xs">
                            {error.message}
                          </pre>
                        </div>

                        {error.stack && (
                          <div>
                            <h4 className="text-sm font-semibold">
                              Stack Trace:
                            </h4>
                            <pre className="bg-muted mt-1 max-h-48 overflow-auto rounded p-2 text-xs">
                              {error.stack}
                            </pre>
                          </div>
                        )}

                        {errorInfo?.componentStack && (
                          <div>
                            <h4 className="text-sm font-semibold">
                              Component Stack:
                            </h4>
                            <pre className="bg-muted mt-1 max-h-48 overflow-auto rounded p-2 text-xs">
                              {errorInfo.componentStack}
                            </pre>
                          </div>
                        )}
                      </div>
                    </details>
                  )}

                {/* Support Information */}
                <div className="text-muted-foreground text-center text-sm">
                  <p>
                    If this problem continues, please contact support with error
                    ID:
                    <code className="bg-muted ml-1 rounded px-1 text-xs">
                      {eventId}
                    </code>
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook-based error boundary for functional components
 */
export function withErrorBoundary<T extends object>(
  Component: React.ComponentType<T>,
  errorBoundaryOptions?: Omit<Props, "children">,
) {
  const WrappedComponent = (props: T) => (
    <ErrorBoundary {...errorBoundaryOptions}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName ?? Component.name})`;

  return WrappedComponent;
}

/**
 * Specialized error boundary for webhook-related components
 * Uses a simplified approach without function props to work with server components
 */
export const WebhookErrorBoundary: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  return (
    <ErrorBoundary showDetails={process.env.NODE_ENV === "development"}>
      {children}
    </ErrorBoundary>
  );
};
