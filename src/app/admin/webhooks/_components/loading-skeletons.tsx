"use client";

import React from "react";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";

// Base skeleton component
const Skeleton = ({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={`bg-muted/50 animate-pulse rounded-md ${className}`}
    {...props}
  />
);

// Dashboard metrics skeleton
export function DashboardMetricsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="mb-2 h-8 w-16" />
            <Skeleton className="h-3 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Table skeleton for delivery logs
export function DeliveryTableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {/* Table header */}
      <div className="flex items-center gap-4 border-b p-4">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-8" />
      </div>

      {/* Table rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b p-4">
          <Skeleton className="h-4 w-4" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div>
            <Skeleton className="mb-1 h-4 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 w-8" />
        </div>
      ))}
    </div>
  );
}

// Analytics chart skeleton
export function AnalyticsChartSkeleton() {
  return (
    <div className="space-y-6">
      {/* Summary cards skeleton */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="mb-2 h-8 w-16" />
              <div className="flex items-center gap-1">
                <Skeleton className="h-3 w-3" />
                <Skeleton className="h-3 w-20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main chart skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] items-end gap-2 p-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton
                key={i}
                className="w-full"
                style={{ height: `${Math.random() * 200 + 50}px` }}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Secondary charts grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent>
              <div className="flex h-[250px] items-center justify-center">
                <Skeleton className="h-32 w-32 rounded-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Health alerts skeleton
export function HealthAlertsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-16" />
          </div>
          <Skeleton className="h-5 w-5" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <Skeleton className="mb-1 h-6 w-8" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div>
            <Skeleton className="mb-1 h-6 w-8" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-20" />
          </div>

          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-lg border p-3"
            >
              <Skeleton className="mt-1 h-4 w-4" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-3 w-full" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
              <Skeleton className="h-8 w-8" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Settings form skeleton
export function SettingsFormSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 3 }).map((_, section) => (
        <Card key={section}>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 4 }).map((_, field) => (
              <div key={field} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <div className="flex justify-end gap-2">
        <Skeleton className="h-10 w-20" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
}

// Recent activity skeleton
export function RecentActivitySkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-8 w-16" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="flex items-center gap-3">
                <Skeleton className="h-4 w-4" />
                <div>
                  <Skeleton className="mb-1 h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// DLQ items skeleton
export function DlqItemsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <Skeleton className="mt-1 h-4 w-4" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-48" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-12" />
                  </div>
                </div>
                <Skeleton className="h-4 w-full" />
                <div className="flex items-center gap-4 text-sm">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-8 w-8" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Generic card loading skeleton
export function CardSkeleton({
  children,
  ...props
}: React.ComponentProps<typeof Card>) {
  return (
    <Card {...props}>
      <CardHeader>
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
      </CardHeader>
      <CardContent>
        {children ?? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
