import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Save, KeyRound } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  userId: string;
  username: string;
  email: string;
}

interface Cred {
  access_token: string;
  ad_account_ids: string[];
  last_synced_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
}

export function MetaCredentialsDialog({ open, onClose, userId, username, email }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [token, setToken] = useState("");
  const [accountsText, setAccountsText] = useState("");
  const [meta, setMeta] = useState<Cred | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from("user_meta_credentials")
      .select("access_token, ad_account_ids, last_synced_at, last_sync_status, last_sync_error")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setMeta(data as Cred);
          setToken(data.access_token || "");
          setAccountsText((data.ad_account_ids || []).join("\n"));
        } else {
          setMeta(null);
          setToken("");
          setAccountsText("");
        }
        setLoading(false);
      });
  }, [open, userId]);

  const save = async () => {
    const ids = accountsText
      .split(/[\n,]/)
      .map((s) => s.trim().replace(/^act_/, ""))
      .filter(Boolean);
    if (!token.trim()) return toast.error("Token obrigatório");
    if (!ids.length) return toast.error("Adicione ao menos uma conta de anúncio");
    setSaving(true);
    const { error } = await supabase
      .from("user_meta_credentials")
      .upsert(
        { user_id: userId, access_token: token.trim(), ad_account_ids: ids },
        { onConflict: "user_id" },
      );
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Credenciais salvas");
    onClose();
  };

  const remove = async () => {
    if (!confirm("Remover credenciais Meta Ads deste usuário?")) return;
    const { error } = await supabase.from("user_meta_credentials").delete().eq("user_id", userId);
    if (error) return toast.error(error.message);
    toast.success("Removido");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-primary" /> Credenciais Meta Ads
          </DialogTitle>
          <DialogDescription>
            {username} <span className="text-muted-foreground">· {email}</span>
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Carregando...</p>
        ) : (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Access Token (System User)</Label>
              <Textarea
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="EAAf3SwOsOIg..."
                className="font-mono text-xs h-24"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Gere em Business Manager → Configurações → Usuários do Sistema → Gerar novo token (permissão <code>ads_read</code>).
              </p>
            </div>
            <div>
              <Label className="text-xs">IDs de contas de anúncio</Label>
              <Textarea
                value={accountsText}
                onChange={(e) => setAccountsText(e.target.value)}
                placeholder={"529395248654046\n1415199993313412"}
                className="font-mono text-xs h-20"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Um ID por linha. Pode usar com ou sem prefixo <code>act_</code>. Cada conta precisa liberar o System User com permissão de leitura.
              </p>
            </div>

            {meta?.last_synced_at && (
              <div className="text-xs bg-secondary/40 rounded-lg p-3 space-y-1">
                <div>
                  Última sincronização: <strong>{new Date(meta.last_synced_at).toLocaleString("pt-BR")}</strong>
                </div>
                <div>
                  Status: <span className={meta.last_sync_status === "ok" ? "text-success" : meta.last_sync_status === "partial" ? "text-warning" : "text-destructive"}>
                    {meta.last_sync_status}
                  </span>
                </div>
                {meta.last_sync_error && (
                  <div className="text-destructive text-[10px] break-all">{meta.last_sync_error}</div>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {meta && (
            <Button variant="ghost" onClick={remove} className="text-destructive hover:text-destructive mr-auto">
              <Trash2 className="w-4 h-4 mr-1" /> Remover
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            <Save className="w-4 h-4 mr-1" /> {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
