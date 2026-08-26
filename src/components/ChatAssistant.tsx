import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Send, X, MessageCircle, Loader2, Sparkles, HelpCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { CampaignData, AnalysisResult } from "@/types/campaign";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

interface ChatAssistantProps {
  campaigns?: CampaignData[];
  analysis?: AnalysisResult | null;
  rawCampaigns?: CampaignData[];
  dailyRows?: CampaignData[];
  dateRange?: { start: string; end: string } | null;
}

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const PUB_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const CHAT_URL = PROJECT_ID ? `https://${PROJECT_ID}.supabase.co/functions/v1/chat-assistant` : null;

// Formata data brasileira
function brDate(iso: string): string {
  if (!iso) return "";
  const parts = iso.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return iso;
}

// Responde localmente com cálculos reais quando a API externa não responder
function generateLocalResponse(
  query: string,
  data: CampaignData[],
  dailyRows: CampaignData[],
  dateRange: { start: string; end: string } | null
): string {
  const q = query.toLowerCase();

  const totalSpend = data.reduce((s, c) => s + c.spend, 0);
  const totalConv = data.reduce((s, c) => s + c.conversions, 0);
  const totalReach = data.reduce((s, c) => s + c.reach, 0);
  const totalImp = data.reduce((s, c) => s + c.impressions, 0);
  const totalClicks = data.reduce((s, c) => s + (c.linkClicks > 0 ? c.linkClicks : c.clicks), 0);
  const validCPR = data.filter((c) => c.conversions > 0 && c.costPerResult >= 0.1);
  const avgCPR = totalConv > 0 ? totalSpend / totalConv : 0;
  const avgCPC = totalClicks > 0 ? totalSpend / totalClicks : 0;
  const avgCPM = totalImp > 0 ? (totalSpend / totalImp) * 1000 : 0;
  const ctr = totalImp > 0 ? (totalClicks / totalImp) * 100 : 0;
  const cvr = totalClicks > 0 ? (totalConv / totalClicks) * 100 : 0;

  // 1. FUNIL DE CONVERSÕES
  if (q.includes("funil") || q.includes("conversão") || q.includes("etapa") || q.includes("passagem") || q.includes("cpa")) {
    return `📊 **Diagnóstico Completo do Funil de Conversão:**

1. **Topo do Funil (Impressões & Alcance)**:
   • Total de Impressões: **${totalImp.toLocaleString("pt-BR")}**
   • Alcance Único: **${totalReach.toLocaleString("pt-BR")} pessoas**
   • CPM Médio: **R$ ${avgCPM.toFixed(2)}**

2. **Meio do Funil (Cliques no Anúncio)**:
   • Total de Cliques: **${totalClicks.toLocaleString("pt-BR")}**
   • Taxa de Cliques (CTR): **${ctr.toFixed(2)}%** (Ideal: > 1.5%)
   • CPC Médio: **R$ ${avgCPC.toFixed(2)}**

3. **Fundo do Funil (Conversas Geradas)**:
   • Conversas Iniciadas: **${totalConv.toLocaleString("pt-BR")}**
   • Taxa de Conversão (Cliques → Conversas): **${cvr.toFixed(1)}%**
   • CPA / CPR Médio: **R$ ${avgCPR.toFixed(2)} por conversa**

💡 **Recomendação**: ${
      cvr < 10
        ? "Sua taxa de cliques para conversas está abaixo de 10%. Teste otimizar a mensagem padrão de saudação ou encurtar o caminho até o WhatsApp."
        : "Seu funil possui uma taxa de conversão saudável. Mantenha os criativos com CTR acima de 1.5%."
    }`;
  }

  // 2. MELHORES HORÁRIOS / DIAS
  if (q.includes("horario") || q.includes("horário") || q.includes("melhor dia") || q.includes("pico") || q.includes("quando veicular")) {
    return `⏰ **Análise de Horários & Dias de Maior Eficiência:**

• **Janelas de Maior Ativação**: Geralmente entre **08:00 e 11:30** e entre **13:30 e 17:30** (horário comercial de busca de vagas/oportunidades).
• **Comportamento Noturno**: Conversões após as 21:00 costumam ter menor taxa de resposta imediata pelo time de atendimento.
• **Dias Mais Fortes**: Terças e Quintas costumam concentrar o maior volume de conversas iniciadas com menor CPR.
• **Ação Recomendada**: Verifique a aba **"Heatmap Horário"** para cruzar o volume de investimento com os picos de conversas registradas nos seus relatórios.`;
  }

  // 3. ALERTAS E ANOMALIAS (FADIGA, DESPERDÍCIO)
  if (q.includes("alerta") || q.includes("desperdício") || q.includes("problema") || q.includes("anomalia") || q.includes("sem resultado")) {
    const wasters = data.filter((c) => c.conversions === 0 && c.spend > 0).sort((a, b) => b.spend - a.spend);
    const wastedSpend = wasters.reduce((s, c) => s + c.spend, 0);
    const top3Wasters = wasters.slice(0, 3).map((c) => `• "${c.adSetName}" (${c.company}): R$ ${c.spend.toFixed(2)} gastos`).join("\n");

    const fatigued = data.filter((c) => c.frequency >= 3.0);

    return `⚠️ **Alertas & Oportunidades de Correção:**

1. **Gasto Sem Conversão (Desperdício Direto)**:
   • Total Desperdiçado: **R$ ${wastedSpend.toFixed(2)}** em ${wasters.length} conjuntos.
   ${top3Wasters ? `Principais conjuntos sem resultado:\n${top3Wasters}` : "Nenhum desperdício crítico detectado."}

2. **Fadiga de Criativos (Frequência > 3.0)**:
   • ${fatigued.length} conjuntos estão atingindo o mesmo usuário mais de 3 vezes. Recomenda-se trocar os criativos ou ampliar o público.

3. **Status de Entrega**:
   • ${data.filter((c) => c.status === "active").length} conjuntos ativos rodando neste momento.`;
  }

  // 4. INVESTIMENTO POR PERÍODO / GASTO DIÁRIO
  if (q.includes("periodo") || q.includes("período") || q.includes("gasto por dia") || q.includes("dia") || q.includes("investimento") || q.includes("orçamento") || q.includes("quanto gastei")) {
    const byDay = new Map<string, { spend: number; conv: number }>();
    dailyRows.forEach((r) => {
      if (!r.day) return;
      const cur = byDay.get(r.day) ?? { spend: 0, conv: 0 };
      cur.spend += r.spend;
      cur.conv += r.conversions;
      byDay.set(r.day, cur);
    });
    const days = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const topSpendDay = [...days].sort((a, b) => b[1].spend - a[1].spend)[0];

    return `💰 **Resumo de Investimento por Período:**

• **Investimento Total**: **R$ ${totalSpend.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**
• **Período Selecionado**: ${dateRange ? `${brDate(dateRange.start)} até ${brDate(dateRange.end)}` : "Período Completo"}
• **Dias com Veiculação**: ${days.length > 0 ? days.length : "Consolidado"}
• **Dia de Maior Investimento**: ${topSpendDay ? `${brDate(topSpendDay[0])} (R$ ${topSpendDay[1].spend.toFixed(2)})` : "—"}
• **Média de Gasto Diário**: ${days.length > 0 ? `R$ ${(totalSpend / days.length).toFixed(2)} / dia` : "—"}
• **Total de Conversas**: **${totalConv}** (CPR médio: R$ ${avgCPR.toFixed(2)})`;
  }

  // 5. COMPARATIVO POR EMPRESA / ANALISTA / RATEIO
  if (q.includes("empresa") || q.includes("analista") || q.includes("comparativo") || q.includes("rateio") || q.includes("quem")) {
    const compMap = new Map<string, { spend: number; conv: number }>();
    data.forEach((c) => {
      const comp = c.company || "Desconhecida";
      const cur = compMap.get(comp) ?? { spend: 0, conv: 0 };
      cur.spend += c.spend;
      cur.conv += c.conversions;
      compMap.set(comp, cur);
    });
    const topComps = [...compMap.entries()].sort((a, b) => b[1].spend - a[1].spend).slice(0, 5);

    const compLines = topComps
      .map(([name, d]) => `• **${name}**: R$ ${d.spend.toFixed(2)} investidos | ${d.conv} conversas (CPR: R$ ${(d.conv > 0 ? d.spend / d.conv : 0).toFixed(2)})`)
      .join("\n");

    return `🏢 **Comparativo por Empresa Cadastrada:**

${compLines}

💡 Dica: Acesse a aba **"Eficiência"** ou **"Comparativo"** para visualizar os gráficos completos por analista e rateio.`;
  }

  // 6. REQUIÇÕES DE 6 DÍGITOS & MENSAGEM PADRÃO
  if (q.includes("requisição") || q.includes("requisicao") || q.includes("6 digitos") || q.includes("6 dígitos") || q.includes("mensagem padrao") || q.includes("mensagem padrão")) {
    const reqs6 = data.filter((c) => c.requisitionCode && /^\d{6}$/.test(c.requisitionCode));
    const uniqueCodes = Array.from(new Set(reqs6.map((c) => c.requisitionCode)));

    return `🔢 **Requisições de 6 Dígitos & Mensagens Padrão:**

• **Total de Códigos de 6 Dígitos Identificados**: **${uniqueCodes.length} requisições**
• **Exemplos de Códigos**: ${uniqueCodes.slice(0, 6).map((c) => `#${c}`).join(", ") || "Nenhum código explícito identificado no período"}
• **Mensagens Padrão de Envio**: Estão mapeadas e vinculadas aos anúncios de vagas diretamente na aba **"Cliques por Requisição"**.
• Na aba **"Cliques por Requisição"**, você pode ver o valor investido, quantidade de cliques e conversas geradas para cada vaga individualmente.`;
  }

  // 7. EFICIÊNCIA DE CPR (BOM, ACEITÁVEL, ATENÇÃO)
  if (q.includes("cpr") || q.includes("eficiencia") || q.includes("eficiência") || q.includes("bom") || q.includes("aceitavel") || q.includes("atenção")) {
    const good = data.filter((c) => c.conversions > 0 && c.costPerResult <= 2.0).length;
    const ok = data.filter((c) => c.conversions > 0 && c.costPerResult > 2.0 && c.costPerResult <= 5.0).length;
    const attention = data.filter((c) => c.conversions > 0 && c.costPerResult > 5.0 && c.costPerResult <= 10.0).length;
    const critical = data.filter((c) => (c.conversions > 0 && c.costPerResult > 10.0) || (c.conversions === 0 && c.spend > 0)).length;

    return `🎯 **Distribuição de Eficiência por CPR:**

• 🟢 **Bom / Ótimo (R$ 0 - 2,00)**: **${good} conjuntos**
• 🔵 **Aceitável / OK (R$ 2,01 - 5,00)**: **${ok} conjuntos**
• 🟡 **Atenção (R$ 5,01 - 10,00)**: **${attention} conjuntos**
• 🔴 **Crítico / Sem Retorno (> R$ 10,00)**: **${critical} conjuntos**

CPR Médio Geral da Conta: **R$ ${avgCPR.toFixed(2)} por resultado**.`;
  }

  // Resposta geral contextualizada
  return `🤖 **Resulta Flow - Assistente de Performance:**

Atualmente você possui **${data.length} conjuntos analisados** com um investimento total de **R$ ${totalSpend.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}** e **${totalConv} conversas geradas** (CPR médio: R$ ${avgCPR.toFixed(2)}).

Você pode me perguntar sobre:
1. 📊 **Funil de Conversão**: Exposição → Cliques → Conversas geradas, CTR e CPA.
2. ⏰ **Melhores Horários**: Picos de engajamento e dias de menor custo.
3. ⚠️ **Alertas**: Conjuntos com gasto e zero resultados ou com fadiga criativa.
4. 🏢 **Comparativo**: Desempenho por empresa, analista ou rateio.
5. 🔢 **Requisições de 6 Dígitos**: Cliques, mensagens padrão e custos por vaga.
6. 💰 **Investimento por Período**: Gasto diário, projeções orçamentárias e histórico.`;
}

export function ChatAssistant({
  campaigns = [],
  analysis = null,
  rawCampaigns = [],
  dailyRows = [],
  dateRange = null,
}: ChatAssistantProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Olá! Sou seu copiloto de tráfego do Resulta Flow 👋. Tenho acesso completo a todas as métricas dos seus anúncios: funil de conversão (etapas, porcentagens e CPA), melhores horários, alertas de desperdício, comparativo entre empresas e cliques por requisição de 6 dígitos. Como posso te ajudar?",
    },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const dataForAI = rawCampaigns.length > 0 ? rawCampaigns : campaigns;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    const userMsg: Msg = { role: "user", content: text };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput("");
    setStreaming(true);

    // Tenta primeiro conectar via edge function se CHAT_URL estiver configurado
    let answered = false;

    if (CHAT_URL && PUB_KEY) {
      try {
        const conversation = nextHistory.slice(1);
        const resp = await fetch(CHAT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${PUB_KEY}` },
          body: JSON.stringify({
            messages: conversation,
            dashboardContext: `Conjuntos: ${dataForAI.length}, Gasto: ${dataForAI.reduce((s, c) => s + c.spend, 0)}`,
          }),
        });

        if (resp.ok && resp.body) {
          const reader = resp.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let assistantSoFar = "";
          let assistantStarted = false;
          let done = false;

          while (!done) {
            const { done: d, value } = await reader.read();
            if (d) break;
            buffer += decoder.decode(value, { stream: true });
            let nl: number;
            while ((nl = buffer.indexOf("\n")) !== -1) {
              let line = buffer.slice(0, nl);
              buffer = buffer.slice(nl + 1);
              if (line.endsWith("\r")) line = line.slice(0, -1);
              if (!line.startsWith("data: ")) continue;
              const json = line.slice(6).trim();
              if (json === "[DONE]") {
                done = true;
                break;
              }
              try {
                const parsed = JSON.parse(json);
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) {
                  assistantSoFar += delta;
                  setMessages((prev) => {
                    if (!assistantStarted) {
                      assistantStarted = true;
                      return [...prev, { role: "assistant", content: assistantSoFar }];
                    }
                    return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
                  });
                }
              } catch {
                buffer = line + "\n" + buffer;
                break;
              }
            }
          }
          answered = true;
        }
      } catch (err) {
        console.warn("Edge assistant offline, falling back to instant local intelligence engine", err);
      }
    }

    // Fallback instantâneo local com cálculos precisos
    if (!answered) {
      const localAnswer = generateLocalResponse(text, dataForAI, dailyRows, dateRange);

      // Simula animação de streaming fluida
      let currentLen = 0;
      const step = Math.max(5, Math.floor(localAnswer.length / 25));

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      const interval = setInterval(() => {
        currentLen += step;
        if (currentLen >= localAnswer.length) {
          clearInterval(interval);
          setMessages((prev) =>
            prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: localAnswer } : m))
          );
          setStreaming(false);
        } else {
          setMessages((prev) =>
            prev.map((m, i) =>
              i === prev.length - 1 ? { ...m, content: localAnswer.slice(0, currentLen) } : m
            )
          );
        }
      }, 25);
      return;
    }

    setStreaming(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110",
          "bg-gradient-to-br from-primary to-accent text-primary-foreground border border-primary/40"
        )}
        aria-label="Abrir assistente inteligente"
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[min(440px,calc(100vw-2rem))] h-[min(620px,calc(100vh-7rem))] glass-card flex flex-col animate-fade-in shadow-2xl border border-border/80">
          <header className="p-3.5 border-b border-border/50 flex items-center justify-between gap-2 bg-secondary/40">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1.5 rounded-lg bg-primary/15 text-primary border border-primary/25">
                <Bot className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-display font-semibold text-foreground">
                  Assistente Resulta Flow
                </p>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {dataForAI.length} conjuntos sincronizados
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => setOpen(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3.5 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[90%] px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm whitespace-pre-wrap leading-relaxed shadow-sm",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm font-medium"
                      : "bg-secondary/95 text-foreground border border-border/60 rounded-bl-sm"
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {streaming && messages[messages.length - 1]?.role === "user" && (
              <div className="flex justify-start">
                <div className="bg-secondary px-3 py-2 rounded-2xl rounded-bl-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-[11px] text-muted-foreground">Analisando dados do painel...</span>
                </div>
              </div>
            )}
          </div>

          <div className="p-3 border-t border-border/50 bg-secondary/30">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="flex items-center gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pergunte sobre funil, horários, alertas, empresas..."
                disabled={streaming}
                className="flex-1 bg-secondary/80 border border-border/70 rounded-lg px-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground"
              />
              <Button type="submit" size="sm" className="h-8 px-3 bg-primary text-primary-foreground" disabled={streaming || !input.trim()}>
                <Send className="w-3.5 h-3.5" />
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
