# 06 — Registro de decisões

Todas as decisões tomadas com o usuário, com o código usado na conversa. Decisões ainda não confirmadas ficam em **Pendentes** como **(proposto)**.

## Rodada 1: Conceito (2026-11-12)

| Código | Decisão |
|---|---|
| C1 | Os dois: o jogador caça animais **e** é caçado por uma criatura. Sobrevivência completa com coleta, construção e crafting (gênero de Minecraft, Valheim, The Forest). |
| C2-A | Primeira pessoa. |
| C3-B | Mundo aberto contínuo com save. |
| C4-A | Low-poly escuro com neblina. |
| C-extra | Neblina densa; a criatura espreita, faz pequenos sons de passos e tem olhos brilhantes (pouco visível no escuro e na neblina); pequenos barulhos do jogador importam; faca = caça silenciosa, mais segura e mais difícil; armas = mais fácil e mais barulhenta. |

## Rodada 2: Mecânicas (2026-11-12)

| Código | Decisão |
|---|---|
| T0-C | Babylon.js, com teste de carga na 1ª fase. Se o navegador não aguentar, trocar para Godot cedo. |
| M1-B | Ruído: raio de som por ação, modificado pelo tipo de chão. |
| M2-A | Medidor de ruído discreto no HUD. |
| M3-B | A luz (tocha, fogueira) também denuncia o jogador. |
| M4-B | A criatura dá dano grande e recua para a neblina; o fogo a afasta; ela não pode ser morta. |
| M5-B | Ciclo de dia e noite: a criatura existe sempre; ronda de longe de dia e caça ativamente à noite. |
| M6-B | Presas: coelho (fácil, pouca carne) e cervo (arisco, muita carne). |
| M7-B | Armas: faca, arco e espingarda (rara, munição escassa, barulho enorme). |
| M8-A | Faca: mata na hora se a presa não notou o jogador. |
| M9-A | Necessidades: vida, fome e fôlego. |
| M10-A | Construção por peças encaixadas em grade (fundação, parede, telhado, porta) desde o início. |
| M11-C | Mundo procedural infinito, gerado por semente. |
| M12-A | Morte: renasce na cama; uma mochila com os itens fica no local da morte. |
| M-extra | Modelos de boa qualidade, revisados quantas vezes forem necessárias. |

## Rodada 3: Técnica e arte (2026-11-12)

| Código | Decisão |
|---|---|
| T1-A | TypeScript + Vite. |
| T2-B | Física com Havok. |
| T3-A | Save no navegador (IndexedDB). |
| T4-A | Só computador, teclado e mouse. |
| T5-B → T5a-C | Começou como ECS; depois de saber que o Babylon não tem ECS nativo, ficou **Behaviors + Observables nativos do Babylon** (sem biblioteca de ECS). |
| T6-A | Testes só com Vitest (lógica). |
| T7 | Tudo local: o jogo não será publicado (sem VPS, sem deploy). |
| A1-A | Modelos 100% procedurais no Babylon (TypeScript), sem Blender por enquanto. O desafio proíbe modelos 3D prontos. |
| A2-C | Revisão de modelos por capturas no PR **e** por uma cena de galeria. |
| A3 | Sons prontos: permitidos. Texturas e imagens geradas por outra IA: permitidas. Música: Epidemic Sound. Bibliotecas: permitidas. |
| A4-A | Som espacial 3D (direção e distância). |
| A5-B | Animação por esqueleto com skinning (a malha deforma com os ossos). |

## Rodada 4: Prazo, escopo e organização (2026-11-12)

| Código | Decisão |
|---|---|
| D1 | Prazo: dia 20 (ver G1). |
| D2 | Desafio informal, avaliado por pessoas, pelos 3 temas: sobrevivência, floresta sombria, furtividade e caça. |
| D3 | GitHub, sem exigência do desafio; os avaliadores rodam o jogo localmente. |
| O1-A | Todo o escopo decidido entra na versão do dia 20 (com uma ordem de corte como plano reserva, ver G9). |
| ~~O2-A~~ | ~~Um PR pequeno por issue; o usuário revisa antes do merge, várias vezes por dia.~~ Substituída por R2 em 2026-11-16 (commits direto na `main`). |
| O3-A | Nome: **Silent Hunt**. |
| O4-A | Textos do jogo em pt-BR. |
| O5-A | Repositório público; a música do Epidemic Sound fica fora do Git. |
| O6-C | Efeitos sonoros: Epidemic Sound e Freesound (CC0 e CC-BY, com créditos). |
| O7-A | Fonte gratuita do Google Fonts, escolhida pelo usuário. |
| O8-A | Projeto no Linear (uma issue por item), GDD em `docs/` espelhado em Linear Docs, CI no GitHub. |

## Rodada 5: Valores do GDD (2026-11-12)

Propostos por Claude e aprovados pelo usuário ("G1 a G14 - Ok"; G15 com a cor escolhida; G16 e G17 ok).

