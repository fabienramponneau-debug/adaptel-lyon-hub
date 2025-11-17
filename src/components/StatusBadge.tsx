import { cn } from "@/lib/utils";

interface Props { status: "prospect"|"client"|"ancien_client"; className?: string; size?: "sm"|"md"; }
export const StatusBadge = ({ status, className, size="md" }: Props) => {
  const base = "inline-flex items-center justify-center border font-medium text-center select-none";
  const dim  = size==="sm" ? "h-7 min-w-[96px] px-3 text-[13px] rounded-md" : "h-8 min-w-[112px] px-3.5 text-sm rounded-md";
  const map = {
    prospect: { label:"Prospect",       cls:"bg-amber-50 text-amber-800 border-amber-200" },
    client:   { label:"Client actif",   cls:"bg-emerald-50 text-emerald-800 border-emerald-200" },
    ancien_client:{ label:"Ancien client", cls:"bg-slate-50 text-slate-800 border-slate-200" },
  } as const;
  const cfg = map[status];
  return <span className={cn(base, dim, cfg.cls, className)}>{cfg.label}</span>;
};
