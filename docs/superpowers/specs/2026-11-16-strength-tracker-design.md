# Design — App de registro de treino (estilo Hevy), pessoal

**Data:** 2026-11-16
**Autor:** Pedro (via brainstorming com Claude)
**Status:** rascunho para aprovação

---

## Intenção e o porquê

Pedro não tem rotina de exercícios: acorda e decide no dia se corre ou faz
musculação, sem estrutura — e por isso se sente perdido. Ele quer um app
**pessoal** (só pra ele, sem rede social) que faça duas coisas:

1. **Dar estrutura:** uma rotina de treino em ciclo que ele segue, pra parar
   de decidir do zero todo dia.
2. **Registrar e mostrar evolução:** peso, reps e séries de cada exercício, e
   peso corporal, pra enxergar progresso ao longo do tempo.

**Objetivo de fundo:** ser saudável e "secar" (perder gordura) sem perder
força. Por isso o acompanhamento de **progressão de carga** cruzado com a
**evolução do peso corporal** é o coração do valor — não é um diário, é uma
ferramenta de progressão.

As corridas ele já registra no **Strava** como atividades privadas e quer
continuar assim; a longo prazo quer ver corrida e musculação no mesmo lugar.

## Objetivos (v1)

- **Ciclo de treino em sequência** (ex: peito → costas → corrida → ombro →
  descanso → repete) que o app acompanha, dizendo qual é o próximo e avançando
  conforme ele treina. Flexível: dá pra pular/trocar; o ciclo anda conforme o
  que é feito, não conforme o calendário.
- **Modelos por grupo muscular** (peito, costas, ombro…), cada um com sua base
  fixa de exercícios. São as "peças" que compõem o ciclo.
- **Treino ao vivo:** para cada exercício do modelo, registrar várias séries de
  **peso × reps**, com um campo de **nota/descrição** por exercício (ex:
  "máquina", "halter 20kg"). Abaixo de cada série, mostrar **"última vez:
  40kg × 10"** como referência de progressão. **Timer de descanso** que dispara
  ao fechar uma série.
- **Biblioteca de exercícios:** o app já vem com uma **lista base** organizada
  por grupo muscular, e o usuário pode **criar/editar os seus** a qualquer
  momento.
- **Peso corporal:** registro avulso (quando ele se pesa), com **gráfico de
  evolução**.
- **Progresso e histórico:** gráfico de **progressão por exercício** (peso ao
  longo do tempo) e **histórico** de treinos feitos. O gráfico de peso corporal
  e os de exercício ficam **na mesma linha do tempo**, pra você "cruzar a olho"
  carga subindo × peso corporal caindo. *(decisão minha: v1 entrega os gráficos
  separados numa visão de tempo comum; um gráfico sobreposto de eixo-duplo fica
  como melhoria futura — o revisor perguntou se o cruzamento era obrigatório na
  v1.)*
- **Corrida na v1:** apenas um **marcador** no ciclo ("hoje é corrida →
  registra no Strava"). Sem logar corrida dentro do app.
- **Entrega:** PWA (web app instalável no celular), que funcione na academia.

## Não-objetivos (v1)

- Qualquer recurso social (seguir pessoas, curtir, comentar, compartilhar).
- Logar corridas dentro do app (distância/tempo manuais). Corrida é marcador.
- Integração com Strava já funcionando (é o **próximo passo**, não a v1).
- IA especialista (é **v2**).
- Medidas corporais além do peso (cintura etc.) — anotado como futuro.
- Multiusuário. É um app de uma pessoa só.
- Vídeos/demonstrações de exercícios (o Hevy tem; aqui não é necessário).
- Notificações push nativas (limitação consciente do PWA).

## Anti-objetivos (o que tornaria isto um fracasso mesmo "funcionando")

- Um app que **brigue com o usuário** por sair da rotina. O ciclo é guia, não
  carcereiro: pular/trocar tem que ser fácil e sem atrito.
- Uma tela de treino **poluída/lenta** de usar com o celular na mão, suado,
  entre séries. A tela ao vivo tem que ser rápida e direta.
- Travar no meio do treino por causa de internet ruim na academia.
- Perder dados de treino (histórico é o ativo mais valioso aqui).

## Restrições

- **Backend em Python** (decisão do usuário).
- **Frontend** construído com a skill `design-taste-frontend` (decisão do
  usuário) — PWA web.
- Uso pessoal, um único usuário; precisa ser **acessível da academia** (fora de
  casa).
- Arquitetura precisa deixar "portas" prontas, sem construir agora, para:
  (a) **leitura de corridas do Strava** (só leitura, atividades privadas);
  (b) **IA especialista** em exercícios (v2).

## Abordagens consideradas

**A) PWA + FastAPI + SQLite, hospedado na nuvem — ESCOLHIDA.**
Um frontend web instalável como PWA; backend Python com FastAPI servindo API
JSON; SQLite como banco (um arquivo, ideal pra usuário único, backup trivial,
migração futura possível); hospedado em serviço barato/free pra alcançar da
academia; login por PIN/senha simples. Mais curto caminho pro que importa,
casa com Python + skill de design, e já nasce pronto pra Strava e IA.

**B) App nativo (React Native/Flutter) + FastAPI — descartada.**
Melhor sensação e push nativo, mas introduz segunda linguagem no front (foge da
skill de design web escolhida), taxa/revisão de loja, e muito mais trabalho.
Overkill para um usuário.

