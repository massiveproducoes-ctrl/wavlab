# Wav Lab

Loja de beats (instrumentais) com vitrine pública e painel admin. Site estático, sem build e sem framework: HTML + CSS + JavaScript puro (ES5 na vitrine), com Supabase como banco, login e storage. Publicado no GitHub Pages a partir da branch `main`.

- Repositório: `massiveproducoes-ctrl/wavlab`
- Site: https://massiveproducoes-ctrl.github.io/wavlab/
- Idioma do projeto: português do Brasil (textos da tela, comentários e mensagens de commit).

## Regras (valem sempre)

1. **Tudo configurável fica em `config.js`.** Preços, licenças e termos, WhatsApp, textos do topo, tempo do preview, URL e chave do Supabase. Não escreva esses valores direto em `app.js`, `admin.js` ou nos HTMLs. Se aparecer um valor novo que o dono pode querer mudar, crie a chave em `config.js` e leia de lá.
2. **Nunca coloque `secret key` nem `service_role` no código.** Só a chave pública (`anon`) pode ficar em `config.js`. Se o usuário colar uma chave, confira o `role` antes de gravar. Qualquer chave que não seja `anon` não entra em arquivo nenhum.
3. **Sempre teste antes de publicar.** Veja "Como testar" abaixo. Se não deu para testar alguma parte, diga qual antes de pedir autorização para publicar.
4. **SQL de banco vai em arquivo separado, fora do repositório.** O usuário cola o SQL no Supabase por conta própria. Salve o arquivo (ex.: `migracao_03.sql`) em `~\Documents\wavlab-sql` (`C:\Users\pedro\Documents\wavlab-sql`), fora do repositório, nunca nesta pasta, e nunca o inclua em commit. Não rode SQL, não tente se conectar ao banco e não use chave de administrador.
5. **Commits sempre com o e-mail noreply do GitHub já configurado neste repositório** (`git config user.email` dentro desta pasta). Não use o e-mail pessoal, não mude `user.email` (nem global nem local) e não use `--author` com outro e-mail. Se `git config user.email` mostrar algo que não termine em `@users.noreply.github.com`, pare e pergunte.
6. **Publicar só quando o usuário pedir.** "Publicar" é `git commit` + `git push origin main`. Nunca faça commit ou push por iniciativa própria. Termine o trabalho, mostre o `git status` e o `git diff --stat`, e pergunte se pode publicar.

## Arquivos

| Arquivo | Para que serve |
|---|---|
| `index.html` | Vitrine pública: busca, produtores, gêneros, lista de beats, mini player, modal de licença |
| `app.js` | Lógica da vitrine (ver abaixo) |
| `style.css` | Estilos da vitrine. O admin também carrega este arquivo |
| `admin.html` | Painel admin (`/admin.html`, `noindex`). Login, abas Beats / Produtores / Pedidos, modais de beat, produtor e entrega |
| `admin.js` | Lógica do admin |
| `admin.css` | Estilos extras só do admin, por cima do `style.css` |
| `config.js` | Configuração única, lida por vitrine e admin via `window.WAVLAB` |
| `favicon.svg`, `og.png` | Ícone e imagem de pré-visualização do link (WhatsApp/Instagram) |

Os scripts são carregados na ordem: `supabase-js` (CDN jsDelivr, versão fixa) → `config.js` → `app.js` ou `admin.js`. Cada script é uma IIFE; não há módulos nem bundler.

## Como funciona

