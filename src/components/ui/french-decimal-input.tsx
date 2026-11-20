import * as React from "react";
import { Input } from "@/components/ui/input";

type BaseInputProps = Omit<React.ComponentProps<typeof Input>, "type" | "value" | "onChange">;

interface FrenchDecimalInputProps extends BaseInputProps {
  value: number;
  onValueChange: (value: number) => void;
  decimals?: number;
  allowNegative?: boolean;
}

const formatFrenchNumber = (value: number, decimals: number) =>
  Number.isFinite(value)
    ? value.toLocaleString("fr-FR", {
        useGrouping: false,
        minimumFractionDigits: 0,
        maximumFractionDigits: decimals,
      })
    : "0";

const numericBound = (value: string | number | undefined) => {
  if (value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export function FrenchDecimalInput({
  value,
  onValueChange,
  decimals = 2,
  allowNegative = false,
  min,
  max,
  onFocus,
  onBlur,
  onKeyDown,
  ...props
}: FrenchDecimalInputProps) {
  const [draft, setDraft] = React.useState(() => formatFrenchNumber(value, decimals));
  const [focused, setFocused] = React.useState(false);

  React.useEffect(() => {
    if (!focused) setDraft(formatFrenchNumber(value, decimals));
  }, [value, decimals, focused]);

  const commit = React.useCallback(
    (rawValue: string) => {
      const normalized = rawValue.trim().replace(/\s/g, "").replace(",", ".");
      let parsed = Number(normalized);
      if (!normalized || normalized === "-" || !Number.isFinite(parsed)) parsed = 0;
      const minimum = numericBound(min);
      const maximum = numericBound(max);
      if (!allowNegative) parsed = Math.max(0, parsed);
      if (minimum !== undefined) parsed = Math.max(minimum, parsed);
      if (maximum !== undefined) parsed = Math.min(maximum, parsed);
      const rounded = Number(parsed.toFixed(decimals));
      onValueChange(rounded);
      setDraft(formatFrenchNumber(rounded, decimals));
    },
    [allowNegative, decimals, max, min, onValueChange]
  );

  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      min={min}
      max={max}
      value={draft}
      onFocus={(event) => {
        setFocused(true);
        event.currentTarget.select();
        onFocus?.(event);
      }}
      onChange={(event) => {
        const next = event.target.value.replace(/\s/g, "");
        const pattern = allowNegative ? /^-?\d*(?:[,.]\d*)?$/ : /^\d*(?:[,.]\d*)?$/;
        if (!pattern.test(next)) return;
        setDraft(next);
        if (next && !/[,.]$/.test(next) && next !== "-") {
          const parsed = Number(next.replace(",", "."));
          if (Number.isFinite(parsed)) onValueChange(parsed);
        }
      }}
      onBlur={(event) => {
        setFocused(false);
        commit(event.currentTarget.value);
        onBlur?.(event);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        onKeyDown?.(event);
      }}
    />
  );
}
