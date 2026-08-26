import type { CampaignData } from "@/types/campaign";

/**
 * Intelligent delimiter detector (supports comma, semicolon, tab).
 */
function detectDelimiter(text: string): string {
  const firstLine = text.split("\n")[0] || "";
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  const tabs = (firstLine.match(/\t/g) || []).length;

  if (semicolons > commas && semicolons > tabs) return ";";
  if (tabs > commas && tabs > semicolons) return "\t";
  return ",";
}

/**
 * Robust CSV line parser respecting quotes, escaped quotes, and auto-detected delimiter.
 */
function parseCsvLine(line: string, delimiter: string = ","): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Robust number parsing supporting PT-BR (1.234,56 or 12,34) and standard US (1234.56).
 */
function parseLocalizedNumber(raw: any): number {
  if (raw === undefined || raw === null || raw === "") return 0;
  if (typeof raw === "number") return isNaN(raw) ? 0 : raw;
  let str = String(raw).trim();
  // Remove currency signs or % signs
  str = str.replace(/[R$\s%]/g, "");
  if (!str) return 0;

  // Case 1: 1.234,56 (PT-BR with thousands dot and decimal comma)
  if (/^\d{1,3}(\.\d{3})+,\d+$/.test(str)) {
    str = str.replace(/\./g, "").replace(",", ".");
  }
  // Case 2: 1234,56 (PT-BR comma decimal)
  else if (/^-?\d+,\d+$/.test(str)) {
    str = str.replace(",", ".");
  }
  // Case 3: 1,234.56 (US with thousands comma)
  else if (/^\d{1,3}(,\d{3})+\.\d+$/.test(str)) {
    str = str.replace(/,/g, "");
  }

  const num = parseFloat(str);
  return isFinite(num) ? num : 0;
}

const HEADER_MAP: Record<string, string> = {
  // Brazilian Meta export
  "nome da campanha": "campaignName",
  "campaign name": "campaignName",
  "campaign_name": "campaignName",
  "nome do conjunto de anúncios": "adSetName",
  "ad set name": "adSetName",
  "adset_name": "adSetName",
  "nome do anúncio": "adName",
  "ad name": "adName",
  "ad_name": "adName",
  "idade": "age",
  "age": "age",
  "objetivo": "objective",
  "objective": "objective",
  "gênero": "gender",
  "gender": "gender",
  "dia": "day",
  "day": "day",
  "date_start": "day",
  "date_stop": "endDate",
  "data de início": "startDate",
  "data de término": "endDate",
  "status de veiculação": "status",
  "delivery status": "status",
  "delivery": "status",
  "status": "status",
  "nível de veiculação": "level",
  "alcance": "reach",
  "reach": "reach",
  "impressões": "impressions",
  "impressions": "impressions",
  "frequência": "frequency",
  "frequency": "frequency",
  "configuração de atribuição": "attribution",
  "tipo de resultado": "resultType",
  "result type": "resultType",
  "resultados": "conversions",
  "results": "conversions",
  "valor usado (brl)": "spend",
  "amount spent (brl)": "spend",
  "amount spent": "spend",
  "spend": "spend",
  "custo por resultado": "costPerResult",
  "cost per result": "costPerResult",
  "cost_per_result": "costPerResult",
  "início": "startDate",
  "start": "startDate",
  "término": "endDate",
  "end": "endDate",
  "início dos relatórios": "reportStart",
  "encerramento dos relatórios": "reportEnd",
  "cliques no link": "linkClicks",
  "link clicks": "linkClicks",
  "inline_link_clicks": "linkClicks",
  "cliques (todos)": "clicks",
  "clicks (all)": "clicks",
  "clicks": "clicks",
  "ctr (taxa de cliques no link)": "ctr",
  "ctr (link click-through rate)": "ctr",
  "inline_link_click_ctr": "ctr",
  "ctr (todos)": "ctr",
  "ctr": "ctr",
  "cpc (custo por clique no link)": "cpc",
  "cpc (cost per link click)": "cpc",
  "cost_per_inline_link_click": "cpc",
  "cpc (todos)": "cpc",
  "cpc": "cpc",
  "cpm (custo por 1.000 impressões)": "cpm",
  "cpm (cost per 1,000 impressions)": "cpm",
  "cpm": "cpm",
  "roas (retorno sobre o gasto com anúncios)": "roas",
  "purchase roas": "roas",
  "roas": "roas",
  "account_id": "account",
  "conta": "account",
  "id da conta": "account",
  "company_name": "company",
  "empresa": "company",
  "sip_number": "sip",
  "sip": "sip",
  "unidade": "rateio",
  "vaga_tipo": "contractType",
  "corpo": "defaultAdMessage",
  "texto": "defaultAdMessage",
  "body": "defaultAdMessage",
  "text": "defaultAdMessage",
  "ad_text": "defaultAdMessage",
  "texto do anúncio": "defaultAdMessage",
  "mensagem": "defaultAdMessage",
  "mensagem padrão": "defaultAdMessage",
  "mensagem de saudação": "defaultAdMessage",
  "greeting": "defaultAdMessage",
  "message": "defaultAdMessage",
  "default_message": "defaultAdMessage",
  "whatsapp_message": "defaultAdMessage",
  "requisition": "requisitionCode",
  "requisição": "requisitionCode",
  "requisicao": "requisitionCode",
  "codigo_vaga": "requisitionCode",
  "código_vaga": "requisitionCode",
};

function mapStatus(raw: string): CampaignData["status"] {
  const s = (raw || "").toLowerCase().trim();
  if (s === "active" || s.includes("ativ")) return "active";
  if (s === "paused" || s.includes("pausad")) return "paused";
  if (s === "inactive" || s.includes("inativ")) return "inactive";
  if (s.includes("not_delivering") || s.includes("not delivering") || s.includes("não veicul")) return "not_delivering";
  if (s.includes("recently_completed") || s.includes("recently completed") || s.includes("conclu") || s.includes("encerrad")) return "recently_completed";
  return "active";
}

