# 03 — Mecânicas (GDD)

Regras numeradas (`RF-xx`) **nunca são renumeradas**: o que sair fica riscado com a data e o motivo. Os valores foram aprovados pelo usuário com os códigos G2 a G13 (ver [06-decisoes](06-decisoes.md)). Todos os valores ficam num único arquivo de configuração no código, para o ajuste fino (issue 29) ser fácil.

## Controles

**(G2)**

| Ação | Tecla |
|---|---|
| Andar | W A S D |
| Olhar | Mouse |
| Correr | Shift (segurar) |
| Agachar | C (alterna). ~~Ctrl (segurar)~~ removido em 2026-11-16 (J5-A): Ctrl+W fecha a aba do navegador |
| Pular | Espaço |
| Usar item / atacar | Botão esquerdo |
| Mirar (arco, espingarda) | Botão direito (segurar) |
| Interagir (pegar, comer, dormir, acender) | E |
| Acender ou apagar a tocha | F |
| Arremessar uma pedra (segurar para mirar; PD1-B, TR1-A) | G |
| Mapa (MP1-A) | M |
| Barra rápida | 1 a 6 e roda do mouse |
| Inventário e crafting | Tab |
| Modo de construção | B |
| Girar peça na construção | R |
| Pausa | Esc |
| Nos menus: escolher, confirmar, voltar (EM6-A) | ↑ ↓ ou W S; Enter ou Espaço; Esc (← → ou A D nas barras) |

## Mundo

- **RF-01** O mundo é infinito e gerado a partir de uma **semente** (M11-C). A mesma semente gera sempre o mesmo mundo.
- **RF-02** O terreno tem relevo suave (colinas e vales), sem cavernas. Rios e lagos desde a NBB-164 (RF-71).
- **RF-03** Tipos de chão: **terra**, **musgo**, **folhas secas** e **galhos secos** (manchas espalhadas). O tipo de chão muda o ruído (RF-11).
- **RF-04** Vegetação: 3 espécies de árvore (pinheiro, carvalho, árvore morta), arbustos, pedras e galhos soltos. A densidade varia por região (clareiras e mata fechada).
- **RF-05** Ciclo de dia e noite (M5-B): **dia de 10 min e noite de 6 min**, com 1 min de entardecer e 1 min de amanhecer dentro desses tempos (G4). O jogo começa de manhã.
- **RF-06** Neblina densa sempre. Visibilidade (G11): cerca de **40 m de dia** e **15 m à noite** (sem luz).
- **RF-70** **Biomas** (NBB-163; BI1, BI2-A, BM1 a BM12): o mundo se divide em manchas de 400 a 800 m, sorteadas pela semente, com mistura de 40 m nas fronteiras. O começo (200 m) é sempre pinheiral, e em volta das cabanas o chão é firme. Cada bioma muda a forma de jogar:
  - **Pinheiral** (~40%): o de antes.
  - **Bosque de folhosas** (~15%): carvalhos e bétulas, chão de folhas secas (passos 50% mais barulhentos), o dobro de moitas.
  - **Pântano** (~15%): baixo e quase plano, árvores mortas, juncos e poças. Fora das **trilhas de terra firme** (musgo), a **lama** deixa na metade da velocidade e cada passo faz barulho de água no raio do galho estalando. A neblina chega 40% mais perto, para o jogador e para a criatura. Os juncos escondem como moita.
  - **Campo aberto** (~15%): poucas árvores, capim alto e muitas pedras soltas. De pé, o jogador é visto 50% mais longe; agachado no capim alto, só a menos de 15 m.
  - **Serra rochosa** (~15%): morros até ~25 m mais altos em degraus, paredões e pedras grandes (para o machado). Subir encosta de mais de 15° deixa a 70% da velocidade e cansa como correr. O vento encobre os passos: os do jogador e os da criatura chegam a 70% do alcance.
  - Chãos novos: **lama** (pântano) e **capim** (campo), com passos próprios. O mapa pinta cada bioma, e o nome dele aparece ao entrar.
  - **Quedas altas ferem** (BM1): cair de mais de 4 m tira 12 de vida por metro a mais; água de 1,5 m ou mais amortece a queda.
