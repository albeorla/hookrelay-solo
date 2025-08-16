"use client";

import React, { lazy, Suspense, useRef } from "react";
import { useIntersectionObserver } from "~/hooks/use-optimized-query";
import { AnalyticsChartSkeleton } from "./loading-skeletons";

// Lazy load the heavy analytics component
const AnalyticsCharts = lazy(() =>
  import("./analytics-charts").then((module) => ({
    default: module.AnalyticsCharts,
  })),
);

interface LazyAnalyticsProps {
  endpointId?: string;
  timeRange?: "1h" | "24h" | "7d" | "30d";
  className?: string;
}

export function LazyAnalytics({
  endpointId: _endpointId,
  timeRange: _timeRange = "24h",
  className,
}: LazyAnalyticsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { hasIntersected } = useIntersectionObserver(
    containerRef as React.RefObject<Element>,
    {
      threshold: 0.1,
      rootMargin: "100px", // Load when 100px before coming into view
    },
  );

  return (
    <div ref={containerRef} className={className}>
      {hasIntersected ? (
        <Suspense fallback={<AnalyticsChartSkeleton />}>
          <AnalyticsCharts />
        </Suspense>
      ) : (
        <div className="flex h-[400px] items-center justify-center">
          <div className="text-muted-foreground text-sm">
            Analytics will load when scrolled into view...
          </div>
        </div>
      )}
    </div>
  );
}
