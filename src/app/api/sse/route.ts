import { type NextRequest } from "next/server";
import { auth } from "~/server/auth";

// In-memory store for active SSE connections
// In production, use Redis or similar for scaling across instances
const activeConnections = new Set<
  ReadableStreamDefaultController<Uint8Array>
>();

// Global interval reference to manage simulation
let simulationInterval: NodeJS.Timeout | null = null;

// Simulated webhook delivery updates (in production, this would come from your webhook processing service)
const startSimulation = () => {
  if (simulationInterval) return; // Already running

  simulationInterval = setInterval(
    () => {
      if (activeConnections.size > 0) {
        const statuses = ["success", "failed", "pending", "retrying"] as const;
        const endpointIds = ["webhook_001", "webhook_002", "webhook_003"];
        const httpStatuses = [200, 201, 400, 401, 500, 502];

        const update = {
          type: "delivery_update",
          data: {
            endpointId:
              endpointIds[Math.floor(Math.random() * endpointIds.length)]!,
            deliveryId: `delivery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            status: statuses[Math.floor(Math.random() * statuses.length)]!,
            timestamp: Date.now(),
            responseStatus:
              httpStatuses[Math.floor(Math.random() * httpStatuses.length)],
            durationMs: Math.floor(Math.random() * 5000) + 100,
            attempt: Math.floor(Math.random() * 3) + 1,
            error: Math.random() > 0.7 ? "Connection timeout" : undefined,
          },
          timestamp: Date.now(),
        };

        broadcastUpdate(update);
      } else {
        // No active connections, stop simulation
        stopSimulation();
      }
    },
    5000 + Math.random() * 5000,
  ); // Random interval between 5-10 seconds
};

const stopSimulation = () => {
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
  }
};

function broadcastUpdate(update: unknown) {
  const data = `data: ${JSON.stringify(update)}\n\n`;
  const encoder = new TextEncoder();
  const encodedData = encoder.encode(data);

  // Send to all connected clients
  for (const controller of activeConnections) {
    try {
      controller.enqueue(encodedData);
    } catch {
      // Remove disconnected clients
      activeConnections.delete(controller);
    }
  }

  // Stop simulation if no connections remain
  if (activeConnections.size === 0) {
    stopSimulation();
  }
}

// Function to broadcast updates (can be called from webhook processing logic)
export function broadcastDeliveryUpdate(update: {
  endpointId: string;
  deliveryId: string;
  status: "pending" | "success" | "failed" | "retrying";
  timestamp: number;
  responseStatus?: number;
  durationMs?: number;
  attempt: number;
  error?: string;
}) {
  const message = {
    type: "delivery_update",
    data: update,
    timestamp: Date.now(),
  };

  broadcastUpdate(message);
}

export async function GET(request: NextRequest) {
  // Check authentication
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Create a readable stream for SSE
  const stream = new ReadableStream<Uint8Array>({
    start(controller: ReadableStreamDefaultController<Uint8Array>) {
      // Add this connection to active connections
      activeConnections.add(controller);

      // Start simulation if in development mode and this is the first connection
      if (
        process.env.NODE_ENV === "development" &&
        activeConnections.size === 1
      ) {
        startSimulation();
      }

      // Send initial connection message
      const welcomeMessage = {
        type: "connection",
        data: { message: "Connected to webhook delivery updates" },
        timestamp: Date.now(),
      };

      const encoder = new TextEncoder();
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify(welcomeMessage)}\n\n`),
      );

      // Send periodic heartbeat to keep connection alive
      const heartbeatInterval = setInterval(() => {
        try {
          const heartbeat = {
            type: "heartbeat",
            timestamp: Date.now(),
          };
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(heartbeat)}\n\n`),
          );
        } catch {
          clearInterval(heartbeatInterval);
          activeConnections.delete(controller);

          // Stop simulation if no connections remain
          if (activeConnections.size === 0) {
            stopSimulation();
          }
        }
      }, 30000); // Every 30 seconds

      // Cleanup on connection close
      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeatInterval);
        activeConnections.delete(controller);
        controller.close();

        // Stop simulation if no connections remain
        if (activeConnections.size === 0) {
          stopSimulation();
        }
      });
    },
    cancel() {
      // Connection was closed by client
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Cache-Control",
    },
  });
}