- **RF-71** **Água e nado** (NBB-164; AG1-A a AG17-A): rios e lagos cavados no relevo, sorteados pela semente (ruído, AG12-A): rios de 6 a 14 m de largura e ~2 m de fundura, com vaus rasos; lagos de até 3,5 m; no pântano, lagos rasos e mais frequentes. O começo (200 m) e as cabanas (40 m) ficam secos. A superfície reflete as árvores e o céu (material de água do Babylon).
  - **Água rasa** (de 0,3 a 1,3 m acima dos pés): anda a 60% da velocidade, e os passos soam como na lama, com alcance 50% maior.
  - **Nadar** (a partir de 1,3 m): 1,6 m/s, ou 2,4 m/s com Shift (gasta fôlego como correr; nadar devagar gasta metade, boiar parado um quarto). Sem fôlego, afunda. **C** segurado mergulha e **Espaço** sobe; embaixo d'água nada para onde olha a 1,4 m/s.
  - **Ar**: 20 s embaixo d'água, numa barra azul-clara acima da barra de vida (só aparece embaixo d'água e até encher de novo); enche em 2 s na superfície. Sem ar, o afogamento tira 10 de vida por segundo. Voltar depois de 3 s ou mais embaixo d'água faz o jogador puxar o ar.
  - **Embaixo d'água**: neblina verde-azulada de ~6 m (mais escura à noite), efeitos e ambiente abafados a 40% e um som de fundo próprio.
  - A **tocha** apaga com a água no peito (1,2 m) e não acende com a água acima da cintura (1 m): "Não dá para acender na água". Nadando, armas e ferramentas não funcionam.
  - **Ruído**: 8 m por braçada na superfície, nenhum embaixo d'água, 15 m ao cair na água funda.
  - A **criatura** não entra onde a água passa de 1 m: contorna pela margem e, com o jogador fora do alcance na água funda, desiste em 40 s; se ele estiver ao alcance, golpeia. **Animais** contornam a água funda e, pastando a menos de 15 m dela, às vezes vão à margem beber por 4 a 8 s. Nenhum animal nasce na água.
  - O **mapa** pinta a água de azul-acinzentado, com "Água" na legenda.

## Furtividade

### Ruído (M1-B)

- **RF-10** Cada ação emite um **raio de som**. Quem estiver dentro do raio (presas e criatura) ouve e sabe **de onde** veio.

  **(G3)**

  | Ação | Raio |
  |---|---|
  | Parado | 0 m |
  | Agachado andando | 2 m |
  | Andando | 6 m |
  | Correndo | 15 m |
  | Aterrissar de um pulo | 8 m |
  | Cortar árvore / quebrar pedra | 25 m |
  | Construir (por peça) | 20 m |
  | Golpe de faca | 3 m |
  | Disparo do arco | 8 m |
  | Disparo da espingarda | 150 m |

- **RF-11** O chão multiplica os raios de movimento (G3): musgo ×0,7; terra ×1,0; folhas secas ×1,4; galhos secos ×1,4 (NO4). Pisar num **galho seco** visível no chão (a menos de 0,4 m dele) dá um estalo único de **12 m**, mesmo agachado; cada galho estala uma vez só (NO4-B).
- **RF-12** O **medidor de ruído** no HUD (M2-A) mostra o raio atual como uma barra discreta que pulsa a cada passo.

### Visibilidade (M3-B)

- **RF-13** Presas e criatura **veem** o jogador dentro de um cone à frente delas, até uma distância que depende da luz (G11):

  | Situação do jogador | Distância em que é visto |
  |---|---|
  | No escuro (noite, sem luz) | 8 m |
  | De dia | 20 m |
  | Com tocha acesa | 40 m (de dia ou de noite) |
  | Perto de uma fogueira acesa | 40 m |
  | Agachado | metade da distância |

- **RF-14** A tocha ilumina cerca de 12 m ao redor e dura **4 min** acesa (G11): são 2 tochas por noite (PG3-A).

## A criatura

**(G12)**

