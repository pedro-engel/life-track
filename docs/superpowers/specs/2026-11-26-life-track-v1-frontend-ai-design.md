# Design — life-track v1: Frontend (PWA) + IA embarcada

**Data:** 2026-11-26
**Autor:** Pedro (via brainstorming com Claude)
**Status:** rascunho para aprovação
**Depende de:** backend já pronto e em `master` (ver `docs/superpowers/specs/2026-11-16-strength-tracker-design.md` e o plano de backend). A API JSON do strength-tracker já existe e está testada.

---

## Intenção e o porquê

O backend do app pessoal de treino está pronto, mas **não tem nenhuma tela** — hoje é só API. Esta é a fase que transforma isso num app que o Pedro realmente abre e usa no celular.

Duas coisas nesta v1:

1. **O "app Hevy"** — a interface (PWA instalável no celular) que consome a API existente: ver o treino do dia, treinar ao vivo registrando séries, acompanhar progresso e peso corporal.
2. **A IA embarcada** — uma IA que lê os **próprios dados do app** e responde perguntas factuais tipo *"qual foi meu último supino inclinado com halteres?"*. Não dá conselhos nem opina (isso é v2); só consulta e responde o que está no banco.

**O porquê, nas palavras do Pedro:** ele abre o app **de manhã pra ver o que tem pro dia**, e **à noite pra ver o que realizou e o que vem amanhã**. Ou seja, o app é organizado em torno do **dia**, não do treino solto. A tela inicial é uma visão "Hoje".

## Decisões de produto que moldam tudo (vindas do brainstorming)

- **O app gira em torno do "Hoje".** A porta de entrada é uma tela que de manhã mostra *o que vem* e de noite mostra *o que foi feito + o que vem amanhã*.
- **"Hoje/Amanhã" é a sequência do ciclo vestida de dia** — NÃO é um calendário. Se o Pedro não treina num dia, amanhã continua mostrando o mesmo próximo passo. O ponteiro do ciclo (que o backend já tem) só anda quando ele treina. Nada de "segunda = peito".
- **Dualidade ciclo × data:** o **ciclo** é sequência (sem data); o **recap** é por data real ("o que fiz hoje" = o que aconteceu neste dia do calendário). A tela Hoje combina as duas: *próximo-da-sequência* + *acontecimentos do dia*.
- **O "resumo de vida" NÃO é uma aba de estatísticas separada** — ele aparece como o **recap da noite** dentro da tela Hoje.
- **A IA v1 é factual e read-only** — responde sobre os dados que existem. A IA "especialista/treinadora" que dá opinião fica para v2.

## Objetivos (v1)

**Frontend (PWA, consome a API que já existe):**
- **Tela Hoje:** próximo passo do ciclo + recap do dia (treino feito hoje, peso corporal de hoje). Botão para iniciar o treino do dia; opção de escolher outro passo do ciclo.
- **Treino ao vivo:** para cada exercício do template, registrar várias séries (peso × reps) + nota; mostrar **"última vez: X"** por série; **timer de descanso**; finalizar. **Resiliente a internet ruim:** o treino é persistido localmente (IndexedDB) enquanto digita e sincronizado via o `POST /sessions/sync` idempotente quando a conexão volta — sem perder treino.
- **Progresso/histórico:** gráfico de progressão por exercício + gráfico de peso corporal **na mesma linha do tempo**; lista de treinos passados.
- **Peso corporal:** registrar + ver no gráfico.
- **Editores:** gerenciar catálogo de exercícios (criar/editar os seus), templates (montar/ordenar), e o ciclo (montar a sequência).
- **PWA instalável** no iPhone (manifest + service worker), funciona na academia.

**IA embarcada (peça de backend nova + superfície no frontend):**
- **Endpoint novo `POST /ask`** (autenticado) no mesmo app FastAPI. Recebe uma pergunta em linguagem natural, roda um loop de tool-calling da API da Anthropic onde as "ferramentas" são **chamadas às rotas de leitura que já construímos** (last-set, progress, sessions, exercises, bodyweight, cycle), e devolve a resposta em texto.
- **Superfície no frontend:** um campo "Perguntar" (ask box) acessível a partir da tela Hoje.
- Responde perguntas factuais sobre os próprios dados (ex: último peso num exercício, quantas vezes treinou peito no mês, evolução do peso corporal).