// --- Dicionário Extensivo de Sinônimos de Empresas RHBrasil & Clientes Industriais/Comerciais ---
const KNOWN_COMPANY_DICTIONARY: Record<string, string> = {
  // Grandes Clientes Industriais / Fabricantes
  "WHIRLPOOL": "WHIRLPOOL",
  "WHIRPOOL": "WHIRLPOOL",
  "WIRPOOL": "WHIRLPOOL",
  "WHRILPOOL": "WHIRLPOOL",
  "WHIRLPOL": "WHIRLPOOL",
  "WHILPOOL": "WHIRLPOOL",
  "WHIRPOLL": "WHIRLPOOL",
  "EMBRACO": "EMBRACO",
  "NIDEC": "NIDEC",
  "NIDEC GLOBAL APPLIANCE": "NIDEC",
  "TUPY": "TUPY",
  "TUPI": "TUPY",
  "SCHULZ": "SCHULZ",
  "SCHULZ COMPRESSORES": "SCHULZ",
  "SCHULZ AUTOMOTIVA": "SCHULZ",
  "BRITANIA": "BRITÂNIA",
  "BRITÂNIA": "BRITÂNIA",
  "PHILCO": "PHILCO",
  "ALUTEC": "ALUTEC",
  "V V REFEICOES": "V V REFEIÇÕES",
  "V V REFEIÇÕES": "V V REFEIÇÕES",
  "VV REFEICOES": "V V REFEIÇÕES",
  "VV REFEIÇÕES": "V V REFEIÇÕES",
  "V&V REFEICOES": "V V REFEIÇÕES",
  "V&V REFEIÇÕES": "V V REFEIÇÕES",
  "CORDAVILLE": "CORDAVILLE",
  "CORDA VILLE": "CORDAVILLE",
  "INPLAVEL": "INPLAVEL",
  "IMPLAVEL": "INPLAVEL",
  "ZINCO SUL": "ZINCO SUL",
  "ZINCOSUL": "ZINCO SUL",
  "PLASBOHN": "PLASBOHN",
  "PLASBOHM": "PLASBOHN",
  "DOHLER": "DOHLER",
  "DOLHER": "DOHLER",
  "DÖHLER": "DOHLER",
  "WETZEL": "WETZEL",
  "KRONA": "KRONA",
  "KRONNA": "KRONA",
  "ISOTERM": "ISOTERM",
  "ISOTERME": "ISOTERM",
  "GOODYEAR": "GOODYEAR",
  "GOOD YEAR": "GOODYEAR",
  "MAGAZINE LUIZA": "MAGAZINE LUIZA",
  "MAGALU": "MAGAZINE LUIZA",
  "MAGALOG": "MAGAZINE LUIZA",
  "BRASCABOS": "BRASCABOS",
  "BRACABOS": "BRASCABOS",
  "CSI": "C S I",
  "C S I": "C S I",
  "C.S.I.": "C S I",
  "CSI CARGO": "C S I",
  "C S I CARGO": "C S I",
  "BRASPO": "BRASPÓ",
  "BRASPÓ": "BRASPÓ",
  "BRASPOO": "BRASPÓ",
  "TAF": "TAF",
  "TAF DISTRIBUIDORA": "TAF",
  "HENRIQUE G SCHROEDER": "HENRIQUE G SCHROEDER ADVOGADO",
  "HENRIQUE SCHROEDER": "HENRIQUE G SCHROEDER ADVOGADO",
  "GWM": "GWM",
  "GREAT WALL": "GWM",
  "GREAT WALL MOTORS": "GWM",
  "HIDROFILTROS": "HIDROFILTROS",
  "HIDROFILTRO": "HIDROFILTROS",
  "VOLANI": "VOLANI",
  "MARCEGAGLIA": "MARCEGAGLIA",
  "MARCEGALIA": "MARCEGAGLIA",
  "PLASTICOS ZANOTTI": "PLASTICOS ZANOTTI",
  "PLÁSTICOS ZANOTTI": "PLASTICOS ZANOTTI",
  "ZANOTTI": "PLASTICOS ZANOTTI",
  "VEOLIA": "VEOLIA",
  "VEOLIE": "VEOLIA",
  "BRASTORNO": "BRASTORNO",
  "IRCE": "IRCE",
  "PORTAL CANDIDATO": "PORTAL CANDIDATO",
  "TIGRE": "TIGRE",
  "WEG": "WEG",
  "CISER": "CISER",
  "TUPER": "TUPER",
  "CLAMED": "CLAMED",
  "DROGARIA CATARINENSE": "CLAMED",
  "CATARINENSE PHARMA": "CATARINENSE PHARMA",
  "TERMOTECNICA": "TERMOTÉCNICA",
  "TERMOTÉCNICA": "TERMOTÉCNICA",
  "INTELBRAS": "INTELBRAS",
  "HAVAN": "HAVAN",
  "NEOGRID": "NEOGRID",
  "SELBETTI": "SELBETTI",
  "OPA BIER": "OPA BIER",
  "OPA": "OPA BIER",
  "KARSTEN": "KARSTEN",
  "BUDDEMEYER": "BUDDEMEYER",
  "DUDALINA": "DUDALINA",
  "HERING": "HERING",
  "MARISOL": "MARISOL",
  "MALWEE": "MALWEE",
  "ROVITEX": "ROVITEX",
  "ALTENBURG": "ALTENBURG",
  "MULTILOG": "MULTILOG",
  "AMBEV": "AMBEV",
  "JBS": "JBS",
  "BRF": "BRF",
  "SEARA": "SEARA",
  "BOSCH": "BOSCH",
  "RANDON": "RANDON",
  "MARCOPOLO": "MARCOPOLO",
  "TRAMONTINA": "TRAMONTINA",
  "AUSTEN": "AUSTEN",
  "BUSCHLE": "BUSCHLE & LEPPER",
  "BUSCHLE & LEPPER": "BUSCHLE & LEPPER",
  "BUSCHLE E LEPPER": "BUSCHLE & LEPPER",
  "AJAX": "AJAX",
  "FORT ATACADISTA": "FORT ATACADISTA",
  "KOMPRAO": "KOMPRÃO",
  "KOMPRÃO": "KOMPRÃO",
  "KOCH": "KOMPRÃO",
  "SUPERMERCADOS KOCH": "KOMPRÃO",
  "GIASSI": "GIASSI",
  "CONDOR": "CONDOR",
  "ANGELONI": "ANGELONI",
  "COOPER": "COOPER",
  "BISTEK": "BISTEK",
  "UNIMED": "UNIMED",
  "HAPVIDA": "HAPVIDA",
  "NOTRE DAME": "NOTRE DAME",
  "NOTREDAME": "NOTRE DAME",
  "GARTNER": "GARTNER",
  "CARVALHO": "CARVALHO",
  "ALLIANCE": "ALLIANCE",
  "PROMAX": "PROMAX",
  "FIBRA": "FIBRA",
  "METISA": "METISA",
  "POMIFRUTAS": "POMIFRUTAS",
  "KOBRASOL": "KOBRASOL",
  "CREMER": "CREMER",
  "FLEX": "FLEX",
  "INPLAC": "INPLAC",
  "PLASVALE": "PLASVALE",
  "AURORA": "AURORA",
  "COOPERALFA": "COOPERALFA",
  "PAMPLONA": "PAMPLONA",
  "MASTER": "MASTER",
  "DUAS RODAS": "DUAS RODAS",
  "RUDOLPH": "RUDOLPH",
  "ELECTROLUX": "ELECTROLUX",
  "MONDIAL": "MONDIAL",
  "ARNO": "ARNO",
  "CADENCE": "CADENCE",
  "SEW": "SEW",
  "SEW EURODRIVE": "SEW",
  "DANFOSS": "DANFOSS",
  "FESTO": "FESTO",
  "SCHNEIDER": "SCHNEIDER",
  "SCHNEIDER ELECTRIC": "SCHNEIDER",
  "SIEMENS": "SIEMENS",
  "ABB": "ABB",
  "TUBOARTE": "TUBOARTE",
  "SANTA LUZIA": "SANTA LUZIA",
  "PORTOBELLO": "PORTOBELLO",
  "CEUSA": "CEUSA",
  "BERNECK": "BERNECK",
  "ARAUCO": "ARAUCO",
  "KLABIN": "KLABIN",
  "SUZANO": "SUZANO",
  "IRANI": "IRANI",
  "FRIMESA": "FRIMESA",
  "LAR": "LAR",
  "COAMO": "COAMO",
  "COPAGAZ": "COPAGAZ",
  "ULTRAGAZ": "ULTRAGAZ",
  "SUPERGASBRAS": "SUPERGASBRAS",
  "LIQUIGAS": "LIQUIGÁS",
  "LIQUIGÁS": "LIQUIGÁS",
  "HEINEKEN": "HEINEKEN",
  "COCA COLA": "COCA-COLA",
  "COCA-COLA": "COCA-COLA",
  "FEMSA": "FEMSA",
  "SOLANUM": "SOLANUM",
  "ALBARUS": "ALBARUS",
  "DANA": "DANA",
  "TUBOFORT": "TUBOFORT",
  "AMAZONAS": "AMAZONAS",
  "INCOPLAS": "INCOPLAS",
  "PLASSON": "PLASSON",
  "METASA": "METASA",
};