- **RF-20** Existe uma criatura por mundo, sempre ativa, e ela **não pode ser morta** (M4-B).
- **RF-21** Estados:

  | Estado | O que faz |
  |---|---|
  | **Rondar** | Vaga longe do jogador (de dia, a 60–120 m; de noite, a 30–60 m). |
  | **Espreitar** | Segue o jogador fora da visão dele (no limite da neblina), parando quando é olhada. Passos baixos e olhos visíveis. |
  | **Investigar** | Vai até o último ruído ou luz que percebeu. |
  | **Atacar** | ~~Corre até o jogador e golpeia.~~ **Persegue** o jogador a ~6 m/s, pouco mais rápido que a corrida dele (5,8 m/s, PS9-A), e golpeia a 2 m, parada (dá para desviar se mexendo). Se o golpe erra, volta a perseguir (GF3-B). Desiste se não o pegar em 25 s ou se ele chegar a uma fogueira acesa (PS1-A, 2026-11-23). |
  | **Recuar** | ~~Depois do golpe,~~ Quando desiste do ataque (ou leva uma facada, RF-32), foge para a neblina e volta a rondar após 60–90 s. |
  | **Procurar** | Perdeu o jogador escondido numa moita (RF-64): por 20–30 s, anda a 3 m/s por pontos a 4–10 m de onde o perdeu; um barulho a leva até ele. Achando o jogador, ataca; sem achar, recua (MI4-A, NBB-154). |

- **RF-22** De dia ela **nunca ataca**: só ronda, espreita de longe e investiga ruídos muito altos (espingarda). De noite ela ataca depois de **20–40 s** espreitando.
- **RF-23** ~~O golpe tira **40 de vida** (de 100).~~ **O golpe mata**, com qualquer vida (GF1-A, NBB-155). A morte pelo golpe é o **"pego"** (GF4-C): a câmera vira para a cara dela em 0,15 s, o rosnado e a mordida tocam, a tela fica preta na hora e "Você morreu" aparece 1,5 s depois. O coração, o ofegar e a música da perseguição param na hora. **Morrer à noite** (pelo golpe ou pela fome) leva ao **amanhecer**: o jogador renasce no começo do dia, com a fome do renascer menos o que cairia nas horas puladas (GF5-B).
- **RF-24** **Fogo afasta:** ela não chega a menos de **8 m** de uma fogueira acesa. ~~A tocha acesa faz ela hesitar e recuar quando o jogador a encara a menos de 10 m~~ **A tocha segura, mas não espanta** (GF2-B): encarada com a tocha acesa a menos de 10 m, ela fica a uns 7 m, rodeando de lado e rosnando a cada 4–7 s; quando o jogador desvia o olhar, ela corre para ele na hora. O ataque só acaba pela desistência em 25 s, pela fogueira ou pelo abrigo. Na espreita, a tocha encarada a faz recuar para a neblina, como quando é encarada (IA4-B). A tocha também a atrai de longe (RF-13).
- **RF-25** **Presença:** os olhos brilham (visíveis até o limite da neblina, mesmo no escuro) e os passos tocam com som 3D (A4-A), baixos e espaçados, audíveis até **25 m**.
- **RF-63** **Perseguição** (NBB-153, PS3, PS4-A): enquanto ela persegue, o coração do jogador bate cada vez mais rápido conforme ela se aproxima, e as bordas da tela escurecem a cada batida; a cada passo dela a menos de 10 m, a câmera treme. Com o fôlego baixo (abaixo de 40), o jogador ofega. Só à noite (PS5).
- **RF-64** **Esconder-se nas moitas** (NBB-154, MI1-A a MI10): agachado dentro de uma moita (a menos de 0,7 m do centro) e com a tocha apagada, o jogador fica **escondido**: as bordas da tela ficam escuras e esverdeadas, e nem a criatura nem as presas o veem, a qualquer distância. A criatura só o acha passando a 2 m dele. Entrar ou sair de uma moita farfalha e faz 4 m de ruído. Na espreita ou na perseguição, ela **perde o jogador** se estava mais longe que a distância em que o veria de pé e sem tocha (8 m no escuro); mais perto, ela o viu entrar e o ataque segue. Perdido o jogador, ela **procura** por perto (RF-21) e depois recua. Escondido, o tempo não a leva a espreitar. À noite, depois de **60 s** escondido na mesma moita, ela o fareja e ataca de onde estiver; sair da moita zera esse tempo. As moitas têm 1,1–1,6 m de altura.
- **RF-65** **Arremessar pedra** (NBB-158, PD1-B a PD8, TR1-A a TR6): G arremessa uma pedra do inventário na direção do olhar, sem trocar o que está na mão; sem pedras, avisa "Sem pedras para arremessar". **Segurar G mira:** aparece o caminho da pedra, em pontinhos que brilham mesmo no escuro e na neblina, com um anel onde ela vai parar; soltar arremessa (um toque rápido arremessa na hora) e o botão direito cancela. Ela sai a 14 m/s e cai com a gravidade (uns 20 m mirando a 45°), com 0,8 s entre arremessos; o gesto faz 3 m de ruído. Ela para no primeiro toque (chão, tronco ou rocha), sem quicar, e ali faz **20 m de ruído**: a criatura vai até lá se não sabe onde o jogador está (rondando, investigando ou procurando, RF-21); as presas fogem; um coelho no caminho morre. A pedra fica no chão e se pega de novo com E (no máximo 30 no chão; não entram no save).

