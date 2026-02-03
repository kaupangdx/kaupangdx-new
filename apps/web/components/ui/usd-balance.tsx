
export interface USDBalanceProps {
  balance?: string;
}

export function USDBalance({ balance }: USDBalanceProps) {
  return <span className="font-mono">{balance ?? "—"}$</span>;
}
