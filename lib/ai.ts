import { generateObject, generateText } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import type { DemandSnapshot } from "@/lib/demand";

/**
 * Camada de IA — análise da vitrine de um tenant (Fase 8, plano Premium).
 *
 * Usa o Google Gemini via Vercel AI SDK. A chave vem de
 * `GOOGLE_GENERATIVE_AI_API_KEY` (lida automaticamente pelo SDK). O modelo
 * pode ser sobrescrito por `AI_MODEL`.
 */

const MODEL = process.env.AI_MODEL ?? "gemini-2.5-flash";

/** True quando a chave da API está configurada. */
export function aiConfigured(): boolean {
  return !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;
}

/** Snapshot da vitrine de um tenant — a entrada da análise. */
export interface VitrineSnapshot {
  nome: string;
  cidade: string | null;
  cores: { primaria: string; destaque: string };
  hero: { estilo: string; titulo: string | null; subtitulo: string | null; temImagem: boolean };
  cards: { estilo: string; porFila: number };
  catalogo: {
    total: number;
    disponiveis: number;
    comFoto: number;
    marcas: string[];
    precoMin: number | null;
    precoMax: number | null;
  };
}

export const analiseSchema = z.object({
  resumo: z.string().describe("Uma frase resumindo o estado geral da vitrine."),
  recomendacoes: z
    .array(
      z.object({
        area: z.enum(["marca", "layout", "catalogo", "conteudo"]),
        severidade: z.enum(["alta", "media", "baixa"]),
        titulo: z.string().describe("Título curto e direto."),
        sugestao: z.string().describe("O que fazer — concreto e acionável."),
      }),
    )
    .min(3)
    .max(7),
});

export type Analise = z.infer<typeof analiseSchema>;

const SYSTEM = `Você é um consultor de vitrines digitais para concessionárias de
veículos seminovos no Brasil. Analisa a vitrine de uma loja e dá recomendações
práticas para vender mais. Seja direto, específico e escreva em português do
Brasil. Não invente dados além do que foi fornecido. Foque no que tem impacto
real em conversão: clareza, confiança, qualidade e cobertura das fotos,
coerência visual e textos que vendem.`;

/** Analisa a vitrine e devolve recomendações estruturadas. */
export async function analisarVitrine(snapshot: VitrineSnapshot): Promise<Analise> {
  const { object } = await generateObject({
    model: google(MODEL),
    schema: analiseSchema,
    system: SYSTEM,
    prompt:
      "Analise esta vitrine e gere de 3 a 7 recomendações priorizadas " +
      "(severidade 'alta' = maior impacto em vendas):\n\n" +
      JSON.stringify(snapshot, null, 2),
  });
  return object;
}

/** Veículo + loja — a entrada da legenda do post de Instagram. */
export interface PostInput {
  veiculo: {
    marca: string;
    modelo: string;
    versao: string | null;
    ano: string;
    km: number;
    cambio: string;
    combustivel: string;
    cor: string;
    precoFormatado: string;
    condicao: string;
    carroceria: string | null;
    opcionais: string[];
    blindado: boolean;
    unicoDono: boolean;
  };
  loja: {
    nome: string;
    cidade: string | null;
    whatsapp: string | null;
  };
}

const SYSTEM_LEGENDA = `Você escreve legendas de Instagram para concessionárias
de veículos seminovos no Brasil. Escreva em português do Brasil, com tom
comercial e acolhedor, sem exageros nem promessas. Use no máximo 4 emojis, bem
colocados. Estruture a legenda assim: a primeira linha com o veículo (marca,
modelo, versão e ano); 1 a 2 linhas com os destaques; o preço; uma chamada para
ação com o WhatsApp da loja (quando houver); e de 3 a 5 hashtags relevantes ao
final. Não invente nenhuma informação que não tenha sido fornecida.`;

/** Gera a legenda do post de Instagram para um veículo. */
export async function gerarLegendaPost(input: PostInput): Promise<string> {
  const { text } = await generateText({
    model: google(MODEL),
    system: SYSTEM_LEGENDA,
    prompt:
      "Gere a legenda do post para este veículo:\n\n" +
      JSON.stringify(input, null, 2),
  });
  return text.trim();
}

export const dicasDemandaSchema = z.object({
  resumo: z.string().describe("Uma frase resumindo o que a demanda mostra."),
  dicas: z
    .array(
      z.object({
        titulo: z.string().describe("Título curto e direto da dica."),
        texto: z.string().describe("A recomendação — concreta e acionável."),
        oportunidade: z.enum(["alta", "media", "baixa"]),
      }),
    )
    .min(2)
    .max(5),
});

export type DicasDemanda = z.infer<typeof dicasDemandaSchema>;

const SYSTEM_DICAS = `Você é um consultor de demanda para concessionárias de
veículos seminovos no Brasil. Recebe os sinais anônimos de busca e visualização
do marketplace e do site de uma loja, e sugere ações concretas de estoque e de
anúncio. Escreva em português do Brasil, direto e prático. Baseie-se apenas nos
dados fornecidos — se um sinal for fraco (poucos eventos), diga isso em vez de
inventar tendência.`;

/** Gera dicas de demanda a partir dos snapshots do marketplace e da loja. */
export async function gerarDicasDemanda(input: {
  marketplace: DemandSnapshot;
  loja: DemandSnapshot;
}): Promise<DicasDemanda> {
  const { object } = await generateObject({
    model: google(MODEL),
    schema: dicasDemandaSchema,
    system: SYSTEM_DICAS,
    prompt:
      "Analise estes sinais de demanda e gere de 2 a 5 dicas priorizadas " +
      "(oportunidade 'alta' = maior potencial de venda):\n\n" +
      JSON.stringify(input, null, 2),
  });
  return object;
}