### Vitrine (`app.js`)
- Lê `beats` do Supabase com o `producers` e o `genres` embutidos (só `published = true`, mais novos primeiro) usando a chave `anon`.
- **Busca por type beat:** o texto é normalizado (minúsculo, sem acento) e as palavras "type", "beat", "instrumental" etc. são ignoradas (`STOP`). Cada palavra precisa aparecer em título, produtor, gênero, tags ou `type_artists`. A ordem de relevância é type > título > tag > resto. O termo buscado também vai para a URL (`?q=drake`).
- **Rolagem infinita:** lotes de `BATCH` (24) beats liberados por um `IntersectionObserver` no elemento `#sentinel`. Sem o observer, mostra tudo de uma vez.
- **Grade/lista:** escolha salva em `localStorage` (`wavlab_view`). O padrão é grade em tela larga e lista no celular.
- **Filtros:** gêneros e produtores só aparecem se houver mais de um. Os atalhos de busca (chips) vêm dos types e tags mais usados.
- **Player:** um único `Audio` para a página toda, cortado em `PREVIEW_SECONDS`.
- **Compra:** o modal mostra as licenças de `config.js`. O botão abre o WhatsApp (`wa.me/<WHATSAPP>`) com a mensagem pronta e grava um *lead* em `orders` com o texto exato da licença (`terms_snapshot`). O pagamento é por Pix, combinado no WhatsApp. Não existe checkout automático.
- Todo texto vindo do banco passa por `esc()` antes de ir para `innerHTML`. Mantenha assim.

### Admin (`admin.js`)
- Login por e-mail e senha do Supabase Auth. As permissões reais ficam nas regras (RLS) do banco, não no JavaScript.
- Cadastro de produtores (foto quadrada reduzida no navegador), de beats e conferência de pedidos (status `lead` → `pago` → `entregue`).
- Cadastro de beat: o título deve seguir `Artista Type Beat - "Nome"`, e o admin avisa quando não segue. Há também "Type de" (`type_artists`), tags, tom, BPM, nota, capa e preview de ~30s com tag de voz.
- **Entrega:** gera links assinados de 7 dias dos arquivos master para o usuário colar no WhatsApp do cliente.
- Excluir um beat apaga também os arquivos dele no storage.

### Supabase
- Tabelas usadas: `genres`, `producers`, `beats`, `beat_files`, `orders`.
- Buckets de storage: `covers`, `previews`, `avatars` (públicos) e `masters` (privado, só por link assinado).
- **Compatibilidade com o banco antigo:** `type_artists` (em `beats`) e `terms_snapshot` (em `orders`) vêm de uma migração SQL (`migracao_02`) que o usuário aplica no Supabase por conta própria. Se a coluna não existir, vitrine e admin tentam de novo sem ela e continuam funcionando. Preserve esse comportamento ao mexer nessas consultas.

## Como testar

Não há suíte de testes. Antes de pedir para publicar:

1. Abra o site localmente por um servidor (não por `file://`), em uma pasta/porta separada do projeto, por exemplo `python -m http.server 8000` rodado com `--directory` apontando para esta pasta. Abra `http://localhost:8000/` e `/admin.html`.
2. Confira o console do navegador: nenhum erro vermelho.
3. Na vitrine: os beats carregam; a busca (`drake type beat`, termo com acento, termo sem resultado); filtros de gênero e produtor; alternar grade/lista; rolar até o fim da lista; tocar um preview; abrir o modal e conferir o link do WhatsApp; testar em largura de celular (~390 px).
4. No admin (se mexeu nele): o login abre, as abas trocam e os modais abrem/fecham. Ações que gravam no banco só devem ser testadas com autorização do usuário, porque o banco é o de produção.
5. Se mexeu em `config.js`: confira que a vitrine mostra os valores novos.
6. Diga ao usuário o que foi testado e o que não deu para testar.

## Publicar (somente quando o usuário pedir)

1. `git status` e `git diff --stat` para o usuário conferir.
2. `git config user.email` deve ser o noreply do GitHub (regra 5).
3. `git add` apenas dos arquivos do site, citados um a um. Não use `git add -A` nem `git add .`, para não incluir `.sql` ou outro arquivo solto por engano.
4. `git commit` com mensagem em português, curta, descrevendo o que mudou para quem usa o site.
5. `git push origin main`. O GitHub Pages atualiza sozinho em ~1 minuto.
6. Se o push der erro 403, a conta salva no Windows não tem acesso ao repositório. Este repositório usa `credential.username = massiveproducoes-ctrl`. Não mexa nas credenciais salvas; avise o usuário.
7. Informe o resultado do push (deu certo ou não).
