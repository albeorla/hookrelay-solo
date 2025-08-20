"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { LoadingButton } from "~/components/ui/loading-button";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";
import { toastMessages } from "~/lib/toast-messages";
import {
  webhookEndpointSchema,
  type WebhookEndpointFormData,
} from "~/lib/validation-schemas";

interface WebhookEndpointFormProps {
  onSuccess?: () => void;
}

export function WebhookEndpointForm({ onSuccess }: WebhookEndpointFormProps) {
  const [isActive, setIsActive] = React.useState(true);

  const form = useForm<WebhookEndpointFormData>({
    resolver: zodResolver(webhookEndpointSchema),
    defaultValues: {
      endpointId: "",
      destUrl: "",
      hmacMode: undefined,
      secret: "",
      description: "",
    },
  });

  const createEndpoint = api.webhook.createEndpoint.useMutation({
    onSuccess: () => {
      toastMessages.webhook.endpoint.created();
      form.reset();
      onSuccess?.();
    },
    onError: (error) => {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      toastMessages.webhook.endpoint.createFailed(errorMessage);
    },
  });

  const handleSubmit = async (data: WebhookEndpointFormData) => {
    await createEndpoint.mutateAsync({
      endpointId: data.endpointId,
      destUrl: data.destUrl,
      hmacMode: data.hmacMode,
      secret: data.secret ?? undefined,
      description: data.description || undefined,
      isActive,
    });
  };

  const isSubmitting = createEndpoint.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
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

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Short description to identify this endpoint"
                  rows={3}
                  {...field}
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormDescription>
                Up to 500 characters. Shown in the endpoints list.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-2">
          <FormLabel>Active</FormLabel>
          <div className="flex items-center justify-between rounded border p-3">
            <div className="text-muted-foreground text-sm">
              When disabled, deliveries will be paused for this endpoint.
            </div>
            <Switch
              checked={isActive}
              onCheckedChange={setIsActive}
              disabled={isSubmitting}
              aria-label="Toggle endpoint active"
            />
          </div>
        </div>

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
                    autoComplete="new-password"
                    {...field}
                    disabled={isSubmitting}
                  />
                </FormControl>
                <FormDescription>
                  The secret key for HMAC signature verification. This will be
                  securely stored and used for webhook validation.
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
          <LoadingButton
            type="submit"
            loading={isSubmitting}
            loadingText="Creating..."
          >
            Create Endpoint
          </LoadingButton>
        </div>
      </form>
    </Form>
  );
}
