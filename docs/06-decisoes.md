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
| J1 | Velocidades: andar 1,6 m/s, correr 4,5 m/s, agachado 0,9 m/s. |
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
| MW2 | Por chunk: ~80 árvores (45% pinheiro, 35% carvalho, 20% morta), ~40 arbustos, ~15 pedras, ~30 galhos, ~150 tufos; clareiras (0,1×) e mata fechada (1,5×). |
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
| CT1-A | Manter todo o escopo (R1-B) e reavaliar no fim de 18/11: se o M3 não estiver pronto, cortar os itens 1 e 2 da ordem de corte (espingarda e crafting além do básico). |

## NBB-137: Modelos do coelho e do cervo (2026-11-17)

| Código | Decisão |
|---|---|
| CO1 | O usuário mandou referências: cervos realistas (veado-vermelho e corça) e coelhos selvagens marrons (orelhas longas, patas traseiras grandes, cauda branca). Inspiração, não cópia. |
| CO2 | Coelho com ~40 cm de comprimento; cervo com ~1,8 m de comprimento e 1,1 m na cernelha. |
| CO3 | Só corças, **sem galhada**: a galhada fica exclusiva da criatura, então um vulto com galhos na cabeça na neblina é sempre ela. |
| CO4 | Coelho marrom-acinzentado com cauda clara; cervo marrom-avermelhado apagado com barriga e traseira claras; cores na paleta do `config.ts`. |
| CO5 | Detalhes propostos por Claude e aprovados ("1 a 5 - Ok", "modelos ok"): textura de pelo desenhada por código; cores exatas na paleta; ritmos (cervo: galope 0,6 s, morrer 0,8 s; coelho: salto 0,4 s, morrer 0,6 s); esqueleto, skinning e poses compartilhados em `src/models/rig/`; olhos dos animais escuros, sem brilho. |

## Pendentes (proposto)

Nenhuma no momento.
