import { cn } from "~/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "bg-accent max-w-full min-w-0 animate-pulse overflow-hidden rounded-md",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
