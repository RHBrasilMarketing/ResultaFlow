import { useCallback, useState } from "react";
import { Upload, FileText, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CampaignData } from "@/types/campaign";
import { parseMetaCsv } from "@/lib/csv-parser";
import { cn } from "@/lib/utils";

interface CsvUploadProps {
  onDataLoaded: (data: CampaignData[]) => void;
}

interface LoadedFile {
  fileName: string;
  account: string;
  rowCount: number;
  data: CampaignData[];
}

export function CsvUpload({ onDataLoaded }: CsvUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState<LoadedFile[]>([]);

  const processFiles = useCallback((fileList: File[]) => {
    const csvFiles = fileList.filter((f) => f.name.endsWith(".csv") || f.type === "text/csv");
    if (csvFiles.length === 0) return;

    Promise.all(
      csvFiles.map(
        (file) =>
          new Promise<LoadedFile>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              const text = e.target?.result as string;
              // Use file name (without .csv) as default account name
              const account = file.name.replace(/\.csv$/i, "").trim() || "Conta";
              const data = parseMetaCsv(text, account);
              resolve({ fileName: file.name, account, rowCount: data.length, data });
            };
            reader.readAsText(file, "utf-8");
          })
      )
    ).then((loaded) => {
      setFiles((prev) => [...prev, ...loaded]);
    });
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      processFiles(Array.from(e.dataTransfer.files));
    },
    [processFiles]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const list = e.target.files ? Array.from(e.target.files) : [];
      processFiles(list);
      e.target.value = "";
    },
    [processFiles]
  );

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const renameAccount = (idx: number, newName: string) => {
    setFiles((prev) =>
      prev.map((f, i) => {
        if (i !== idx) return f;
        const renamed = { ...f, account: newName, data: f.data.map((c) => ({ ...c, account: newName, id: c.id.replace(f.account, newName) })) };
        return renamed;
      })
    );
  };

  const analyze = () => {
    const all = files.flatMap((f) => f.data);
    onDataLoaded(all);
  };

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "glass-card p-8 border-2 border-dashed transition-all cursor-pointer",
          dragOver ? "border-primary bg-primary/5" : "border-border/50 hover:border-primary/50"
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById("csv-input")?.click()}
      >
        <input id="csv-input" type="file" accept=".csv" multiple className="hidden" onChange={handleFileSelect} />
        <div className="flex flex-col items-center gap-3 text-center">
          {files.length > 0 ? (
            <>
              <Plus className="w-8 h-8 text-primary" />
              <div>
                <p className="font-medium text-sm">Adicionar mais CSVs</p>
                <p className="text-xs text-muted-foreground">Você pode comparar várias contas de anúncio</p>
              </div>
            </>
          ) : (
            <>
              <Upload className="w-10 h-10 text-muted-foreground" />
              <div>
                <p className="font-medium">Arraste um ou mais CSVs do Meta Ads aqui</p>
                <p className="text-sm text-muted-foreground">Cada arquivo será tratado como uma conta de anúncio</p>
              </div>
            </>
          )}
        </div>
      </div>

      {files.length > 0 && (
        <div className="glass-card p-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Contas carregadas ({files.length})
          </p>
          {files.map((f, idx) => (
            <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/40">
              <FileText className="w-4 h-4 text-primary shrink-0" />
              <Input
                value={f.account}
                onChange={(e) => renameAccount(idx, e.target.value)}
                className="h-8 text-sm flex-1 bg-background"
                placeholder="Nome da conta"
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">{f.rowCount} linhas</span>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => removeFile(idx)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
          <Button onClick={analyze} className="w-full mt-2 bg-primary hover:bg-primary/90">
            Analisar {files.reduce((s, f) => s + f.rowCount, 0)} conjuntos de {files.length} {files.length === 1 ? "conta" : "contas"}
          </Button>
        </div>
      )}
    </div>
  );
}
