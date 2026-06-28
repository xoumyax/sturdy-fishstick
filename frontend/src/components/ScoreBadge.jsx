export function ScoreBadge({ score }) {
  if (score == null) {
    return (
      <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-slate-100 text-slate-400 text-xs font-bold flex-shrink-0">
        –
      </span>
    );
  }

  const s = Math.round(score);
  let bg, color, ring;
  if (s >= 9)      { bg = "#A1CCA6"; color = "#14532d"; ring = "rgba(161,204,166,0.4)"; }
  else if (s >= 7) { bg = "#23CED9"; color = "#fff";    ring = "rgba(35,206,217,0.3)"; }
  else if (s >= 5) { bg = "#F9D779"; color = "#78350f"; ring = "rgba(249,215,121,0.4)"; }
  else             { bg = "#e2e8f0"; color = "#64748b"; ring = "transparent"; }

  return (
    <span
      className="inline-flex items-center justify-center w-9 h-9 rounded-full text-xs font-bold flex-shrink-0"
      style={{ background: bg, color, boxShadow: `0 0 0 3px ${ring}` }}
    >
      {s}
    </span>
  );
}
