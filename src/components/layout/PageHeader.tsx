import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}
export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && (
          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground sm:text-sm">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex w-full flex-wrap gap-2 sm:w-auto">{actions}</div>}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "warning" | "destructive" | "success";
  valueClassName?: string;
}
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  valueClassName,
}: StatCardProps) {
  const toneCls =
    tone === "warning"
      ? "text-warning"
      : tone === "destructive"
      ? "text-destructive"
      : tone === "success"
      ? "text-success"
      : "text-foreground";
  return (
    <div className="rounded-lg border bg-card p-3 shadow-[var(--shadow-soft)] transition hover:shadow-[var(--shadow-card)] sm:rounded-xl sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="line-clamp-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">
            {label}
          </div>
          <div
            className={cn(
              "mt-1 break-words text-xl font-bold leading-tight sm:mt-2 sm:text-2xl",
              toneCls,
              valueClassName,
            )}
          >
            {value}
          </div>
          {hint && <div className="mt-1 line-clamp-1 text-xs text-muted-foreground">{hint}</div>}
        </div>
        {Icon && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted sm:h-10 sm:w-10">
            <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${toneCls}`} />
          </div>
        )}
      </div>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="px-4 py-10 text-center sm:py-16">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted sm:mb-4 sm:h-14 sm:w-14">
        <Icon className="h-6 w-6 text-muted-foreground sm:h-7 sm:w-7" />
      </div>
      <h3 className="font-semibold">{title}</h3>
      {description && (
        <p className="mx-auto mt-1 line-clamp-2 max-w-sm text-xs text-muted-foreground sm:text-sm">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
