"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { api } from "~/trpc/react";
import { Loader2 } from "lucide-react";

const webhookEndpointSchema = z
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

type WebhookEndpointFormData = z.infer<typeof webhookEndpointSchema>;

interface WebhookEndpointFormProps {
  onSuccess?: () => void;
}

export function WebhookEndpointForm({ onSuccess }: WebhookEndpointFormProps) {
  const form = useForm<WebhookEndpointFormData>({
    resolver: zodResolver(webhookEndpointSchema),
    defaultValues: {
      endpointId: "",
      destUrl: "",
      hmacMode: undefined,
      secret: "",
    },
  });

  const createEndpoint = api.webhook.createEndpoint.useMutation({
    onSuccess: () => {
      toast.success("Webhook endpoint created successfully");
      form.reset();
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(`Failed to create endpoint: ${error.message}`);
    },
  });

  const onSubmit = async (data: WebhookEndpointFormData) => {
    await createEndpoint.mutateAsync({
      endpointId: data.endpointId,
      destUrl: data.destUrl,
      hmacMode: data.hmacMode,
      secret: data.secret ?? undefined,
    });
  };

  const isSubmitting = createEndpoint.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="endpointId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Endpoint ID</FormLabel>
              <FormControl>
                <Input
                  placeholder="ep_my_service"
                  {...field}
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormDescription>
                A unique identifier for this webhook endpoint.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="destUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Destination URL</FormLabel>
              <FormControl>
                <Input
                  placeholder="https://api.example.com/webhooks"
                  {...field}
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormDescription>
                The URL where webhooks will be delivered.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="hmacMode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>HMAC Verification Mode</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
                disabled={isSubmitting}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="None (no signature verification)" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="stripe">Stripe</SelectItem>
                  <SelectItem value="github">GitHub</SelectItem>
                  <SelectItem value="generic">Generic</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                Choose a signature verification method for security.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {form.watch("hmacMode") && (
          <FormField
            control={form.control}
            name="secret"
            render={({ field }) => (
              <FormItem>
                <FormLabel>HMAC Secret</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="your-secret-key"
                    {...field}
                    disabled={isSubmitting}
                  />
                </FormControl>
                <FormDescription>
                  The secret key for HMAC signature verification.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="flex justify-end gap-4 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onSuccess}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? "Creating..." : "Create Endpoint"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
