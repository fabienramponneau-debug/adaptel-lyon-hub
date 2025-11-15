// components/StatusBadge.tsx
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "prospect" | "client" | "ancien_client";
  className?: string;
}

export const StatusBadge = ({ status, className }: StatusBadgeProps) => {
  const statusConfig = {
    prospect: {
      label: "Prospect",
      className: "bg-orange-100 text-orange-800 border-orange-200"
    },
    client: {
      label: "Client actif", 
      className: "bg-green-100 text-green-800 border-green-200"
    },
    ancien_client: {
      label: "Ancien client",
      className: "bg-slate-100 text-slate-800 border-slate-200"
    }
  };

  const config = statusConfig[status];

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center px-3 py-1 rounded-md text-sm font-medium border min-w-[100px] text-center",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
};