**C) Roda só na máquina do usuário / servidor em casa — descartada.**
Custo zero e dados 100% locais, mas exige túnel (Tailscale/ngrok) ou servidor
sempre ligado pra usar na academia — manutenção chata e ponto de falha
justamente durante o treino.

## Decisões de construção (o "como")

- **Backend:** Python + **FastAPI**. API JSON. Escolhido por ser leve, rápido de
  desenvolver e forte pra integrações externas (Strava) e chamadas de IA (v2).
- **Banco:** **SQLite** (arquivo único). Suficiente e simples para um usuário;
  caminho de migração pra Postgres existe se um dia precisar.
- **Frontend:** PWA web, construído com a skill `design-taste-frontend`. Service
  worker + manifest pra instalação e funcionamento offline básico (ver "a
  resolver"). Consome a API do FastAPI.
- **Entrega/hospedagem:** nuvem; **a escolha do provedor fica para a hora de
  publicar** (há opções free que servem). Não trava o desenho.
- **Resiliência de conexão (treino ao vivo):** durante o treino, o que o usuário
  registra é **persistido localmente no próprio celular** (ex: IndexedDB)
  conforme ele digita — funciona mesmo com internet instável na academia.
  Quando a conexão volta, um mecanismo de **sincronização** envia os dados ao
  servidor (escritas idempotentes / fila de saída), sem travar no meio da série
  e sem perder nada. *(decisão do usuário: nível "meio-termo"; não é offline
  total, é "não perco o treino se a internet cair".)* Isso molda o fluxo de
  dados e o formato da API (aceitar lotes idempotentes de séries).
- **Login:** por ser usuário único, autenticação enxuta: **senha de verdade**
  (não um PIN de 4 dígitos), sessão por token e **HTTPS obrigatório**.
  **Sem** limite de tentativas/bloqueio *(decisão do usuário; o revisor havia
  sugerido o bloqueio porque o app fica exposto na internet, mas o usuário optou
  por não ter — fica como possível reativação futura numa linha).*
- **Corrida (v1):** dia do tipo "corrida" no ciclo é só um marcador visual, sem
  tela de log.

### Modelo de dados (esboço — detalhe fica para o plano)

- **Exercise** (exercício do catálogo): nome, grupo muscular, se é base do app
  ou criado pelo usuário, descrição opcional. Trocar máquina/halter **não** cria
  exercício novo — é o mesmo exercício; o equipamento vai na nota.
- **WorkoutTemplate** (modelo por grupo muscular): nome (ex: "Peito"), lista
  ordenada de exercícios que compõem a base daquele grupo.
- **RoutineCycle** (ciclo): sequência ordenada de etapas (cada etapa = um
  WorkoutTemplate, ou um marcador "corrida", ou "descanso") + um ponteiro de
  "onde estou no ciclo". **Regras do ponteiro** *(decisão minha, a partir do
  "flexível, anda conforme o que faz")*: concluir o treino atual avança o
  ponteiro em um; se o usuário escolher uma etapa que **não** é a próxima, o
  ciclo "segue o que ele fez" e o ponteiro passa a apontar para logo depois
  dessa etapa; etapas de "corrida" e "descanso" avançam com um toque de
  "feito". Nunca bloqueia pular/trocar.
- **WorkoutSession** (treino realizado): data/hora, qual template, e os
  exercícios feitos.
- **SetEntry** (série registrada): exercício, peso, reps, nota, ordem, marcada
  como concluída. A referência **"última vez"** mostra, para a série N de hoje,
  a série N **do último treino em que esse exercício foi feito** (série 1 ⇄
  série 1); se naquele dia houve menos séries, cai para a última série
  existente. *(decisão minha — é como o Hevy faz; o revisor notou que "mesma
  posição de série" e "série mais recente qualquer" dão números diferentes.)*
- **BodyWeightEntry:** data + peso corporal.

### Telas principais (esboço)

- **Início / "próximo no ciclo":** mostra o próximo treino, botão Iniciar, e
  opção de escolher outro do ciclo.
- **Treino ao vivo:** exercícios → séries (peso × reps) + nota, "última vez: X"
  por série, timer de descanso, finalizar.
- **Montar/editar modelos** e **montar/editar o ciclo**.
- **Catálogo de exercícios** (base + criar/editar os seus).
- **Peso corporal:** registrar + gráfico.
- **Progresso/histórico:** gráficos por exercício + lista de treinos passados.

## O que fica a cargo de quem implementa

- Estrutura de pastas/projeto, nomes de módulos, organização do código.
- Detalhe fino do schema do banco e migrações.
- Escolha de biblioteca de gráficos no front.
- Mecânica exata do timer de descanso (duração padrão, se é por exercício etc.).
- Conteúdo inicial exato da **lista base** de exercícios por grupo muscular.
- Detalhes visuais e de layout — guiados pela skill `design-taste-frontend`.
- Como o service worker lida com offline (até onde funciona sem internet).

## Portas para o futuro (não construir na v1, só não impedir)

- **Strava (próximo passo):** leitura de atividades privadas (OAuth + processo
  de aprovação do Strava). O dia "corrida" do ciclo passará a exibir a corrida
  puxada de lá. Modelar o ciclo de forma que a etapa "corrida" possa ganhar
  dados depois.
- **IA especialista (v2):** avaliar rotina/treino e responder perguntas tipo
  "faz sentido treinar ombro um dia depois de peito?" ou "esse exercício faz
  sentido pro meu objetivo?". É o diferencial frente aos apps free. FastAPI
  facilita plugar isso.
- **Medidas corporais** (cintura etc.) além do peso.
