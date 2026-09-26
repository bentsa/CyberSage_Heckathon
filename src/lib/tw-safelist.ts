// Tailwind v4 safelist — these literal class strings exist so the JIT compiler
// generates the utilities used dynamically in templates.
// prettier-ignore
export const TW_SAFELIST = [
  "bg-success/5","bg-warning/5","bg-destructive/5","bg-cyber/5","bg-accent/5","bg-info/5",
  "border-success/30","border-warning/30","border-destructive/30","border-cyber/30","border-accent/30","border-info/30",
  "bg-success","bg-warning","bg-destructive","bg-cyber","bg-accent","bg-info",
  "text-success","text-warning","text-destructive","text-cyber","text-accent","text-info",
  "border-success/40","border-warning/40","border-destructive/40","border-cyber/40","border-accent/40","border-info/40",
  "bg-success/10","bg-warning/10","bg-destructive/10","bg-cyber/10","bg-accent/10","bg-info/10",
  "bg-success/15","bg-warning/15","bg-destructive/15","bg-cyber/15","bg-accent/15","bg-info/15",
].join(" ");
