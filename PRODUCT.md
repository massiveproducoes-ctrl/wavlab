# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Artistas independentes de qualquer gênero (bandas, cantores, rappers, projetos de R&B, pop e rock) que querem um trabalho diferenciado. A maioria acessa pelo celular. O trabalho deles: ouvir instrumentais, achar o que combina com a música que vão gravar, escolher uma licença e fechar a compra.

Segundo público, interno: os produtores (hoje Alexandre, Drin, Faciebat e Felipe), que têm página própria em `/<slug>/` estilo link na bio, e o dono do site, que usa o painel admin.

## Product Purpose

Wav Lab é um ateliê de produção musical feito por produtores, com contato humano direto. Hoje vende instrumentais com licença; no futuro, sample packs e plugins ("Em breve no Lab", com lista de espera). Sucesso: o artista ouve o preview, escolhe a licença e chama no WhatsApp. O pagamento é por Pix, combinado na conversa. Não há checkout automático.

## Positioning

Não é um supermercado de beats nem um marketplace anônimo. Cada produção sai das mãos de quem assina (foto, nome e nota do autor ficam visíveis), e o artista fala direto com a equipe. LANDR e Splice são a referência de acabamento de produto, não de modelo: o diferencial da Wav Lab é o atendimento humano que eles não oferecem.

## Operating Context

- Compra: preview de 30 s, modal de licença, mensagem pronta no WhatsApp, Pix. O lead é gravado em `orders` com o texto exato da licença.
- Quatro licenças (MP3, WAV, Stems, Unlimited), todas **não exclusivas**, com preço igual para todos os produtores no beta. Valores e limites vivem em `config.js` e são provisórios até combinados com os produtores.
- Estática no GitHub Pages; dados, login e arquivos no Supabase.
- Medição sem dado pessoal (`events`), lista de espera (`waitlist`) e admin com abas de Beats, Produtores, Pedidos, Lista de espera e Resumo.

## Capabilities and Constraints

- Busca por type beat, filtros por gênero e produtor, grade/lista, rolagem infinita, mini player único, modal de licença, "Copiar link" (`?beat=ID`), páginas de produtor, página de licenças e admin.
- Stack fixa: HTML, CSS e JavaScript puro, sem framework e sem build (ES5 na vitrine). Regras técnicas completas em `CLAUDE.md`.
- Idioma: português do Brasil. Nos textos principais, preferir "instrumentais" e "produções" a só "beats"; "beat" e "type beat" seguem válidos como termo de busca, de URL e de título.
- Exclusividade: a licença padrão é não exclusiva; **exclusividade existe sob consulta pelo WhatsApp, com preço combinado**. O site não deve prometer "exclusivo" como atributo de todo instrumental. O texto atual do `<meta description>` ("Instrumentais exclusivos") contradiz isso e deve ser corrigido.
- Em aberto: o slogan ("Beats com identidade.") ainda está em definição; prazo de resposta e preço de exclusividade não estão definidos.

## Brand Commitments

- Nome: Wav Lab (wordmark "WAV.LAB" com "LAB" em laranja, ícone de ondas). Fundo escuro e laranja como destaque são compromissos do dono; o tom do laranja pode ser refinado.
- Voz: profissional e premium, mas humana. Abrangente para todos os gêneros, sem gíria de um nicho só e sem estética exclusiva de trap.
- Os produtores aparecem com foto e nome, e a nota do autor continua visível. Isso não se esconde por estética.

## Evidence on Hand

- Quatro produtores reais com página própria (`alexandre/`, `drin/`, `faciebat/`, `felipe/`) e catálogo no Supabase.
- Texto "Quem somos" e blocos de licenças em `config.js`.
- Não há depoimentos, números de vendas nem logos de clientes; nada disso deve ser inventado.
- O Instagram oficial do estúdio é o @wavlab.studio (`instagram.com/wavlab.studio`), usado no rodapé.

## Product Principles

1. **O humano vem antes da vitrine.** Produtor, nota do autor e WhatsApp têm de estar sempre à vista.
2. **Ouvir e escolher em poucos toques.** Do preview à licença, o caminho é curto, principalmente no celular.
3. **Dizer só o que é verdade.** Licenças, exclusividade e prazos aparecem como estão em `config.js`; nada de promessa que o produto não cumpre.
4. **Serve a qualquer gênero.** Linguagem e identidade não pertencem a um nicho.
5. **Cresce para além de instrumentais.** A estrutura comporta sample packs e plugins sem virar outro site.

## Accessibility & Inclusion

Padrão: contraste WCAG AA, foco visível, movimento reduzido respeitado e alvos de toque confortáveis no celular. Sem exigência adicional informada.
