import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEMO_BUSINESS, type BusinessData } from "@/lib/business";
import { UploadDialog } from "./upload-dialog";

interface HeaderProps {
  business: BusinessData;
  onLoadBusiness: (b: BusinessData) => void;
  onResetDemo: () => void;
}

export function Header({ business, onLoadBusiness, onResetDemo }: HeaderProps) {
  return (
    <header className="border-b border-border/60 backdrop-blur-sm sticky top-0 z-30 bg-background/70">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 md:px-8">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-md"
            style={{ background: "linear-gradient(135deg, var(--gold), oklch(0.55 0.14 60))" }}
          >
            <Building2 className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <div className="font-display text-lg leading-none">Gemma Boardroom</div>
            <div className="text-muted-foreground text-[11px] uppercase tracking-[0.25em]">AI Executive Team</div>
          </div>
        </div>

        <div className="hidden text-right md:block">
          <div className="text-muted-foreground text-xs uppercase tracking-widest">Currently reviewing</div>
          <div className="text-sm font-medium">{business.companyName}</div>
        </div>

        <div className="flex items-center gap-2">
          <UploadDialog onLoad={onLoadBusiness} />
          {business.companyName !== DEMO_BUSINESS.companyName && (
            <Button variant="ghost" size="sm" onClick={onResetDemo}>
              Reset demo
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