## Não-objetivos (v1)

- **Tempo de tela / Instagram / dados do iPhone.** Confirmado pelo Pedro: fica para o futuro.
- **Strava / importar corridas.** O passo "corrida" do ciclo continua sendo só um marcador ("hoje é corrida"). Integração (print+OCR ou API) é futuro.
- **IA que opina/aconselha** ("faz sentido treinar ombro depois de peito?"). É a v2 "especialista".
- **Qualquer recurso social**, multiusuário, notificações push nativas (limitação consciente do PWA).
- **Novas features de backend de treino** além do endpoint `/ask` — a API de treino já está completa.

## Anti-objetivos (o que seria fracasso mesmo "funcionando")

- Tela de treino ao vivo **poluída ou lenta** com o celular na mão, suado, entre séries. Tem que ser rápida e direta.
- **Perder um treino** por internet ruim na academia. O fluxo offline-resiliente é inegociável.
- Uma IA que **inventa** números (alucina pesos/datas). Por isso ela só responde via chamadas às rotas reais, nunca "de cabeça".
- Um app que pareça um **dashboard de métricas frio** em vez do check-in diário leve que o Pedro descreveu.

## Restrições

- **Backend já existe** (FastAPI + SQLite, um usuário, auth por senha + JWT). O frontend o consome; a IA é um endpoint novo **dentro do mesmo app FastAPI**.
- **A chave da Anthropic fica só no servidor.** Nunca no navegador. Por isso a IA roda server-side.
- **Frontend construído com a skill `design-taste-frontend`** (decisão do Pedro) — PWA web.
- **Resiliência offline** no treino ao vivo (IndexedDB + sync idempotente que o backend já suporta).
- **Pré-deploy obrigatório:** definir um `JWT_SECRET` forte por variável de ambiente antes de expor na internet (o default hoje só emite um aviso de startup, não bloqueia; o default é um segredo público e forjável).
- **Privacidade (a aceitar conscientemente):** quando o Pedro usa a IA, os dados de treino relevantes saem do servidor dele para a API da Anthropic. Aceitável para um app pessoal privado; anotado para o Pedro poder rever (ex: IA local no futuro).
- **Hospedagem:** nuvem; escolha do provedor fica para a hora de publicar (não trava o desenho).

## Abordagens consideradas

### A) Stack do frontend

- **React + Vite, como PWA — ESCOLHIDA.** Melhor ferramental para as partes de instalação/offline (service worker, IndexedDB pra não perder treino) e para gráficos; casa bem com a skill de design. Mais maquinário de build, mas quem mantém sou eu (via agentes), não o Pedro.
- **Svelte/SvelteKit PWA — descartada.** Mais enxuto e ótimo DX, mas ecossistema de libs (gráficos, offline) menor; o ganho não compensa aqui.
- **HTML/JS puro — descartada.** Mínimo de dependências, mas lutaríamos contra ele para gráficos, estado do treino ao vivo e offline. Falso "simples".

### B) Como a IA lê os dados

- **Tool-calling sobre as rotas que já existem, via o Tool Runner do SDK — ESCOLHIDA.** A IA recebe "ferramentas" que são as nossas rotas de leitura (last-set, progress, sessions, exercises, bodyweight, cycle). Ela responde **chamando a API real**, nunca inventando SQL. Seguro, read-only por construção, e reaproveita tudo que já foi testado. O SDK (`client.beta.messages.tool_runner` com `@beta_tool`) dirige o loop; eu só escrevo as funções-ferramenta.
- **IA escreve SQL (NL→SQL) — descartada (v1).** Mais flexível, mas arriscado (query ruim/injeção), precisa de guardas. Fica como possível evolução se as perguntas ficarem complexas demais pras ferramentas fixas.
- **Despejar dados recentes no prompt — descartada.** Simples, mas não escala e manda dado demais pra fora.

### C) Onde a IA roda

- **Endpoint `POST /ask` no próprio backend FastAPI — ESCOLHIDA.** Mantém a chave da Anthropic no servidor; reusa a autenticação JWT; fica pertinho dos dados.
- **Managed Agents (Anthropic hospeda o loop) — descartada.** Overkill e custo/infra a mais para um Q&A pessoal; preferimos hospedar o loop no nosso próprio FastAPI.
- **Navegador chama a Anthropic direto — descartada.** Exporia a chave da API no cliente. Inaceitável.