// Palavras que NUNCA podem ser consideradas nomes de empresas (Audiências, Cargos, Mídia, Cidades, Metadados)
const BLACKLIST_COMPANY_WORDS = new Set([
  // Audiências e Segmentação
  "LOOKALIKE", "LOOKAILE", "LAL", "ABERTO", "ABETTO", "PUBLICO", "PÚBLICO", "PUBLICO ABERTO", "PÚBLICO ABERTO",
  "INTERESSES", "INTERESSE", "DEMOGRAFICO", "DEMOGRÁFICO", "REMARKETING", "ENGAGEMENT", "ENGAJAMENTO",
  "ENGAJAMENTO NO SITE", "18-50", "18-55", "18-65", "18 A 50", "18 A 60", "ANOS", "IDADE", "MASCULINO",
  "FEMININO", "TODOS", "TODOS OS GENEROS", "GENERO", "GÊNERO", "HOMENS", "MULHERES", "HOMEM", "MULHER",
  "HOMEM FUNDO AZUL", "HOMEM FUNDO BRANCO", "AMBOS", "GERAL", "DISTRITO", "DISTRITO INDUSTRIAL", "PARANAGUAMIRIM",
  "PIRABEIRABA", "AVENTUREIRO", "BOA VISTA", "COSTA E SILVA", "IRIRIÚ", "IRIRIU", "VILA NOVA", "CENTRO",
  "ZONA SUL", "ZONA NORTE", "ZONA LESTE", "ZONA OESTE", "BAIRROS", "BAIRRO", "RAIO 20KM", "RAIO 25KM", "RAIO", "KM",
  // Formatos e Mídia
  "FEED", "STORIES", "STORY", "REELS", "ADVANTAGE", "ADVANTAGE+", "AUTOMATICO", "AUTOMÁTICO", "MANUAL",
  "CARROSSEL", "ESTATICO", "ESTÁTICO", "VIDEO", "VÍDEO", "BANNER", "FOTO", "CRIATIVO", "CRIATIVOS", "CARD",
  "ARTE", "DESIGN", "POST", "NW", "ABO", "CBO", "SITE", "TESTE", "TESTES", "LISTA", "LISTA DE CANDIDATOS",
  "LISTA DE CANDIDATOS ATUALIZADA", "GEO", "FACEBOOK", "INSTAGRAM", "WPP", "WHATSAPP", "VAN", "DIA DE SELEÇÃO",
  "DIA DE SELECAO", "1 TURNO", "2 TURNO", "3 TURNO", "1° TURNO", "2° TURNO", "3° TURNO", "PRIMEIRO TURNO",
  "SEGUNDO TURNO", "TERCEIRO TURNO", "TURNO", "ESCALA 6X1", "ESCALA 5X2", "SEXTA", "QUINTA", "SEGUNDA", "DOMINGO",
  // Cargos e Funções
  "OPERADOR", "OPERADORA", "AUXILIAR", "ASSISTENTE", "ANALISTA", "TÉCNICO", "TECNICO", "TÉCNICA", "TECNICA",
  "ENGENHEIRO", "ENGENHEIRA", "LÍDER", "LIDER", "SUPERVISOR", "SUPERVISORA", "COORDENADOR", "COORDENADORA",
  "GERENTE", "ESTÁGIO", "ESTAGIO", "ESTAGIÁRIO", "ESTAGIARIO", "JOVEM APRENDIZ", "APRENDIZ", "SOLDADOR",
  "SOLDADORA", "PINTOR", "PINTORA", "TORNEIRO", "COSTUREIRA", "COSTUREIRO", "CONFECCIONISTA", "MECÂNICO",
  "MECANICO", "ELETRICISTA", "MONTADOR", "MONTADORA", "ALMOXARIFE", "CONFERENTE", "REPOSITOR", "REPOSITORA",
  "ATENDENTE", "CAIXA", "OPERADOR DE CAIXA", "RECEPCIONISTA", "MOTORISTA", "COZINHEIRO", "COZINHEIRA", "COZINHA",
  "PRODUÇÃO", "PRODUCAO", "LOGÍSTICA", "LOGISTICA", "MANUTENÇÃO", "MANUTENCAO", "EXPEDIÇÃO", "EXPEDICAO",
  "FUNDIÇÃO", "FUNDICAO", "USINAGEM", "INJEÇÃO", "INJECAO", "EXTRUSÃO", "EXTRUSAO", "QUALIDADE", "ADMINISTRATIVO",
  "LIMPEZA", "SERVIÇOS GERAIS", "SERVICOS GERAIS", "BALCONISTA", "FARMACÊUTICO", "FARMACEUTICO", "SERRALHEIRO",
  "CALDEIREIRO", "FERRAMENTEIRO", "PRENSISTA", "FORJADOR", "BOBINADOR", "OPERACIONAL", "CARREGADOR", "ESTOQUISTA",
  "EMBALADOR", "EMBALADORA", "ZELADOR", "ZELADORA", "COPA", "PORTARIA", "VIGILANTE", "REBARBADOR", "AJUDANTE",
  "AJUDANTE GERAL", "AJUDANTE DE PRODUCAO", "AJUDANTE DE PRODUÇÃO", "OPERADOR DE PRODUCAO", "OPERADOR DE PRODUÇÃO",
  "AUXILIAR DE PRODUCAO", "AUXILIAR DE PRODUÇÃO", "AUXILIAR DE LOGISTICA", "AUXILIAR DE LOGÍSTICA",
  // Metadados de RH e Sistema
  "SIP", "REQUISICAO", "REQUISIÇÃO", "REQ", "COD", "CODIGO", "CÓDIGO", "ID", "ANUNCIO", "ANÚNCIO", "CAMPANHA",
  "CONJUNTO", "BANCO DE TALENTOS", "VAGAS", "VAGA", "SELEÇÃO", "SELECAO", "CONTRATAÇÃO", "CONTRATACAO", "IMEDIATA",
  "URGENTE", "TEMPORÁRIO", "TEMPORARIO", "TEMPORÁRIA", "TEMPORARIA", "TEMP", "EFETIVO", "EFETIVA", "EF", "TE",
  "MISTO", "INPUT", "PERAZZOLI", "PERAZOLLI", "PERAZOLI", "RHB", "CONTRATACAO IMEDIATA", "CONTRATAÇÃO IMEDIATA",
  "ENSINO MEDIO COMPLETO", "ENSINO MEDIO", "ENSINO MÉDIO", "ENSINO FUNDAMENTAL", "INICIO IMEDIATO", "INÍCIO IMEDIATO",
  "RECUPERACAO DE BANCO", "RECUPERAÇÃO DE BANCO", "PROCESSO SELETIVO", "UNIDADE", "RATEIO", "MATRIZ", "FILIAL",
  "DESCONHECIDA", "DESCONHECIDO", "NAO INFORMADA", "NÃO INFORMADA"
]);

