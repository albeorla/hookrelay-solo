"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";

export interface SSEMessage {
  type: string;
  data: unknown;
  timestamp: number;
}

export interface DeliveryUpdateMessage extends SSEMessage {
  type: "delivery_update";
  data: {
    endpointId: string;
    deliveryId: string;
    status: "pending" | "success" | "failed" | "retrying";
    timestamp: number;
    responseStatus?: number;
    durationMs?: number;
    attempt: number;
    error?: string;
  };
}

export interface SSEOptions {
  url?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  debug?: boolean;
  autoConnect?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
}

export function useServerSentEvents(options: SSEOptions = {}) {
  const {
    url = "/api/sse",
    reconnectInterval = 3000,
    maxReconnectAttempts = 10,
    debug = false,
    autoConnect = false,
    onConnect,
    onDisconnect,
    onError,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<
    "disconnected" | "connecting" | "connected"
  >("disconnected");
  const [lastMessage, setLastMessage] = useState<SSEMessage | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const eventSource = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messageHandlers = useRef<Map<string, (message: SSEMessage) => void>>(
    new Map(),
  );

  const log = useCallback(
    (message: string, data?: unknown) => {
      if (debug) {
        console.log(`[SSE] ${message}`, data);
      }
    },
    [debug],
  );

  const connect = useCallback(() => {
    if (
      eventSource.current?.readyState === EventSource.CONNECTING ||
      eventSource.current?.readyState === EventSource.OPEN
    ) {
      return;
    }

    try {
      setConnectionState("connecting");
      log("Connecting to SSE...", { url, attempt: reconnectAttempts + 1 });

      eventSource.current = new EventSource(url);

      eventSource.current.onopen = () => {
        log("SSE connected");
        setIsConnected(true);
        setConnectionState("connected");
        setReconnectAttempts(0);
        onConnect?.();
      };

      eventSource.current.onmessage = (event) => {
        try {
          const raw = JSON.parse(String(event.data)) as unknown;
          const message = raw as SSEMessage;
          log("Message received", message);

          // Skip heartbeat messages for UI updates
          if (message.type !== "heartbeat") {
            setLastMessage(message);
          }

          // Call registered message handlers
          const handler = messageHandlers.current.get(message.type);
          if (handler) {
            handler(message);
          }
        } catch (error) {
          console.error("Failed to parse SSE message:", error);
        }
      };

      eventSource.current.onerror = (error) => {
        log("SSE error", error);
        setIsConnected(false);
        setConnectionState("disconnected");
        onError?.(error);
        onDisconnect?.();

        // Attempt to reconnect if we haven't exceeded max attempts
        if (reconnectAttempts < maxReconnectAttempts) {
          log(`Attempting to reconnect in ${reconnectInterval}ms...`);
          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempts((prev) => prev + 1);
            connect();
          }, reconnectInterval);
        } else {
          toast.error(
            "Real-time connection failed after multiple attempts. Updates disabled.",
          );
        }
      };
    } catch (error) {
      console.error("Failed to create SSE connection:", error);
      setConnectionState("disconnected");
    }
  }, [
    url,
    reconnectInterval,
    maxReconnectAttempts,
    reconnectAttempts,
    log,
    onConnect,
    onDisconnect,
    onError,
  ]);

  const disconnect = useCallback(() => {
    log("Manually disconnecting SSE");

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSource.current) {
      eventSource.current.close();
      eventSource.current = null;
    }

    setIsConnected(false);
    setConnectionState("disconnected");
    setReconnectAttempts(0);
  }, [log]);

  const subscribe = useCallback(
    (messageType: string, handler: (message: SSEMessage) => void) => {
      messageHandlers.current.set(messageType, handler);
      log(`Subscribed to message type: ${messageType}`);

      return () => {
        messageHandlers.current.delete(messageType);
        log(`Unsubscribed from message type: ${messageType}`);
      };
    },
    [log],
  );

  // Connect on mount only if autoConnect is true
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  return {
    isConnected,
    connectionState,
    lastMessage,
    reconnectAttempts,
    connect,
    disconnect,
    subscribe,
    // Convenience methods for common message types
    subscribeToDeliveryUpdates: (
      handler: (message: DeliveryUpdateMessage) => void,
    ) => {
      return subscribe(
        "delivery_update",
        handler as (message: SSEMessage) => void,
      );
    },
  };
}
