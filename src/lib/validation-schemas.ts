import { z } from "zod";

export const webhookEndpointSchema = z
  .object({
    endpointId: z
      .string()
      .min(1, "Endpoint ID is required")
      .regex(
        /^[a-zA-Z0-9_-]+$/,
        "Only letters, numbers, hyphens and underscores allowed",
      ),
    destUrl: z.string().url("Must be a valid URL"),
    hmacMode: z.enum(["stripe", "github", "generic"]).optional(),
    secret: z.string().optional(),
    description: z.string().max(500).optional(),
  })
  .refine(
    (data) => {
      if (data.hmacMode && !data.secret) {
        return false;
      }
      return true;
    },
    {
      message: "Secret is required when HMAC mode is selected",
      path: ["secret"],
    },
  );

export const roleSchema = z.object({
  name: z.string().min(1, "Role name is required"),
  description: z.string().optional(),
});

export type WebhookEndpointFormData = z.infer<typeof webhookEndpointSchema>;
export type RoleFormData = z.infer<typeof roleSchema>;