## Objetivo

- **RF-66** **A fuga pelo rádio** (NBB-156; OB1 a OB7, OB12, OB13): num mundo novo, uma frase diz que há uma cabana a uns 60 m e em que direção. A cabana da espingarda tem o primeiro bilhete e a primeira página de um diário. Três outras cabanas, a ~150, ~300 e ~500 m do início (direções sorteadas pela semente), guardam no baú uma peça do rádio (**Bateria**, **Antena** e **Válvulas**), um bilhete e, nas duas primeiras, uma página do diário. Cada bilhete diz a direção (8) e a distância (arredondada a 50 m) da próxima cabana; uma **bússola** no topo da tela (N, NE, L, SE, S, SO, O, NO) ajuda a seguir. Os bilhetes abrem na tela ao abrir o baú (fecha com E ou Esc) e ficam na coluna **"Anotações"** do inventário, com o progresso ("Rádio: N de 3 peças"), que também aparece na pausa. Com as três peças, o inventário mostra a receita **Rádio**; com ele na mão, o botão esquerdo **chama o resgate**, que chega no amanhecer seguinte. As peças, o rádio e os crânios de cervo **nunca vão para a mochila** ao morrer. O resgate mostra a **tela de vitória** ("Você foi resgatado", dias sobrevividos e mortes, "Continuar jogando" ou "Menu principal").
- **RF-67** **O ritual** (OB8-A a OB10-A): o diário conta que três crânios de cervo no fogo, à noite, com a criatura perto, a banem. O cervo limpo deixa **1 crânio** (pilha de 3). Com os 3 crânios, uma fogueira acesa, à noite e a criatura a menos de **20 m**, segurar E na fogueira por 2 s queima os crânios ("Queimar os crânios"). Ela rosna, foge e **some daquele mundo para sempre**; aparece a tela de vitória "A criatura foi banida". Os dois finais se somam: cada um mostra sua vitória uma vez, e o jogo continua.
- **RF-68** **A última noite** (OB4-A, OB11-B): chamado o resgate de dia, a noite seguinte é a última; chamado à noite, a noite atual vira a última. Nela a neblina e a luz puxam para um **vermelho escuro** e os olhos da criatura ficam **vermelhos**; ela ataca sem espreitar, a tocha não a segura, ela não desiste nos 25 s e procura nas moitas por 40–60 s. Só a fogueira e o abrigo fechado protegem, e não dá para dormir nela. Morrer na última noite faz o resgate não achar o jogador: o rádio pode chamar de novo no dia seguinte.
- **RF-69** **Mapa** (NBB-157; MP1-A a MP8): **M** abre (e fecha) uma folha de papel com o norte para cima, centrada no jogador; Esc também fecha. O mundo continua e o jogador fica parado. Só aparece o que ele explorou: quadrados de 8 m a menos de 40 m de onde ele passou, em papel claro, com as árvores como pontinhos; o resto fica escuro. Aparecem sozinhos o jogador (seta), as cabanas visitadas e a próxima, assim que o bilhete que aponta para ela é lido, as fogueiras (laranja acesas, cinza apagadas) e a cama; as mochilas não (MO4-A). Clique esquerdo põe uma marcação (até 12) ou tira a clicada; o botão direito numa marcação a torna o **destino**, que aparece na **bússola** com a distância (a 5 m deixa de ser destino). A roda do mouse muda o zoom (1 px = 0,5, 1 ou 2 m). O save guarda o que foi explorado, as marcações, o destino e as cabanas visitadas.

