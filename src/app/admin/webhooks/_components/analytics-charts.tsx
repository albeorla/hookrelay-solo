"use client";

import React, { useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Button } from "~/components/ui/button";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Clock,
  BarChart3,
  RefreshCw,
} from "lucide-react";
import { api } from "~/trpc/react";

interface AnalyticsChartsProps {
  className?: string;
}

const COLORS = {
  success: "#10b981",
  failed: "#ef4444",
  pending: "#3b82f6",
  retrying: "#f59e0b",
  primary: "#8b5cf6",
  secondary: "#06b6d4",
};

const STATUS_CODE_COLORS = [
  "#8b5cf6",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ef4444",
];

export function AnalyticsCharts({ className = "" }: AnalyticsChartsProps) {
  const [timeRange, setTimeRange] = useState<"1h" | "24h" | "7d" | "30d">(
    "24h",
  );
  const [selectedEndpoint, setSelectedEndpoint] = useState<
    string | undefined
  >();

  // Fetch analytics data
  const {
    data: analytics,
    refetch: refetchAnalytics,
    isLoading: analyticsLoading,
    error: analyticsError,
  } = api.webhook.getAnalytics.useQuery(
    {
      timeRange,
      endpointId: selectedEndpoint,
    },
    {
      refetchInterval: 30000, // Refresh every 30 seconds
    },
  );

  // Fetch endpoints for filter dropdown
  const { data: endpoints } = api.webhook.getEndpoints.useQuery();

  const handleRefresh = () => {
    void refetchAnalytics();
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    switch (timeRange) {
      case "1h":
        return date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
      case "24h":
        return date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
      case "7d":
        return date.toLocaleDateString([], { month: "short", day: "numeric" });
      case "30d":
        return date.toLocaleDateString([], { month: "short", day: "numeric" });
      default:
        return date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
    }
  };

  const formatTooltipValue = (value: number, name: string) => {
    if (name === "successRate") {
      return [`${value.toFixed(1)}%`, "Success Rate"];
    }
    return [value, name];
  };

  if (analyticsError) {
    return (
      <Card className={className}>
        <CardContent className="py-8 text-center">
          <Activity className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <h3 className="text-lg font-medium">Analytics Unavailable</h3>
          <p className="text-muted-foreground">
            Unable to load analytics data. Please try again later.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={handleRefresh}
            disabled={analyticsLoading}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${analyticsLoading ? "animate-spin" : ""}`}
            />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Webhook Analytics</h2>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={timeRange}
              onValueChange={(value) => setTimeRange(value as typeof timeRange)}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last Hour</SelectItem>
                <SelectItem value="24h">Last 24h</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={selectedEndpoint ?? "all"}
              onValueChange={(value) =>
                setSelectedEndpoint(value === "all" ? undefined : value)
              }
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Endpoints" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Endpoints</SelectItem>
                {endpoints?.map(
                  (endpoint: { id: string; name?: string | null }) => (
                    <SelectItem key={endpoint.id} value={String(endpoint.id)}>
                      {endpoint.name ?? endpoint.id}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={analyticsLoading}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${analyticsLoading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {analytics && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Deliveries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analytics.summary.totalDeliveries.toLocaleString()}
                </div>
                <div className="text-muted-foreground flex items-center gap-1 text-xs">
                  <TrendingUp className="h-3 w-3" />
                  {timeRange.toUpperCase()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Success Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {analytics.summary.successRate.toFixed(1)}%
                </div>
                <div className="text-muted-foreground flex items-center gap-1 text-xs">
                  {analytics.summary.successRate >= 95 ? (
                    <TrendingUp className="h-3 w-3 text-green-500" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-500" />
                  )}
                  {analytics.summary.successfulDeliveries} successful
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Avg Response Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analytics.summary.averageResponseTime}ms
                </div>
                <div className="text-muted-foreground flex items-center gap-1 text-xs">
                  <Clock className="h-3 w-3" />
                  Processing time
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Failed Deliveries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {analytics.summary.failedDeliveries}
                </div>
                <div className="text-muted-foreground flex items-center gap-1 text-xs">
                  <Activity className="h-3 w-3" />
                  Needs attention
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Delivery Trends Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Delivery Trends</CardTitle>
              <CardDescription>
                Webhook delivery status over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={analytics.timeSeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={formatTimestamp}
                    domain={["dataMin", "dataMax"]}
                  />
                  <YAxis />
                  <Tooltip
                    labelFormatter={(value) => formatTimestamp(Number(value))}
                    formatter={formatTooltipValue}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="successful"
                    stackId="1"
                    stroke={COLORS.success}
                    fill={COLORS.success}
                    name="Successful"
                  />
                  <Area
                    type="monotone"
                    dataKey="failed"
                    stackId="1"
                    stroke={COLORS.failed}
                    fill={COLORS.failed}
                    name="Failed"
                  />
                  <Area
                    type="monotone"
                    dataKey="retrying"
                    stackId="1"
                    stroke={COLORS.retrying}
                    fill={COLORS.retrying}
                    name="Retrying"
                  />
                  <Area
                    type="monotone"
                    dataKey="pending"
                    stackId="1"
                    stroke={COLORS.pending}
                    fill={COLORS.pending}
                    name="Pending"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Success Rate Over Time */}
            <Card>
              <CardHeader>
                <CardTitle>Success Rate Trend</CardTitle>
                <CardDescription>Success percentage over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={analytics.timeSeries}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={formatTimestamp}
                    />
                    <YAxis domain={[0, 100]} />
                    <Tooltip
                      labelFormatter={(value) => formatTimestamp(Number(value))}
                      formatter={(value: number) => [
                        `${value.toFixed(1)}%`,
                        "Success Rate",
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="successRate"
                      stroke={COLORS.primary}
                      strokeWidth={2}
                      dot={{ fill: COLORS.primary, strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Status Code Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Status Code Distribution</CardTitle>
                <CardDescription>HTTP response status codes</CardDescription>
              </CardHeader>
              <CardContent>
                {analytics.statusCodeDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={analytics.statusCodeDistribution}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(props) => {
                          const payload = (
                            props as unknown as {
                              payload?: {
                                statusCode?: number;
                                percentage?: number;
                              };
                            }
                          ).payload;
                          const pct = payload?.percentage ?? 0;
                          if (pct <= 5) return "";
                          const code = payload?.statusCode ?? "";
                          return `${code} (${Math.round(pct)}%)`;
                        }}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="count"
                        nameKey="statusCode"
                      >
                        {analytics.statusCodeDistribution.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={
                              STATUS_CODE_COLORS[
                                index % STATUS_CODE_COLORS.length
                              ]
                            }
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number, name) => [
                          value,
                          `Status ${name}`,
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-muted-foreground flex h-[250px] items-center justify-center">
                    <div className="text-center">
                      <BarChart3 className="mx-auto mb-2 h-12 w-12 opacity-50" />
                      <p>No status code data available</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Endpoint Performance */}
          {!selectedEndpoint && analytics.endpointPerformance.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Endpoint Performance</CardTitle>
                <CardDescription>Success rate by endpoint</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={analytics.endpointPerformance}
                    layout="horizontal"
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 100]} />
                    <YAxis
                      type="category"
                      dataKey="endpointId"
                      width={150}
                      tickFormatter={(value: string) =>
                        value.length > 20 ? `${value.slice(0, 20)}...` : value
                      }
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => {
                        if (name === "successRate") {
                          return [`${value.toFixed(1)}%`, "Success Rate"];
                        }
                        return [value, name];
                      }}
                      labelFormatter={(label: string) => `Endpoint: ${label}`}
                    />
                    <Bar
                      dataKey="successRate"
                      fill={COLORS.primary}
                      name="Success Rate"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Loading State */}
          {analyticsLoading && (
            <div className="py-4 text-center">
              <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin" />
              <p className="text-muted-foreground">Updating analytics...</p>
            </div>
          )}
        </>
      )}

      {/* Empty State */}
      {analytics && analytics.summary.totalDeliveries === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart3 className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
            <h3 className="text-lg font-medium">No Data Available</h3>
            <p className="text-muted-foreground">
              No webhook deliveries found for the selected time range.
              {selectedEndpoint &&
                " Try selecting a different endpoint or time range."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
