import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Status = "ready" | "generating" | "failed" | "processed" | "processing";

const map: Record<Status, { label: string; className: string }> = {
  ready: { label: "Ready", className: "bg-success/15 text-success border-success/25" },
  processed: { label: "Processed", className: "bg-success/15 text-success border-success/25" },
  generating: { label: "Generating", className: "bg-warning/15 text-warning border-warning/25" },
  processing: { label: "Processing", className: "bg-warning/15 text-warning border-warning/25" },
  failed: {
    label: "Failed",
    className: "bg-destructive/15 text-destructive border-destructive/25",
  },
};

export function StatusBadge({ status }: { status: Status }) {
  const { label, className } = map[status];
  return (
    <Badge variant="outline" className={cn("font-medium", className)}>
      {label}
    </Badge>
  );
}
