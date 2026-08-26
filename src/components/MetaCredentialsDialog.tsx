import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Save, KeyRound, CheckCircle2 } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  userId?: string | null;
  username?: string;
  email?: string;
  onSaved?: () => void;
}

interface Cred {
  access_token: string;
  ad_account_ids: string[];
  last_synced_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
}

export function MetaCredentialsDialog({ open, onClose, userId, username, email, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [token, setToken] = useState("");
  const [accountsText, setAccountsText] = useState("");
  const [meta, setMeta] = useState<Cred | null>(null);

  const effectiveUserId = userId || "local-user";

  useEffect(() => {
    if (!open) return;
    setLoading(true);

    // 1. Tenta carregar do localStorage primeiro
    const local = localStorage.getItem("meta_ads_credentials");
    if (local) {
      try {
        const parsed = JSON.parse(local);
        if (parsed.access_token) setToken(parsed.access_token);
        if (Array.isArray(parsed.ad_account_ids)) {
          setAccountsText(parsed.ad_account_ids.join("\n"));
        } else if (parsed.ad_account_id) {
          setAccountsText(parsed.ad_account_id);
        }
      } catch {}
    }

    // 2. Tenta carregar do Supabase se houver usuário
    if (userId && userId !== "local-user") {
      supabase
        .from("user_meta_credentials")
        .select("access_token, ad_account_ids, last_synced_at, last_sync_status, last_sync_error")
        .eq("user_id", userId)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setMeta(data as Cred);
            if (data.access_token) setToken(data.access_token);
            if (data.ad_account_ids?.length) {
              setAccountsText(data.ad_account_ids.join("\n"));
            }
          }
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [open, userId]);

  const save = async () => {
    const ids = accountsText
      .split(/[\n,]/)
      .map((s) => s.trim().replace(/^act_/, ""))
      .filter(Boolean);

    if (!token.trim()) return toast.error("Token de acesso da Meta é obrigatório");
    if (!ids.length) return toast.error("Adicione pelo menos um ID de conta de anúncio");

    setSaving(true);
    try {
      // Salva no LocalStorage para garantir funcionamento imediato
      localStorage.setItem(
        "meta_ads_credentials",
        JSON.stringify({
          access_token: token.trim(),
          ad_account_ids: ids,
          ad_account_id: ids[0],
        })
      );

      // Salva no Supabase se possível
      if (userId && userId !== "local-user") {
        await supabase
          .from("user_meta_credentials")
          .upsert(
            { user_id: userId, access_token: token.trim(), ad_account_ids: ids },
            { onConflict: "user_id" }
          )
          .catch(() => {});
      }

      toast.success("Credenciais da Meta salvas com sucesso!");
      onSaved?.();
      onClose();
    } catch (e: any) {
      toast.error("Erro ao salvar: " + (e?.message || "Falha inesperada"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm("Remover credenciais salvas da Meta Ads?")) return;
    localStorage.removeItem("meta_ads_credentials");
    if (userId && userId !== "local-user") {
      await supabase.from("user_meta_credentials").delete().eq("user_id", userId).catch(() => {});
    }
    setToken("");
    setAccountsText("");
    setMeta(null);
    toast.success("Credenciais removidas");
    onSaved?.();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" /> Credenciais da Meta Ads
          </DialogTitle>
          <DialogDescription>
            {username ? `${username} · ` : ""}{email || "Conexão oficial Graph API"}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Carregando...</p>
        ) : (
          <div className="space-y-4">
            <div>
              <Label className="text-xs font-semibold">Meta Access Token (Token de Acesso)</Label>
              <Textarea
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="EAAf3SwOsOIgBA..."
                className="font-mono text-xs h-24 mt-1 bg-secondary/30"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Obtido em <strong>Meta for Developers → Graph API Explorer</strong> ou Usuário do Sistema com permissão <code>ads_read</code>.
              </p>
            </div>
            <div>
              <Label className="text-xs font-semibold">IDs das Contas de Anúncio (um por linha)</Label>
              <Textarea
                value={accountsText}
                onChange={(e) => setAccountsText(e.target.value)}
                placeholder={"529395248654046\n1415199993313412"}
                className="font-mono text-xs h-20 mt-1 bg-secondary/30"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Pode colar com ou sem o prefixo <code>act_</code> (ex: <code>123456789</code> ou <code>act_123456789</code>).
              </p>
            </div>

            {token && (
              <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 p-2.5 rounded-lg border border-emerald-500/20">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Credenciais prontas para sincronização direta na nuvem e navegador.</span>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {(meta || token) && (
            <Button variant="ghost" onClick={remove} className="text-destructive hover:text-destructive mr-auto">
              <Trash2 className="w-4 h-4 mr-1" /> Remover
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            <Save className="w-4 h-4 mr-1" /> {saving ? "Salvando..." : "Salvar Credenciais"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
