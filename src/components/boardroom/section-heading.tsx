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
    <div className="mb-6">
      <div className="text-muted-foreground text-xs tracking-normal lowercase">{eyebrow}</div>
      <h2 className="font-display mt-1 text-2xl md:text-3xl font-semibold tracking-tight text-black lowercase">
        {title}
      </h2>
      <div className="text-muted-foreground mt-1.5 text-sm lowercase">{subtitle}</div>
      <div className="border-t border-black/8 mt-4 w-full" />
    </div>
  );
}