## Decisões de construção (o "como")

- **Frontend:** React + Vite, PWA (manifest + service worker). Biblioteca de gráficos à escolha de quem implementa (ex: Recharts/visx) — guiada pela skill `design-taste-frontend` e pela skill `dataviz` para os gráficos. Consome a API JSON existente; token JWT guardado no cliente; HTTPS em produção.
- **Offline do treino ao vivo:** o treino em andamento é persistido em **IndexedDB** conforme o Pedro digita; ao finalizar (ou quando a conexão volta) um mecanismo de sync chama `POST /sessions/sync` com IDs (UUID) estáveis — o backend já é idempotente, então reenvio não duplica.
- **IA:** endpoint `POST /ask` autenticado, roda o **Tool Runner** da API da Anthropic. Modelo **`claude-opus-5-5`** por padrão (thinking adaptativo); se o Pedro quiser cortar custo, dá pra trocar por `claude-sonnet-5-5` ou `claude-haiku-5-5` — decisão dele, não minha. As ferramentas expõem, como funções, as consultas de leitura que já existem no backend. A resposta volta como texto para o frontend.
- **"última vez" na tela ao vivo:** o frontend consulta `GET /exercises/{id}/last-set?position=N` **antes** de sincronizar a sessão atual (ou passando `exclude_session_id` da sessão em andamento) para não ecoar a série de hoje como referência — o backend já suporta os dois caminhos.
- **Tela Hoje:** monta a visão a partir de `GET /cycle` (próximo passo) + consultas por data do dia (treino de hoje, peso de hoje). O "amanhã" é o passo seguinte na sequência do ciclo.

### Decisões resolvidas no builder-check (minhas chamadas — Pedro pode vetar)

- **Serviço único (não dois).** O próprio FastAPI serve o build do PWA como arquivos estáticos — uma URL só, caminhos de API relativos (`/sessions`, `/cycle`…), **sem CORS**, um container só pra publicar. Em desenvolvimento, o Vite usa um dev-proxy pro backend. (A alternativa — frontend e backend em serviços/origens separados com `CORSMiddleware` + `VITE_API_BASE_URL` — foi descartada por ser mais peça pra manter num app de uma pessoa.)
- **`POST /ask` bloqueante com estado de "pensando…" (não streaming token-a-token) na v1.** O tempo de espera é majoritariamente o loop de ferramentas (consultas ao banco), não a geração do texto final — que é curto. Então streaming do texto renderia pouco; o que resolve o "15s em silêncio parece que travou" no mobile é um **indicador de carregamento claro**. O endpoint devolve `{"answer": "..."}`. Streaming/progresso fica como refinamento futuro fácil.

## Fases de entrega (minha decisão — pode ser revista)

Ambas são v1; esta é só a ordem de construção:

1. **Fase 1 — o app usável (frontend sobre a API atual):** Tela Hoje, treino ao vivo (com offline/sync), progresso/histórico, peso corporal, editores. No fim desta fase o Pedro já usa o app na academia.
2. **Fase 2 — a IA:** endpoint `/ask` + superfície "Perguntar" no frontend.

## O que fica a cargo de quem implementa

- Estrutura de pastas do frontend, componentes, organização do código e do estado.
- Escolha da biblioteca de gráficos e de componentes.
- Mecânica fina do timer de descanso (duração padrão, se é por exercício etc.).
- Até onde o service worker leva o offline (o mínimo inegociável é não perder o treino ao vivo).
- Layout e visual — guiados por `design-taste-frontend`.
- O conjunto exato de ferramentas que a IA recebe e o texto do system prompt dela (dentro da restrição: só leitura, só via rotas reais).
- Como a tela Hoje decide "é de manhã / é de noite" (ex: por horário, ou sempre mostrar os dois blocos).

## Portas para o futuro (não construir na v1, só não impedir)

- **Tempo de tela / dados do iPhone** por print+OCR ou manual (o Pedro confirmou que quer, só não agora). A IA de visão que lê os prints seria a mesma peça da IA factual.
- **Strava** por print+OCR ou API; o passo "corrida" do ciclo passa a exibir a corrida.
- **IA especialista/treinadora** (v2) — opina sobre rotina e exercícios.
- **IA local** (se um dia a privacidade pesar mais que a conveniência).
