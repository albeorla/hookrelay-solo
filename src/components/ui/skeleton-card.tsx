import { Card, CardContent, CardHeader } from "./card";
import { Skeleton } from "./skeleton";

export function SkeletonCard() {
  return (
    <Card>
      <CardHeader className="gap-2">
        <Skeleton className="h-5 w-[150px]" />
        <Skeleton className="h-4 w-[250px]" />
      </CardHeader>
      <CardContent>
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-4 w-full max-w-full" />
          <Skeleton className="h-4 w-[80%]" />
        </div>
      </CardContent>
    </Card>
  );
}

export function SkeletonStatCard() {
  return (
    <Card variant="stats">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-[100px]" />
        <div className="relative">
          <Skeleton className="h-6 w-6 rounded-lg" />
          <div className="from-primary/20 to-primary/10 absolute inset-0 animate-pulse rounded-lg bg-gradient-to-br" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Skeleton className="h-8 w-[60px]" />
          <Skeleton className="h-3 w-[120px]" />
        </div>
      </CardContent>
    </Card>
  );
}

export function SkeletonUserCard() {
  return (
    <Card className="min-h-[260px]">
      <CardHeader className="gap-0">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="from-primary/20 absolute inset-0 animate-pulse rounded-full bg-gradient-to-br to-transparent" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-5 w-[150px]" />
              <Skeleton className="h-4 w-[200px]" />
            </div>
          </div>
          <div>
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        <div>
          <div className="mb-2 h-5 w-[140px]">
            <Skeleton className="h-5 w-[140px]" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        </div>
        <div>
          <div className="mb-2 h-5 w-[180px]">
            <Skeleton className="h-5 w-[180px]" />
          </div>
          <Skeleton className="h-4 w-[120px]" />
        </div>
      </CardContent>
    </Card>
  );
}

// Enhanced skeleton for loading text with shimmer effect
export function SkeletonText({ className }: { className?: string }) {
  return (
    <div
      className={`from-muted via-muted/50 to-muted animate-[shimmer_2s_infinite] animate-pulse rounded bg-gradient-to-r bg-[length:200%_100%] ${className}`}
    />
  );
}
