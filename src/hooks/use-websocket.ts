"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";

export interface WebSocketMessage {
  type: string;
  data: unknown;
  timestamp: number;
}

export interface DeliveryUpdateMessage extends WebSocketMessage {
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

export interface WebSocketOptions {
  url?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  debug?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
}

export function useWebSocket(options: WebSocketOptions = {}) {
  const {
    url = process.env.NODE_ENV === "production"
      ? `wss://${window.location.host}/api/ws`
      : "ws://localhost:3001/api/ws",
    reconnectInterval = 3000,
    maxReconnectAttempts = 10,
    debug = false,
    onConnect,
    onDisconnect,
    onError,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<
    "disconnected" | "connecting" | "connected"
  >("disconnected");
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messageHandlers = useRef<
    Map<string, (message: WebSocketMessage) => void>
  >(new Map());

  const log = useCallback(
    (message: string, data?: unknown) => {
      if (debug) {
        console.log(`[WebSocket] ${message}`, data);
      }
    },
    [debug],
  );

  const connect = useCallback(() => {
    if (
      ws.current?.readyState === WebSocket.CONNECTING ||
      ws.current?.readyState === WebSocket.OPEN
    ) {
      return;
    }

    try {
      setConnectionState("connecting");
      log("Connecting to WebSocket...", {
        url,
        attempt: reconnectAttempts + 1,
      });

      ws.current = new WebSocket(url);

      ws.current.onopen = () => {
        log("WebSocket connected");
        setIsConnected(true);
        setConnectionState("connected");
        setReconnectAttempts(0);
        onConnect?.();
      };

      ws.current.onmessage = (event) => {
        try {
          const raw = JSON.parse(String(event.data)) as unknown;
          const message = raw as WebSocketMessage;
          log("Message received", message);
          setLastMessage(message);

          // Call registered message handlers
          const handler = messageHandlers.current.get(message.type);
          if (handler) {
            handler(message);
          }
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      ws.current.onclose = (event) => {
        log("WebSocket disconnected", {
          code: event.code,
          reason: event.reason,
        });
        setIsConnected(false);
        setConnectionState("disconnected");
        onDisconnect?.();

        // Attempt to reconnect if not a normal closure and we haven't exceeded max attempts
        if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
          log(`Attempting to reconnect in ${reconnectInterval}ms...`);
          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempts((prev) => prev + 1);
            connect();
          }, reconnectInterval);
        } else if (reconnectAttempts >= maxReconnectAttempts) {
          toast.error(
            "WebSocket connection failed after multiple attempts. Real-time updates disabled.",
          );
        }
      };

      ws.current.onerror = (error) => {
        log("WebSocket error", error);
        onError?.(error);
      };
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
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
    log("Manually disconnecting WebSocket");

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (ws.current) {
      ws.current.close(1000, "Manual disconnect");
      ws.current = null;
    }

    setIsConnected(false);
    setConnectionState("disconnected");
    setReconnectAttempts(0);
  }, [log]);

  const sendMessage = useCallback(
    (message: unknown) => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        const messageStr =
          typeof message === "string" ? message : JSON.stringify(message);
        ws.current.send(messageStr);
        log("Message sent", message);
        return true;
      } else {
        log("Cannot send message - WebSocket not connected");
        return false;
      }
    },
    [log],
  );

  const subscribe = useCallback(
    (messageType: string, handler: (message: WebSocketMessage) => void) => {
      messageHandlers.current.set(messageType, handler);
      log(`Subscribed to message type: ${messageType}`);

      return () => {
        messageHandlers.current.delete(messageType);
        log(`Unsubscribed from message type: ${messageType}`);
      };
    },
    [log],
  );

  // Connect on mount
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

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
    sendMessage,
    subscribe,
    // Convenience methods for common message types
    subscribeToDeliveryUpdates: (
      handler: (message: DeliveryUpdateMessage) => void,
    ) => {
      return subscribe(
        "delivery_update",
        handler as (message: WebSocketMessage) => void,
      );
    },
  };
}
