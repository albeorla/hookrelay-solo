import { createTRPCRouter } from "~/server/api/trpc";
import { endpointsProcedures } from "./webhook/endpoints";
import { deliveriesProcedures } from "./webhook/deliveries";
import { dlqProcedures } from "./webhook/dlq";
import { exportsProcedures } from "./webhook/exports";
import { analyticsProcedures } from "./webhook/analytics";
import { healthProcedures } from "./webhook/health";
import { systemProcedures } from "./webhook/system";
import { statsProcedures } from "./webhook/stats";

export const webhookRouter = createTRPCRouter({
  ...endpointsProcedures,
  ...deliveriesProcedures,
  ...dlqProcedures,
  ...exportsProcedures,
  ...analyticsProcedures,
  ...healthProcedures,
  ...systemProcedures,
  ...statsProcedures,
});
