/** Money + date helpers used across the app */
export const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

export const fmtWhen = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const time = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase();
  const key = (x: Date) => x.getFullYear() * 10000 + x.getMonth() * 100 + x.getDate();
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (key(d) === key(now)) return `Today, ${time}`;
  if (key(d) === key(yest)) return `Yesterday, ${time}`;
  return `${d.getDate()} ${d.toLocaleString("en-IN", { month: "short" })}, ${time}`;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const mapServerTxn = (t: any) => ({
  id: t.id, mode: t.source, n: t.counterparty, cat: t.category, cr: t.type === "credit",
  amt: t.amount, d: fmtWhen(t.createdAt), bank: t.bank, ref: t.ref,
});
