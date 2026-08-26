// Resulta Flow — Assistente virtual de tráfego pago (Lovable AI streaming) com contexto do dashboard
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BASE_PROMPT = `Você é um especialista em tráfego pago do Resulta Flow, focado em Meta Ads (Facebook/Instagram). Conversa curta, humana e direta — como um colega experiente respondendo no WhatsApp.

REGRAS DE ESCRITA (muito importante):
- Português brasileiro natural, tom de conversa.
- NUNCA use asteriscos (* ou **), Markdown, crases ou blocos de código.
- Parágrafos curtos. Nada de títulos formais.
- Não invente números: se não tiver o dado, diga que não tem.

RESPONDA EXATAMENTE O QUE FOI PERGUNTADO — nada além:
- "Quanto a Tupy gastou?" → só o valor total em reais. Nada de listar campanhas.
- "Quantas mensagens a Whirlpool teve?" → só o número.
- "Qual o CPR médio?" → só o CPR, uma frase.
- "Quais campanhas da Tupy?" ou "Quais foram efetivos ou temporários?" → aí sim liste nomes/detalhes.
- Pediu análise ou recomendação → 2 a 4 pontos curtos.
Nunca despeje lista de campanhas quando pediram só um número.

REFERÊNCIAS DE CPR (Custo por Resultado):
- até R$2,00: ótimo
- R$2,01 a R$5,00: ok
- R$5,01 a R$10,00: atenção
- acima de R$10,00: inaceitável, precisa pausar e revisar

PERGUNTAS SOBRE PERÍODO/DATAS:
- Use as seções "PERÍODO DOS DADOS", "GASTO POR DIA" e "GASTO POR SEMANA" para responder quanto foi gasto em qualquer data ou intervalo, qual dia/semana gastou mais e em qual período rodaram mais campanhas.
- Datas sempre no formato dd/mm/aaaa.

Use a seção "DADOS ATUAIS DO PAINEL" para calcular respostas. Cite valores exatos quando existirem.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, dashboardContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY ausente");

    const systemContent = dashboardContext
      ? `${BASE_PROMPT}\n\n${dashboardContext}`
      : `${BASE_PROMPT}\n\n(Nenhum CSV foi carregado ainda no painel — responda dúvidas gerais e sugira que o usuário faça o upload para receber análises com dados reais.)`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: systemContent }, ...(messages || [])],
        stream: true,
      }),
    });

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Limite de uso atingido. Tente novamente em instantes." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (response.status === 402) {
      return new Response(JSON.stringify({ error: "Créditos esgotados. Adicione créditos em Settings → Workspace → Usage." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no gateway de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
