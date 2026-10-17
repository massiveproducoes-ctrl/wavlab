# DESIGN.md — Wav Lab

Referência de design para toda melhoria visual e de texto do projeto. Complementa o `CLAUDE.md` (regras técnicas) e vale para vitrine, páginas de produtor, licenças e admin. Em caso de conflito, as regras do `CLAUDE.md` vencem.

## O que é

Ateliê de produção musical feito por produtores, com contato humano direto. Hoje vende instrumentais; no futuro, sample packs e plugins. **Não é um supermercado de beats.**

## Público

Artistas independentes em geral: bandas, cantores, rappers, projetos de R&B, pop e rock. Todo mundo que quer um trabalho diferenciado. **A maioria acessa pelo celular**, então o celular (~390 px) é o tamanho principal de projeto; o desktop é a expansão.

## Referências

LANDR e Splice como estão hoje. O que se busca é o **acabamento de produto de software musical**:

- interface limpa, organizada e confiante;
- tipografia forte, com hierarquia clara;
- muito respiro;
- listas de faixas fáceis de escanear: play, BPM, tom e tags;
- contraste alto e poucos elementos decorativos.

Inspiração no nível de acabamento, **nunca** cópia de logo, cores exatas ou layout idêntico.

## Tom

Profissional e premium, mas humano. O **produtor (foto e nome)** e a **nota do autor** continuam visíveis em listas, modal e páginas de produtor: o contato humano é o diferencial em relação a esses players. Nunca remover nem esconder esses elementos por estética.

## Linguagem

- Abrangente para todos os gêneros. Sem gírias de um nicho só.
- Nos textos principais, preferir **"instrumentais"** e **"produções"** a só "beats". "Beat" e "type beat" continuam válidos onde são termo de busca ou de URL (`?beat=`, "Artista Type Beat - Nome").
- Português do Brasil.
- Textos configuráveis ficam em `config.js` (regra 1 do `CLAUDE.md`).

## O que evitar

- Cara de template.
- Cara de "feito por IA".
- Excesso de gradiente e de brilho (glow, sombras coloridas, textos com degradê).
- Estética exclusiva de trap (caveiras, fogo, grafite, fontes agressivas).

## Manter

- **Fundo escuro** e **laranja como cor de destaque** (o tom pode ser refinado).
- **Todas as funcionalidades atuais**: busca por type beat, filtros, grade/lista, rolagem infinita, player, modal de licença, "Copiar link", "Em breve no Lab", páginas de produtor, licenças e admin.

## Stack

Fixa: HTML, CSS e JavaScript puro, sem frameworks e sem build (ES5 na vitrine). Depois de qualquer mudança visual, testar busca, filtros, player, modal de compra, admin e páginas de produtor (ver "Como testar" no `CLAUDE.md`).

## Estado atual (ponto de partida, a refinar)

Valores hoje em `style.css`, que podem ser reescritos seguindo este documento:

| Item | Hoje |
|---|---|
| Fundo | `#0b0b0d` |
| Cartões | `#131316` |
| Borda | `#27272a` |
| Destaque | `#ff5500` (laranja saturado; candidato a refino) |
| Texto / texto suave | `#f4f4f5` / `#a1a1aa` |
| Fontes | Inter (corpo) e Space Grotesk (títulos) |
| Capa sem imagem | gradiente com a cor do gênero (candidato a simplificar) |

## Princípios de aplicação

1. **Celular primeiro.** Alvos de toque confortáveis, nada de scroll horizontal, play sempre ao alcance do polegar.
2. **Linha de faixa escaneável.** Play, título, produtor, BPM, tom e tags alinhados e com a mesma ordem em toda linha.
3. **Hierarquia por tipografia, não por enfeite.** Tamanho, peso e espaço antes de caixas, bordas e cor.
4. **Laranja é raro.** Reservado a ação principal, estado ativo e foco. Se tudo é laranja, nada é.
5. **Contraste alto.** Texto suave só para informação secundária e sempre legível sobre o fundo escuro.
6. **Poucos elementos decorativos.** Cada elemento precisa ter função.
7. **Aplicar em tudo.** Vitrine, `licencas.html`, páginas de produtor e admin evoluem juntos, sem ilhas com visual antigo.
