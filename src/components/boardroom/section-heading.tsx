/**
 * Shared section heading used by every major panel on the dashboard.
 * Eyebrow label, display-font title, subtitle, and a gold divider.
 */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-5">
      <div className="text-gold text-xs uppercase tracking-[0.35em]">{eyebrow}</div>
      <h2 className="font-display mt-1 text-3xl md:text-4xl">{title}</h2>
      <div className="text-muted-foreground mt-1 text-sm">{subtitle}</div>
      <div className="gold-divider mt-4 w-24" />
    </div>
  );
}