// Analistas de Recrutamento conhecidos na RHBrasil
const KNOWN_ANALYST_NAMES = new Set([
  "MARIANA", "CAMILA", "ANA", "ANA SOARES", "PAULA", "GABRIELA", "BEATRIZ", "FERNANDA", "JULIANA",
  "ALINE", "CAROLINE", "LUCAS", "MATHEUS", "GABRIEL", "FELIPE", "BRUNO", "RODRIGO", "MARCELO",
  "VINICIUS", "LEONARDO", "EDUARDO", "RAFAEL", "TIAGO", "DIEGO", "ANDRE", "GUSTAVO", "PATRICIA",
  "RENATA", "LETICIA", "NATALIA", "VANESSA", "PRISCILA", "JESSICA", "AMANDA", "BRUNA", "SABRINA",
  "THAMIRES", "CRISTIANE", "DANIELA", "ELIANE", "FRANCIELI", "GRAZIELA", "HELENA", "ISABELA",
  "JAQUELINE", "KARINA", "LILIAN", "MONIQUE", "NICOLE", "PAMELA", "RAQUEL", "SIMONE", "TATIANE",
  "VIVIANE", "WALESKA", "YASMIN", "MAVIAEL", "FABRICIO", "GIOVANA", "LARISSA", "LUANA", "LUCIANA",
  "MAIARA", "MARCIA", "MARINA", "MAYARA", "NATHALIA", "PAOLA"
]);

const RATEIO_ALIASES: Record<string, string> = {
  "JLLE": "JOINVILLE",
  "JOI": "JOINVILLE",
  "JOIN": "JOINVILLE",
  "JOINVILE": "JOINVILLE",
  "JOIVILLE": "JOINVILLE",
  "ITJ": "ITAJAÍ",
  "ITAJAI": "ITAJAÍ",
  "SUMARE": "SUMARÉ",
  "FLORIPA": "FLORIANÓPOLIS",
  "FLORIANOPOLIS": "FLORIANÓPOLIS",
  "JARAGUA": "JARAGUÁ DO SUL",
  "JARAGUA DO SUL": "JARAGUÁ DO SUL",
  "SAO PAULO": "SÃO PAULO",
  "SP": "SÃO PAULO",
  "RIO DE JANEIRO": "RIO DE JANEIRO",
  "RJ": "RIO DE JANEIRO",
  "RIO CLARO": "RIO CLARO",
  "BLUMENAU": "BLUMENAU",
  "CURITIBA": "CURITIBA",
  "CAMPINAS": "CAMPINAS",
  "CASCAVEL": "CASCAVEL",
  "MAFRA": "MAFRA",
  "CUIABA": "CUIABÁ",
  "CUIABÁ": "CUIABÁ",
  "PORTO ALEGRE": "PORTO ALEGRE",
  "POA": "PORTO ALEGRE",
  "LONDRINA": "LONDRINA",
  "MARINGA": "MARINGÁ",
  "MARINGÁ": "MARINGÁ",
  "CHAPECO": "CHAPECÓ",
  "CHAPECÓ": "CHAPECÓ",
  "CRICIUMA": "CRICIÚMA",
  "CRICIÚMA": "CRICIÚMA",
  "TUBARAO": "TUBARÃO",
  "TUBARÃO": "TUBARÃO",
  "LAGES": "LAGES",
  "BRUSQUE": "BRUSQUE",
  "INDAIAL": "INDAIAL",
  "TIMBO": "TIMBÓ",
  "TIMBÓ": "TIMBÓ",
  "GASPAR": "GASPAR",
  "SAO JOSE": "SÃO JOSÉ",
  "PALHOCA": "PALHOÇA",
};

/**
 * Remove acentuação e pontuação para busca tolerante
 */
