"use client";

import React from "react";
import { Wifi, WifiOff, RefreshCw, Activity } from "lucide-react";
import { Badge } from "~/components/ui/badge";
// removed unused Button import
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { useWebSocketContext } from "~/contexts/websocket-context";

export function RealtimeStatus() {
  const { isConnected, connectionState, deliveryStats } = useWebSocketContext();

  const getStatusIcon = () => {
    switch (connectionState) {
      case "connected":
        return <Wifi className="h-4 w-4 text-green-500" />;
      case "connecting":
        return <RefreshCw className="h-4 w-4 animate-spin text-yellow-500" />;
      case "disconnected":
        return <WifiOff className="h-4 w-4 text-red-500" />;
      default:
        return <WifiOff className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusText = () => {
    switch (connectionState) {
      case "connected":
        return "Live";
      case "connecting":
        return "Connecting...";
      case "disconnected":
        return "Offline";
      default:
        return "Unknown";
    }
  };

  const getStatusVariant = ():
    | "default"
    | "secondary"
    | "destructive"
    | "outline" => {
    switch (connectionState) {
      case "connected":
        return "default";
      case "connecting":
        return "secondary";
      case "disconnected":
        return "destructive";
      default:
        return "outline";
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant={getStatusVariant()}
            className="flex cursor-pointer items-center gap-1"
          >
            {getStatusIcon()}
            {getStatusText()}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-sm">
            <div className="mb-1 font-medium">Real-time Status</div>
            <div>Connection: {connectionState}</div>
            {isConnected && (
              <>
                <div>Updates received: {deliveryStats.totalUpdates}</div>
                {deliveryStats.lastUpdate && (
                  <div>
                    Last update: {deliveryStats.lastUpdate.toLocaleTimeString()}
                  </div>
                )}
              </>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function RealtimeStatsCard() {
  const { isConnected, deliveryStats } = useWebSocketContext();

  const recentFailures = deliveryStats.recentUpdates.filter(
    (update) => update.data.status === "failed",
  ).length;

  const recentSuccesses = deliveryStats.recentUpdates.filter(
    (update) => update.data.status === "success",
  ).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">
          Real-time Activity
        </CardTitle>
        <RealtimeStatus />
      </CardHeader>
      <CardContent>
        {isConnected ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {recentSuccesses}
                </div>
                <p className="text-muted-foreground">Recent successes</p>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">
                  {recentFailures}
                </div>
                <p className="text-muted-foreground">Recent failures</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-muted-foreground flex items-center justify-between text-xs">
                <span>Total updates: {deliveryStats.totalUpdates}</span>
                {deliveryStats.lastUpdate && (
                  <span>
                    Last: {deliveryStats.lastUpdate.toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>

            {deliveryStats.recentUpdates.length > 0 && (
              <div className="space-y-1">
                <div className="text-muted-foreground text-xs font-medium">
                  Recent Activity
                </div>
                <div className="max-h-24 space-y-1 overflow-y-auto">
                  {deliveryStats.recentUpdates
                    .slice(0, 3)
                    .map((update, idx) => (
                      <div
                        key={`${update.data.deliveryId}-${idx}`}
                        className="bg-muted/50 flex items-center justify-between rounded p-1 text-xs"
                      >
                        <span className="flex-1 truncate">
                          {update.data.endpointId.slice(0, 15)}...
                        </span>
                        <Badge
                          variant={
                            update.data.status === "success"
                              ? "default"
                              : update.data.status === "failed"
                                ? "destructive"
                                : "secondary"
                          }
                          className="px-1 py-0 text-xs"
                        >
                          {update.data.status}
                        </Badge>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-muted-foreground py-4 text-center">
            <Activity className="mx-auto mb-2 h-8 w-8 opacity-50" />
            <p className="text-sm">Real-time updates unavailable</p>
            <p className="text-xs">Refreshing data every 10 seconds</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
