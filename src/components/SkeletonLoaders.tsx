import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

export function BatchListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-3">
            <Skeleton className="h-3.5 w-3/4 mb-2" />
            <Skeleton className="h-2.5 w-1/2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ContactListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-3 flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-3.5 w-1/3 mb-1.5" />
              <Skeleton className="h-2.5 w-1/4" />
            </div>
            <Skeleton className="h-5 w-12 rounded-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function StatCardsSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-2 mb-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-3 flex flex-col items-center gap-2">
            <Skeleton className="w-8 h-8 rounded-full" />
            <Skeleton className="h-5 w-10" />
            <Skeleton className="h-2.5 w-14" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function TemplateListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-3">
            <Skeleton className="h-3.5 w-1/3 mb-2" />
            <Skeleton className="h-2.5 w-full mb-1" />
            <Skeleton className="h-2.5 w-2/3" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
