import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Status = "prospect" | "client" | "ancien_client";

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

const statusConfig: Record<Status, { label: string; color: string }> = {
  prospect: { label: "Prospect", color: "bg-prospect text-prospect-foreground" },
  client: { label: "Client", color: "bg-client text-client-foreground" },
  ancien_client: { label: "Ancien client", color: "bg-ancien-client text-ancien-client-foreground" },
};

export const StatusBadge = ({ status, className }: StatusBadgeProps) => {
  const config = statusConfig[status];

  return (
    <Badge className={cn(config.color, "font-medium", className)}>
      {config.label}
    </Badge>
  );
};