## Caça

**(G13)**

- **RF-30** Presas: **coelho** (pequeno, rápido, 1 de carne) e **cervo** (grande, arisco, 4 de carne) (M6-B).
- **RF-31** Estados das presas: **pastar** → **alerta** (ouviu ou viu algo: para e olha) → **fugir** (corre para longe por 10–15 s) → volta a pastar. O cervo fica em alerta com metade do estímulo do coelho. Pastando, o animal está distraído e ouve só a metade do raio de cada ruído (FA1-A).
- **RF-32** **Faca** (M8-A): alcance de 1,5 m. Se a presa **não está em alerta nem fugindo**, mata na hora. Se está em alerta, ela foge. Contra a criatura: não causa dano, mas faz ela recuar.
- **RF-33** **Arco:** segurar para puxar (até 1 s). A flecha cai com a gravidade (calculada pelo jogo, AR3-A). Um acerto mata o coelho; o cervo precisa de dois (o primeiro o faz fugir ferido). A flecha pode ser recuperada (chance de quebrar: 25%).
- **RF-34** **Espingarda:** um tiro mata qualquer presa até 40 m. Barulho de 150 m (RF-10) chama a criatura **mesmo de dia**. É encontrada uma vez no mundo, numa cabana abandonada perto do início, com 4 cartuchos; mais cartuchos aparecem raramente em baús dessas cabanas.
- **RF-35** Presa abatida vira **carcaça**: segurar E com a faca na mão (coelho 2 s, cervo 5 s) dá a carne crua, a gordura (coelho 1, cervo 3, PG2-A) e, no cervo, 1 couro; sobra um resto de ossos e pele (CA1-B a CA4-A). Carne crua: +10 de fome. Carne cozida na fogueira (10 s, até 4 de uma vez): +30 (CZ2-A).

## Necessidades

**(G6)** (M9-A)

- **RF-40** **Vida** 0–100. Volta 1 por segundo quando a fome está acima de 50, **só de dia** (à noite o corpo não sara, VD7-B) e só 5 s depois do último dano (VD3-B).
- **RF-41** **Fome** 100 → 0 em **2 ciclos de dia e noite** (32 min). Com fome 0, perde 1 de vida a cada 2 s. Ao renascer, a fome volta a 50 (FO4-B); depois de uma morte à noite, menos o que cairia até o amanhecer (GF5-B).
- **RF-42** **Fôlego** 0–100. Correr gasta ~~15~~ ~~10~~ **6** por segundo (PS2 e PS9-A, 2026-11-23); recupera 20 por segundo parado ou andando. Sem fôlego, não corre.

## Coleta, crafting e construção

**(G7)**

- **RF-50** Recursos: **madeira** (cortar árvore com machado), **galho** (pegar do chão), **pedra** (pegar do chão ou quebrar pedra grande), **fibra** (de arbusto), **carne**, **couro** (do cervo), **gordura** (da carcaça, PG2-A).
- **RF-51** Receitas (crafting no inventário, sem bancada):

  | Item | Custo |
  |---|---|
  | Machado de pedra | 2 galhos, 2 pedras, 1 fibra |
  | Faca de pedra | 1 galho, 1 pedra, 1 fibra |
  | Tocha | 1 galho, 1 fibra, 1 gordura (PG2-A) |
  | Arco | 3 galhos, 3 fibras |
  | Flechas (×5) | 3 galhos, 1 pedra |
  | Fogueira | 4 galhos, 4 pedras |
  | Cama (saco de dormir) | 4 fibras, 2 couros |

