import { useState } from "react";
import { Download, FileUp, Sparkles, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { parseBusinessZipWithMetadata, downloadTemplateZip, type ZipParseResult } from "@/lib/business-import";
import type { BusinessData } from "@/lib/business";

interface UploadDialogProps {
  onLoad: (b: BusinessData) => void;
}

export function UploadDialog({ onLoad }: UploadDialogProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<ZipParseResult["detectedFiles"] | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10_000_000) {
      toast.error("ZIP file too large (max 10MB).");
      return;
    }
    setBusy(true);
    try {
      const result = await parseBusinessZipWithMetadata(f);
      setLastAnalysis(result.detectedFiles);
      onLoad(result.data);
      
      const fileSummary = result.detectedFiles.map((df) => `${df.filename} (${df.category})`).join(", ");
      toast.success(
        `Successfully loaded ${result.data.companyName}! Auto-detected ${result.detectedFiles.length} file(s): ${fileSummary}`,
        { duration: 5000 }
      );
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid ZIP file");
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
          <div className="flex items-center gap-2 mb-1">
            <DialogTitle className="font-display text-xl">Upload your company data</DialogTitle>
            <Badge variant="outline" className="text-gold border-gold/40 gap-1 text-[11px]">
              <Sparkles className="h-3 w-3" /> Smart Auto-Detection
            </Badge>
          </div>
          <DialogDescription>
            Upload any ZIP archive containing your company's CSV or tabular data. Gemma automatically inspects your files, detects data types, maps column names, and re-briefs the executive board.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-muted-foreground mb-1 block text-xs uppercase tracking-widest">
              ZIP Archive (Any CSV layout or filenames)
            </label>
            <Input
              type="file"
              accept=".zip,application/zip,application/x-zip-compressed"
              onChange={onFile}
              disabled={busy}
            />
            <div className="text-muted-foreground mt-1 text-xs">{busy ? "Analyzing & classifying CSVs…" : "Max 10MB."}</div>
          </div>

          <div className="rounded-md border border-border/60 bg-card/50 p-4 text-xs space-y-3">
            <div className="text-foreground font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-gold" /> Universal CSV & Column Auto-Recognition
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              No specific filenames required. You can include sales spreadsheets, vendor directories, invoice aging reports, or key-value metric sheets. Column names like <code className="text-gold">Sales</code>, <code className="text-gold">Revenue</code>, <code className="text-gold">Vendor</code>, <code className="text-gold">Supplier</code>, <code className="text-gold">Client</code>, or <code className="text-gold">Overdue</code> are detected automatically.
            </p>
            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
              <div className="rounded border border-border/40 bg-background/50 p-2">
                <span className="text-foreground font-medium block">Financial & Performance</span>
                <span className="text-muted-foreground">Monthly revenue, fixed costs, cash, margins, elasticity</span>
              </div>
              <div className="rounded border border-border/40 bg-background/50 p-2">
                <span className="text-foreground font-medium block">Operations & Sourcing</span>
                <span className="text-muted-foreground">Supplier reliability, cost indices, overdue AR invoices</span>
              </div>
            </div>
          </div>

          {lastAnalysis && (
            <div className="rounded-md border border-gold/30 bg-gold/5 p-3 text-xs">
              <div className="text-gold font-medium mb-1">Last Upload Auto-Detection Result:</div>
              <ul className="space-y-1 text-muted-foreground">
                {lastAnalysis.map((df, i) => (
                  <li key={i} className="flex justify-between">
                    <span>{df.filename}</span>
                    <span className="text-foreground font-medium">{df.category} ({df.recordCount} rows)</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-between items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => downloadTemplateZip()}>
            <Download className="mr-2 h-4 w-4" /> Download sample ZIP template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
