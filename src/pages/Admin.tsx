import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ShieldCheck, Users, Building2, Plus, Trash2, Save, KeyRound, Wallet, Link2, Lock } from "lucide-react";
import { toast } from "sonner";
import { MetaCredentialsDialog } from "@/components/MetaCredentialsDialog";

interface ProfileWithRole {
  id: string;
  username: string;
  company: string;
  email: string;
  created_at: string;
  role: "admin" | "user";
}

interface CompanySetting {
  id: string;
  company_name: string;
  ideal_cpr: number;
  acceptable_cpr: number;
  warning_cpr: number;
  ideal_cpm: number;
  ideal_frequency: number;
  monthly_budget: number;
  notes: string | null;
}

const emptyCompany = {
  company_name: "",
  ideal_cpr: 2,
  acceptable_cpr: 5,
  warning_cpr: 10,
  ideal_cpm: 15,
  ideal_frequency: 2,
  monthly_budget: 0,
  notes: "",
};

export default function Admin() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [profiles, setProfiles] = useState<ProfileWithRole[]>([]);
  const [companies, setCompanies] = useState<CompanySetting[]>([]);
  const [tab, setTab] = useState<"users" | "companies">("users");
  const [newCompany, setNewCompany] = useState({ ...emptyCompany });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<CompanySetting | null>(null);
  const [credUser, setCredUser] = useState<ProfileWithRole | null>(null);
  const [totalBudget, setTotalBudget] = useState<number>(0);
  const [budgetId, setBudgetId] = useState<string | null>(null);
  const [savingBudget, setSavingBudget] = useState(false);
  const [busyUser, setBusyUser] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) { setIsAdmin(false); return; }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", sess.session.user.id);
      const admin = roles?.some((r) => r.role === "admin") ?? false;
      setIsAdmin(admin);
      if (!admin) { setLoading(false); return; }

      await Promise.all([loadProfiles(), loadCompanies(), loadAccountBudget()]);
      setLoading(false);
    })();
  }, []);

  async function loadProfiles() {
    const { data: profs, error } = await supabase
      .from("profiles")
      .select("id, username, company, email, created_at")
      .order("created_at", { ascending: false });
    if (error) { toast.error("Erro ao carregar usuários"); return; }

    const ids = profs?.map((p) => p.id) ?? [];
    const { data: allRoles } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", ids);

    const roleMap = new Map<string, "admin" | "user">();
    allRoles?.forEach((r) => {
      if (r.role === "admin" || roleMap.get(r.user_id) !== "admin") {
        roleMap.set(r.user_id, r.role as "admin" | "user");
      }
    });

    setProfiles((profs ?? []).map((p) => ({ ...p, role: roleMap.get(p.id) ?? "user" })));
  }

  async function loadCompanies() {
    const { data, error } = await supabase
      .from("company_settings")
      .select("*")
      .order("company_name");
    if (error) { toast.error("Erro ao carregar empresas"); return; }
    setCompanies((data as CompanySetting[]) ?? []);
  }

  async function loadAccountBudget() {
    const { data } = await supabase.from("account_settings").select("id, total_budget").maybeSingle();
    if (data) { setBudgetId(data.id); setTotalBudget(Number(data.total_budget)); }
  }

  async function saveAccountBudget() {
    setSavingBudget(true);
    const { error } = budgetId
      ? await supabase.from("account_settings").update({ total_budget: totalBudget, updated_at: new Date().toISOString() }).eq("id", budgetId)
      : await supabase.from("account_settings").insert({ total_budget: totalBudget }).select("id").single()
          .then(async (r) => { if (r.data) setBudgetId(r.data.id); return { error: r.error }; });
    setSavingBudget(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Orçamento total salvo");
  }

  async function callAdmin(action: string, payload: Record<string, unknown>) {
    const { data, error } = await supabase.functions.invoke("admin-users", { body: { action, ...payload } });
    if (error) {
      const msg = (error as any).context ? await (error as any).context.text() : error.message;
      throw new Error(msg);
    }
    if ((data as any)?.error) throw new Error((data as any).error);
    return data as any;
  }

  async function handleDeleteUser(p: ProfileWithRole) {
    if (!confirm(`Excluir definitivamente o usuário ${p.email}?`)) return;
    setBusyUser(p.id);
    try {
      await callAdmin("delete", { userId: p.id });
      toast.success("Usuário excluído");
      await loadProfiles();
    } catch (e) { toast.error((e as Error).message); } finally { setBusyUser(null); }
  }

  async function handleSetPassword(p: ProfileWithRole) {
    const pwd = prompt(`Definir nova senha para ${p.email} (mín. 6 caracteres):`);
    if (!pwd) return;
    setBusyUser(p.id);
    try {
      await callAdmin("set_password", { userId: p.id, password: pwd });
      toast.success("Senha redefinida — informe-a ao usuário");
    } catch (e) { toast.error((e as Error).message); } finally { setBusyUser(null); }
  }

  async function handleResetLink(p: ProfileWithRole) {
    setBusyUser(p.id);
    try {
      const res = await callAdmin("reset_link", { userId: p.id });
      await navigator.clipboard.writeText(res.link ?? "");
      toast.success("Link de recuperação copiado");
    } catch (e) { toast.error((e as Error).message); } finally { setBusyUser(null); }
  }

  async function handleToggleRole(p: ProfileWithRole) {
    const next = p.role === "admin" ? "user" : "admin";
    if (!confirm(`Alterar papel de ${p.email} para ${next.toUpperCase()}?`)) return;
    setBusyUser(p.id);
    try {
      await callAdmin("set_role", { userId: p.id, role: next });
      toast.success("Papel atualizado");
      await loadProfiles();
    } catch (e) { toast.error((e as Error).message); } finally { setBusyUser(null); }
  }

  async function handleAddCompany() {
    if (!newCompany.company_name.trim()) {
      toast.error("Informe o nome da empresa");
      return;
    }
    const { error } = await supabase
      .from("company_settings")
      .insert({ ...newCompany, company_name: newCompany.company_name.trim().toUpperCase() });
    if (error) { toast.error(error.message); return; }
    toast.success("Empresa cadastrada");
    setNewCompany({ ...emptyCompany });
    loadCompanies();
  }

  async function handleSaveEdit() {
    if (!editDraft) return;
    const { id, ...payload } = editDraft;
    const { error } = await supabase.from("company_settings").update(payload).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Atualizado");
    setEditingId(null);
    setEditDraft(null);
    loadCompanies();
  }

  async function handleDelete(id: string) {
    if (!confirm("Remover esta empresa dos parâmetros?")) return;
    const { error } = await supabase.from("company_settings").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Removida");
    loadCompanies();
  }

  if (isAdmin === false) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 backdrop-blur-lg bg-background/80 sticky top-0 z-50">
        <div className="container max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Button></Link>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <h1 className="text-lg font-display font-bold">Painel Administrador</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl mx-auto px-4 py-8 space-y-4">
        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 bg-secondary/50 rounded-xl w-fit">
          <button
            onClick={() => setTab("users")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${tab === "users" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Users className="w-4 h-4 inline mr-1.5" /> Usuários
          </button>
          <button
            onClick={() => setTab("companies")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${tab === "companies" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Building2 className="w-4 h-4 inline mr-1.5" /> Empresas ({companies.length})
          </button>
        </div>

        {tab === "users" && (
          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-muted-foreground" />
              <h2 className="font-display font-semibold text-lg">Usuários cadastrados ({profiles.length})</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Por segurança, as senhas são criptografadas e não podem ser visualizadas. Use "Nova senha" para definir uma e informá-la ao usuário, ou gere um link de recuperação.
            </p>

            {loading ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p>
            ) : profiles.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhum usuário cadastrado</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Usuário</th>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Empresa</th>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Email</th>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Papel</th>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Cadastro</th>
                      <th className="text-right p-3 text-xs font-medium text-muted-foreground uppercase">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profiles.map((p) => (
                      <tr key={p.id} className="border-b border-border/30 hover:bg-secondary/30">
                        <td className="p-3 font-medium">{p.username}</td>
                        <td className="p-3">{p.company}</td>
                        <td className="p-3 text-muted-foreground">{p.email}</td>
                        <td className="p-3">
                          <button
                            onClick={() => handleToggleRole(p)}
                            disabled={busyUser === p.id}
                            className={`px-2 py-0.5 text-[10px] font-bold rounded transition-opacity hover:opacity-80 ${p.role === "admin" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}
                            title="Clique para alternar o papel"
                          >
                            {p.role === "admin" ? "ADMIN" : "USUÁRIO"}
                          </button>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString("pt-BR")}</td>
                        <td className="p-3">
                          <div className="flex gap-1 justify-end flex-wrap">
                            <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={busyUser === p.id} onClick={() => setCredUser(p)}>
                              <KeyRound className="w-3.5 h-3.5 mr-1" /> Token
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={busyUser === p.id} onClick={() => handleSetPassword(p)}>
                              <Lock className="w-3.5 h-3.5 mr-1" /> Nova senha
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={busyUser === p.id} onClick={() => handleResetLink(p)}>
                              <Link2 className="w-3.5 h-3.5 mr-1" /> Link
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-destructive hover:text-destructive" disabled={busyUser === p.id} onClick={() => handleDeleteUser(p)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {credUser && (
          <MetaCredentialsDialog
            open={!!credUser}
            onClose={() => setCredUser(null)}
            userId={credUser.id}
            username={credUser.username}
            email={credUser.email}
          />
        )}

        {tab === "companies" && (
          <div className="space-y-4">
            {/* Orçamento total da conta */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-2 mb-3">
                <Wallet className="w-5 h-5 text-primary" />
                <h2 className="font-display font-semibold text-lg">Orçamento total da conta</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Usado nos avisos da Visão Geral para acompanhar o percentual consumido do orçamento global.
              </p>
              <div className="flex items-end gap-3 max-w-md">
                <div className="flex-1">
                  <Label className="text-xs">Orçamento total (R$)</Label>
                  <Input type="number" step="0.01" value={totalBudget} onChange={(e) => setTotalBudget(Number(e.target.value))} />
                </div>
                <Button onClick={saveAccountBudget} disabled={savingBudget}><Save className="w-4 h-4 mr-1" /> Salvar</Button>
              </div>
            </div>

            {/* Form */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Plus className="w-5 h-5 text-primary" />
                <h2 className="font-display font-semibold text-lg">Cadastrar nova empresa</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Os parâmetros aqui definem as faixas de cor personalizadas e o orçamento mensal de cada empresa no dashboard.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="md:col-span-2">
                  <Label className="text-xs">Nome da empresa</Label>
                  <Input value={newCompany.company_name} onChange={(e) => setNewCompany({ ...newCompany, company_name: e.target.value })} placeholder="WHIRLPOOL" />
                </div>
                <div>
                  <Label className="text-xs">Orçamento (R$)</Label>
                  <Input type="number" step="0.01" value={newCompany.monthly_budget} onChange={(e) => setNewCompany({ ...newCompany, monthly_budget: Number(e.target.value) })} />
                </div>
                <div>
                  <Label className="text-xs">CPR ideal (R$)</Label>
                  <Input type="number" step="0.01" value={newCompany.ideal_cpr} onChange={(e) => setNewCompany({ ...newCompany, ideal_cpr: Number(e.target.value) })} />
                </div>
                <div>
                  <Label className="text-xs">CPR aceitável</Label>
                  <Input type="number" step="0.01" value={newCompany.acceptable_cpr} onChange={(e) => setNewCompany({ ...newCompany, acceptable_cpr: Number(e.target.value) })} />
                </div>
                <div>
                  <Label className="text-xs">CPR atenção</Label>
                  <Input type="number" step="0.01" value={newCompany.warning_cpr} onChange={(e) => setNewCompany({ ...newCompany, warning_cpr: Number(e.target.value) })} />
                </div>
                <div>
                  <Label className="text-xs">CPM ideal</Label>
                  <Input type="number" step="0.01" value={newCompany.ideal_cpm} onChange={(e) => setNewCompany({ ...newCompany, ideal_cpm: Number(e.target.value) })} />
                </div>
                <div>
                  <Label className="text-xs">Freq. ideal</Label>
                  <Input type="number" step="0.01" value={newCompany.ideal_frequency} onChange={(e) => setNewCompany({ ...newCompany, ideal_frequency: Number(e.target.value) })} />
                </div>
                <div className="md:col-span-3">
                  <Label className="text-xs">Observações (opcional)</Label>
                  <Input value={newCompany.notes} onChange={(e) => setNewCompany({ ...newCompany, notes: e.target.value })} placeholder="Notas internas sobre a empresa" />
                </div>
                <div className="md:col-span-1 flex items-end">
                  <Button onClick={handleAddCompany} className="w-full"><Plus className="w-4 h-4 mr-1" /> Adicionar</Button>
                </div>
              </div>
            </div>

            {/* List */}
            <div className="glass-card p-6">
              <h2 className="font-display font-semibold text-lg mb-4">Empresas parametrizadas</h2>
              {companies.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma empresa cadastrada ainda.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50 text-xs text-muted-foreground uppercase">
                        <th className="text-left p-2">Empresa</th>
                        <th className="text-right p-2">Orçamento</th>
                        <th className="text-right p-2">CPR ideal</th>
                        <th className="text-right p-2">CPR ok</th>
                        <th className="text-right p-2">CPR atenção</th>
                        <th className="text-right p-2">CPM ideal</th>
                        <th className="text-right p-2">Freq. ideal</th>
                        <th className="text-right p-2">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {companies.map((c) => {
                        const editing = editingId === c.id && editDraft;
                        const cell = (val: number, key: keyof CompanySetting) => editing ? (
                          <Input type="number" step="0.01" value={(editDraft as any)[key]} onChange={(e) => setEditDraft({ ...editDraft, [key]: Number(e.target.value) })} className="h-7 text-xs text-right" />
                        ) : `R$${Number(val ?? 0).toFixed(2)}`;
                        return (
                          <tr key={c.id} className="border-b border-border/30 hover:bg-secondary/30">
                            <td className="p-2 font-medium">{c.company_name}</td>
                            <td className="p-2 text-right">{cell(c.monthly_budget, "monthly_budget")}</td>
                            <td className="p-2 text-right text-success">{cell(c.ideal_cpr, "ideal_cpr")}</td>
                            <td className="p-2 text-right text-info">{cell(c.acceptable_cpr, "acceptable_cpr")}</td>
                            <td className="p-2 text-right text-warning">{cell(c.warning_cpr, "warning_cpr")}</td>
                            <td className="p-2 text-right">{cell(c.ideal_cpm, "ideal_cpm")}</td>
                            <td className="p-2 text-right">{editing ? (
                              <Input type="number" step="0.01" value={editDraft.ideal_frequency} onChange={(e) => setEditDraft({ ...editDraft, ideal_frequency: Number(e.target.value) })} className="h-7 text-xs text-right" />
                            ) : c.ideal_frequency.toFixed(2)}</td>
                            <td className="p-2 text-right">
                              {editing ? (
                                <div className="flex gap-1 justify-end">
                                  <Button size="sm" variant="default" className="h-7" onClick={handleSaveEdit}><Save className="w-3 h-3" /></Button>
                                  <Button size="sm" variant="ghost" className="h-7" onClick={() => { setEditingId(null); setEditDraft(null); }}>×</Button>
                                </div>
                              ) : (
                                <div className="flex gap-1 justify-end">
                                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setEditingId(c.id); setEditDraft({ ...c }); }}>Editar</Button>
                                  <Button size="sm" variant="ghost" className="h-7 text-destructive hover:text-destructive" onClick={() => handleDelete(c.id)}><Trash2 className="w-3 h-3" /></Button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