- **RF-52** Peças de construção (M10-A), numa grade de **2 m**:

  | Peça | Custo | Regra de apoio |
  |---|---|---|
  | Fundação | 4 madeiras | No chão (aceita desnível de até 1 m). |
  | Parede | 3 madeiras | Em cima de uma fundação. |
  | Porta (parede com porta) | 4 madeiras | Em cima de uma fundação; abre e fecha com E. |
  | Telhado | 3 madeiras | Em cima de duas paredes, ou de uma parede e outro telhado. |

- **RF-53** No modo de construção (B), a peça aparece transparente: **verde** se pode ser colocada e **vermelha** se não pode. As teclas 1 a 4 escolhem a peça, o botão esquerdo coloca, R gira (CN1-A). Segurar o botão direito por 1 s numa peça a desmonta e devolve metade do custo (CN2-A).
- **RF-54** A criatura **não atravessa paredes nem portas fechadas**, e o golpe dela também não passa por elas (CN5-A). Ela não destrói construções.
- **RF-55** A **fogueira** queima **5 min**; E com um galho na mão soma **2 min**, até **10 min**. Apagada, não ilumina nem afasta a criatura (PG4-A). Feita no crafting e colocada pela barra rápida, quantas o jogador quiser (FG1-A, FG2-A); nos últimos 30 s a chama diminui; fria, um galho a reacende; segurar E por 1 s a apaga (FG3-A).
- **RF-56** O jogador **começa sem nada** (PG1-A): faca, tocha, arco e flechas vêm do crafting (PG5-A).
- **RF-57** **Inventário** (IN1-A): 6 espaços na barra rápida e 18 na mochila. Pilhas de 20 (recursos e flechas), 10 (comida e cartuchos) e 1 (ferramentas). O item selecionado na barra aparece na mão (IN6-B); com carne selecionada, o botão esquerdo come (IN2-A). O Tab não pausa o jogo (IN3-A).
- **RF-58** **Coleta à mão** (CL1): E pega um galho do chão ou uma pedra pequena; segurar E por 1,5 s num arbusto dá 2 fibras. O que foi pego some do mundo.
- **RF-59** **Crafting** (CF1-A, CF2-B): as receitas ficam ao lado do inventário (Tab); fazer leva de 2 a 3 s. **Machado** (MC1-A, MC2): golpes de 0,8 s a até 2 m, cada um com 25 m de ruído; pinheiro e carvalho caem com 6 golpes (4 madeiras), a árvore morta com 4 (2 madeiras), deixando um toco; a pedra grande quebra com 5 (3 pedras). O machado não fere animais nem a criatura (MC3-A). **Tocha** (TC1-A): F acende uma tocha do inventário; apagar guarda o tempo que sobrou.

## Morte e save

- **RF-60** Ao morrer (M12-A), uma **mochila** com todo o inventário fica no local. O jogador renasce na última cama usada (ou no ponto inicial). Se morrer de novo antes de pegar a mochila, a mochila antiga continua lá (podem existir várias). A mochila leva também os cartuchos do cano; a tocha da mão fica com o jogador (MO1-A). E pega tudo o que couber; vazia, ela some; ela nunca some sozinha e não tem marcador na tela (MO2-A a MO4-A).
- **RF-61** O jogo salva automaticamente a cada **60 s**, ao dormir e ao pausar (G6, T3-A). Um único mundo salvo por vez; "Novo mundo" pede confirmação antes de apagar o atual. Até a pausa existir, também salva quando a aba fica escondida; nunca com a tela de morte aberta (SV3), mas sim no instante da morte, já como se o jogador tivesse renascido (MO5-A). Um "Salvando..." discreto aparece por 1,5 s (SV4-A).
- **RF-62** Dormir na cama, de noite e sem a criatura a menos de 30 m, pula para o amanhecer. A fome cai como se o tempo passasse; a vida não volta (DO1). A cama vira o ponto de renascer ao ser colocada; segurar E a recolhe (CM1-A, CM2).
