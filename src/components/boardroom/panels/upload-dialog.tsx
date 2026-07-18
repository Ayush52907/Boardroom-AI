import { useState } from "react";
import { Download, FileUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { parseBusinessZip, downloadTemplateZip } from "@/lib/business-import";
import type { BusinessData } from "@/lib/business";

interface UploadDialogProps {
  onLoad: (b: BusinessData) => void;
}

export function UploadDialog({ onLoad }: UploadDialogProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5_000_000) {
      toast.error("ZIP file too large (max 5MB).");
      return;
    }
    setBusy(true);
    try {
      const b = await parseBusinessZip(f);
      onLoad(b);
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid ZIP");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileUp className="mr-2 h-4 w-4" /> Upload company (.zip)
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Upload your company data</DialogTitle>
          <DialogDescription>
            Upload a ZIP archive containing your company's CSV files. The board will re-brief on your
            business.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-muted-foreground mb-1 block text-xs uppercase tracking-widest">
              ZIP file
            </label>
            <Input
              type="file"
              accept=".zip,application/zip,application/x-zip-compressed"
              onChange={onFile}
              disabled={busy}
            />
            <div className="text-muted-foreground mt-1 text-xs">{busy ? "Parsing…" : "Max 5MB."}</div>
          </div>

          <div className="rounded-md border border-border/60 bg-card/50 p-3 text-xs">
            <div className="text-foreground mb-1.5 font-medium">Expected files inside the ZIP</div>
            <ul className="text-muted-foreground space-y-1">
              <li>
                <code className="text-gold">company.csv</code> —{" "}
                <span>
                  key,value pairs (companyName, industry, currency, monthlyRevenue, cogsRatio,
                  fixedCosts, cashReserves, outstandingInvoices, inventoryValue, avgOrderValue,
                  monthlyOrders, priceElasticity)
                </span>
              </li>
              <li>
                <code className="text-gold">revenue_trend.csv</code> —{" "}
                <span>month,revenue (last 6 months, oldest first)</span>
              </li>
              <li>
                <code className="text-gold">suppliers.csv</code> —{" "}
                <span>name,reliability,costIndex</span>
              </li>
              <li>
                <code className="text-gold">overdue_invoices.csv</code> —{" "}
                <span>customer,amount,daysOverdue</span>
              </li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => downloadTemplateZip()}>
            <Download className="mr-2 h-4 w-4" /> Download template ZIP
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