| Código | Assunto | Onde |
|---|---|---|
| G1 | Prazo: 20/11/2026, até o fim do dia. | [02-escopo](02-escopo.md) |
| G2 | Controles (teclas). | [03-mecanicas](03-mecanicas.md#controles) |
| G3 | Raios de ruído e efeito do chão. | [03-mecanicas](03-mecanicas.md#furtividade) |
| G4 | Dia de 10 min e noite de 6 min. | [03-mecanicas](03-mecanicas.md#mundo) |
| G5 | Chunks de 64 m, raio 2; teste de carga aprovado com média ≥ 60 FPS e sem travadas > 100 ms. | [05-arquitetura](05-arquitetura.md#teste-de-carga-t0-c) |
| G6 | Vida, fome e fôlego; save automático a cada 60 s. | [03-mecanicas](03-mecanicas.md#necessidades) |
| G7 | Recursos (incluindo fibra e couro), receitas (incluindo machado) e peças de construção. | [03-mecanicas](03-mecanicas.md#coleta-crafting-e-construção) |
| G8 | Versões por marco (`v0.1.0` … `v1.0.0`). | [02-escopo](02-escopo.md) |
| G9 | Ordem de corte se atrasarmos. | [02-escopo](02-escopo.md#ordem-de-corte) |
| G10 | Música em `assets-private/music/`, fora do Git, enviada à parte. | [04-arte-e-som](04-arte-e-som.md#música) |
| G11 | Visibilidade (luz, neblina, agachar) e tocha. | [03-mecanicas](03-mecanicas.md#furtividade) |
| G12 | Comportamento da criatura (distâncias, tempos, dano). | [03-mecanicas](03-mecanicas.md#a-criatura) |
| G13 | Presas e caça (carne, munição, flechas, cabana abandonada com a espingarda). | [03-mecanicas](03-mecanicas.md#caça) |
| G14 | Paleta e pós-processamento (granulado, vinheta, glow). | [04-arte-e-som](04-arte-e-som.md#estilo-visual-c4-a) |
| G15 | Criatura alta e magra, sem rosto, olhos **branco-amarelados**. | [04-arte-e-som](04-arte-e-som.md#a-criatura) |
| G16 | Organização das pastas do código, `src/config.ts` e limites de triângulos. | [05-arquitetura](05-arquitetura.md#organização-do-código) |
| G17 | Galeria aberta por `/?galeria` e checklist de revisão de modelos. | [04-arte-e-som](04-arte-e-som.md#revisão-dos-modelos-a2-c) |

## NBB-124: Projeto base e CI (2026-11-12 e 2026-11-16)

| Código | Decisão |
|---|---|
| I1-A | Projeto criado com o gerador oficial do Vite (modelo `vanilla-ts`), sem os arquivos de exemplo. |
| I2-A | `@babylonjs/core` e `@babylonjs/havok`; Inspector (`@babylonjs/inspector`) só em desenvolvimento, aberto com F9. |
| I3-A | Regras do Codetomb: Prettier (ponto e vírgula, aspas duplas, vírgula final, 100 colunas), TypeScript `strict`, ESLint sem `any`, sem `!`, com `import type` e só pacotes declarados, `--max-warnings=0`. |
| I4-A | Scripts `dev`, `build`, `preview`, `lint`, `typecheck`, `test`, `test:watch`, `format`, `format:check`; porta 5173. |
| I5-A | Node 24 (`.nvmrc` e `engines`). |
| I6-A | `.gitattributes` (LF; imagens, fontes, sons e `.wasm` binários) e `.gitignore` com `assets-private/`. |
| I7-A | Workflows `ci`, `codeql` e `pr-title`, Dependabot (npm e GitHub Actions), `CODEOWNERS`, label `dependencies`. |
| I8-A | Cena mínima de prova: chão, luz, neblina, câmera orbital, caixa caindo com Havok e contador de FPS. |
| V1-A | TypeScript 6.0 (o `typescript-eslint` ainda não suporta o 7); o Dependabot ignora o major 7. |
| V2-A | ESLint 10 com `eslint-plugin-import-x` (o `eslint-plugin-import` original não suporta o ESLint 10). |

## NBB-126: Galeria de modelos (2026-11-16)

| Código | Decisão |
|---|---|
| GL1-B | Interface da galeria com o **Babylon GUI** (`@babylonjs/gui`), desenhada dentro da cena. |
| GL2-A | Galeria pronta já, com um catálogo de modelos (`src/models/registry.ts`, uma linha por modelo); por enquanto mostra só a "Caixa de teste". |
| GL3 | Três modos de luz provisórios (dia, noite, neblina), com os valores em `src/config.ts`. A luz de verdade vem na NBB-130. |
| GL4 | Textos do painel: "Modelo", "Semente", "Dia", "Noite", "Neblina", "Animações", "Triângulos", "Voltar ao jogo". |

## NBB-127: Jogador em primeira pessoa (2026-11-16)

| Código | Decisão |
|---|---|
| J1 | Velocidades: ~~andar 1,6 m/s, correr 4,5 m/s, agachado 0,9 m/s~~ **andar 2,4, correr ~~5,5~~ 5,8, agachado 1,3 m/s** (AJ2-A e PS9-A, 2026-11-23). |
| J2 | Olhos a 1,7 m (1,0 m agachado); pulo de 0,6 m. |
| J3 | Sensibilidade do mouse fixa no `src/config.ts` até o menu de opções (NBB-150). |
| J4 | Até o mundo existir, o jogador anda no chão de 50 m da cena de prova. |
| J5-A | Agachar só com o C (alternar). O "Ctrl segurado" do G2 saiu, porque Ctrl+W fecha a aba do navegador e não pode ser bloqueado. |

## NBB-128: Modelos procedurais do mundo (2026-11-16)

| Código | Decisão |
|---|---|
| W1 | Formas e tamanhos: pinheiro (cones empilhados, 8–14 m), carvalho (tronco que se divide e copa de bolhas, 6–10 m), árvore morta (tronco torto e galhos secos, 5–9 m), arbusto (0,6–1,2 m), pedra (0,3–1,5 m), galho seco no chão (0,5–1 m) e tufo de folhagem (0,2–0,5 m). |
| W2 | Cores dentro da paleta G14 (pinheiro verde-escuro azulado, carvalho e arbusto verde-oliva, troncos marrom-acinzentados, madeira morta cinza-claro, pedras cinza com musgo no topo), com pequena variação por semente. |
| W3-A | Vento: balanço das copas calculado na placa de vídeo (shader). |
| W4 | Triângulos: pinheiro ~300, carvalho ~500, árvore morta ~250, arbusto ~150, pedra ~80, galho ~24, tufo ~12. Na implementação, o arbusto ficou com 240–400 (com menos parecia cristal). |

### Revisões da NBB-128 (2026-11-16)

| Código | Decisão |
|---|---|
| Revisão 1 | O usuário mandou 10 imagens de referência ("inspiração, não igual"): vegetação com galhos recursivos e placas de folhas desenhadas por código. |
| M-T1 | Limite de triângulos por árvore: de 600 (G16) para **1.500**. Semente 1: pinheiro 1.022, carvalho 698, árvore morta 1.316. Na NBB-129, a neblina permite limitar a distância de desenho. |
| Revisão 2 | Texturas nas superfícies, para não ficarem "lisas": casca (troncos, galhos e galho caído), pedra e chão de floresta (terra, musgo, folhas secas e gravetos), todas desenhadas por código e com mapa de relevo (*normal map*). |

## NBB-129: Mundo infinito (2026-11-16)

| Código | Decisão |
|---|---|
| MW1 | Relevo: colinas suaves de até ±6 m, espaçadas ~100 m; malha do chão a cada 2 m. |
| MW2 | Por chunk: ~80 árvores (45% pinheiro, 35% carvalho, 20% morta), ~40 arbustos, ~15 pedras, ~30 galhos, ~150 tufos; clareiras (0,1×) e mata fechada (1,5×). **Mais 20 pedras soltas pequenas por chunk (AJ1-A, 2026-11-23).** |
| MW3-A | 8 variações de cada modelo, geradas ao abrir o jogo e repetidas pelo mundo (*thin instances*) com rotação e tamanho ±15%. |
| MW4 | Nada é desenhado além de 90 m. |
| MW5 | Troncos e pedras grandes bloqueiam; arbustos, capim e galhos no chão não. |
| MW6 | Tipos de chão com tom próprio (musgo mais verde, folhas mais marrons); manchas de galhos secos com mais galhos no chão. |

## NBB-130: Dia, noite e neblina (2026-11-16)

| Código | Decisão |
|---|---|
| DN1-A | Sem céu desenhado: a cor da neblina é o céu. |
| DN2 | Noite com luar azulado fraco: silhuetas visíveis até ~15 m, quase preto além disso. |
| DN3 | Cores da neblina: cinza-azulado de dia, cinza-alaranjado no entardecer e no amanhecer, azul quase preto à noite. Densidade calculada para a visibilidade do G11 (40 m de dia, 15 m à noite). |
| DN4 | Granulado leve e vinheta moderada; brilho preparado para os olhos da criatura e o fogo. |
| DN5 | Só em desenvolvimento: a tecla T acelera o tempo 20×. |

## NBB-131: Ruído e medidor no HUD (2026-11-16)

| Código | Decisão |
|---|---|
| NO1-A | HUD feito com o Babylon GUI (o mesmo da galeria). |
| NO2 | Medidor de ruído: barra fina e discreta embaixo no centro, branca e semitransparente; cresce com o raio e pulsa a cada passo. |
| NO3 | Um ruído por passo: a cada 0,55 s andando, 0,35 s correndo e 0,8 s agachado. |
| NO4-B | O galho seco estala (12 m) ao pisar a menos de 0,4 m de um galho visível no chão, uma vez por galho. O chão de "galhos secos" usa o multiplicador das folhas (×1,4). |
| NO5 | Só em desenvolvimento: a tecla N desenha no chão o círculo de cada ruído. |

## NBB-132: Tocha e visibilidade (2026-11-16)

| Código | Decisão |
|---|---|
| TO1-A | Provisório: tochas ilimitadas até o crafting (NBB-144). Cada uma queima 4 min; acabou, o F acende outra. |
| TO2 | A tocha aparece segurada no canto inferior direito; as mãos vêm na NBB-139. |
| TO3 | Luz laranja de 12 m com cintilação leve; a chama usa o brilho (G14). |
| TO4 | Nos últimos 20 s a chama diminui e falha antes de apagar. |
| TO5 | `VisibilitySystem` calcula a que distância o jogador é visto (RF-13); não aparece na tela, só no console de desenvolvimento. |

## Replanejamento (2026-11-16)

O M0 estava previsto para 12–13/11 e só avançou em 16/11 (cerca de 3 dias de atraso).

| Código | Decisão |
|---|---|
| R1-B | Manter **todo o escopo** até 20/11, apesar do atraso. A ordem de corte (G9) continua como reserva, mas não é aplicada agora. |
| X1-C | **Sem teste de carga e sem testes automáticos novos**, para ganhar tempo. A NBB-125 foi cancelada e o Babylon fica definitivo (muda T0-C). O Vitest e o teste existente continuam no CI, mas as regras novas não ganham testes (muda T6-A). O limite do passo da física, que seria feito no teste de carga, vai para a NBB-127. |
| R2 | **Sem PRs:** commits direto na `main` (substitui O2-A). O usuário revisa pelos commits e pelo resumo no chat; o que Claude decidir sozinho vai no resumo e num comentário da issue no Linear. |

## NBB-133: Modelo da criatura (2026-11-16)

| Código | Decisão |
|---|---|
| CR1 | O usuário mandou 4 imagens de referência (wendigo com crânio de cervo e galhadas), como inspiração, não para copiar. |
| CR2 | Pele **cinza-escura quase preta**, seca e rachada como casca de árvore, desenhada por código. Ela se camufla entre os troncos e na neblina. |
| CR3 | Quatro animações: **Andar** (em pé, curvada, passos longos e lentos), **Espreitar** (baixa, nas quatro, devagar), **Atacar** (golpe com o braço longo) e **Recuar** (foge rápido nas quatro). |
| CR4 | A criatura deve "enganar o cérebro": o jogador não consegue ler expressão nenhuma nela, é algo **sem alma**. |
| CR4a | A cabeça é um **crânio de cervo** claro, sem pele, com **galhadas** e os olhos no fundo das órbitas (seguindo o CR1). Ele tem focinho e mandíbula, mas nenhuma expressão. Muda o CR4 (cabeça lisa sem boca) e o G15 ("sem rosto definido"). |
| CR3a | "Atacar" é só o bote com o golpe (1 s). A corrida até o jogador fica para a IA (NBB-134). Muda o CR3, que juntava a corrida e o golpe. |

O usuário aprovou o modelo e as animações em 2026-11-16 ("modelos ok").

## NBB-134: IA da criatura (2026-11-16)

| Código | Decisão |
|---|---|
| IA1-A | Ela desvia das árvores "enxergando" os troncos e pedras grandes próximos (*steering*), com os dados que o mundo já guarda. Sem malha de navegação. |
| IA2 | Velocidades: rondar 1,2 m/s; espreitar até 3 m/s (só o necessário para acompanhar); atacar e recuar 7 m/s. As animações aceleram com a velocidade. |
| IA3 | Espreitar a 90% da distância que o jogador enxerga na neblina (cerca de 36 m de dia e 13 m à noite). |
| IA4-B | "Olhada" = dentro de um cone de 25° no centro da tela e dentro da distância da neblina. Ela congela; encarada por mais de 4 s, recua devagar para a neblina. O relógio até o ataque continua contando. |
| IA5 | De noite, ronda 20–40 s e passa a espreitar. De dia, a cada 2–4 min espreita de longe por 30 s, sem atacar. Ouve qualquer ruído que a alcance e vai investigar; de dia, só ruídos de 50 m ou mais. Vê num cone de 120° com o alcance do `VisibilitySystem`. |
| IA6 | A mais de 150 m do jogador, ela reaparece fora da vista, na distância de rondar. |
| IA7-A | Sem colisão com o jogador: o golpe é decidido pela distância. |
| IA8 | Paredes e portas (RF-54) vão para a issue de construção; sem testes das transições (X1-C); o golpe dispara um evento de dano que a NBB-136 vai usar; `silentHunt.creature()` e `silentHunt.creatureState()` só em desenvolvimento. |
| IA9 | Detalhes da implementação, propostos por Claude e aprovados ("1 a 12 - Ok"): investigar a 3 m/s e olhar em volta por 5 s; bote a 2 m e dano só se o jogador ainda estiver a até 2,5 m no meio do golpe; recuo de 6 s a 1,5 m/s depois de encarada; tocha com o mesmo cone de 25° (no ataque hesita 1,2 s e foge; espreitando foge direto); recuar a 7 m/s até 15 m além da neblina e depois rondar; novo ponto de ronda ao chegar ou a cada 25 s; entardecer e amanhecer contam como dia; espreita do lado onde já está; ruídos só afetam ronda e investigação; começa atrás do jogador a 60–120 m; raio do corpo 0,4 m, desvio 2,5 m à frente, giro de 4 rad/s; `creatureStep()` e `faceCreature()` só em desenvolvimento. |

## NBB-135: Olhos e passos da criatura (2026-11-16)

| Código | Decisão |
|---|---|
| OL1-B | Os olhos ignoram a neblina, mas esmaecem com a distância: brilho cheio até a distância da neblina, sumindo até 30% além dela. Cada olho ganha um halo suave para ser percebido de longe. |
| SO1-A | Sons do **Freesound com licença CC0**: Claude propõe 2–3 candidatos por som, o usuário escolhe e Claude baixa a prévia em MP3 de alta qualidade para `public/sounds/` (anotada no `CREDITS.md`). |
| SO2 | Passos da criatura a cada meio ciclo da animação (andar ~0,7 s, espreitar ~1 s e mais baixo, galope ~0,3 s e mais forte), parada sem som, tom variando ±10%, som 3D audível até 25 m (RF-25). |
| SO3 | Respiração lenta e áspera em loop quando ela espreita a menos de 20 m; rosnado curto e grave ao começar o ataque (aviso para erguer a tocha); recuo em silêncio. |
| SO4 | Volume mestre no `src/config.ts` (0,8); o controle pelo jogador vem no menu de opções (NBB-150). O áudio é liberado no clique que captura o mouse. |
| SO5 | Sons escolhidos: P1 (passos, Cinetony), R1 (respiração, perspektywa_tn) e G1 (rosnado, yatoimtop), todos CC0. Detalhes propostos por Claude e aprovados ("1 a 7 - Ok"): halo de 20 cm, 6 cm à frente da órbita; 6 passos recortados e normalizados; volumes (passos 0,7 / 0,4 / 1, respiração 0,6 com 1,5 s de transição, rosnado 1); sons em mono, respiração com pontas suavizadas; `fogVisibility()` compartilhada; textura de ponto suave em `textures.ts`; som caindo em linha reta de 1 m a 25 m. |

### Revisão da criatura no jogo (2026-11-16)

| Código | Decisão |
|---|---|
| TM1-B | A criatura fica **1,3× maior**: cerca de 3 m até o alto do crânio e 3,9 m com as galhadas. O modelo inteiro é escalado (malha, ossos, olhos e animações); os triângulos não mudam. |
| AP1-A | **De dia**, se o jogador chega a menos de 60% da distância da neblina (~22 m) ou corre na direção dela a menos de 30 m, ela foge para a neblina a 7 m/s e fica 60–90 s longe (como no "Recuar"). Nunca é alcançada. |
| AP2-A | **À noite**, se o jogador chega a menos de 8 m sem tocha acesa, ela ataca na hora. Com a tocha encarada, continua fugindo (RF-24). |
| AP3 | Detalhes propostos por Claude e aprovados ("1 a 5 - Ok"): raio do corpo de 0,5 m; bote a 2 m e dano a até 2,5 m; "correr na direção dela" = o jogador se aproximando a mais de 3 m/s; à noite, um ruído perto dela a traz até o jogador e a menos de 8 m ela ataca; qualquer tocha acesa impede o ataque imediato a menos de 8 m. |

## NBB-136: Vida, dano e morte (2026-11-16)

| Código | Decisão |
|---|---|
| VD1-C | Barra de vida fina no canto inferior esquerdo, no estilo do medidor de ruído. Só aparece quando a vida não está cheia e some 3 s depois de encher. |
| VD2 | A cada golpe: clarão vermelho nas bordas (0,4 s) e tremor curto da câmera (0,25 s). Com vida abaixo de 30, bordas escuras e avermelhadas pulsando devagar. Sem som novo. |
| VD3-B | Até a fome existir, ela conta como cheia. A recuperação só começa 5 s depois do último dano. |
| VD4 | Tela de morte: escurece em 1,5 s, "Você morreu", "Sobreviveu N dia(s)" e o botão "Renascer"; o mouse é liberado. |
| VD5 | Renascer: ponto inicial (a cama vem na NBB-146), vida cheia, o relógio segue, a criatura é mandada para longe e a tocha é mantida. |
| VD6 | Sem testes da lógica de vida (X1-C); `silentHunt.health()` e `silentHunt.damage(n)` só em desenvolvimento. |
| VD7-B | **A vida só volta de dia** (1 por segundo, com fome acima de 50); **à noite o corpo não sara**. Sem isso a criatura nunca mataria: um golpe sararia antes de ela voltar. Muda o RF-40. |
| VD8 | Detalhes propostos por Claude e aprovados ("1 a 9 - Ok"): barra de 160 px vermelho-escura na altura do medidor de ruído; bordas em degradê desenhado por código (clarão vermelho vivo; vida baixa pulsando entre 50% e 90% a cada 1,6 s); tremor de até ~1,7°; tela de morte em bege-acinzentado com botão escuro, dias contados pelo tempo jogado desde o começo ou o último renascer; amanhecer e entardecer contam como dia; controles travados e criatura mandada para longe na morte e ao renascer; renasce em pé olhando reto; recusa da captura do mouse tratada; `DayClock.elapsed` e `cycleSeconds`. |

## Cronograma (2026-11-17)

| Código | Decisão |
|---|---|
| ~~CT1-A~~ | ~~Manter todo o escopo (R1-B) e reavaliar no fim de 18/11: se o M3 não estiver pronto, cortar os itens 1 e 2 da ordem de corte (espingarda e crafting além do básico).~~ Substituída por PZ1. |
| PZ1 | Em 2026-11-17 o usuário pediu para esquecer o prazo: sem ponto de controle nem cortes por causa da data. Todo o escopo segue, no ritmo da qualidade. |

## NBB-137: Modelos do coelho e do cervo (2026-11-17)

| Código | Decisão |
|---|---|
| CO1 | O usuário mandou referências: cervos realistas (veado-vermelho e corça) e coelhos selvagens marrons (orelhas longas, patas traseiras grandes, cauda branca). Inspiração, não cópia. |
| CO2 | Coelho com ~40 cm de comprimento; cervo com ~1,8 m de comprimento e 1,1 m na cernelha. |
| CO3 | Só corças, **sem galhada**: a galhada fica exclusiva da criatura, então um vulto com galhos na cabeça na neblina é sempre ela. |
| CO4 | Coelho marrom-acinzentado com cauda clara; cervo marrom-avermelhado apagado com barriga e traseira claras; cores na paleta do `config.ts`. |
| CO5 | Detalhes propostos por Claude e aprovados ("1 a 5 - Ok", "modelos ok"): textura de pelo desenhada por código; cores exatas na paleta; ritmos (cervo: galope 0,6 s, morrer 0,8 s; coelho: salto 0,4 s, morrer 0,6 s); esqueleto, skinning e poses compartilhados em `src/models/rig/`; olhos dos animais escuros, sem brilho. |

## NBB-138: IA das presas (2026-11-17)

| Código | Decisão |
|---|---|
| PR1 | Por chunk: 40% de chance de 1–2 coelhos e 20% de chance de um grupo de 1–3 cervos. Aparecem e somem com os chunks; um animal abatido não reaparece na mesma sessão (o save é a NBB-147). A mais de 70 m ficam parados, sem pensar nem animar. |
| PR2 | O coelho ouve o ruído que o alcança e vê o jogador até a distância do `VisibilitySystem`; o cervo, o dobro dos dois. Visão em cone de 270° (ponto cego de 90° atrás). Do alerta à fuga: um segundo ruído em até 5 s, ou o jogador a menos da metade da distância em que foi visto. |
| PR3-A | Pastam parados, virando o corpo devagar de vez em quando; o coelho dá um pulinho curto a cada 10–20 s. Sem animação de andar. |
| PR4 | Fuga a 7 m/s (coelho) e 9 m/s (cervo), para longe do susto, desviando das árvores com o mesmo desvio da criatura. |
| PR5 | Os animais também fogem quando a criatura passa a menos de 20 m: bichos correndo de repente avisam que ela está perto. |
| PR6 | Sem testes das transições (X1-C); `silentHunt.prey()` só em desenvolvimento. |
| PR7 | Detalhes propostos por Claude e aprovados ("1 a 8 - Ok"; FPS ok no PC do usuário): o grupo de cervos foge junto (pastam a até 5 m uns dos outros); alerta enquanto vê o jogador, volta a pastar após 5 s sem estímulo; giros (pastando 0,6 rad/s a cada 6–12 s, alerta 3 rad/s, fuga 6 rad/s); pulinho de 0,8 s a 1,5 m/s; pasta onde a fuga terminar; modelos reaproveitados; mesmos animais por chunk; `teleport` e `face` só em desenvolvimento. |

## NBB-139: Mãos e faca (2026-11-17)

| Código | Decisão |
|---|---|
| SA1-B | Os sons dos animais (bufo de alarme do cervo primeiro, galope, fuga do coelho) ficam para a issue de som (NBB-149), junto com os demais. |
| MA1 | Braços em primeira pessoa feitos por código (mangas de casaco escuro e mãos), presos à câmera. Mão direita com o item; mão esquerda com a tocha quando acesa (a tocha passa para a esquerda). Até ~2.000 triângulos. |
| MA2 | Faca: lâmina de ~18 cm, cinza-metálica e gasta, cabo de madeira escura. |
| MA3 | Provisório: até o inventário (NBB-143), a faca fica sempre na mão direita. |
| MA4 | Botão esquerdo: estocada de 0,4 s, novo golpe só depois de 0,6 s. Acerta o que estiver a até 1,5 m num cone de 30° no centro da tela: presa calma morre, em alerta foge, fugindo nada; a criatura recua. |
| MA5 | Mãos com balanço leve parado (respiração), balanço no ritmo do passo e a estocada. |
| MA6 | Sem testes da regra do ataque furtivo (X1-C); sem som de golpe por enquanto (NBB-149). |
| FA1-A | Animal pastando está distraído: ouve só a metade do raio do ruído (em alerta, volta a ouvir normal). Assim o passo agachado nas folhas (2,8 m) só alcança um coelho pastando a 1,4 m, e dá para chegar por trás até a faca (1,5 m). O cervo, que ouve o dobro, continua difícil. |
| MA7 | Detalhes propostos por Claude e aprovados ("1 a 7 - Ok", "mãos ok"; o usuário matou um coelho no PC): punho direito no canto inferior direito com a lâmina um pouco para cima, mão esquerda mais baixa segurando a tocha perto do topo; casaco marrom-oliva e pele em material fosco liso; punho fechado com polegar; estocada recua 6 cm e avança 20 cm, acerto aos 0,24 s e ruído depois do acerto; de perto vale qualquer parte do corpo no cone; o clique que captura o mouse não golpeia; `stab()` só em desenvolvimento. |

## NBB-140: Arco e flechas (2026-11-17)

| Código | Decisão |
|---|---|
| AR1 | Provisório até o inventário (NBB-143): **1** pega a faca e **2** pega o arco; 10 flechas iniciais até o crafting (NBB-144). Sem flechas, não dispara. |
| AR2 | Segurar o botão esquerdo puxa a corda (até 1 s), soltar dispara. Segurar o direito mira (zoom leve e arco firme). Dá para disparar sem mirar. |
| AR3-A | A flecha voa por cálculo próprio (curva com gravidade e choque com chão, troncos e animais), sem corpo do Havok. Velocidade de 15 m/s (puxão curto) a 45 m/s (corda toda puxada). Muda o "(Havok)" do RF-33. |
| AR4 | Coelho morre com uma flecha. Cervo: a primeira o deixa ferido (foge a 75% da velocidade), a segunda mata. A criatura recua, sem dano. Flecha que erra faz 4 m de ruído onde cai. |
| AR5 | A flecha fica cravada onde caiu; **E** a pega a até 2 m. Ao acertar algo, quebra com 25% de chance; se acertou um animal e não quebrou, cai no chão junto dele. |
| AR6 | Arco curvo de ~1,2 m com corda, na mão esquerda; a direita puxa a corda. Flecha de ~70 cm com ponta de pedra e penas. Pegar o arco apaga a tocha (o tempo restante fica guardado). |
| AR7 | Um ponto pequeno e discreto no centro da tela, só enquanto mira ou puxa a corda. |
| AR8 | "Flechas: N" discreto no canto inferior direito, só com o arco na mão. |
| AR9 | Sem testes de dano e quebra (X1-C). |
| AR10 | Detalhes propostos por Claude e aprovados ("1 a 9 - Ok"): braço esquerdo à frente e arco inclinado ~25°, centralizando ao mirar; corda recua 14 cm na tela; o tiro vai ao centro da tela; puxão abaixo de 15% cancela sem gastar flecha; alvos (coelho 16 cm, cervo duas esferas de 30 cm, criatura duas de 45 cm, troncos até 6 m); flecha some após 5 s de voo; dica "[E] Pegar flecha" com qualquer item, ponto de mira e contador brancos a 55%; cores do arco e da flecha na paleta; ferramentas de desenvolvimento do arco. |

## NBB-141: Espingarda (2026-11-17)

| Código | Decisão |
|---|---|
| ES1 | Cabana de toras pequena (~3×4 m), meio arruinada (telhado com buraco, vão de porta sem porta, janela), com o baú e a espingarda numa mesa. A primeira fica a ~60 m do início, numa direção sorteada pela semente, numa pequena clareira; outras são raras (~1 a cada 12 chunks), só com baú. Não é refúgio: as paredes bloqueiam, mas o golpe da criatura alcança lá dentro. |
| ES2 | Espingarda de dois canos (2 cartuchos carregados). Tecla 3 (provisória, só depois de achada); esquerdo atira, direito mira com zoom, R recarrega em 2 s. Ocupa as duas mãos: pegar a espingarda apaga a tocha. |
| ES3 | Tiro instantâneo num cone de 4°; até 40 m mata qualquer presa, além disso não acerta; a criatura recua sem dano. Clarão curto no cano e tranco na câmera. |
| ES4-A | Sons do tiro e da recarga buscados agora (Freesound CC0, o usuário escolhe), antes da NBB-149. |
| ES5 | E abre o baú, com mensagem de 3 s ("Você encontrou: ..."). Outros baús: 35% de chance de 1–2 cartuchos. Baús abertos são lembrados na sessão (save na NBB-147). "Cartuchos: N" no canto com a espingarda na mão. |
| ES6 | Sem testes da munição e do loot (X1-C). |
| ES7 | Detalhes propostos por Claude e aprovados ("1 a 6 - Ok"): a espingarda vem descarregada; cabana de 4 × 3 m (paredes de 2,1 m, cumeeira a 3,05 m), colisão por caixas e piso 2 cm acima do chão; E alcança 1,8 m; clarão de 0,06 s e tranco de 0,25 s; espingarda baixa no quadril e no olho ao mirar (FOV 0,62); o cone ganha a margem do tamanho do alvo; troncos, pedras grandes, paredes e morros barram o tiro; o contador soma cano e reserva. Os obstáculos ganharam altura (pedra até o topo, tronco até 6 m, parede até a cumeeira), o que corrige também a flecha. |
| SN1-A | Som do tiro: "Shotgun Shot 01" (LilMati, CC0), uma Beretta 687 de dois canos. |
| SN2-A | Som da recarga: "Single Barreled Shotgun Loading" (sentryx86, CC0), recortado em 2 s: abrir, dois cartuchos, fechar. |
| SN3 | Detalhes propostos por Claude e aprovados ("1 a 4 - Ok", "modelos ok"): tiro com os primeiros 1,75 s e o fim suavizado; recarga montada no ritmo da animação (abrir 0 s, cartuchos 0,55 s e 1,05 s, fechar 1,75 s); sons em mono e sem 3D, por saírem das mãos do jogador; volumes 1,0 (tiro) e 0,8 (recarga). |

## NBB-142: Carcaça, fome e cozinhar (2026-11-17)

| Código | Decisão |
|---|---|
| CA1-B | Limpar a carcaça é segurar E (coelho 2 s, cervo 5 s), com barra de progresso; o jogador fica parado e exposto; soltar cancela. |
| CA2-A | Limpar exige a faca na mão (tecla 1); com outro item, a dica diz "Precisa da faca". |
| CA3-B | Depois de limpa, a carcaça vira um resto (ossos e pele no chão), feito por código, que fica até o chunk ser descarregado. |
| CA4-A | O cervo dá 1 couro (a cama pede 2, então 2 cervos). |
| FO1-A | Provisório até o inventário (NBB-143): contador no canto com carne crua, carne cozida e couro. |
| FO2-A | Provisório até o inventário: Q come uma carne na hora (a cozida primeiro, senão a crua), com mensagem curta. |
| FO3-B | Barra de fome âmbar ao lado da vida, só com a fome abaixo de 50 (quando a vida para de voltar); abaixo de 20, pulsa devagar. |
| FO4-B | Ao renascer, a fome volta a 50. |
| CZ1-A | A fogueira básica é adiantada para esta issue: modelo (pedras em círculo, toras e chamas), luz e a criatura mantendo 8 m (RF-24). Provisório: tecla G coloca uma à frente, sem custo, uma por vez, sem apagar sozinha até a rodada de progressão (PG). A NBB-146 fica com a cama e a receita da fogueira. |
| CZ2-A | E perto da fogueira põe uma carne crua no espeto (até 4 ao mesmo tempo); ela escurece e fica pronta em 10 s; E pega a cozida. Não queima. O jogador pode se afastar. |
| CZ3 | Modelos da fogueira, da carne e do resto feitos por código e revisados na galeria e por capturas (dia, noite, neblina); as chamas reaproveitam a técnica da tocha. |
| CZ4 | Sem testes de fome e cozimento (X1-C). |
| CZ5 | Detalhes propostos por Claude e aprovados ("1 a 12 - Ok", "modelos ok"): alcance para limpar (coelho 1,5 m, cervo 2,2 m); segurar E cancela ao soltar ou andar; mensagens ("Você conseguiu: ...", "Você comeu: ...", "Você não tem carne", "Você está sem fome" acima de 95); contador só com o que não é zero, acima do contador da arma; fome zerada tira vida sem clarão; barra de fome à direita da vida; fogueira a 1,8 m com o espeto atravessado, sem colisão, luz de 14 m, e colocar outra devolve as carnes; "perto da fogueira" até 8 m; pegar a cozida antes de cozinhar outra, "O espeto está cheio"; modelos (fogueira com 9 pedras e 5 toras, carne com osso, restos do coelho = os do cervo menores); galeria em duas colunas; ferramentas de desenvolvimento. O animal morto passou a ficar deitado (o "Morrer" segura o último quadro). |

## Progressão (2026-11-17)

Pedido do usuário: o jogador começa sem nada e vai progredindo; a fonte de luz é o recurso mais importante; como a tocha protege da criatura à noite, ela deve ser difícil de fazer.

| Código | Decisão |
|---|---|
| PG1-A | O jogador começa **sem nada**: a primeira tarefa é a faca de pedra (1 galho, 1 pedra, 1 fibra). |
| PG2-A | A tocha passa a pedir **gordura animal**: 1 galho, 1 fibra e 1 gordura. A carcaça dá gordura (coelho 1, cervo 3). Para ter luz à noite é preciso caçar de dia. Recurso novo (RF-50). |
| PG3-A | A tocha continua durando 4 min (RF-14): são 2 tochas por noite. |
| PG4-A | A fogueira pede a receita (4 galhos, 4 pedras) e **combustível**: queima 5 min; E com um galho na mão soma 2 min, até 10 min. Apagada, não afasta a criatura. |
| PG5-A | Arco e flechas só pelo crafting (RF-51). |
| PG6 | Os atalhos provisórios (tochas ilimitadas TO1-A, fogueira na tecla G CZ1-A, faca sempre na mão MA3, arco com 10 flechas AR1) saem quando o inventário e o crafting existirem (NBB-143, NBB-144, NBB-146). |

## NBB-143: Coleta e inventário (2026-11-17)

| Código | Decisão |
|---|---|
| IN1-A | Inventário em grade com pilhas: 6 espaços da barra rápida + 18 da mochila. Pilhas de 20 (recursos e flechas), 10 (comida e cartuchos) e 1 (ferramentas). Cheio, não pega mais. |
| IN2-A | Comer: carne selecionada na barra + botão esquerdo ("usar item", G2). Substitui o Q provisório (FO2-A). |
| IN3-A | O Tab não pausa: o mundo continua enquanto o inventário está aberto. |
| IN4-A | Mover itens: clicar para pegar e clicar para soltar; o botão direito pega metade de uma pilha. |
| IN5-A | Até o crafting (NBB-144), o inventário começa com um kit provisório: faca, arco, 10 flechas; as tochas continuam se repondo sozinhas (TO1-A). A NBB-144 esvazia o kit (PG1-A, PG6). |
| IN6-B | Qualquer item selecionado aparece na mão (carne, galho, pedra, fibra...), com modelos feitos por código e revisados na galeria. |
| IN7-A | Ícones: miniaturas dos próprios modelos 3D, desenhadas por código ao abrir o jogo (fibra, gordura, couro e cartucho ganham modelos). |
| CL1 | Galho: E no galho do chão (ele some e para de estalar). Pedra: E nas pedras pequenas, que não bloqueiam (abaixo de 0,6 m), que somem. Fibra: segurar E 1,5 s num arbusto, que dá 2 fibras e some. Gordura: na limpeza da carcaça (PG2-A). O que foi pego fica na lista de mudanças do chunk. |
| CL2-A | Cortar árvores e quebrar pedras grandes ficam na NBB-144, junto com o machado. |
| CL3 | Sem testes do inventário (X1-C). |
| IN8 | Detalhes propostos por Claude e aprovados ("1 a 11 - Ok", "modelos ok"): item novo vai primeiro para a barra rápida; kit com faca no espaço 1, arco no 2 e flechas na mochila; barra de 52 px acima do medidor de ruído, com o nome do item por 1,6 s ao trocar; com o Tab aberto o jogador fica parado e o mouse livre (Tab fecha e devolve o mouse, Esc fecha sem devolver; morrer fecha a tela); "Inventário cheio" onde não couber (o baú fica fechado); coleta a 1,6 m ("Pegar galho", "Pegar pedra", "Colher fibra"); a tocha só é bloqueada com arco ou espingarda; ícones com o item deitado na diagonal, visto de cima, fundo transparente; posição, giro e escala de cada item na mão (galho e pedra são os modelos do mundo reduzidos); mudar a fogueira provisória com o inventário cheio perde as carnes que não couberem; ferramentas de desenvolvimento. Modelos de fibra, gordura, couro e cartucho aprovados. |

## NBB-144: Crafting e machado (2026-11-17)

| Código | Decisão |
|---|---|
| CF1-A | As receitas ficam numa coluna ao lado do inventário, no Tab, todas à vista: ícone, nome, custo (o que falta em vermelho) e o botão "Fazer", apagado quando não dá. |
| CF2-B | Fazer leva de 1 a 3 s com barra de progresso (faca, tocha e flechas 2 s; arco e machado 3 s); o mundo continua. |
| CF3-A | A fogueira e a cama entram na lista na NBB-146 (até lá, a tecla G provisória continua). |
| CF4 | Sem testes das receitas (X1-C). |
| MC1-A | Cortar: botão esquerdo com o machado a até 2 m do tronco, golpes de 0,8 s, cada um com 25 m de ruído. A árvore tomba devagar (~1,5 s) e some, deixando um toco; a madeira vai direto para o inventário. Modelos novos: machado, toco e madeira. |
| MC2 | Pinheiro e carvalho: 6 golpes, 4 madeiras; árvore morta: 4 golpes, 2 madeiras; pedra grande: 5 golpes, 3 pedras, e some. Madeira em pilhas de 20. |
| MC3-A | O machado é só ferramenta: contra animais e a criatura, o golpe não faz nada. |
| TC1-A | A tocha vira item (pilhas de 5): F acende uma do inventário, gastando 1, que dura 4 min; apagar com F guarda o tempo que sobrou. Saem as tochas ilimitadas (TO1-A) e o kit provisório (IN5-A): o jogador começa sem nada (PG1-A). |
| CF5 | Detalhes propostos por Claude e aprovados ("1 a 12 - Ok", "modelos ok"): receitas em ordem machado, faca, tocha, arco, flechas, uma por vez; custo como "Galho 1/2", o que falta em vermelho, "Fazer" apagado quando não dá ou enquanto outra é feita; fechar o Tab interrompe sem gastar; "Você fez: ..."; o golpe acerta até ~50° de onde se olha e golpe no ar não faz barulho; a árvore tomba acelerando e some, sem tronco caído; o último golpe espera espaço no inventário; golpes lembrados só na sessão; toco de 0,35 m sem colisão; animação "Cortar" de 0,6 s; a tocha na barra aparece apagada na mão; ferramentas de desenvolvimento. Modelos do machado, da madeira e do toco aprovados. |

## NBB-145: Construção em grade (2026-11-17)

| Código | Decisão |
|---|---|
| CN1-A | No modo de construção (B), as teclas 1 a 4 (e a roda) escolhem fundação, parede, porta e telhado; a barra rápida vira uma barra de peças com o custo de cada uma. Botão esquerdo coloca, R gira. A madeira sai direto do inventário. |
| CN2-A | Desmontar: no modo B, mirando numa peça, segurar o botão direito por 1 s; devolve metade da madeira (para baixo). |
| CN3 | Fundação na célula para onde se olha, a até 6 m; parede e porta se encaixam na borda da fundação mais próxima da mira (R vira o lado em que a porta abre); telhado em cima de uma célula com paredes. Vermelho quando falta madeira, o desnível passa de 1 m, há árvore, pedra grande, jogador ou outra peça no caminho, ou falta apoio. |
| CN4-A | Peças rústicas como a cabana: paredes de toras, piso e telhado de tábuas; a fundação é um piso de tábuas sobre toras que desce até o chão; o telhado de cada célula fica levemente inclinado na direção escolhida com R. Feitas por código e revisadas na galeria. |
| CN5-A | Paredes e porta fechada bloqueiam a passagem e o golpe da criatura: um abrigo fechado é seguro. |
| CN6 | E abre e fecha a porta, com giro de 0,5 s; aberta, deixa passar o jogador e a criatura. |
| CN7 | Sem testes de encaixe e apoio (X1-C); as construções entram nas mudanças do mundo (save na NBB-147). |
| CN8 | Detalhes propostos por Claude e aprovados ("1 a 12 - Ok", "modelos ok"): laterais da porta em tábuas em pé (limite de 200 triângulos); paredes de 2,4 m, vão da porta de 1 × 2,05 m, piso 12 cm acima do chão, telhado com \~10°; bloqueada 8 s junto à parede, a criatura desiste e recua; avisos da prévia ("Já tem uma peça aqui", "O chão é inclinado demais", "Algo no caminho", "Você está no caminho", "Precisa de paredes", "Precisa de uma fundação", "Falta madeira", "Mire no chão, a até 6 m") e a linha de ajuda; barra de peças com o custo, em vermelho quando falta; prévia 40% transparente; parede com fundação de um lado só; não se passa por baixo da fundação; porta abre 100°, R escolhe o lado; mão vazia no modo de construção, Tab funcionando; construções ficam o jogo todo (save na NBB-147); ferramentas de desenvolvimento. |

## NBB-146: Fogueira e cama (2026-11-18)

| Código | Decisão |
|---|---|
| FG1-A | Fogueira e cama viram itens do crafting. Com o item na barra rápida, uma prévia verde ou vermelha aparece 1,8 m à frente e o botão esquerdo coloca (no chão ou no piso; vermelha encostada em tronco, pedra grande ou parede). A tecla G provisória sai. |
| FG2-A | Quantas fogueiras o jogador fizer, cada uma com seu combustível e seu espeto. |
| FG3-A | Nos últimos 30 s a chama diminui e apaga; fica a fogueira fria (pedras e cinza), que um galho reacende (2 min). Segurar E por 1 s apaga de propósito (o combustível restante se perde). |
| FG4 | Perto da fogueira, E com um galho na mão põe lenha ("Pôr lenha (3:20)"); com outra coisa na mão, E cozinha e pega a carne (CZ2-A). A madeira não é lenha. |
| CM1-A | A cama vira o ponto de renascer ao ser colocada; E nela dorme (se der) e também a confirma. |
| CM2 | Segurar E por 1 s recolhe a cama para o inventário; sem cama, renasce no ponto inicial. |
| CM3 | Modelo: saco de dormir de couro aberto no chão, uma pele por cima e um travesseiro de fibra, feito por código (até 200 triângulos) e revisado na galeria. |
| DO1 | Dormir: a tela escurece em 1,5 s, o relógio pula para o amanhecer e clareia; a fome cai como se o tempo passasse (\~20 numa noite inteira); a vida não volta (VD7-B). Avisos: "Só dá para dormir à noite" e "Não dá para dormir: há perigo por perto". |
| DO2 | Sem testes das regras de dormir (X1-C). |
| FG5 | Detalhes propostos por Claude e aprovados ("1 a 11 - Ok", "modelos ok"): fogueira e cama levam 3 s no crafting, uma por espaço; na mão, fogueira pequena sem chama e cama enrolada; prévia vermelha encostada em tronco, pedra grande, parede ou perto de outra fogueira ou cama; cama com a cabeceira longe do jogador; textos ("Clique para colocar", "Algo no caminho", "Pôr lenha (3:20)", "A fogueira está cheia", "Acender (2:00)", "Fogueira apagada: acenda com um galho na mão", "Fogueira (4:53)", "segure E: apagar", "Você vai renascer nesta cama", "[E] Dormir · segure E: recolher"); carne só cozinha com o fogo aceso; chama morrendo até \~20–35%; dorme só na noite, renasce na cama; uma ação passa na frente de um aviso no E; o toque age ao soltar e a barra de segurar aparece após 0,15 s; ferramentas de desenvolvimento. |

## NBB-147: Save no IndexedDB (2026-11-18)

| Código | Decisão |
|---|---|
| SV1-A | O save guarda o que dura: jogador (posição, vida, fome, fôlego), inventário, tocha (tempo restante), hora do dia; o que foi pego, cortado ou quebrado; construções (portas abertas ou fechadas); fogueiras (combustível e espeto); camas; baús abertos, espingarda pega e cartuchos no cano; animais mortos e carcaças limpas. Fica fora o passageiro: flechas cravadas, posição dos animais vivos e da criatura (ela volta longe), corpo de animal ainda não limpo. |
| SV2-A | Até o menu (NBB-150), ao abrir o jogo ele continua sozinho o mundo salvo; começar de novo só por `silentHunt.newWorld()` (desenvolvimento). |
| SV3 | Salva a cada 60 s, ao acordar e, até a pausa existir, quando a aba fica escondida ou a página fecha. Não salva com a tela de morte aberta; salva logo depois de renascer. (MO5-A: também salva no instante da morte, já como se tivesse renascido.) |
| SV4-A | Um "Salvando..." discreto no canto inferior direito por 1,5 s. |
| SV5 | O save guarda a versão do formato (1). Se o formato mudar sem conversão, começa um mundo novo e avisa "O mundo salvo era de uma versão antiga". |
| SV6 | Sem testes do save (X1-C). |
| SV7 | Detalhes propostos por Claude e aprovados ("1 a 10 - Ok"): o save guarda também o início da vida atual (dias sobrevividos), os cartuchos no cano e a semente (só informativa); o item preso ao mouse no inventário entra no save; os 60 s recomeçam a cada save; "Salvando..." branco, 14 px, opacidade 0,6; falha ao ler ou gravar só avisa no console (save ilegível vira mundo novo, sem mensagem); o jogo espera o save ser lido antes de começar; a criatura começa longe; `silentHunt.save()` e `silentHunt.newWorld()` (desenvolvimento); `save.everySeconds` no `config.ts`. |

## NBB-148: Morte com mochila (2026-11-18)

| Código | Decisão |
|---|---|
| MO1-A | A mochila leva os 24 espaços e o item preso ao mouse; os cartuchos do cano viram cartuchos na mochila. A tocha da mão fica com o jogador, apagada e com o tempo que sobrou (VD5). Inventário vazio não deixa mochila. |
| MO2-A | E na mochila pega tudo o que couber; o resto fica nela, com o aviso "Inventário cheio". Vazia, ela some. |
| MO3-A | A mochila não some com o tempo: fica até ser esvaziada, em qualquer chunk, e entra no save. |
| MO4-A | Sem marcador: só a memória do jogador. O modelo é de lona clara, que se destaca no chão escuro e na luz da tocha. |
| MO5-A | No instante da morte o mundo é salvo com a mochila no chão e o jogador como se tivesse renascido (na cama, vida cheia, fome de renascer): fechar a aba na tela de morte não desfaz a morte. Muda a SV3. |
| MO6-A | O formato do save continua na versão 1; um save sem mochilas carrega com nenhuma. |
| MO7 | Modelo: mochila de lona bege caída de lado, com corpo arredondado, aba de couro com fivela, duas alças e um rolo de fibra embaixo; até 300 triângulos; revisada na galeria. |
| MO8 | Sem testes da mochila (X1-C). |
| MO9 | Detalhes propostos por Claude e aprovados ("1 a 9 - Ok", "Modelo - Ok"): alcance de 2 m (`backpack.reach`); texto "[E] Pegar mochila"; a mochila fica no chão sob os pés (ou no piso, se o jogador estava sobre uma fundação), virada para onde ele olhava; os cartuchos do cano entram como um grupo à parte; o espaço selecionado da barra é mantido; o save da morte também enche o fôlego e começa a nova vida, mantendo a direção do olhar; modelo com fivela de latão, bolso, aba sobre a ponta e cor `canvas` (296 triângulos); as mochilas ficam sempre no mundo; `silentHunt.backpacks()` (desenvolvimento). |

## NBB-149: Som (2026-11-18)

| Código | Decisão |
|---|---|
| SM1-A | Lista inteira, sem sons de interface: passos por chão (terra, musgo, folhas, gravetos), galho estalando, pouso; vento, pássaros de dia, grilos e corujas à noite; fogueira (crepitar 3D, acender, apagar) e tocha (acender, chiado); faca, arco, machado (madeira, pedra, árvore caindo); bufo de alarme e galope do cervo, fuga do coelho, grito ao morrer; pegar coisas, limpar carcaça, comer, colocar e desmontar peça, porta, baú. |
| SM2-B | O usuário escolhe entre 2–3 candidatos nos sons de clima e aviso (passos, ambiente, fogo, bufo e galope do cervo, arco, machado). Os pequenos (pegar, comer, porta, baú, pouso, peças, acerto da faca, flecha cravando, grito dos animais) Claude escolhe e o usuário revisa no jogo. |
| SM3-A | CC0 de preferência; CC-BY só quando claramente melhor, avisado na proposta e creditado no `CREDITS.md`. Efeitos do Epidemic Sound ficam de fora. |
| SM4-A | Ambiente em camadas em loop (vento sempre, pássaros de dia, grilos à noite) que trocam suavemente no entardecer e no amanhecer, e sons soltos 3D de vez em quando numa direção aleatória (coruja, pássaro distante, galho estalando longe). |
| SM5-A | Música rara e baixa, só de dia: uma faixa a cada 5–10 min, com silêncio entre elas; à noite, nada. O jogo procura as faixas em `assets-private/music/` e funciona sem elas. As faixas e a licença do Epidemic Sound para jogo ficam com o usuário. |
| SM6-A | Aqui só o `CREDITS.md`; a tela de créditos vai para a NBB-150 (menus). |
| SM7 | Volumes por grupo no `config.ts` (efeitos, ambiente, música) abaixo do mestre (0,8); o menu de opções usa os mesmos grupos. |
| SM8 | Uma rodada de candidatos e um commit por grupo: passos, ambiente, animais, ferramentas e armas, fogo e ações, música. |
| SM9 | Sem testes de som (X1-C). |
| PA1-A a PA5-A | Grupo 1 (passos), todos CC0: terra "Footsteps_6_Dirt_shoe" (monte32), musgo "Footsteps Moss" (Vrymaa), folhas "01-20 Footsteps, sneakers on dry leaves" (SpliceSound), gravetos "Forest_footsteps_6x" (Letterborne), galho estalando "Branches snapping" (northern87). |
| PA6-A | Os mesmos passos para agachado, andando e correndo, com volume e tom variando. |
| PA7 | Detalhes propostos por Claude e aprovados ("1 a 8 - Ok"): 6 passos por chão e 4 estalos, mono, pico normalizado; volumes agachado 0,22 (tom 10% mais grave), andando 0,45, correndo 0,75; por chão terra 1, musgo 0,75, folhas e gravetos 0,9; tom ±8%; estalo 0,9; pouso com passo de terra a 0,85 e tom 25% mais grave; passos do jogador sem 3D; grupos efeitos 1, ambiente 0,7, música 0,5 (criatura e espingarda no de efeitos). |
| AM1-C a AM5-C | Grupo 2 (ambiente), todos CC0: vento "Wind and Ambient in Pine Forest" (setcookie), pássaros "A Quiet Forest Edge" (newlocknew), grilos "Crickets at night in a forest" (LukaCafuka), coruja "Owl Hoot" (Breviceps), corvos "Crows" (ken788). |
| AM6 | Sons soltos a cada 20–60 s, 3D a 30–60 m numa direção aleatória: corvo de dia, coruja à noite, galho estalando nos dois (com os estalos dos passos, mais baixos e graves). Não fazem ruído para a criatura nem para os animais. |
| AM7 | O vento toca sempre; pássaros e grilos trocam com a luz do dia no entardecer e no amanhecer. |
| AM8 | Detalhes propostos por Claude e aprovados ("1 a 9 - Ok"): loops de 60 s em estéreo, sem emenda, do trecho mais estável de cada gravação; três grasnados de 1,6 s e a coruja inteira; volumes vento 0,5, pássaros 0,45, grilos 0,5, coruja 0,9, corvo 0,8, galho distante 0,7 (tom 20% mais grave); galho em 25% dos sons soltos de dia e 40% à noite; corvo e coruja 4 m acima, galho perto do chão, tom ±5%, ouvidos até 80 m; "de dia" é luz acima de 50%; `silentHunt.ambience()` e `silentHunt.ambienceOneShot()`. |
| AN1-B | Alarme do cervo: latido de corço "barkingroedeer" (raoul_slayer, CC0). Não há bufo de cervo limpo em CC0. |
| AN2-A | Galope do cervo e fuga do coelho montados com os passos de folhas e gravetos, em 3D (não há gravação de galope de cervo em CC0 ou CC-BY). |
| AN3 | O cervo bale ao morrer ("Deer Meewing 01", msantoro11, CC0); o coelho morre em silêncio (não há grito de coelho em CC0 ou CC-BY). |
| AN4 | Detalhes propostos por Claude e aprovados ("1 a 7 - Ok"): 3 latidos de 1 s e 2 balidos de 0,9 s, mono, sem graves, chiado reduzido; um latido por grupo (outro só após 4 s), ao passar de pastar para alerta ou fuga; só o cervo e o coelho em fuga mais próximos são ouvidos; galope de três batidas e pausa (tom 20% mais grave), coelho em duas batidas (40% mais agudo); volumes latido 1, balido 0,8, galope 0,7, coelho 0,35, tom ±6%; audição latido 70 m, balido e galope 40 m, coelho 18 m; `silentHunt.preySounds()` e `silentHunt.killPrey(id)`. |
| FE1-A a FE5-C | Grupo 4 (ferramentas e armas), todos CC0: puxar o arco "Bow Drawn" (Paveroux), soltar "Bow_release" (PorkMuncher), machado na madeira "Large Axe Chopping Small Log" (Hano_van_Dalen), na pedra "Pickaxe #2" (abstraktgeneriert), árvore caindo "Big Tree Fall in Forest" (Kinoton). |
| FE6 | Sons pequenos escolhidos por Claude: faca no ar "Small Knife Whoosh" (Shamewap), acerto "Knife Stab Melon" (jawbutch), flecha cravando "ARROW_WOOD_IMPACT_SINGLE_ARCHERY_01" (JoeDinesSound), todos CC0. |
| FE7 | O rangido do arco toca enquanto puxa e para ao soltar; estalo no disparo; flecha cravando em 3D onde para (num animal, o acerto da faca); faca no ar a cada estocada e acerto só quando atinge; machado na madeira ou na pedra a cada golpe que acerta; árvore caindo em 3D. |
| FE8 | Detalhes propostos por Claude e aprovados ("1 a 7 - Ok"): recortes em mono com pico normalizado; volumes puxada 0,5, disparo 0,8, faca no ar 0,5, acerto 0,8, machado 0,9, pedra 0,8, árvore 1, flecha 0,8, tom ±5%; acerto, árvore e flecha em 3D até 50 m; árvore ouvida 2 m acima da base; módulo `SoundEffects` com os sons por nome; `silentHunt.effects()`. |
| CH1-B | Fogueira crepitando: "Campfire 01" (HECKFRICKER, CC0), em loop 3D em cada fogueira acesa. |
| CH2-A | Acender (fogueira com galho e tocha com F): "Tumbleweed Firestarter Torch Ignite" (loganzsound, CC0). |
| CH3 | Apagar não tem som próprio: o crepitar some em ~1 s. A tocha acesa crepita como a fogueira, bem baixo e mais agudo, saindo da mão. |
| AC1 | Sons das ações escolhidos por Claude, todos CC0: pegar é um passo de folhas baixo e agudo; comer "Eating a Toastie" (squashy555); limpar carcaça "vlees_snijden" (dutchlady), enquanto segura E; colocar peça, fogueira ou cama e pôr lenha "Wood Fall 2" (Manim8); desmontar "Planks Clattering" (Fission9); porta "Wooden_Door_Squeak_04" (BlondPanda); baú "Wooden Chest Open" (The_Frisbee_of_Peace). |
| AC2 | Detalhes propostos por Claude e aprovados ("1 a 6 - Ok"): loops sem emenda (fogueira 60 s, carcaça 4,4 s); crepitar da fogueira a 0,6, de 40% a 100% com a força da chama, ouvido até 25 m, cada fogueira num ponto diferente do loop; volumes acender 0,7, tocha 0,15, pegar 0,35, comer 0,6, carcaça 0,6, colocar 0,7, desmontar 0,7, porta 0,6, baú 0,7 (tocha e pegar 30% mais agudos); pegar também ao pôr carne no espeto e recolher a cama; a porta usa o mesmo rangido para abrir e fechar; a interação ganhou campos de som (`sound`, `holdActSound`, `holdingSound`); `silentHunt.campfires()` mostra o volume do crepitar. |
| MU1-A | Um plugin no `vite.config.ts` serve `assets-private/music/` em `/music/` com a lista das faixas em `/music/index.json` e, no build, copia as faixas se a pasta existir. Qualquer nome de arquivo (`.mp3`, `.ogg`, `.m4a`, `.wav`). |
| MU2 | A primeira faixa 1–3 min depois de abrir o jogo; ordem aleatória sem repetir até tocar todas; entra em 3 s e sai em 5 s; no entardecer (luz abaixo de 50%) a faixa sai em 10 s e nenhuma começa à noite. |
| MU3 | O grupo de música baixa de 0,5 para 0,3 (SM7), por baixo do ambiente. |
| MU4 | As instruções para pôr as faixas ficam no docs/04; o README fica para a NBB-152. |
| MU5-A | `@types/node` como dependência de desenvolvimento e um `tsconfig.node.json` só para o `vite.config.ts`; o `tsconfig` principal não inclui mais o `vite.config.ts`, e o script `typecheck` checa os dois. |
| MU6 | Detalhes propostos por Claude e aprovados ("1 a 5 - Ok"): `@types/node` na linha 24, a do Node do projeto; faixas em streaming, uma de cada vez e descarregadas ao fim; as transições contam o tempo do jogo; faixa que não abre só avisa no console e espera o intervalo normal; `silentHunt.music()` e `silentHunt.musicNext()`. |

## NBB-150: Menus (2026-11-18)

| Código | Decisão |
|---|---|
| MN1-C | Fonte: **Crimson Pro** (Google Fonts, OFL), serifa clássica de livro, no menu, no HUD e nos créditos; os arquivos entram no repositório. |
| MN2-A | O menu principal aparece sobre a floresta já carregada (mundo parado), ao abrir o jogo: "Continuar" (só com mundo salvo), "Novo mundo" (com confirmação, apaga o save e recarrega), "Opções" e "Créditos". O clique em "Continuar" captura o mouse e libera o som. |
| MN3-A | Esc (o mouse solto) pausa e congela tudo: relógio, criatura, animais, física, animações e fogo. Menu de pausa: "Voltar ao jogo", "Opções" e "Menu principal" (salva antes). |
| MN4 | Opções: sensibilidade do mouse (0,25× a 2×) e volumes geral, efeitos, ambiente e música; salvas no navegador, separadas do mundo ("Novo mundo" não as apaga). |
| MN5-A | A tela de créditos lê o próprio `CREDITS.md` ao montar o jogo (uma fonte só da verdade); a música do Epidemic Sound entra só se a pasta existir. |
| MN6 | Menu à esquerda sobre a floresta, título "Silent Hunt" grande, botões só de texto em branco suave que acendem em laranja (a cor do fogo) ao passar o mouse. |
| MN7 | Textos: menu "Continuar", "Novo mundo", "Opções", "Créditos"; confirmação "Começar um mundo novo? O mundo atual será apagado.", "Apagar e começar", "Cancelar"; pausa "Pausado", "Voltar ao jogo", "Opções", "Menu principal"; opções "Sensibilidade do mouse", "Volume geral", "Efeitos", "Ambiente", "Música", "Voltar"; créditos "Créditos", "Voltar". |
| MN8 | Sai o `silentHunt.newWorld()` (o menu faz isso, SV2-A); sem testes novos (X1-C). |
| MN9 | Autor nos créditos: **nbbrdev** ("Silent Hunt foi feito por nbbrdev.", no `CREDITS.md`). |
| MN10 | Detalhes propostos por Claude e aprovados ("1 a 11 - Ok"): depois de "Novo mundo" a página recarrega numa tela com o botão "Clique para começar"; sem save, "Novo mundo" começa direto; a pausa só abre com o jogador no controle (não morto, dormindo nem no inventário) e também pausa o som; F e Tab não funcionam pausado; um tempo de quadro único (`frameSeconds`, 0 na pausa) em todos os sistemas; créditos como "Som — Autor (Licença)", com as seções "Fonte" e "Tecnologia" no `CREDITS.md`; tamanhos 76/44/30/20, sombra a 45%, sliders laranja com o valor ao lado, opções salvas ao voltar; a fonte em `public/fonts/` (TTF e OFL); a fonte do HUD em cada controle de topo; `silentHunt.menu()` e `silentHunt.play()`; o tamanho dos textos do HUD pode subir depois (a Crimson Pro é mais baixa que a Arial). |

## NBB-151: Equilíbrio e bugs (2026-11-18)

| Código | Decisão |
|---|---|
| EQ1-B | Claude prepara um roteiro de teste (cenários curtos com o que se espera sentir); o usuário joga seguindo o roteiro e anota as diferenças. Jogo livre também vale. |
| EQ2-A | Painel de teste só em desenvolvimento, ligado pela F2: hora do jogo, vida, fome e fôlego em números, estado e distância da criatura, FPS. Não entra no build. |
| EQ3-A | Vale a X1-C: sem testes novos; cada correção é conferida no headless e pelo usuário no jogo. |
| EQ4-A | O usuário anota o FPS de dia, à noite com tocha e perto de uma fogueira com construções; abaixo de 60, a otimização entra nesta issue. |
| EQ5 | Pontos suspeitos no roteiro: captura do mouse ao voltar do menu, tamanho dos textos do HUD, chiado em pássaros, coruja e latido, dificuldade de ponta a ponta (primeira noite, comida e gordura, criatura contra fogueira e cama), noite de 6 min contra tocha de 4 min. |
| EQ6 | Depois de cada sessão, uma tabela "valor atual → proposto, e por quê"; aprovação do usuário; um commit por lote; valores finais nos docs (RF do docs/03). |
| EQ7-A | A issue termina quando o usuário disser que está bom, depois de quantas sessões forem precisas (PZ1). |
| AJ1-A | Sessão 1 (2026-11-23), pedras escassas (só ~4–5 pegáveis por chunk): **20 pedras soltas a mais por chunk**, de 0,2 a 0,45 m, todas pegáveis, com o mesmo modelo de pedra. Vêm no fim da lista do chunk, para os saves antigos continuarem certos. Muda a MW2. |
| AJ2-A | Sessão 1, jogador lento: **andar 2,4, correr 5,5, agachado 1,3 m/s** (eram 1,6, 4,5 e 0,9). O ritmo dos passos e o ruído não mudam. Muda a J1. |
| AJ3 | Detalhes propostos por Claude e aprovados ("1 a 3 - Ok"): as pedras soltas no fim da lista de cada chunk (saves antigos certos); tamanho sorteado por igual entre 0,2 e 0,45 m, vistas a partir de 70 m como as pedras grandes; a criatura não muda (espreita a até 3 m/s, mais que o andar de 2,4). |
| EQ8 | Fechamento (2026-11-23): o usuário aprovou o estado atual do jogo ("o estado atual do jogo está ok"); as ideias que surgiram são features novas (ver Pendentes). **FPS não medido** (EQ4-A ficou em aberto). |

## NBB-152: Entrega (2026-11-23)

| Código | Decisão |
|---|---|
| EN1-A | O README manda rodar a versão final (`npm install`, `npm run build`, `npm run preview`), sem as ferramentas de desenvolvimento e com a música da pasta privada; `npm run dev` numa seção "Para desenvolver". |
| EN2 | README: título e frase, capturas, como rodar, controles (do docs/03, com R para recarregar e o botão direito para desmontar), como jogar (4–5 dicas), música opcional, créditos, tecnologia e documentação. Sai o aviso "Em desenvolvimento". |
| EN3-A | Claude tira 4 capturas no navegador de teste (menu, floresta de dia, noite com tocha e criatura, abrigo com fogueira) e as salva em `docs/images/`. |
| EN4-A | Licença do código: **MIT**. Sons, fonte e música seguem as próprias licenças (`CREDITS.md`). |
| EN5-A | README só em pt-BR. |
| EN6 | Sem conferência de clone limpo por Claude: o usuário roda o projeto na própria máquina. |
| EN7 | Detalhes propostos por Claude e aprovados ("1 a 7 - Ok"): copyright "2026 nbbrdev"; capturas em JPG numa grade 2 × 2 (`menu`, `day`, `night`, `shelter`), sem o contador de FPS e com o abrigo na clareira do início, à noite; "Como jogar" com 5 dicas, porta do preview (4173) como "normalmente", seção "Para desenvolver" com as ferramentas; tabela de controles do código e do docs/03, com R e o botão direito para desmontar; requisito "Node.js 24"; sai o aviso "Em desenvolvimento". |
| EN8 | Releases (2026-11-23): a pedido do usuário, **como exceção à regra** "o agente nunca cria tags nem releases" (a regra continua valendo), Claude criou as tags anotadas e as releases do GitHub de todos os marcos: `v0.1.0` (M0, `d5a8561`), `v0.2.0` (M1, `a57e71f`), `v0.3.0` (M2, `6c62ae6`), `v0.4.0` (M3, `8315ec6`), `v0.5.0` (M4, `f989be9`) e `v1.0.0` (M5, `09c1133`, a principal). Notas em pt-BR com o que cada marco entregou; sem arquivos anexados. |
| EN9 | Tags (2026-11-24): a pedido do usuário, de novo **como exceção à regra** "o agente nunca cria tags nem releases" (a regra continua valendo), Claude criou as tags anotadas `v1.1.0` (M6 · Pós-entrega, `5da60f5`, o fechamento do mapa) e `v1.2.0` (M7 · Acabamento, `0327a89`, o fechamento dos efeitos sonoros). Só as tags: sem releases do GitHub. |

## M8: Mundo vivo (2026-11-24)

Pedido do usuário: novos biomas, animais (hostis e pacíficos), lagos, rios e cachoeiras, para enriquecer o mundo e o ambiente.

| Código | Decisão |
| -- | -- |
| BI0-A | Um marco novo, **M8 · Mundo vivo** (meta `v1.3.0`), com uma issue por parte, nesta ordem: 41 biomas, 42 relevo, lagos e rios, 43 cachoeiras, 44 animais pacíficos, 45 animais hostis, 46 ambiente de cada bioma. Cada uma com rodada própria. |
| BI1 | Cinco biomas, todos no mesmo clima frio e com neblina: **pinheiral** (o de hoje), **bosque de folhosas**, **pântano**, **campo aberto** e **serra rochosa**. O usuário pediu que **cada um mude a forma de jogar** (ex.: mais moitas para se esconder, capim alto, lentidão no pântano fora do caminho certo); as regras de cada um vêm na rodada da issue 41. |
| BI2-A | Grandes manchas sorteadas pela semente (centenas de metros), com transição suave de 30 a 50 m; o começo continua sempre no pinheiral (o filme do menu e as cabanas não mudam). |
| BI3-B | **Nadar de verdade**, com fôlego e afogamento. |
| BI4-A | **Sem sede**: a água é cenário, obstáculo e caminho. A sede continua no Backlog. |
| BI5 | Rios, lagos e cachoeiras: **testar primeiro a água descendo pelo relevo** (simulada); se não funcionar bem no mundo infinito em chunks, vale a geração por ruído (rios como vales, lagos nas depressões, cachoeiras nos degraus da serra). |
| BI6-B | O **material de água do Babylon** (reflexo e refração de verdade), de olho nos 60 FPS. |
| BI7 | Animais pacíficos: **raposa**, **aves** que levantam voo (e avisam), **peixes** nos lagos e rios e **sapos** no pântano. Sem pesca por enquanto. |
| BI8-A | Animais hostis: **lobo** (matilha, no campo), **urso** (raro, na serra) e **javali** (no bosque), só de dia e no entardecer; a noite continua da criatura, e eles fogem quando ela chega perto. Todos podem ser caçados. Tira do Backlog o "animal que revida" (M6-C). |
| BI9-A | Uma issue no fim para o ambiente de cada bioma: sons próprios, neblina e partículas. |
| BI10-B | Uma medição de FPS no fim do marco, na máquina do usuário. Hoje o jogo roda a 60 FPS sem problemas. |

## NBB-163: Biomas (2026-11-24)

| Código | Decisão |
| -- | -- |
| BM1 | O que cada bioma muda no jogo: **pinheiral** é a base; **bosque de folhosas**: folhas secas deixam os passos 50% mais barulhentos, mas há o dobro de moitas, e mais cervos (o javali depois); **pântano**: fora das trilhas de terra firme a lama deixa 50% mais lento e cada passo faz barulho de água, neblina mais densa (o jogador e a criatura veem menos), juncos altos escondem como moita quando agachado; **campo aberto**: poucas árvores, de pé a criatura vê 50% mais longe, agachado no capim alto o jogador fica escondido para quem está a mais de ~15 m, muitas pedras soltas (os lobos depois); **serra rochosa**: subir encostas é mais lento e gasta fôlego, pedras grandes para o machado, o vento encobre os passos (o ruído dele e o dela chegam 30% menos longe), quedas de penhasco ferem (cachoeiras e urso depois). |
| BM2-A | Pinheiral em ~40% do mundo; bosque, pântano, campo e serra em ~15% cada; manchas de 400 a 800 m. |
| BM3-A | As cabanas continuam onde estão; num raio de ~40 m de cada uma o chão vira pinheiral ou bosque (sem lama nem penhasco). |
| BM4-A | Modelos novos, gerados por código e revisados na galeria: bétula (bosque), juncos e lama com poças (pântano), capim alto (campo), paredões e pedras grandes (serra) e um chão próprio para cada bioma. |
| BM5-A | O mapa de papel pinta cada bioma com um tom próprio nas áreas exploradas. |
| BM6-A | Ao entrar num bioma novo, o nome dele aparece discreto no alto da tela, como a mensagem do amanhecer, menor. |
| BM7-A | Saves de antes dos biomas: **começam um mundo novo**, com o aviso de hoje (SV5): a versão do save sobe. |
| BM8 | Detalhes propostos por Claude e aprovados ("Ok"): manchas em células irregulares de 400 a 800 m, sorteadas pela semente nas proporções da BM2, mistura de 40 m; 200 m em volta do começo sempre pinheiral; relevo: serra até ~25 m mais alta com degraus íngremes e paredões, pântano baixo e quase plano, campo com ondulações suaves; vegetação: bosque carvalho 45%, bétula 40%, pinheiro 15%, árvores como hoje e o dobro de moitas; pântano árvore morta 65%, bétula 20%, pinheiro 15%, 40% das árvores, juncos em tufos e poças de lama; campo 10% das árvores, capim alto em manchas e o dobro de pedras soltas; serra pinheiro 70%, árvore morta 30%, 35% das árvores e o triplo de pedras grandes; chão com cor própria por bioma, misturado; bosque: ruído dos passos ×1,5; pântano: trilhas firmes de ~3 m por ruído, fora delas 50% da velocidade, barulho de água no raio do galho estalando e passos de lama, neblina 40% mais perto para os dois, juncos como moita (agachado, sem tocha, a menos de 1,5 m); campo: de pé a criatura vê ×1,5 mais longe, agachado no capim alto só é visto a menos de 15 m; serra: encosta acima de 15° dá 70% da velocidade e gasta fôlego como correr, ruído do jogador e passos da criatura com alcance ×0,7; passos na lama e no capim com candidatos para o usuário escolher (SM2-B) depois dos modelos; mapa com um tom por bioma e legenda; aviso do bioma em maiúsculas espaçadas de 26 px a 12% do topo, entra em 0,6 s, fica 2,5 s, sai em 1 s, só após 5 s no bioma, nunca no começo e sem repetir; ordem: modelos primeiro (capturas de dia, noite e neblina), depois os biomas no mundo, depois as regras; limites: bétula como as árvores, juncos e capim em cartões, paredão até 600 triângulos, pedra grande até 300; `silentHunt.biome()` e `silentHunt.goToBiome()`. |
| BM9 | Revisão do usuário (2026-11-24): os seis modelos aprovados (bétula, juncos, capim alto, paredão, pedra grande, poça de lama) e os detalhes decididos por Claude ("1 a 6 - Ok"): casca própria da bétula, desenhada com as marcas e sem relevo, base mais escura; paredão em camadas de blocos com blocos caídos ao pé; poça de borda ondulada e brilho de molhado; machado: bétula 5 golpes e 3 madeiras, pedra grande 8 golpes e 5 pedras; chão de terra nua na serra, folhas no bosque, musgo nas trilhas do pântano; cores e quantidades no `config.ts`. |
| BM10-C | Passos na lama (pântano, fora das trilhas): "Footsteps_Walking Boot_Muddy Puddles-Water-Squelch", omnisounddesign (Freesound 336845, CC-BY 4.0), cortado em 6 passos. |
| BM11-B | Passos no capim alto (campo aberto): "Footsteps on Grass", harrietniamh (400123, CC-BY 4.0), cortado em 6 passos. |
| BM12 | Revisão do usuário (2026-11-24): detalhes decididos por Claude aprovados ("1 a 7 - Ok"): regras misturadas na fronteira pela proporção dos biomas; barulho de água da lama também no pouso; no campo, de pé, ×1,5 com ou sem tocha, e "dentro do capim" a até 1 m de uma touceira; na serra, subida medida 1 m à frente, correndo morro acima também 70% e fôlego de corrida, passos da criatura ouvidos até 17,5 m, ruído do jogador (passos e pulo) a 70%; juncos com as regras da moita; legenda do mapa a partir de dois biomas vistos; nomes PINHEIRAL, BOSQUE, PÂNTANO, CAMPO ABERTO, SERRA. |
| BM13 | Revisão do usuário (2026-11-24): detalhes dos passos aprovados ("1 a 5 - Ok"): cada passo com 0,45 s a partir do pico e pico em −2 dB; ruído do chão lama ×1,2 e capim ×1,1, volume lama 0,9 e capim 0,8; o campo inteiro é chão de capim, o pântano fora das trilhas é lama; manchas de galhos em todos os biomas; lama mais escura e capim mais claro. Regra registrada como RF-70 no docs/03. |

## NBB-164: Relevo, lagos e rios (2026-11-24)

| Código | Decisão |
| -- | -- |
| AG1-A | O teste da água simulada (BI5) calcula regiões de ~2 km com margem sobreposta às vizinhas; antes de ir para o jogo, Claude gera **imagens vistas de cima** (relevo, rios, lagos) para o usuário julgar. Rios quebrando nas bordas ou estranhos: vale a geração por ruído. |
| AG2-A | Água moderada: um rio a cada 600–1.000 m, lagos nas partes baixas, o pântano com muitos lagos rasos. |
| AG3-B | Nado **com mergulho**: uma tecla desce e o Espaço sobe, com uma barra de ar de ~20 s embaixo d'água e afogamento depois. |
| AG4-A | Entrar na água funda **apaga a tocha**; nadando não se acende nem se usa armas e ferramentas; o inventário não se perde. |
| AG5-A | A criatura **não entra na água funda**: espera e ronda a margem e desiste depois de um tempo. |
| AG6-B | Cervos e coelhos contornam a água funda e **bebem na margem**, com animação. |
| AG7-A | Sons do nado (entrar e sair, braçadas, fôlego recuperado) entram aqui, com rodada de candidatos. |
| AG8-A | Reflexo do céu, da neblina, do chão e das árvores a até ~60 m, numa imagem de 512 px; se o FPS cair na medição do marco, só o céu e a neblina. |
| AG9-A | Os rios têm **trechos rasos** a cada 80–150 m para atravessar a pé. |
| AG10-A | Sem água a menos de 40 m das cabanas e nos 200 m em volta do começo. |
| AG11-A | O mapa desenha a água explorada em azul-acinzentado. |
| AG12-A | O teste da água simulada (regiões de 2 km com 512 m de margem) **não passou**: na faixa da borda as regiões vizinhas só concordaram sobre a água em 14% e 74%, e os rios quebravam ao cruzar; o relevo de ruído também enchia o mapa de lagos sem "cavar a saída" das bacias. Fica a **geração por ruído** (BI5): rios como vales sinuosos cavados no relevo, contínuos em todo o mundo; lagos em bacias escolhidas e cavadas; o pântano com muitos lagos rasos. Nova imagem vista de cima (`/?hidrologia`) para aprovação antes de ir para o jogo. |
| AG13 | Desenho da água por ruído aprovado pelo usuário (imagem de 4 × 4 km) e os valores propostos por Claude ("1 a 6 - Ok"): rios a cada ~750 m, sinuosos, de 6 a 14 m de largura e 2,2 m de fundura; vaus de 0,5 m de tempos em tempos; lagos de até 3,5 m, fundos a 10 m da margem; no pântano muitas lagoas de 0,8 m; superfície 0,8 m abaixo do formato geral do chão, com margem baixa de 10 m; água em ~6,6% do mundo. Limites aceitos: às vezes um rio fecha um anel e ele não nasce nem desce de verdade. |
| AG14 | Detalhes do nado propostos por Claude e aprovados ("Ok"): água rasa (até 1 m) a 60% da velocidade, com passos de água no alcance de caminhada ×1,5; a partir de 1,3 m nada a 1,6 m/s (2,4 m/s com Shift, gastando fôlego como correr; devagar gasta metade); sem fôlego afunda e gasta o ar; C segurado desce, Espaço sobe, embaixo d'água nada para onde olha a 1,4 m/s; barra de ar de 20 s embaixo da de fôlego (só embaixo d'água), enche em 2 s na superfície, afogamento tira 10 de vida por segundo; embaixo d'água neblina verde-azulada de ~6 m e sons abafados (efeitos e ambiente a 40%) com o som de fundo; a tocha apaga com a água no peito (1,2 m) e não acende com a água acima da cintura; armas e ferramentas não funcionam nadando; ruído de 8 m por braçada, nenhum embaixo d'água, 15 m ao cair na água funda; a criatura não entra onde passa de 1 m, ronda a margem mais perto e desiste em 40 s, mas golpeia se o jogador estiver ao alcance; animais contornam a água funda e, pastando a menos de 15 m dela, às vezes bebem na margem por 4 a 8 s (com a animação de pastar); mapa com a água em #8fa3ad e "Água" na legenda; sem dano de queda em água de 1,5 m ou mais; o fôlego recuperado reusa a respiração presa (FX13) e sair da água reusa o som de entrar, mais baixo. |
| AG15-A | Entrar na água: "splash_1", genel (Freesound 482953, CC0). |
| AG16-A | Braçadas: "POOL SWIMMING R-L", tbsounddesigns (530158, CC0), em loop. |
| AG17-A | Som de fundo embaixo d'água: "Underwater Ambience", Fission9 (504641, CC0). |
| AG18 | Revisão do usuário (2026-11-25): detalhes decididos por Claude aprovados ("1 a 9 - Ok"): barra de ar azul-clara logo acima da barra de vida (não há barra de fôlego na tela), visível embaixo d'água e até o ar encher; dano de queda da BM1, que tinha ficado de fora da NBB-163: acima de 4 m, 12 de vida por metro a mais; nada nasce na água, só juncos até 0,4 m; animais evitam água de mais de 0,4 m, 30% de chance de ir beber a cada virada, a 1,2 m/s, e nenhum nasce na água; os 40 s da criatura valem também na última noite, e ela contorna a margem virando sempre para o mesmo lado; passos na água rasa com o alcance do andar atual ×1,5; afogamento aplicado de 10 em 10; nado de 1,3 m até 1,05 m, para não piscar na margem; comandos de teste `swim`, `goToWater(fundura)` e `pitch`. O commit `9a251c6` saiu com a mensagem do anterior; a `main` não aceita force push, e o usuário escolheu deixar assim. Regra registrada como RF-71 no docs/03. |

## NBB-165: Cachoeiras (2026-11-25)

| Código | Decisão |
| -- | -- |
| CC1-A | Cachoeiras só onde um rio cruza um degrau da serra: a água, que hoje desce a face do degrau como uma rampa, vira uma queda de verdade (4 m, ou 8 m com dois degraus juntos). |
| CC2-A | Um poço redondo ao pé de cada queda (~6 m de raio, ~3 m de fundura), onde dá para mergulhar; pular lá de cima não fere (AG14). |
| CC3-A | Visual gerado por código: cortina de água curva com listras claras rolando para baixo, semitransparente; espuma branca no pé e névoa leve subindo, em partículas, só nas cachoeiras a menos de ~60 m. O material de água do Babylon continua nos poços e no rio. Revisão na galeria (dia, noite, neblina). |
| CC4-A | Um loop 3D do rugido da queda, ouvido até ~40 m, do Freesound (CC0 ou CC-BY), escolhido pelo usuário entre candidatos. O murmúrio dos rios fica para a NBB-168. |
| CC5-A | O rugido encobre o barulho: a menos de 15 m da queda, o ruído do jogador alcança metade da distância, e os passos da criatura chegam a ele pela metade também. |
| CC6-A | Um pequeno símbolo de cachoeira no mapa, nos quadrados explorados. |
| CC7-A | Antes do 3D, as cachoeiras aparecem marcadas na página `/?hidrologia`, com a contagem por km², para o usuário julgar a frequência. |
| CC8-A | Frequência aprovada vendo a página (4 × 4 km): **todas as quedas ficam**, ~3,8 por km², só na serra; cada rio que a atravessa vira uma escadaria, uma queda por degrau a cada ~50 a 100 m (a maioria de 3,3 a 4,4 m, algumas de 5 a 10 m, poucas baixas na borda). O nível da água na serra cai seco no alto de cada degrau, em vez da rampa de antes. |
| CC9-B | Primeira versão da cachoeira vista na galeria (dia, perto, noite, neblina): ajustar com a névoa mais visível e a espuma mais apagada na neblina. |
| CC10-1 | Som da queda: "Ambiance_Waterfall_Small_Close_Loop_02_Stereo", Nox_Sound (Freesound 698306, CC0), em loop. |
| CC11 | Revisão do usuário (2026-11-25): aprovadas as cachoeiras no jogo e a contagem corrigida da CC8 (a primeira imagem juntava por engano quedas de degraus vizinhos): 88 em 16 km² (~5 por km²), quase todas de 3,2 a 3,6 m, ~25 mais baixas na borda da serra, só duas acima de 5 m. Detalhes decididos por Claude aprovados ("1 a 7 - Ok"): só os rios caem (os lagos da serra mantêm a superfície suave); cortina 2 m mais larga que a beira, com as laterais e a parte plana acima da beira sumindo aos poucos; rugido só nas três mais perto, volume 0,8 no grupo do ambiente; o abafamento vale para todo ruído a menos de 15 m, também no medidor; quedas do mesmo degrau se juntam a até 6 m e com até 0,75 m de diferença; três traços `#3f5f70` no mapa; comandos de teste `goToWaterfall` e `fallProfile`. Regra registrada como RF-72 no docs/03. |

## NBB-169: Árvores imponentes e luz da floresta (2026-11-25)

Pedido do usuário: árvores mais imponentes, maiores e mais altas, sem a folhagem tapar a visão, com a copa tapando a luz do sol e deixando passar feixes de luz.

| Código | Decisão |
| -- | -- |
| FL0-A | Issue nova, a **47 (NBB-169)**, no M8 · Mundo vivo, feita antes da 44 (animais pacíficos). |
| FL1-A | Árvores **~2× maiores**: pinheiro 16–28 m, carvalho 12–20 m, bétula 16–26 m, árvore morta 9–15 m; troncos mais grossos na mesma proporção, colisão incluída. |
| FL2-A | **Tronco limpo embaixo:** a folhagem começa acima de ~35% da altura e não desce até os olhos; nos pinheiros, alguns tocos de galhos secos no tronco baixo. |
| FL3-A | ~25% das árvores continuam no tamanho de hoje, como **árvores jovens**. |
| FL4-A | **Sombra simulada:** a luz do dia diminui conforme a densidade de árvores no lugar (floresta fechada mais escura; clareira, campo e pântano mais claros), com transição suave. |
| FL5-A | **Feixes de luz** desenhados por código nos vãos das copas em volta do jogador, inclinados na direção do sol, só de dia (dourados no amanhecer e no entardecer), entrando na neblina; poucas dezenas, de planos cruzados. |
| FL6-A | O machado dá as mesmas madeiras; a árvore alta cai mais devagar; o resto igual. |
| FL7-A | Cada árvore dentro dos 1.500 triângulos; revisão na galeria, depois capturas no jogo (dia, entardecer, noite, neblina); medição de FPS na máquina do usuário no fim. O filme do menu é revisto com as árvores maiores. |
| FL8-A | Árvores adultas aprovadas na galeria, com os detalhes de Claude: folhagem nunca abaixo de 5,5 m; jovens são as variações 2 e 6 de cada árvore; pinheiro adulto com 36–41 galhos, um pouco mais longos e menos caídos, e 3–6 tocos secos; carvalho adulto com o tronco até 42% da altura, dividindo-se no alto, e 10–13 cartões de folha por ponta; cartões de folha de no máximo 3,2 m (carvalho) e 2,6 m (bétula); bétula adulta com 8–11 por ponta; colisão de tronco até 0,9 m de raio; a árvore derrubada cai em 1,5 s × √(altura ÷ 11 m); comando `seed(n)` na galeria. |
| FL9-B | Três variações antigas acima dos 1.500 triângulos (carvalho 6 com 1.636; árvores mortas 1 e 6 com 1.536 e 1.690), achadas ao contar todas as variações do mundo, **ficam como estão**. |
| FL10 | Revisão do usuário (2026-11-25): sombra da copa e feixes aprovados, com os detalhes de Claude ("1 a 4 - Ok"): a sombra conta as árvores a até 12 m (9 adultas fecham a copa, uma jovem vale 0,4), copa fechada tira 70% do sol, 40% da luz do céu e escurece a neblina em 25%, em ~2,5 s, só de dia; até 24 feixes a menos de 38 m, em pontos sorteados pela semente (55% dos quadrados de 7 m), só em vãos (nenhum tronco a 2 m, ao menos 3 adultas a 9 m), 24 m de altura, 1,2–2,6 m de largura, até ~43° de inclinação, força 0,3, somem a menos de ~4 m; sombra e feixes seguem a câmera (também no filme do menu); comando `forestLight()`. A medição de FPS na máquina do usuário fica para o fim do marco (BI10-B). Regra registrada como RF-73 no docs/03. |

## Pedidos de 2026-11-25: chão, placa e água (NBB-170 a NBB-172)

Pedido do usuário: mais detalhes no chão (um gramado mais vivo), um poste com placa que aponta a cabana mais próxima e uma textura de água que mostre o fluxo nos rios e lagos.

| Código | Decisão |
| -- | -- |
| PD0-A | Três issues no M8 · Mundo vivo, nesta ordem, antes da 44 (animais): **48 · Detalhes no chão (NBB-170)**, **49 · Poste com placa (NBB-171)**, **50 · Água com correnteza (NBB-172)**. |
| SL1-A | Chão e cobertura juntos: a textura do chão ganha variação de cor em manchas grandes e uma segunda textura de perto; por cima, detalhes gerados por código por bioma: grama viva em tufos mais cheios e de tons variados, samambaias (pinheiral e bosque), folhas caídas em montinhos (bosque), cogumelos perto de troncos e árvores mortas, flores pequenas e raras (campo), pedrinhas (serra); só até ~35 m. |
| SL2-A | Chão bem coberto perto do jogador sem esconder o caminho: ~3× os tufos de hoje, mais densos no bosque e no campo, mais ralos na serra; a grama balança com o vento. |
| SL3-A | Só visual: as plantas novas não escondem nem fazem barulho (a moita e o capim alto continuam os esconderijos). |
| PL1-A | O poste aponta a **cabana mais próxima** dele, qualquer uma (comum ou do rádio). |
| PL2-A | Raros, sorteados pela semente, ~1 a cada 300 a 500 m, a pelo menos 60 m de uma cabana; nenhum no pinheiral do começo. |
| PL3-A | Poste de madeira velho e inclinado com uma placa em seta, escrito à mão (por código) **"Cabana"**, a seta apontando a cabana de verdade; revisão na galeria. |
| PL4-A | E lê a placa ("Cabana a uns 300 m a nordeste") e marca a direção no mapa como destino da bússola, até chegar. |
| AF1-A | Uma camada de correnteza por cima da água de hoje: nos rios, linhas de espuma e ondinhas andando do lado mais alto para o mais baixo, mais rápidas perto das cachoeiras; nos lagos, quase parada; o reflexo continua por baixo. |
| AF2-A | A textura das ondinhas redesenhada em código, com mais detalhe e duas escalas; a cor fica a de hoje. |
| AF3-B | A correnteza também **empurra quem nada no rio**, devagar, a favor dela, e mais forte perto das cachoeiras. |
| SL4 | Revisão do usuário (2026-11-25): chão da NBB-170 aprovado, com os detalhes de Claude ("1 a 5 - Ok"): claridade de 80% a 112% em manchas de ~18 m; mais verde ou mais seco até 20% em manchas de ~45 m, nunca mais vermelho; grãos de terra a cada 0,75 m, força 0,45; por pedaço de 64 m, grama viva 300/420/200/480/120, samambaias 40/55/10/0/5, folhas caídas 8/45/4/0/0, flores 0/8/4/45/4, pedrinhas 6/4/0/10/70 (pinheiral/bosque/pântano/campo/serra), cogumelos ao pé de 12% das árvores, os 150 tufos antigos mantidos; grama viva 0,3–0,6 m, samambaia 0,45–0,85 m; 10 a 28 triângulos nas plantas, 140 nas pedrinhas, 208 nos cogumelos; só visual. Regra registrada como RF-74 no docs/03. |
| PL5 | Revisão do usuário (2026-11-25): poste da NBB-171 aprovado, com os detalhes de Claude ("1 a 5 - Ok"): quadrados de 400 m, 80% com um poste, nenhum a menos de 260 m do começo, na água ou a menos de 60 m de uma cabana, só com cabana a até 700 m (~1 a cada 300 a 500 m); poste de 1,9 m inclinado até ~4°, seta de 0,85 m, 40 triângulos, letra em itálico da fonte do jogo com a tinta gasta; colisão fina (0,2 m); E a até 2,4 m, distância arredondada a 50 m, reusa marcação existente e, com as 12 cheias, a mais antiga dá lugar; comando `goToSignpost`. Regra registrada como RF-75 no docs/03. |
| AF4 | Revisão do usuário (2026-11-26): correnteza da NBB-172 aprovada, com os detalhes de Claude ("1 a 6 - Ok"): o lado mais baixo medido 6 m à frente e atrás (nos topos de morro a água desce para os dois lados); 0,5 m/s no plano, × 8 a inclinação, o dobro a menos de 20 m de uma cachoeira, até 1,4 m/s, sumindo nos 2 m perto da margem, lagos e poços parados; espuma por mapa de fluxo (pontinhos de uma textura de 3 m, ciclos de 2,5 s, rastro de ~0,12 m, duas camadas, força 0,5, branco-azulada), no lugar das listras giradas da primeira versão, que se quebravam longe da origem; ondinhas com 3 ondas longas e 4 miúdas entortadas por ruído; o nadador levado a 70% da correnteza; comandos `goToRiver` e `current`. Regra registrada como RF-76 no docs/03. |

## M6: Features novas (2026-11-23)

| Código | Decisão |
|---|---|
| FN0-A | Um marco novo, **M6 · Pós-entrega** (meta `v1.1.0`), com uma issue por feature: NBB-153 (perseguição), NBB-154 (moitas), NBB-155 (golpe fatal), NBB-156 (objetivo), NBB-157 (mapa). |
| FN1 | Ideias do usuário, cada uma com rodada própria: **se esconder na moita**; **criatura que mata com um golpe**, para dar mais medo (com a tocha o jogador fica seguro por muito tempo); **um objetivo**, para o jogador não ficar só andando e sobrevivendo; **um mapa** com pontos importantes e waypoints marcados pelo jogador. |
| PS1-A | Perseguição: no lugar do disparo a 7 m/s, a criatura persegue a ~6 m/s (uns 10% mais rápido que a corrida de 5,5) e dá o golpe a 2 m. O jogador escapa chegando a uma fogueira acesa, encarando-a com a tocha acesa ou entrando num abrigo fechado; sem pegar o jogador em 25 s, ela desiste e recua. |
| PS2 | Fôlego: correr gasta 10 por segundo (eram 15), ~10 s de corrida. |
| PS3 | Sons da perseguição: o coração do jogador acelerando com a criatura perto, o ofegar com o fôlego baixo e os passos dela mais altos e rápidos. Os candidatos dos sons novos são escolhidos pelo usuário (SM2-B). |
| PS4-A | Efeitos: bordas escuras pulsando no ritmo do coração e um leve tremor da câmera a cada passo dela a menos de 10 m. |
| PS5 | A perseguição só acontece à noite; de dia a criatura continua fugindo (AP1-A). |
| PS6-A | Coração: "heartbeat-80bpm-limited" (loudernoises, CC0), uma batida recortada que toca com o intervalo ditado pela distância. |
| PS7-C | Ofegar: "Human Breathing Exhausted Panicked" (Sheyvan, CC0), em loop sem emenda. |
| PS8 | Detalhes propostos por Claude e aprovados ("1 a 8 - Ok"): coração só na perseguição, batidas de 0,85 s (30 m) a 0,38 s (2 m), volume 0,45 a 1, acalma em 3 s, intensidade mínima de 15%; bordas pretas de 25% a 75% com pulso a cada batida; tremor de 0,15 s a cada passo dela a menos de 10 m; ofegar abaixo de 40 de fôlego, até 0,6, dentro ou fora da perseguição; passos de galope já existentes; fuga pela fogueira a menos de 8 m; batida de 0,6 s e ofegar em loop de 14 s; `silentHunt.chase()`. |
| PS9-A | Sessão do usuário: a perseguição durava pouco (~11 s), sobretudo pelo fôlego. **Correr a 5,8 m/s** (uns 3% mais devagar que a besta, 6) e **correr gasta 6 de fôlego por segundo** (~17 s). A perseguição passa a durar ~20 s; quem corre bem chega perto da desistência em 25 s. Muda a J1, a AJ2-A e a PS2. |
| MT1-C | Música tensa na perseguição, **exceção à SM5-A** (que deixa a noite sem música): uma faixa CC0 vem com o jogo e uma faixa em `assets-private/music/chase/` (ex.: do Epidemic Sound) toma o lugar dela. |
| MT2 | Quando toca: entra junto com o rosnado, quando a perseguição começa, em 0,5 s; fica em loop enquanto ela ataca; quando o ataque termina (fuga, golpe ou desistência), some em 3 s. Sai pelo grupo de música, então o controle "Música" das opções vale para ela. |
| MT3-D | A faixa: "Orchestral Suspense Loop 1" (awrmacd, CC0), num trecho de 80 s em loop sem emenda e com volume normalizado (`public/sounds/music/chase.mp3`). |
| MT4 | Detalhes propostos por Claude e aprovados ("1 a 8 - Ok"): a música segue o ataque inteiro (perseguição, golpe e hesitação); volume 1 dentro do grupo de música; se o ataque volta durante a saída, ela sobe de novo sem recomeçar a faixa; com mais de uma faixa na pasta privada, vale a primeira em ordem alfabética; os créditos mostram "Música: Epidemic Sound" com a faixa privada; corte de 80 s com emenda cruzada de 2 s, volume médio de -20 dB e 128 kbps; texto no README sobre a pasta `chase/`; `silentHunt.chase()` mostra a música. |

## NBB-155: Golpe fatal (2026-11-23)

| Código | Decisão |
|---|---|
| GF1-A | O golpe da criatura **mata sempre**, com qualquer vida. Muda o RF-23. |
| GF2-B | **A tocha segura, mas não espanta:** encarada com a tocha acesa a menos de 10 m, a criatura para e rodeia na borda da luz, rosnando; quando o jogador desvia o olhar, ela volta a correr para ele. O ataque só acaba pela desistência em 25 s, pela fogueira ou pelo abrigo. Na espreita, a tocha encarada a faz recuar para a neblina (como a IA4-B) em vez de fugir por 60–90 s. Muda o RF-24. |
| GF3-B | O golpe continua **parado** (dá para desviar se mexendo); um golpe que erra faz ela **voltar a perseguir** em vez de recuar. |
| GF4-C | **"Pego":** a câmera vira de uma vez para a cara da criatura, a tela fica preta na hora com o rosnado e um **som novo de golpe ou mordida** (candidatos escolhidos pelo usuário, SM2-B), e depois aparece a tela de morte. |
| GF5-B | **Morrer à noite leva ao amanhecer:** o relógio pula para o amanhecer, como ao dormir, e a fome cai como se o tempo passasse. Muda a VD5. |
| GF6 | Aprovados ("Ok"): o golpe tira 100 (`creature.damage`), sem regra nova na vida; a barra de vida e as bordas de vida baixa continuam (a fome ainda tira vida); a VD7-B (não sarar à noite) continua; docs no RF-23, RF-24 e no 06. |
| GF7-A | Som do golpe: "monster bite" (LucasDuff, CC0), recortado do impacto ao fim (1,2 s), em mono e com volume normalizado (`public/sounds/creature/strike.mp3`). |
| GF8 | Detalhes propostos por Claude e aprovados ("Ok"): segurada pela tocha, fica a ~7 m (recua se o jogador se aproxima), rodeia de lado a 1,5 m/s com a animação de espreitar e rosna a cada 4–7 s; "encarar" é o cone de 25° da IA4-B, e ao desviar o olhar ela corre na hora; o relógio da desistência segue contando; coração, bordas e música continuam enquanto segurada; sai a hesitação de 1,2 s; o ataque imediato a menos de 8 m sem tocha continua (AP2-A); golpe errado volta à perseguição depois da animação (1 s); "pego": controles travam, câmera vira para a cara em 0,15 s, rosnado e golpe tocam, tela preta na hora e "Você morreu" depois de 1,5 s; coração, ofegar e música param na hora (exceção à MT2); a morte por fome continua como a VD4; o amanhecer vale para qualquer morte à noite, e de dia o relógio segue; a fome do renascer é 50 (FO4-B) menos o que cairia nas horas puladas (DO1); o save da morte (MO5-A) já guarda o amanhecer; valores no `config.ts`; som recortado no impacto, em mono, normalizado e no `CREDITS.md`. |
| GF9 | Detalhes da implementação decididos por Claude e aprovados ("1 a 10 - Ok"): segurada, recua mais rápido quanto mais o jogador se aproxima (1,5 m/s mais 2 m/s por metro abaixo dos 7 m, até 6 m/s); o lado em que rodeia é sorteado; o primeiro rosnado segurada vem depois de 4–7 s; no "pego", a câmera mira entre os olhos e o rosnado e a mordida tocam sem posição 3D, pelo grupo de efeitos; a criatura só é mandada para longe quando a tela fica preta; o relógio pula para o amanhecer no instante da morte (para o save da MO5-A); o recuo pela tocha na espreita usa os 6 s e 5 m da IA4-B; `silentHunt.creature()` mostra `held`; o estado "Recuar" do RF-21 diz quando ela recua. |
| VL1-A | Revisão do usuário ("abaixa um pouco os sons no geral"): **volume mestre de 0,8 para 0,6** (tudo cai ~2,5 dB). |
| VL2-A | A música da perseguição mal se ouvia (saía ~2 dB acima do vento): **grupo de música de 0,3 para 0,8**, e a música do dia ganha volume próprio de **0,375** (continua em 0,3). O controle "Música" das opções vale para as duas. |
| VL3-A | **Coração de 0,45–1 para 0,9–1,8** e **ofegar de 0,6 para 1** (~5 dB mais destacados). Muda a PS8. |
| VL4 | Aprovados ("Ok"): valores no `config.ts` (`audio.masterVolume`, `audio.groups.music`, `music.volume`, `chase.beatVolume`, `chase.pantVolume`); os controles das opções multiplicam esses valores; commit à parte com a NBB-155. |

## NBB-154: Esconder-se nas moitas (2026-11-23)

| Código | Decisão |
|---|---|
| MI1-A | **Escondido** = agachado dentro de uma moita, com a tocha apagada. |
| MI2-A | Moitas maiores: de 0,6–1,2 m para **1,1–1,6 m** de altura (mesmos triângulos), para cobrir os olhos agachados (1,0 m). Revisão na galeria. |
| MI3-A | Na perseguição, ela só perde o jogador se **não o viu entrar**: na hora em que ele se esconde, ela precisa estar mais longe que a distância em que o veria de pé naquele momento (8 m no escuro). Mais perto, a moita não adianta. |
| MI4-A | Ao perder o jogador, ela **procura por perto** (pontos em volta de onde o perdeu, nunca direto na moita) por uns 20–30 s e depois recua. Passando a 2 m da moita, ou ouvindo um barulho dele, ela o acha. |
| MI5-B | A moita esconde por **até 60 s seguidos**; depois ela "fareja" e vai direto até lá. O jogador precisa trocar de moita ou sair. |
| MI6-A | Escondido: **bordas da tela escurecidas e esverdeadas**, como folhas; somem ao sair. |
| MI7-A | A moita esconde também das **presas** (elas só ouvem): dá para emboscar. |
| MI8-B | **Farfalhar de folhas** ao entrar e sair da moita, com rodada de candidatos (SM2-B). |
| MI9-A | Som do farfalhar: "The Rustle of a Bush" (Montacue, CC0). |
| MI10 | Detalhes propostos por Claude e aprovados ("Ok"): dentro da moita = a menos de 0,7 m do centro; escondido, a distância em que é visto vira 0 (criatura e presas), exceto a criatura a 2 m ou menos, que o acha; o farfalhar toca ao entrar e sair de qualquer moita (volume 0,5) e faz 4 m de ruído; bordas de folhas verde-escuras a ~55%, entrando e saindo em 0,3 s; "viu entrar" compara com a distância em que veria o jogador de pé e sem tocha naquele momento, na espreita e no ataque; estado novo **"Procurar"** (20–30 s a 3 m/s, animação de espreitar, por pontos a 4–10 m de onde o perdeu; depois recua por 60–90 s); na procura, um barulho a leva até ele, e sair, ficar de pé ou acender a tocha dentro da visão dela faz ela atacar na hora; escondido, o rondar não vira espreita pelo tempo; o limite de 60 s conta só à noite, na mesma moita, e zera ao sair; passando dele, ela ataca de onde estiver; se ela viu entrar, o ataque segue e o golpe acerta na moita; moitas de 1,1–1,6 m com as mesmas folhas, aprovadas por capturas da galeria antes do resto; colher fibra continua sumindo com a moita; RF-64 novo no docs/03 e "Procurar" no RF-21; `silentHunt.hidden()`. |
| MI11 | Revisão do usuário (2026-11-23): moitas de 1,1–1,6 m aprovadas nas capturas; detalhes decididos por Claude aprovados ("1 a 10 - Ok"): o farfalhar só toca com os controles ativos; achado na procura de dia, ela passa a espreitar; ponto da procura não alcançado em 10 s é trocado; um barulho na procura muda o centro dela; o faro não muda nada se ela já ataca; durante o golpe, esconder-se não ajuda; a 2 m de um jogador escondido, à noite, dispara o ataque imediato (AP2-A); perdido de muito longe, ela quase nunca chega à moita; bordas na mesma imagem das de dano, em verde-escuro; `silentHunt.hidden()` e `creatureState('procurar')`. |

## NBB-158: Arremessar pedra (2026-11-23)

| Código | Decisão |
|---|---|
| PD0-A | Ideia do usuário na rodada das moitas: **arremessar pedra** para fazer barulho longe. Entra no escopo como a issue 36 do M6 (NBB-158), feita depois das moitas. |
| PD1-B | A **tecla G** arremessa uma pedra do inventário, sem trocar o que está na mão (dá para usar escondido na moita). |
| PD2-B | A queda da pedra faz **20 m de ruído**, no lugar onde ela cai. |
| PD3-A | A criatura só vai até o barulho quando **não sabe onde o jogador está** (rondando, investigando ou procurando); na espreita e na perseguição, ignora. |
| PD4-A | A pedra **fica no chão** e pode ser pega de novo, como uma pedra solta. |
| PD5-B | As presas fogem do barulho, e um **acerto direto mata um coelho**. |
| PD6-A | **Som novo** da pedra caindo, com rodada de candidatos (SM2-B). |
| PD7-C | Som da queda: um impacto recortado de "Foley_Rocks_Stones_Impacts_Mono" (Nox_Sound, CC0). |
| PD8 | Detalhes propostos por Claude e aprovados ("Ok"): G arremessa uma pedra; sem pedras, o aviso "Sem pedras para arremessar"; sai da câmera a 14 m/s na direção do olhar, com a gravidade das flechas (AR3-A), ~20 m olhando um pouco para cima; 0,8 s entre arremessos; sem animação de braço nem som de arremesso, e o gesto faz 3 m de ruído; modelo da pedra solta com ~0,15 m; para no primeiro toque (chão, tronco ou rocha), sem quicar, e os 20 m de ruído saem dali; mata um coelho em que passar pelo corpo, e no cervo só o barulho conta; no chão vira uma pedra que se pega com E ("Pegar pedra"); as pedras arremessadas não entram no save e ficam no máximo 30 no chão (some a mais antiga); de dia a criatura não investiga (só barulhos de 50 m ou mais); tecla G na tabela de controles e no README; RF-65 novo no docs/03; valores no `config.ts`; a NBB-158 vem depois da NBB-154. |
| PD9 | Revisão do usuário (2026-11-23): detalhes decididos por Claude aprovados ("1 a 8 - Ok"): pegar a pedra de volta usa o alcance dos outros itens do chão (1,6 m); ela gira no ar; atravessa o cervo e a criatura; ao matar um coelho, cai ao lado dele e o barulho acontece; some depois de 5 s voando; sai 0,4 m à frente dos olhos; 0,15 m medidos no modelo; `silentHunt.stones()`. A velocidade **fica em 14 m/s** (~11 m mirando a ~15°, ~20 m a 45°; o PD8 estimava errado). O "Como jogar" do README foi atualizado com o golpe fatal, a tocha que segura, as moitas e a pedra. |
| TR0-A | Pedido do usuário: **prévia do caminho da pedra** para mirar. Reabre a NBB-158 (melhoria da mesma feature). |
| TR1-A | **Segurar G mostra o arco; soltar arremessa.** Um toque rápido arremessa na hora. Muda a PD1-B. |
| TR2-A | Com o G seguro, o **botão direito cancela**; a pedra fica no inventário. |
| TR3-A | O arco é uma **fileira de pontinhos** ao longo do caminho, com um **anel** no chão onde a pedra vai parar. |
| TR4-A | O arco **brilha por conta própria** e a neblina não o esconde (dá para mirar à noite). |
| TR5-A | **Força fixa** (14 m/s): a distância vem do ângulo da mira. |
| TR6 | Detalhes propostos por Claude e aprovados ("Ok"): o arco usa o mesmo cálculo da pedra e para no primeiro chão, tronco ou rocha (sem animais); pontos a cada 0,5 m, de 5 cm, branco pálido a 50%; anel de 0,3 m de raio; o intervalo de 0,8 s continua; segurar G sem pedras mostra o aviso e não desenha o arco; mirar não faz barulho; RF-65 e controles ("Arremessar uma pedra (segurar para mirar)") no docs/03, no README e no Linear. |
| TR7 | Revisão do usuário (2026-11-23): detalhes decididos por Claude aprovados ("1 a 7 - Ok"): pontinhos a partir de 2 m dos olhos; esferas de poucos lados e aro de 3 cm; no máximo 80 pontinhos (40 m); pausar ou morrer com o G seguro cancela; soltar no intervalo de 0,8 s não arremessa; prévia em passos de 1/60 s (pode diferir um pouco em quadros lentos); com o arco na mão, o botão direito cancela e faz o zoom. |

## NBB-156: Objetivo do jogo (2026-11-23)

| Código | Decisão |
|---|---|
| OB1 | O objetivo é uma mistura: a **fuga pelo rádio** (achar as peças em cabanas, montar, pedir resgate e sobreviver até ele chegar) e, **opcional**, **banir a criatura** com um ritual. Detalhes do ritual na rodada seguinte. |
| OB2-A | **3 peças do rádio**, cada uma numa cabana mais longe: ~150 m, ~300 m e ~500 m do início. |
| OB3-A | Cada peça vem com um **bilhete** que diz a direção e a distância da próxima, e o HUD ganha uma **bússola** discreta no topo (N, L, S, O). |
| OB4-A | Com o rádio montado, o jogador chama o resgate, que chega no **amanhecer seguinte**. Nessa **última noite** a criatura ataca sem espreitar antes; sobreviver a ela é a vitória. O clima fica **avermelhado** e os olhos da criatura ficam **vermelhos**; ela fica mais voraz (detalhes na rodada seguinte). |
| OB5-A | **Tela de vitória** (dias sobrevividos e mortes) com "Continuar jogando" e "Menu principal"; o mundo continua salvo. |
| OB6-A | O jogador sabe do objetivo por uma **frase curta** ao começar um mundo novo, um **bilhete na primeira cabana** (a da espingarda) e o **progresso** ("Rádio: 1 de 3 peças") no inventário e na pausa. |
| OB7-A | As peças do rádio **nunca saem do jogador** (não vão para a mochila). |
| OB8-A | **Ritual:** diários de um caçador nas cabanas contam como banir a criatura: queimar **3 crânios de cervo** numa fogueira acesa, à noite, com ela a menos de 20 m. O crânio é um item novo que fica na carcaça limpa do cervo (a corça não tem galhada, CO3). |
| OB9-A | O ritual vale **a qualquer noite**, independente do rádio: o jogo tem **dois finais** (resgate e ritual). |
| OB10-A | Depois do ritual, a criatura **some daquele mundo para sempre**: tela de vitória do ritual, e "Continuar jogando" segue sem ela. |
| OB11-B | Na última noite, além do vermelho e do ataque sem espreitar: **a tocha não a segura**, ela **não desiste** nos 25 s e **procura mais tempo** quando perde o jogador numa moita. Só a fogueira e o abrigo fechado protegem. |
| OB12 | Detalhes propostos por Claude e aprovados ("1 a 20 Ok"): 3 cabanas das peças (comuns, com baú) a ~150, ~300 e ~500 m (±10%), em direções sorteadas pela semente, além das raras; no baú, uma peça, um bilhete e uma página do diário (a cabana da espingarda tem o primeiro bilhete e a primeira página, sem peça); peças **Bateria**, **Antena** e **Válvulas** (nessa ordem); receita **Rádio** no inventário com as três; com o rádio na mão, o botão esquerdo chama o resgate uma vez (de dia, a última noite é a próxima; à noite, a atual vira a última); no amanhecer, a tela escurece em 2 s e aparece a vitória (sem som de resgate); morrer na última noite faz o resgate não achar o jogador, e o rádio volta a chamar no dia seguinte; bússola em faixa no topo (N, NE, L, SE, S, SO, O, NO), com o norte fixo no mundo; direção (8) e distância (arredondada a 50 m) medidas da cabana do bilhete; bilhetes e páginas abrem na tela ao abrir o baú (fecha com E ou Esc) e ficam numa aba "Anotações" do inventário; progresso no inventário e na pausa ("Rádio: N de 3 peças", "Rádio montado: chame o resgate", "O resgate chega ao amanhecer" e, lido o diário do ritual, "Crânios: N de 3"); **crânio de cervo** na carcaça limpa do cervo (1 por cervo), fora da mochila, pilha de 3; o ritual é segurar E por 2 s numa fogueira acesa, à noite, com ela a menos de 20 m ("Queimar os crânios"); banida, ela rosna, recua correndo e some, a tela escurece e aparece a vitória do ritual, e ela fica desativada no save; os dois finais se somam, cada vitória aparece uma vez; última noite vermelha a partir do anoitecer (neblina ~(0,12; 0,02; 0,02), olhos ~(1; 0,15; 0,1)); nela, ataque direto depois de rondar, tocha sem efeito, sem desistência, procura na moita de 40–60 s, faro de 60 s mantido; o save guarda cabanas, peças, anotações, rádio chamado, crânios, criatura banida e mortes (contador novo), na versão 1 com campos opcionais (MO6-A); modelos novos até 300 triângulos (bateria, antena, válvulas, rádio, crânio), revisados na galeria antes do resto; RF-66 (objetivo), RF-67 (ritual) e RF-68 (última noite) no docs/03, valores no `config.ts` e objetivo no README. |
| OB13 | Textos aprovados ("Ok"): frase inicial "Você se perdeu na floresta. Há uma cabana a uns 60 m a {direção}."; quatro bilhetes e três páginas do diário como propostos na conversa (registrados no código e no RF-66/RF-67); vitórias "Você foi resgatado" e "A criatura foi banida", com "Sobreviveu N dias", "Morreu N vezes", "Continuar jogando" e "Menu principal"; itens "Bateria", "Antena", "Válvulas", "Rádio", "Crânio de cervo"; ações "Chamar o resgate" e "Queimar os crânios"; avisos "O resgate chega ao amanhecer. Aguente esta noite.", "Ela precisa estar perto" e "Só à noite". |
| OB14 | Revisão dos modelos (2026-11-23): bateria (72 triângulos), antena (104), válvulas (228) e rádio (252) aprovados; aprovadas as ajudas de galeria `silentHunt.show(id)`, `silentHunt.light(modo)` e a distância opcional em `view`, e o plano de corte da câmera da galeria em 5 cm. |
| OB15 | Revisão do usuário (2026-11-24): detalhes decididos por Claude aprovados ("1 a 19 - Ok"): chunk com cabana do objetivo sem cabana aleatória; direções das 3 cabanas sorteadas sem relação entre si; textos de "Você encontrou" ("a bateria", "a antena", "as válvulas", "um bilhete", "uma página de diário"); títulos "Bilhete 1" a "4" e "Diário, página 1" a "3"; folha de papel de 520 × 280 px com "[E] Fechar"; dica "Clique: Chamar o resgate"; avisos do ritual só com um crânio na mão, e o ritual na frente das ações da fogueira, com o som de acender; o ritual acontece enquanto ela espreita; **sem dormir na última noite** (aviso "Não dá para dormir: há perigo por perto"); vermelho em 8 s; rádio na mão a 0,35 m; depois do resgate o rádio não faz nada; "Sobreviveu N dias" desde o começo do mundo; bússola de 90° para cada lado, norte em +Z; coluna "Anotações" de 270 px à esquerda; frase inicial de 6 s, escondida com inventário ou bilhete aberto; Esc no bilhete não abre a pausa; `silentHunt.objective()`, `callRescue()` e `interaction()`; texto "Saia da floresta..." no README. |
| MD1-A | O primeiro crânio parecia um bico: refeito com a nuca arredondada, focinho e mandíbula numa cunha só, osso nasal por cima e os olhos nas laterais (172 triângulos). |

## NBB-157: Mapa (2026-11-24)

| Código | Decisão |
|---|---|
| MP1-A | A **tecla M** abre o mapa em tela cheia, a qualquer momento (sem item). |
| MP2-A | O mapa mostra **só o que o jogador explorou**: uma faixa de uns 40 m em volta do caminho por onde passou; o resto fica escuro. |
| MP3-A | Marcadores automáticos: o **jogador** (posição e direção), as **cabanas visitadas** e a **próxima cabana** assim que o bilhete dela é lido, a **cama** e as **fogueiras**. As mochilas continuam sem marcador (MO4-A). |
| MP4-A | Clicar no mapa põe uma **marcação**; clicar nela a tira. Uma marcação pode ser o **destino**, que aparece na **bússola** com a distância. |
| MP5-A | O mapa abre **centrado no jogador**, com **zoom** na roda do mouse (uns 3 níveis). |
| MP6-A | O **mundo continua** com o mapa aberto, como no inventário (IN3-A): o jogador fica parado. |
| MP7-A | Aparência de **papel e tinta**, como os bilhetes: árvores como pontinhos, clareiras vazias, cabanas e marcações em desenhos simples. |
| MP8 | Detalhes propostos por Claude e aprovados ("1 a 19 Ok"): M abre e fecha, Esc fecha; não abre em menus, morte, vitória, bilhete ou inventário; mouse livre e jogador parado; quadrados de 8 m explorados a menos de 40 m, conferidos 1 vez por segundo; explorado em papel claro, o resto em papel escuro; árvores das áreas exploradas como pontinhos (as derrubadas somem); folha de 760 × 560 px, norte para cima; zoom de 3 níveis (1 px = 0,5, 1 ou 2 m), abre no do meio; jogador como seta; cabana como casinha, visitada a 15 m, a próxima aparece com o bilhete que aponta para ela; fogueira laranja (acesa) ou cinza (apagada); cama como retângulo; clique esquerdo põe uma marcação ("X" com número, até 12) ou a tira; botão direito a torna destino (ou desfaz), com um círculo em volta; destino na bússola como losango com a distância, ou setinha na ponta fora dos 90°; a 5 m deixa de ser destino; título "Mapa" e ajuda "Clique: marcar ou tirar · Botão direito: destino · Roda: zoom · M: fechar"; o save guarda explorados, marcações, destino e cabanas visitadas; tecla M nos controles (docs/03 e README), RF-69 novo, valores no `config.ts`. |
| MP9 | Revisão do usuário (2026-11-24): detalhes decididos por Claude aprovados ("1 a 12 - Ok"): mapa desenhado ao abrir, no zoom e a cada clique; folha de 800 × 670 px; cores de papel, tinta e vermelho-escuro; tamanhos dos desenhos; números das marcações pela ordem da lista; zoom volta ao meio a cada abertura; cabanas visitadas incluem as raras; todas as camas aparecem; ao abrir, o lugar atual já conta como explorado; clique a menos de 12 px pega a marcação; destino na bússola como losango vermelho com a distância, ou "‹" e "›"; `silentHunt.map()` e `mapMark()`. |

## M7: Acabamento e menu cinematográfico (2026-11-24)

| Código | Decisão |
|---|---|
| CI0-A | Um marco novo, **M7 · Acabamento** (meta `v1.2.0`), para deixar o jogo mais profissional; o menu cinematográfico é a primeira issue (37, NBB-159), e cada melhoria seguinte tem issue e rodada próprias. |
| CI1-A | As cenas acontecem **no próprio mundo do jogo**, com uma câmera de menu em pontos fixos perto do início (a semente é sempre a mesma), visual de noite e a criatura "emprestada"; ao clicar em "Continuar" ou "Novo mundo", tudo volta, e o save não é tocado. |
| CI2-A | Umas **4 ou 5 cenas**, a criatura em 2 ou 3, sempre em **silhueta ou só os olhos** na neblina; as outras: a floresta vazia, a cabana, uma fogueira morrendo. |
| CI3-A | Entre as cenas, **corte com um escurecer rápido** (~0,6 s). |
| CI4-A | Em cada cena, um **movimento lento** de câmera (avançar, girar ou subir alguns metros em ~8 s), com um leve balanço de câmera na mão. |
| CI5-A | Sempre a **noite** do jogo, com neblina e lua, e os olhos dela brilhando. |
| CI6-A | No menu principal, o **ambiente da noite** (vento, grilos) e a respiração ou um rosnado baixo nas cenas com ela (exceção à MN3-A só no menu principal). |
| CI7-A | **Faixas pretas** em cima e embaixo, como no cinema, e bordas escurecidas, com o menu por cima. |
| CI8-A | Só o **menu principal** muda; a pausa continua mostrando o jogo congelado. |
| AC1-A | Pedidos novos do usuário (com referências: The Infected Soul e Outlast II): uma issue para cada no M7, nesta ordem: 37 menu cinematográfico, **38 estilo dos menus** (título, tipografia, destaque, versão), **39 músicas de fundo**, **40 mais efeitos sonoros**. |
| CI9 | Detalhes propostos por Claude e aprovados ("Ok"): 5 cenas de 8 s em loop perto do início: **Clareira** (câmera baixa entra até a clareira, sem ela), **Olhos** (avança 2 m para um vão escuro; a ~18 m só os olhos dela, que somem aos 5 s), **Cabana** (a da espingarda, girando devagar, com uma fogueira morrendo só visual), **Silhueta** (ela parada de lado contra a neblina, câmera desliza 3 m), **Passagem** (ela atravessa ao longe, a câmera acompanha); neblina ~30% mais clara e azulada no menu para a silhueta; criatura sem "cérebro", só animada (espreitar, andar), e volta ao lugar; relógio, presas e save intocados; faixas pretas de 9% da altura e bordas escuras, com o menu de hoje por cima; ambiente noturno, respiração dela nas cenas 2, 4 e 5 e um rosnado baixo no fim da 4; "Continuar" ou "Novo mundo" escurecem 0,6 s até o jogo; os pedaços do mundo das cenas carregam no menu; capturas de cada cena aprovadas antes de fechar, com os pontos de câmera ajustados por elas. |
| CI10-B | O filme ficava escuro demais: no menu principal **sai a camada preta de 45%** do menu (as bordas escuras fazem esse papel); a pausa a mantém. |
| CI11-A | A cena dos Olhos mostra **a silhueta inteira de frente**, a ~7,5 m, com os olhos acesos (mais perto, os olhos aparecem; longe, viravam 2 pixels). Muda o "só os olhos" da CI9. |
| CI12 | Revisão do usuário (2026-11-24): detalhes decididos por Claude aprovados ("1 a 10 - Ok"): o filme segue atrás das telas abertas a partir do menu principal; a criatura aparece mesmo se banida no save; as outras animações pausam durante o filme; andar a 1,6 e espreitar a 0,35; fogo morrendo com 35% das partículas, mais lentas, e luz laranja 0,8 de alcance 7 m; câmera suavizada e tremor em ondas lentas; olhos a ~7,5 m e a passagem a ~10 m; neblina azul-escura (0,10; 0,12; 0,17); filme em tempo real; `silentHunt.film()` e `filmShot()`. |

## NBB-160: Estilo dos menus (2026-11-24)

| Código | Decisão |
| -- | -- |
| EM1-A | Título em **Crimson Pro maiúsculo, bem espaçado** (espaços finos entre as letras: o Babylon GUI não tem espaçamento de letras), com **brilho frio** em volta e um leve tremor de luz de vez em quando; sem fonte nova nem imagem. |
| EM2-A | Opções em **maiúsculas espaçadas**; as outras **apagadas** (~50%) e a escolhida **acesa** na cor de destaque, com um **traço fino à esquerda**. |
| EM3-A | Uma só cor de destaque: o **laranja do fogo** (#ff9a3c). |
| EM4-A | A coluna continua **à esquerda**, com o meio da tela livre para o filme. |
| EM5-A | **Versão discreta** no canto de baixo à direita, guardada no `config.ts` e trocada a cada marco. |
| EM6-A | **Teclado** nos menus: setas (ou W/S) escolhem, Enter confirma, Esc volta uma tela; mouse e teclado mexem na mesma opção escolhida. |
| EM7-A | Ao abrir uma tela, o título e as opções **surgem do preto** em ~0,4 s, uma opção logo depois da outra. |
| EM8-A | O estilo vale em **todas as telas de menu**: principal, pausa, opções (barras mais finas no mesmo estilo), créditos, confirmação, "Clique para começar" e as telas de vitória. |
| EM9-A | Sons ao passar e clicar ficam para a **NBB-162** (efeitos sonoros). |
| EM10 | Detalhes propostos por Claude e aprovados ("1 a 19 - Ok"): título "SILENT HUNT" de 84 px, creme, espaço fino entre as letras e largo entre as palavras, brilho azulado (rgba 150, 180, 220 a 55%, desfoque 28 px) e, só no menu principal, uma ou duas piscadas a ~65% por 0,1 s a cada 6 a 12 s; títulos das outras telas no mesmo estilo em 44 px, sem piscar; sombra preta (desfoque 8 px, 2 px para baixo) em todo texto; maiúsculas aplicadas no código, com a pergunta da confirmação, o progresso da pausa e o texto dos créditos em minúsculas normais; opções de 26 px, apagadas a 50%, a escolhida laranja com traço de 20 × 2 px e o texto deslizando 10 px em 0,12 s; a primeira opção já escolhida ao abrir e o mouse muda a escolhida; ↑/↓ ou W/S escolhem, Enter ou Espaço confirmam, Esc volta uma tela em opções, créditos e confirmação (na pausa não volta ao jogo: o navegador não deixa o Esc prender o mouse); ←/→ ou A/D mudam as barras em 5% (sensibilidade em 0,05); nos créditos ↑/↓ rolam o texto; entrada do preto em 0,4 s com 0,06 s entre as opções, em todas as telas; barras com nome de 18 px em maiúsculas (laranja na escolhida), trilho de 2 px a 25%, parte cheia laranja e marcador quadrado de 12 px; seções dos créditos em maiúsculas espaçadas; versão "v1.2.0" de 14 px a 35%, a 24 px do canto de baixo à direita, só no menu principal e nas telas abertas a partir dele; vitória centralizada, título no estilo principal de 56 px sem piscar, dias e mortes a 60% e opções de texto com teclado no lugar dos botões; uma captura rápida para conferir. |
| EM11 | Revisão do usuário (2026-11-24): detalhes decididos por Claude aprovados ("1 a 8 - Ok"): teclas usadas no menu não chegam ao jogo (`Input.forgetPress`); seções dos créditos em 26 px; pergunta da confirmação em 30 px; opções 30 px à direita do título e linhas de 1,8 vez a letra; ↑/↓ rolam 10% dos créditos; opções da vitória centralizadas pela largura do texto, título com 12 px embaixo; uma ou duas piscadas com 0,08 s entre elas; animação dos menus em tempo real. |

## NBB-161: Músicas de fundo (2026-11-24)

| Código | Decisão |
| -- | -- |
| MF1-A | As músicas são faixas **CC0 ou CC-BY que vêm com o jogo** (Freesound, OpenGameArt, Incompetech), creditadas no `CREDITS.md`: tocam para qualquer um que baixar o repositório. |
| MF2-A | Música no **menu principal** (sobre o filme) e **de dia**; a noite continua sem música, para ouvir a criatura (SM5-A mantida). |
| MF3-A | Menu em **ambiente sombrio** (notas longas e graves, piano esparso, cordas baixas); dia **melancólico e calmo** (piano, violão ou sintetizadores suaves), um alívio entre as noites. |
| MF4-A | **Um tema do menu** em loop sem emenda: entra ao abrir o menu principal e sai em ~1,5 s ao entrar no jogo; a pausa continua em silêncio (MN3-A). |
| MF5-A | **3 ou 4 faixas de dia**, na frequência de hoje (MU2: uma a cada 5–10 min, com silêncio entre elas). |
| MF6-A | **Trechos curtos** (3–8 s) no **amanhecer** (alívio) e no **entardecer** (aviso), e uma faixa calma na **vitória**; pelo grupo de música. |
| MF7-A | Como a SM2-B: Claude traz **2 ou 3 candidatas por vaga** (tema do menu, faixas do dia, amanhecer, entardecer, vitória) com link, licença e autor; o usuário escolhe; Claude corta os loops e iguala o volume com o ffmpeg. |
| MF7-B | O usuário pediu as candidatas **do Freesound** (em vez do Incompetech). |
| MF8-A | Tema do menu: "Uneasy Horror Ambience Music (Loop)", Evan Boyerman (Freesound 850444, CC-BY 4.0, 1:36). |
| MF9 | Faixas do dia: "Melancholic piano music", ZHRØ (623426, CC0); "Bittersweet Piano #1 (With Intro/Outro)", kanaizo (755823, CC0); "Soundscape - Dust - Ambient Guitar", Tri-Tachyon (478318, CC-BY 4.0); "Calm Acoustic Guitar for Serene Moments", Gustavo_Alivera (761373, CC-BY 4.0). |
| MF10-B | Amanhecer: "eastern sunrise", lerwickdj (246160, CC0, 6 s), um som repentino que combina com **uma mensagem na tela** (pedido do usuário: "Amanhecer" ou "Você sobreviveu"; detalhes na MF13). |
| MF11-A | Entardecer: "Chime of Doom", Kostas17 (538432, CC-BY 3.0, 6 s). |
| MF12-A | Vitória: "Hopeful Piano/String Cinematic Ambience", Evan Boyerman (798705, CC-BY 4.0, 2:04). |
| MF13-B | A mensagem do amanhecer depende de como se chegou a ele: acordado, **"VOCÊ SOBREVIVEU"** com "Noite N" embaixo; dormindo, **"AMANHECER"** com "Dia N"; depois de morrer, sem mensagem nem som (a tela de morte já fez esse papel). |
| MF14-B | No entardecer, o sino vem com a mensagem **"A NOITE CHEGA"**. |
| MF15-A | Sai o suporte à pasta privada das faixas do dia (`assets-private/music/`, MU1-A): só as quatro faixas que vêm com o jogo. A pasta privada da perseguição (MT1-C) continua. |
| MF16 | Detalhes propostos por Claude e aprovados ("1 a 10 - Ok"): prévias MP3 de alta qualidade do Freesound em `public/sounds/music/` (`menu`, `day-1` a `day-4`, `dawn`, `dusk`, `victory`), com o volume igualado ao da perseguição e sem silêncio nas pontas; tema do menu em loop, entra em 2 s, sai em 1,5 s ao entrar no jogo, recomeça a cada volta ao menu, pausa em silêncio; faixas do dia nas regras da MU2; sino do entardecer também na última noite, não durante uma perseguição; sem som nem mensagem no amanhecer do resgate nem quando o jogo abre de manhã; mensagem no terço de cima, centralizada, no estilo dos menus (56 px espaçados com brilho, linha de baixo de 20 px a 60%), surge em 1 s, fica 3 s e some em 1,5 s; vitória entra em 2 s quando o texto aparece, toca uma vez, some em 1,5 s ao escolher, e a faixa do dia sai antes; tudo pelo grupo de música, amanhecer e entardecer a 0,6 e as faixas a 0,45; `CREDITS.md` com cada faixa, sem a linha do Epidemic Sound; `silentHunt.dawnMessage()` e `silentHunt.musicCue()`. |
| MF17 | Revisão do usuário (2026-11-24): detalhes decididos por Claude aprovados ("1 a 11 - Ok"): faixas a −18 LUFS, pico de −1,5 dB, MP3 de 160 kbps; corte das pontas abaixo de −60 dB (sino 4,3 s, vitória 1:50, day-1 1:48); "Noite N" sob "A NOITE CHEGA"; pulo do relógio maior que 5 s conta como sono, morto não tem mensagem; dias e noites contados desde o começo do mundo; a faixa do dia para na hora ao abrir o menu principal; nenhuma faixa do dia com a vitória aberta; linha do Epidemic Sound nos créditos só com faixa privada da perseguição; mensagem a 18% do topo; ~19 MB de música no repositório; `musicCue()` e `dawnMessage()`. |

## NBB-162: Mais efeitos sonoros (2026-11-24)

| Código | Decisão |
| -- | -- |
| FX1 | Entram **todos os grupos**, nesta prioridade: criatura (chamado distante, grito ao fugir do fogo e no ritual, farejar), fogo (tocha própria, apagar tocha e fogueira), objetivo (rádio, papel do bilhete e do mapa, crânios queimando, helicóptero), jogador (dano, morte, fome), interface (menus, inventário, item fabricado), ferramentas (arremesso, flecha que erra, espingarda vazia, pegar coisas), coelho (fuga e guincho) e ambiente (árvores rangendo, rajadas, galho caindo longe). Muda a SM1-A, que deixava a interface sem som. |
| FX2-A | Como a SM2-B: o usuário escolhe entre 2 ou 3 candidatos nos sons de clima e aviso (chamado e grito da criatura, tocha, rádio, helicóptero, interface, dano e morte); os pequenos Claude escolhe e o usuário revisa no jogo. Freesound, CC0 de preferência e CC-BY quando claramente melhor (SM3-A). |
| FX3-A | Interface **sutil e orgânica** (madeira e papel): toque leve ao passar, batida grave e abafada ao confirmar, mais suave ao voltar. |
| FX4-A | O **chamado distante** da criatura, uma ou duas vezes por noite, de 60 a 100 m, **vindo de onde ela está de verdade**: uma pista para o jogador atento. |
| FX5-B | **Sem voz** no jogador: baque surdo e uma respiração presa ao levar dano; o coração para ao morrer. |
| FX6-A | Um **helicóptero** se aproxima nos ~10 s antes da tela de vitória do resgate, junto com o escurecer. |
| FX7-A | Chamado distante: "Wildlife Creature Warning Howl", qubodup (Freesound 743078, CC0). |
| FX8-A | Grito da criatura: "Forest Monster Scream1", Unaxete (259281, CC0). |
| FX9-B | Tocha: "Torch or Molotov Cocktail", craigsmith (483322, CC0), um trecho estável em loop. |
| FX10 | Rádio: o chiado "Radio tuning-static-interference", quantumriver (552160, CC0), e a resposta "walkie talkie ininteligible", vinjatovix (109647, CC-BY 4.0). |
| FX11-A | Helicóptero: "Approaching helicopter", Link-Boy (158744, CC0). |
| FX12-A | Interface: "UI Click Wooden", Qvantor (878238, CC0), com altura e volume diferentes para passar, confirmar e voltar. |
| FX13 | Dano: o baque "BodyHit1", Shakedown_M (685204, CC0), e a respiração "sfx sharp breath", DBKEEBLER (403689, CC-BY 3.0). A morte usa o coração do jogo: duas ou três batidas mais lentas e silêncio. |
| FX14 | Sons pequenos escolhidos por Claude e aprovados ("Ok"), do Freesound: apagar tocha e fogueira "Fuego Apagandose 2" (IanLyanx, CC0); farejar "Dog Sniffing" (esperri, CC0), mais grave e lento; bilhete "opening_note" (dalexgray, CC0) e mapa "Unfold a map" (Breviceps, CC0); crânios queimando "Fire Burst" (SilverIllusionist, CC-BY 4.0); fome "Stomach growl" (XxBirdoxX, CC0) a cada 40–80 s abaixo de 25%; inventário "Backpack Open & Close" (Lukeo135, CC0) dividido em abrir e fechar; item fabricado "nailing a wooden stake" (checholio, CC0); arremesso com o sopro da faca mais grave; flecha voando "arrow_whoosh" (smcameron, CC-BY 4.0); espingarda vazia "DryFire_01" (fastson, CC-BY 3.0); pegar coisas "Picking up small box with items inside" (WiesenWiesel, CC-BY 4.0), no lugar do passo nas folhas (AC1); coelho: batida de pata "rabbit-thump-on-soil" (bunnyluvvid, CC0) na fuga e o grito do cervo mais agudo ao morrer; ambiente: "tree_creak_02" (Department64, CC0) à noite, "Wind Gust" (crashoverride6, CC0) e "Falling branch" (marcolo91, CC0) longe à noite. |
| FX15 | Detalhes propostos por Claude e aprovados ("Ok"): chamado 1–2 vezes por noite, só com a criatura a 60–100 m e rondando, em 3D, nunca no começo da noite; grito em 3D quando a tocha ou o fogo a faz recuar e no ritual, no máximo a cada 20 s; a tocha acesa com loop próprio; rádio: chiado ~3 s, depois a voz ~4 s e a mensagem; helicóptero nos 10 s antes da vitória do resgate (a vitória passa a vir 10 s depois do amanhecer), parando quando ela aparece; interface: passar agudo 0,25, confirmar grave 0,5, voltar grave e baixo 0,35, em todas as telas de menu e na vitória, tocando também com o mundo pausado; dano: baque e respiração a cada golpe (0,8); morte: as duas últimas batidas do coração mais lentas e silêncio; volumes igualados e pontas cortadas; `CREDITS.md`, `docs/04` e `silentHunt.sound()`. |
| FX16 | Revisão do usuário (2026-11-24): detalhes decididos por Claude aprovados ("1 a 16 - Ok"): o clique dos menus toca fora do motor de áudio (a pausa continua parando todo o som do mundo); alturas do clique 1,25, 0,8 e 0,7, sem clique na primeira opção nem nas barras; grito quando a tocha a faz recuar ao espreitar e ao chegar a uma fogueira no ataque; no ritual o grito toma o lugar do rosnado e sempre toca; chamado nunca no primeiro minuto da noite, ouvido até 140 m (grito até 60 m); tocha num trecho de 3,5 s em loop a 0,35; mensagem do rádio junto com a voz; helicóptero de 12 s que entra em 6 s e some em 1,5 s; arquivos longos a −20 LUFS e curtos com pico de −2 dB; volumes no `config.ts`; duas batidas a 0,6 s e 1,5 s em qualquer morte; sons novos em 20% dos soltos de dia e 35% à noite; pata do coelho ao se assustar e grito do cervo 1,6 vez mais agudo a 0,4; espingarda vazia a cada 0,35 s; primeiro ronco ao cair abaixo de 25%; `sound()`, `creatureCall()` e `click()`. |

## Pendentes (proposto)

Nenhuma.
