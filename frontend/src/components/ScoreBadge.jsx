export function ScoreBadge({ score }) {
  if (score == null) return <span className="text-xs text-slate-400 px-2 py-0.5 rounded-full bg-slate-100">–</span>;

  const s = Math.round(score);
  let cls = "text-xs font-bold px-2 py-0.5 rounded-full ";
  if (s >= 9) cls += "bg-emerald-100 text-emerald-800";
  else if (s >= 7) cls += "bg-green-100 text-green-700";
  else if (s >= 5) cls += "bg-yellow-100 text-yellow-700";
  else cls += "bg-slate-100 text-slate-500";

  return <span className={cls}>{s}/10</span>;
}
