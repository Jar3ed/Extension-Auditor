import type { ExtensionSnapshot } from "../../shared/types";

const TIER_STYLES: Record<ExtensionSnapshot["riskTier"], string> = {
  low: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  critical: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

const TIER_LABEL: Record<ExtensionSnapshot["riskTier"], string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export function RiskBadge({ tier }: { tier: ExtensionSnapshot["riskTier"] }) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${TIER_STYLES[tier]}`}
    >
      {TIER_LABEL[tier]}
    </span>
  );
}