function normalizeSearchText(str: string): string {
  return (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

/**
 * Verifica se um texto candidato é um nome de empresa legítimo (não é número, SIP, cargo, cidade, audiência ou ruído)
 */
function isValidCompanyCandidate(raw: string): boolean {
  if (!raw) return false;
  const clean = raw.trim();
  if (clean.length < 2 || clean.length > 40) return false;

  const upper = normalizeSearchText(clean);

  // Rejeita qualquer candidato que seja puramente números, códigos ou pontuação
  if (/^[\d\s\-#./()_]+$/.test(upper)) return false;

  // Rejeita qualquer candidato com sequências numéricas de 3 ou mais dígitos (como SIP 12345, 123456, 58493)
  if (/\d{3,}/.test(upper)) return false;

  // Rejeita faixas de datas ou idades (18-50, 18 A 60)
  if (/^\d{1,2}[\s/-]\d{1,2}/.test(upper)) return false;
  if (/^\d+\s*(?:A|ATE|-)\s*\d+/.test(upper)) return false;

  // Rejeita se começar com ou for prefixo de sistema (SIP, REQ, INPUT, VAGA, etc.)
  if (/^(?:SIP|REQ|REQUISICAO|REQUISIÇÃO|COD|CODIGO|CÓDIGO|ID|INPUT|PERAZZOLI|RHB|MISTO)[\s:#\-_]*/i.test(upper)) {
    return false;
  }
  if (/\b(?:SIP|REQ|REQUISICAO|REQUISIÇÃO|CÓDIGO|CODIGO)\b/i.test(upper)) {
    return false;
  }

  // Rejeita rateios conhecidos / cidades
  if (RATEIO_ALIASES[upper]) return false;
  if (
    upper.includes("JOINVILLE") ||
    upper.includes("ITAJAI") ||
    upper.includes("ITAJAÍ") ||
    upper.includes("BLUMENAU") ||
    upper.includes("CURITIBA") ||
    upper.includes("CAMPINAS") ||
    upper.includes("JARAGUA") ||
    upper.includes("FLORIANOPOLIS") ||
    upper.includes("SAO PAULO") ||
    upper.includes("RIO DE JANEIRO") ||
    upper.includes("PORTO ALEGRE") ||
    upper.includes("CASCAVEL") ||
    upper.includes("LONDRINA") ||
    upper.includes("MARINGA") ||
    upper.includes("CUIABA") ||
    upper.includes("CHAPECO") ||
    upper.includes("CRICIUMA")
  ) {
    return false;
  }

  // Rejeita blacklist exata
  if (BLACKLIST_COMPANY_WORDS.has(upper)) return false;

  // Rejeita se começar com cargos comuns ou termos de marketing/RH
  if (
    /^(?:OPERADOR|AUXILIAR|ANALISTA|ASSISTENTE|SOLDADOR|PINTOR|COSTUREIRA|CONFERENTE|MECANICO|MECÂNICO|ELETRICISTA|ESTAGIO|ESTÁGIO|VAGA|VAGAS|BANCO|PUBLICO|PÚBLICO|ABERTO|LOOKALIKE|LAL|INTERESSE|TURNO|ESCALA|RECRUTAMENTO|SELECAO|SELEÇÃO|CONTRATACAO|CONTRATAÇÃO|ENSINO|INICIO|INÍCIO|HOMEM|MULHER|FEED|STORIES|REELS|CARROSSEL|VIDEO|FOTO|BANNER|CRIATIVO|ANUNCIO|ANÚNCIO|PROCESSO|ALMOXARIFE|MONTADOR|MOTORISTA|RECEPCIONISTA|ATENDENTE|CAIXA|ZELADOR|PORTARIA|EMBALADOR|AJUDANTE)/i.test(
      upper
    )
  ) {
    return false;
  }

  // Rejeita se for apenas nome de analista
  if (KNOWN_ANALYST_NAMES.has(upper)) return false;

  // Rejeita se a quantidade de letras for menor que 2
  const onlyLetters = upper.replace(/[^A-ZÀ-ÿ]/g, "");
  if (onlyLetters.length < 2) return false;

  return true;
}

/**
 * Limpa o nome extraído de uma empresa retirando termos comuns, SIPs e pontuação
 */
function sanitizeCompanyName(raw: string): string {
  if (!raw) return "";
  let s = raw
    .replace(/\[.*?\]\s*/g, "")
    .replace(/\b(?:SIP|REQ|REQUISICAO|REQUISIÇÃO|COD|CODIGO|CÓDIGO|VAGA|ID)[\s:#\-_]*\d+/gi, "")
    .replace(/\b\d{3,8}\b/g, "")
    .replace(/^CBO\s+/i, "")
    .replace(/^ABO\s+/i, "")
    .replace(/^IMPULSIONAMENTO\s+(?:DE\s+)?(?:VAGA\s+(?:DA\s+|DE\s+)?)?/i, "")
    .replace(/^RECRUTAMENTO\s+(?:DE\s+)?(?:VAGA\s+(?:DA\s+|DE\s+)?)?/i, "")
    .replace(/^VAGAS?\s+(?:DE\s+|DA\s+)?/i, "")
    .replace(/\s+-\s*TEMPOR[ÁA]RIAS?$/i, "")
    .replace(/\s+-\s*EFETIVAS?$/i, "")
    .replace(/\s+LTDA.*$/i, "")
    .replace(/\s+S\.?A\.?.*$/i, "")
    .replace(/\s+DO BRASIL.*$/i, "")
    .trim();

  // Limpeza de pontuações e parênteses nas bordas: (WHIRLPOOL) -> WHIRLPOOL
  s = s.replace(/^[-–—/|:.\s()[\]]+|[-–—/|:.\s()[\]]+$/g, "").trim();

  // Se o resultado for puramente numérico ou vazio
  if (/^\(?\d+\)?$/.test(s) || /^\d+$/.test(s)) {
    return "";
  }

  // Verifica se cai no dicionário após sanitização
  const norm = normalizeSearchText(s);
  if (KNOWN_COMPANY_DICTIONARY[norm]) {
    return KNOWN_COMPANY_DICTIONARY[norm];
  }

  return s;
}

export function sanitizeAndValidateCompany(raw: string): string {
  if (!raw) return "Desconhecida";
  const s = sanitizeCompanyName(raw);
  if (!s || s === "Desconhecida") return "Desconhecida";
  if (!isValidCompanyCandidate(s)) return "Desconhecida";

  const upperNorm = normalizeSearchText(s);
  if (KNOWN_COMPANY_DICTIONARY[upperNorm]) {
    return KNOWN_COMPANY_DICTIONARY[upperNorm];
  }
  return s.toUpperCase();
}

export function extractAdSetMetadata(
  adSetName: string,
  campaignName: string,
  adName: string = "",
  extraText: string = ""
) {
  let analyst = "Desconhecido";
  let company = "Desconhecida";
  let agency = "Desconhecida";
  let contractType: CampaignData["contractType"] = "desconhecido";
  let sip = "";
  let requisitionCode = "";
  let jobTitle = "";
  let period = "";
  let isContinuous = false;
  let year = "";
  let defaultAdMessage = "";
  let rateio = "—";

  const rawFull = `${campaignName} - ${adSetName} - ${adName} - ${extraText}`.replace(/\s+/g, " ");
  const normalizedFull = normalizeSearchText(rawFull);

  // =========================================================================
  // 1. ESTRUTURA DA CAMPANHA:
  // (SIP) - EMPRESA - [MODALIDADE (EF OU TE)] - ANO - RATEIO
  // =========================================================================

  // 1.1 SIP da Campanha: (SIP) ou (12345) ou 12345
  const campSipMatch =
    campaignName.match(/^\s*\((?:SIP\s*[:\-_]*)?(\d{3,8})\)/i) ||
    campaignName.match(/\((?:SIP\s*[:\-_]*)?(\d{3,8})\)/i) ||
    campaignName.match(/^\s*(\d{4,8})\s*[-–—]/) ||
    rawFull.match(/\bSIP[:\s-]*(\d{3,8})\b/i);

  if (campSipMatch) {
    const candSip = campSipMatch[1];
    // Evita confundir anos como 2023-2028 com SIP quando são 4 dígitos
    if (!["2023", "2024", "2025", "2026", "2027", "2028"].includes(candSip)) {
      sip = candSip;
    }
  }

  // 1.2 Modalidade: [MODALIDADE (EF OU TE)]
  const contractMatch =
    campaignName.match(/\[(?:MODALIDADE\s*[:\-_]*)?(EF|TE|EFETIVO|TEMPOR[AÁ]RIO|TEMPORARIO|MISTO)\]/i) ||
    rawFull.match(/\[(EF|TE|EFETIVO|TEMPOR[AÁ]RIO|TEMPORARIO|MISTO)\]/i) ||
    campaignName.match(/\((EF|TE)\)/i);

  if (contractMatch) {
    const mode = contractMatch[1].toUpperCase();
    if (mode === "EF" || mode.startsWith("EFETIV")) {
      contractType = "efetivo";
    } else if (mode === "TE" || mode.startsWith("TEMPOR")) {
      contractType = "temporario";
    }
  } else if (/TEMPOR[AÁ]RI[AO]S?/i.test(rawFull) || /\bTE\b/i.test(campaignName)) {
    contractType = "temporario";
  } else if (/EFETIV[AO]S?/i.test(rawFull) || /\bEF\b/i.test(campaignName)) {
    contractType = "efetivo";
  }

  // 1.3 Ano da Campanha: ANO (ex: 2024, 2025, 2026)
  const yearMatch = campaignName.match(/\b(202[3-9]|203[0-9])\b/);
  if (yearMatch) {
    year = yearMatch[1];
  }

  // 1.4 Rateio da Campanha (e Fallback do AdSet): RATEIO
  const campSegments = campaignName.split(/[-–—|/]/).map((s) => s.trim()).filter(Boolean);
  if (campSegments.length >= 3) {
    const lastCampSeg = normalizeSearchText(campSegments[campSegments.length - 1]);
    if (RATEIO_ALIASES[lastCampSeg]) {
      rateio = RATEIO_ALIASES[lastCampSeg];
    }
  }

  if (rateio === "—") {
    const unidadeMatch = rawFull.match(/(?:Rateio|Unidade)\s+(?:UNIDADE\s*-\s*)?([A-Za-zÀ-ÿ\s]+?)(?:-|\[|$)/i);
    if (unidadeMatch) {
      const cand = normalizeSearchText(unidadeMatch[1].trim());
      rateio = RATEIO_ALIASES[cand] || unidadeMatch[1].toUpperCase().trim();
    } else {
      for (const [key, display] of Object.entries(RATEIO_ALIASES)) {
        const normKey = normalizeSearchText(key);
        const regex = new RegExp(`\\b${normKey}\\b`, "i");
        if (regex.test(normalizedFull)) {
          rateio = display;
          break;
        }
      }
    }
  }

  if (rateio === "—" && (normalizedFull.includes("JOINVILLE") || normalizedFull.includes("JLLE"))) {
    rateio = "JOINVILLE";
  }

  // 1.5 EMPRESA da Campanha: (SIP) - EMPRESA - [MODALIDADE] - ANO - RATEIO
  // Remove o prefixo de SIP do início do nome da campanha para isolar o bloco da EMPRESA
  const withoutSipPrefix = campaignName.replace(/^\s*\(?\s*(?:SIP\s*[:\-_]*)?\d{3,8}\s*\)?\s*[-–—:]*\s*/i, "").trim();

  if (withoutSipPrefix) {
    // 1.5.1 Tenta extrair a empresa antes de colchetes de modalidade ou traço de ano
    const directCompanyMatch =
      withoutSipPrefix.match(/^([^[\]\-–—|]+?)(?:\s*[-–—]\s*\[|\s*\[|\s*[-–—]\s*202|\s*[-–—]|$)/i) ||
      withoutSipPrefix.match(/^\(([^)]+)\)/);

    if (directCompanyMatch && directCompanyMatch[1]) {
      const cand = sanitizeCompanyName(directCompanyMatch[1].trim());
      if (isValidCompanyCandidate(cand)) {
        company = sanitizeAndValidateCompany(cand);
      }
    }
  }

  // Se ainda desconhecida, analisa os segmentos da campanha divididos por '-'
  if (company === "Desconhecida") {
    for (let i = 0; i < campSegments.length; i++) {
      const seg = campSegments[i];
      if (/^\(?\d+\)?$/.test(seg)) continue;
      if (/^\[.*?\]$/.test(seg)) continue;
      if (RATEIO_ALIASES[normalizeSearchText(seg)]) continue;

      const sanitized = sanitizeCompanyName(seg);
      if (isValidCompanyCandidate(sanitized)) {
        company = sanitizeAndValidateCompany(sanitized);
        if (company !== "Desconhecida") break;
      }
    }
  }

  // 1.5.2 Se ainda desconhecida, verifica se o conjunto possui %NOME DA EMPRESA OU VAGA%
  if (company === "Desconhecida") {
    const percentMatch = adSetName.match(/%([^%]+)%/);
    if (percentMatch) {
      const percentContent = percentMatch[1].trim();
      const percentPieces = percentContent.split(/[-–—|/]/).map((p) => p.trim());
      for (const piece of percentPieces) {
        const sanitized = sanitizeCompanyName(piece);
        if (isValidCompanyCandidate(sanitized)) {
          company = sanitizeAndValidateCompany(sanitized);
          if (company !== "Desconhecida") break;
        }
      }
    }
  }

  // Fallback: Busca direta no dicionário de clientes conhecidos
  if (company === "Desconhecida") {
    const sortedDictKeys = Object.keys(KNOWN_COMPANY_DICTIONARY).sort((a, b) => b.length - a.length);
    for (const key of sortedDictKeys) {
      const normKey = normalizeSearchText(key);
      const regex = new RegExp(`(?:^|[^A-Z0-9À-ÿ])${normKey}(?:$|[^A-Z0-9À-ÿ])`, "i");
      if (regex.test(normalizedFull)) {
        company = KNOWN_COMPANY_DICTIONARY[key];
        break;
      }
    }
  }

  // Validação final da empresa (rejeita se por algum motivo for código SIP ou número)
  if (/^\(?\d+\)?$/.test(company.trim()) || /^\d+$/.test(company.trim())) {
    company = "Desconhecida";
  } else {
    company = sanitizeAndValidateCompany(company);
  }

  // =========================================================================
  // 2. ESTRUTURA DO CONJUNTO DE ANÚNCIO:
  // (AGÊNCIA) - PERIODO PARA RODAR, SE TIVER FULL É CAMPANHA CONTINUA - %NOME DA VAGA OU REQUISIÇÃO (SE FOR NÚMERO É REQUISIÇÃO)% - RATEIO
  // =========================================================================

  // 2.1 AGÊNCIA: (AGÊNCIA) ou [AGÊNCIA]
  const agencyMatch =
    adSetName.match(/^\s*\((INPUT|PERAZZOLI|PERAZOLLI|PERAZOLI|RHB|MISTO)\)/i) ||
    adSetName.match(/\[(INPUT|PERAZZOLI|PERAZOLLI|PERAZOLI|RHB|MISTO)\]/i) ||
    rawFull.match(/\[(INPUT|PERAZZOLI|PERAZOLLI|PERAZOLI|RHB|MISTO)\]/i) ||
    rawFull.match(/\((INPUT|PERAZZOLI|PERAZOLLI|PERAZOLI|RHB|MISTO)\)/i);

  if (agencyMatch) {
    let a = agencyMatch[1].toUpperCase();
    if (a === "PERAZOLLI" || a === "PERAZOLI") a = "PERAZZOLI";
    agency = a;
  }

  // 2.2 PERÍODO PARA RODAR & CAMPANHA CONTÍNUA:
  if (/\bFULL\b/i.test(adSetName) || /\bCONTINUA\b/i.test(adSetName) || /\bCONT[IÍ]NUA\b/i.test(adSetName)) {
    isContinuous = true;
    period = "FULL";
  } else {
    const periodMatch =
      adSetName.match(/\b(\d{1,2}[\s/.-]\d{1,2}(?:\s*(?:A|ATE|ATÉ|-)\s*\d{1,2}[\s/.-]\d{1,2})?)\b/i) ||
      adSetName.match(/\b(\d{1,2}\s*(?:A|ATE|ATÉ|-)\s*\d{1,2}[\s/.-]\d{1,2})\b/i);

    if (periodMatch) {
      period = periodMatch[1].trim();
      isContinuous = false;
    }
  }

  // 2.3 %NOME DA VAGA OU REQUISIÇÃO (SE FOR NÚMERO É REQUISIÇÃO)%:
  const percentMatch = adSetName.match(/%([^%]+)%/);
  if (percentMatch) {
    const rawContent = percentMatch[1].trim();
    const digitsOnly = rawContent.replace(/\D/g, "");

    if (/^\d{3,8}$/.test(rawContent) || (digitsOnly.length >= 5 && rawContent.length <= 10)) {
      // Se for número -> É REQUISIÇÃO
      if (!["202401", "202402", "202403", "202501", "202502", "202503"].includes(digitsOnly)) {
        requisitionCode = digitsOnly;
      }
    } else {
      // Se for texto -> É NOME DA VAGA
      jobTitle = rawContent.toUpperCase();
    }
  }

  // Se não encontrou requisição dentro de %...%, busca no restante
  if (!requisitionCode) {
    const messageSource = `${extraText} ${adName} ${adSetName} ${campaignName}`;
    const greetingReqMatch =
      messageSource.match(/(?:ol[aá][!,.]?\s*)?(?:vim pela vaga|vaga|tenho interesse na vaga|candidatar.*?vaga|interesse.*?vaga)\s*(?:de\s*)?[^\d\n()[\]#]*?(?:[#[(\]]\s*)?(\d{6})\b/i) ||
      messageSource.match(/(?:REQ|REQUISI[CÇ][AÃ]O|VAGA|C[OÓ]D(?:IGO)?)[#:\s-]*(\d{6})\b/i) ||
      messageSource.match(/\b(\d{6})\b/);

    if (greetingReqMatch) {
      const candidate = greetingReqMatch[1];
      if (!["202401", "202402", "202403", "202404", "202405", "202406", "202407", "202408", "202409", "202410", "202411", "202412", "202501", "202502", "202503", "202504", "202505", "202506", "202507", "202508", "202509", "202510", "202511", "202512", "202601", "202602", "202603", "202604", "202605", "202606"].includes(candidate)) {
        requisitionCode = candidate;
      }
    }
  }

  // Se não encontrou jobTitle dentro de %...%, tenta extrair de segmentos do adSet
  if (!jobTitle) {
    const adSetSegments = adSetName.split(/[-–—|/]/).map((s) => s.trim()).filter(Boolean);
    for (const seg of adSetSegments) {
      const segUpper = normalizeSearchText(seg);
      if (/^(INPUT|PERAZZOLI|RHB|MISTO)$/i.test(segUpper)) continue;
      if (segUpper === "FULL" || /^\d/.test(segUpper)) continue;
      if (RATEIO_ALIASES[segUpper]) continue;
      if (BLACKLIST_COMPANY_WORDS.has(segUpper)) {
        jobTitle = seg.toUpperCase();
        break;
      }
    }
  }

  // 2.4 RATEIO no Conjunto de Anúncio
  const adSetSegments = adSetName.split(/[-–—|/]/).map((s) => s.trim()).filter(Boolean);
  if (adSetSegments.length >= 2) {
    const lastSeg = normalizeSearchText(adSetSegments[adSetSegments.length - 1]);
    if (RATEIO_ALIASES[lastSeg]) {
      rateio = RATEIO_ALIASES[lastSeg];
    }
  }

  // 2.5 ANALISTA
  if (analyst === "Desconhecido") {
    const analystMatch =
      rawFull.match(/\[INPUT\]\s+([A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+)?)/i) ||
      adSetName.match(/^([A-ZÀ-Ÿa-zà-ÿ]+(?:\s+[A-ZÀ-Ÿa-zà-ÿ]+)?)\s*-\s*/);

    if (analystMatch) {
      const cand = analystMatch[1].trim();
      const candUpper = normalizeSearchText(cand);
      if (KNOWN_ANALYST_NAMES.has(candUpper) || (!BLACKLIST_COMPANY_WORDS.has(candUpper) && !KNOWN_COMPANY_DICTIONARY[candUpper] && !RATEIO_ALIASES[candUpper] && cand.length <= 20)) {
        analyst = cand;
      }
    }
  }

  // 3. MENSAGEM PADRÃO / CÓPIA DO ANÚNCIO
  if (extraText && extraText.trim().length > 5) {
    defaultAdMessage = extraText.trim();
  } else if (adName && /ol[aá]|vaga|req/i.test(adName)) {
    defaultAdMessage = adName;
  } else if (requisitionCode) {
    defaultAdMessage = `Olá, vim pela vaga (${requisitionCode})`;
  } else if (jobTitle) {
    defaultAdMessage = `Olá, vim pela vaga de ${jobTitle}`;
  } else if (adName && adName !== "—" && adName !== adSetName) {
    defaultAdMessage = adName;
  }

  return {
    analyst,
    company,
    agency: agency.toUpperCase(),
    contractType,
    rateio,
    sip,
    requisitionCode,
    jobTitle,
    period,
    isContinuous,
    year,
    defaultAdMessage,
  };
}

// Normaliza datas dd/mm/yyyy → yyyy-MM-dd; aceita yyyy-MM-dd como já está.
function normalizeDay(raw: string): string {
  if (!raw) return "";
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[/\\-](\d{1,2})[/\\-](\d{2,4})/);
  if (m) {
    const [, d, mo] = m;
    let y = m[3];
    if (y.length === 2) y = "20" + y;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return "";
}

export function normalizeMetaDay(raw: string): string {
  return normalizeDay(raw);
}

export function mapMetaStatus(raw: string): CampaignData["status"] {
  return mapStatus(raw);
}

export function parseMetaCsv(text: string, account: string = "Conta principal"): CampaignData[] {
  const clean = text.replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(clean);
  const lines = clean.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const rawHeaders = parseCsvLine(lines[0], delimiter);
  const headerKeys = rawHeaders.map((h) => {
    const normalized = h.toLowerCase().replace(/"/g, "").trim();
    return HEADER_MAP[normalized] || normalized;
  });

  const campaigns: CampaignData[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i], delimiter);
    if (!values.length || values.every((v) => !v)) continue;

    const row: Record<string, string> = {};
    headerKeys.forEach((key, idx) => {
      row[key] = values[idx] || "";
    });

    const spend = parseLocalizedNumber(row.spend);
    const impressions = Math.round(parseLocalizedNumber(row.impressions));
    const reach = Math.round(parseLocalizedNumber(row.reach));
    const frequency = parseLocalizedNumber(row.frequency) || (reach > 0 ? impressions / reach : 0);
    const conversions = Math.round(parseLocalizedNumber(row.conversions));
    const costPerResult = parseLocalizedNumber(row.costPerResult) || (conversions > 0 ? spend / conversions : 0);
    const clicks = Math.round(parseLocalizedNumber(row.clicks));
    const linkClicks = Math.round(parseLocalizedNumber(row.linkClicks));
    const ctr = parseLocalizedNumber(row.ctr);
    const cpc = parseLocalizedNumber(row.cpc) || (linkClicks > 0 ? spend / linkClicks : clicks > 0 ? spend / clicks : 0);
    const cpm = impressions > 0 ? (spend / impressions) * 1000 : parseLocalizedNumber(row.cpm);

    const adSetName = row.adSetName || row.adset_name || "—";
    const campaignName = row.campaignName || row.campaign_name || `Campanha ${i}`;
    const adName = row.adName || row.ad_name || "—";
    const rawExtraText = row.defaultAdMessage || row.body || row.text || row.ad_text || row.whatsapp_message || row.mensagem || "";

    const extracted = extractAdSetMetadata(adSetName, campaignName, adName, rawExtraText);

    const assignedCompany = (row.company && isValidCompanyCandidate(row.company))
      ? sanitizeAndValidateCompany(row.company)
      : extracted.company;
    const assignedRateio = row.rateio || extracted.rateio;
    const assignedContract = (row.contractType as CampaignData["contractType"]) || extracted.contractType;
    const assignedAccount = row.account || account;
    const assignedRequisition = row.requisitionCode || extracted.requisitionCode;
    const assignedAdMessage = row.defaultAdMessage || extracted.defaultAdMessage;

    campaigns.push({
      id: `${assignedAccount}-${i}-${row.adset_id || row.id || ""}`,
      campaignName,
      adSetName,
      adName,
      status: mapStatus(row.status || "active"),
      objective: row.objective || row.resultType || "—",
      spend,
      impressions,
      clicks,
      linkClicks,
      ctr,
      cpc,
      cpm,
      conversions,
      costPerResult,
      roas: parseLocalizedNumber(row.roas),
      frequency,
      reach,
      relevanceScore: 0,
      resultType: row.resultType || "—",
      startDate: row.startDate || "",
      endDate: row.endDate || "",
      age: row.age || "—",
      gender: row.gender || "—",
      day: normalizeDay(row.day || row.date_start || ""),
      account: assignedAccount,
      analyst: extracted.analyst,
      company: assignedCompany,
      agency: extracted.agency,
      contractType: assignedContract,
      rateio: assignedRateio,
      sip: extracted.sip,
      requisitionCode: assignedRequisition,
      jobTitle: extracted.jobTitle,
      period: extracted.period,
      isContinuous: extracted.isContinuous,
      year: extracted.year,
      defaultAdMessage: assignedAdMessage,
    });
  }

  return campaigns;
}

/**
 * Re-extrai e normaliza todos os metadados de uma lista de campanhas já carregadas/cacheadas.
 * Garante que qualquer SIP no campo company, agência ou rateio desatualizados sejam corrigidos.
 */
export function rehydrateCampaignMetadata(campaigns: CampaignData[]): CampaignData[] {
  if (!campaigns || !Array.isArray(campaigns)) return [];

  return campaigns.map((c) => {
    // Se a empresa está ausente, marcada como Desconhecida, ou contém formato de SIP como (3399683) ou números
    const isCompanyInvalid =
      !c.company ||
      c.company === "Desconhecida" ||
      /^\(?\d+\)?$/.test(c.company.trim()) ||
      /^\d+$/.test(c.company.trim()) ||
      /^SIP\b/i.test(c.company.trim());

    // Se faltam campos da nova taxonomia
    const isMissingNewFields =
      !c.agency ||
      c.agency === "Desconhecida" ||
      !c.period ||
      !c.contractType ||
      c.contractType === "desconhecido";

    if (!isCompanyInvalid && !isMissingNewFields) {
      return c;
    }

    const meta = extractAdSetMetadata(
      c.adSetName || "",
      c.campaignName || "",
      c.adName || "",
      c.defaultAdMessage || ""
    );

    let updatedCompany = c.company;
    if (isCompanyInvalid) {
      updatedCompany = meta.company;
    } else {
      updatedCompany = sanitizeAndValidateCompany(c.company);
    }

    return {
      ...c,
      company: updatedCompany,
      analyst: c.analyst && c.analyst !== "Desconhecido" ? c.analyst : meta.analyst,
      agency: c.agency && c.agency !== "Desconhecida" ? c.agency : meta.agency,
      contractType: c.contractType && c.contractType !== "desconhecido" ? c.contractType : meta.contractType,
      rateio: c.rateio && c.rateio !== "—" ? c.rateio : meta.rateio,
      sip: c.sip || meta.sip,
      requisitionCode: c.requisitionCode || meta.requisitionCode,
      jobTitle: c.jobTitle || meta.jobTitle,
      period: c.period || meta.period,
      isContinuous: c.isContinuous !== undefined ? c.isContinuous : meta.isContinuous,
      year: c.year || meta.year,
    };
  });
}

