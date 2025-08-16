"use client";

import React, {
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect,
} from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  useServerSentEvents,
  type DeliveryUpdateMessage,
  type SSEMessage as WebSocketMessage,
} from "~/hooks/use-server-sent-events";

interface WebSocketContextType {
  isConnected: boolean;
  connectionState: "disconnected" | "connecting" | "connected";
  subscribeToDeliveryUpdates: (
    handler: (message: DeliveryUpdateMessage) => void,
  ) => () => void;
  subscribeToSystemAlerts: (
    handler: (message: WebSocketMessage) => void,
  ) => () => void;
  enableRealTimeUpdates: () => void;
  disableRealTimeUpdates: () => void;
  deliveryStats: {
    recentUpdates: DeliveryUpdateMessage[];
    totalUpdates: number;
    lastUpdate: Date | null;
  };
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [deliveryStats, setDeliveryStats] = useState({
    recentUpdates: [] as DeliveryUpdateMessage[],
    totalUpdates: 0,
    lastUpdate: null as Date | null,
  });

  const {
    isConnected,
    connectionState,
    subscribe,
    subscribeToDeliveryUpdates: wsSubscribeToDeliveryUpdates,
    connect,
    disconnect,
  } = useServerSentEvents({
    debug: process.env.NODE_ENV === "development",
    autoConnect: false, // Don't auto-connect
    onConnect: () => {
      if (session?.user?.roles?.includes("ADMIN")) {
        toast.success("Real-time updates connected", {
          description: "You will now receive live webhook delivery updates",
          duration: 3000,
        });
      }
    },
    onDisconnect: () => {
      if (session?.user?.roles?.includes("ADMIN")) {
        toast.warning("Real-time updates disconnected", {
          description: "Attempting to reconnect...",
          duration: 3000,
        });
      }
    },
  });

  // Handle delivery updates
  const handleDeliveryUpdate = useCallback((message: DeliveryUpdateMessage) => {
    setDeliveryStats((prev) => ({
      recentUpdates: [message, ...prev.recentUpdates.slice(0, 49)], // Keep last 50 updates
      totalUpdates: prev.totalUpdates + 1,
      lastUpdate: new Date(),
    }));

    // Show toast notifications for important status changes
    const { data } = message;
    if (data.status === "failed" && data.attempt === 1) {
      toast.error("Webhook delivery failed", {
        description: `Endpoint ${data.endpointId.slice(0, 20)}... failed with status ${data.responseStatus ?? "unknown"}`,
        duration: 5000,
      });
    } else if (data.status === "success" && data.attempt > 1) {
      toast.success("Webhook delivery recovered", {
        description: `Endpoint ${data.endpointId.slice(0, 20)}... succeeded after ${data.attempt} attempts`,
        duration: 3000,
      });
    }
  }, []);

  // Subscribe to delivery updates when connected and user is admin
  useEffect(() => {
    if (isConnected && session?.user?.roles?.includes("ADMIN")) {
      const unsubscribe = wsSubscribeToDeliveryUpdates(handleDeliveryUpdate);
      return unsubscribe;
    }
  }, [
    isConnected,
    session,
    wsSubscribeToDeliveryUpdates,
    handleDeliveryUpdate,
  ]);

  const subscribeToDeliveryUpdates = useCallback(
    (handler: (message: DeliveryUpdateMessage) => void) => {
      return wsSubscribeToDeliveryUpdates(handler);
    },
    [wsSubscribeToDeliveryUpdates],
  );

  const subscribeToSystemAlerts = useCallback(
    (handler: (message: WebSocketMessage) => void) => {
      return subscribe("system_alert", handler);
    },
    [subscribe],
  );

  const enableRealTimeUpdates = useCallback(() => {
    if (session?.user?.roles?.includes("ADMIN")) {
      connect();
    }
  }, [session, connect]);

  const disableRealTimeUpdates = useCallback(() => {
    disconnect();
  }, [disconnect]);

  const contextValue: WebSocketContextType = {
    isConnected,
    connectionState,
    subscribeToDeliveryUpdates,
    subscribeToSystemAlerts,
    enableRealTimeUpdates,
    disableRealTimeUpdates,
    deliveryStats,
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketContext() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error(
      "useWebSocketContext must be used within a WebSocketProvider",
    );
  }
  return context;
}

// Optional: Hook for components that want delivery updates
export function useDeliveryUpdates(
  handler: (message: DeliveryUpdateMessage) => void,
) {
  const { subscribeToDeliveryUpdates, isConnected } = useWebSocketContext();

  useEffect(() => {
    if (isConnected) {
      const unsubscribe = subscribeToDeliveryUpdates(handler);
      return unsubscribe;
    }
  }, [isConnected, subscribeToDeliveryUpdates, handler]);

  return { isConnected };
}
