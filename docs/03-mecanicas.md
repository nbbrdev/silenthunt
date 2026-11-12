# 03 — Mecânicas (GDD)

Regras numeradas (`RF-xx`) **nunca são renumeradas**: o que sair fica riscado com a data e o motivo. Os valores foram aprovados pelo usuário com os códigos G2 a G13 (ver [06-decisoes](06-decisoes.md)). Todos os valores ficam num único arquivo de configuração no código, para o ajuste fino (issue 29) ser fácil.

## Controles

**(G2)**

| Ação | Tecla |
|---|---|
| Andar | W A S D |
| Olhar | Mouse |
| Correr | Shift (segurar) |
| Agachar | C (alterna) ou Ctrl (segurar) |
| Pular | Espaço |
| Usar item / atacar | Botão esquerdo |
| Mirar (arco, espingarda) | Botão direito (segurar) |
| Interagir (pegar, comer, dormir, acender) | E |
| Acender ou apagar a tocha | F |
| Barra rápida | 1 a 6 e roda do mouse |
| Inventário e crafting | Tab |
| Modo de construção | B |
| Girar peça na construção | R |
| Pausa | Esc |

## Mundo

- **RF-01** O mundo é infinito e gerado a partir de uma **semente** (M11-C). A mesma semente gera sempre o mesmo mundo.
- **RF-02** O terreno tem relevo suave (colinas e vales), sem cavernas nem água profunda.
- **RF-03** Tipos de chão: **terra**, **musgo**, **folhas secas** e **galhos secos** (manchas espalhadas). O tipo de chão muda o ruído (RF-11).
- **RF-04** Vegetação: 3 espécies de árvore (pinheiro, carvalho, árvore morta), arbustos, pedras e galhos soltos. A densidade varia por região (clareiras e mata fechada).
- **RF-05** Ciclo de dia e noite (M5-B): **dia de 10 min e noite de 6 min**, com 1 min de entardecer e 1 min de amanhecer dentro desses tempos (G4). O jogo começa de manhã.
- **RF-06** Neblina densa sempre. Visibilidade (G11): cerca de **40 m de dia** e **15 m à noite** (sem luz).

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

- **RF-11** O chão multiplica os raios de movimento (G3): musgo ×0,7; terra ×1,0; folhas secas ×1,4. Pisar num **galho seco** dá um estalo único de **12 m**, mesmo agachado.
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

- **RF-14** A tocha ilumina cerca de 12 m ao redor e dura **4 min** acesa (G11).

## A criatura

**(G12)**

- **RF-20** Existe uma criatura por mundo, sempre ativa, e ela **não pode ser morta** (M4-B).
- **RF-21** Estados:

  | Estado | O que faz |
  |---|---|
  | **Rondar** | Vaga longe do jogador (de dia, a 60–120 m; de noite, a 30–60 m). |
  | **Espreitar** | Segue o jogador fora da visão dele (no limite da neblina), parando quando é olhada. Passos baixos e olhos visíveis. |
  | **Investigar** | Vai até o último ruído ou luz que percebeu. |
  | **Atacar** | Corre até o jogador e golpeia. |
  | **Recuar** | Depois do golpe, foge para a neblina e volta a rondar após 60–90 s. |

- **RF-22** De dia ela **nunca ataca**: só ronda, espreita de longe e investiga ruídos muito altos (espingarda). De noite ela ataca depois de **20–40 s** espreitando.
- **RF-23** O golpe tira **40 de vida** (de 100).
- **RF-24** **Fogo afasta:** ela não chega a menos de **8 m** de uma fogueira acesa. A tocha acesa faz ela hesitar e recuar quando o jogador a encara a menos de 10 m, mas também a atrai de longe (RF-13).
- **RF-25** **Presença:** os olhos brilham (visíveis até o limite da neblina, mesmo no escuro) e os passos tocam com som 3D (A4-A), baixos e espaçados, audíveis até **25 m**.

## Caça

**(G13)**

- **RF-30** Presas: **coelho** (pequeno, rápido, 1 de carne) e **cervo** (grande, arisco, 4 de carne) (M6-B).
- **RF-31** Estados das presas: **pastar** → **alerta** (ouviu ou viu algo: para e olha) → **fugir** (corre para longe por 10–15 s) → volta a pastar. O cervo fica em alerta com metade do estímulo do coelho.
- **RF-32** **Faca** (M8-A): alcance de 1,5 m. Se a presa **não está em alerta nem fugindo**, mata na hora. Se está em alerta, ela foge. Contra a criatura: não causa dano, mas faz ela recuar.
- **RF-33** **Arco:** segurar para puxar (até 1 s). A flecha cai com a gravidade (Havok). Um acerto mata o coelho; o cervo precisa de dois (o primeiro o faz fugir ferido). A flecha pode ser recuperada (chance de quebrar: 25%).
- **RF-34** **Espingarda:** um tiro mata qualquer presa até 40 m. Barulho de 150 m (RF-10) chama a criatura **mesmo de dia**. É encontrada uma vez no mundo, numa cabana abandonada perto do início, com 4 cartuchos; mais cartuchos aparecem raramente em baús dessas cabanas.
- **RF-35** Presa abatida vira **carcaça**: interagir dá a carne crua. Carne crua: +10 de fome. Carne cozida na fogueira (10 s): +30.

## Necessidades

**(G6)** (M9-A)

- **RF-40** **Vida** 0–100. Volta 1 por segundo quando a fome está acima de 50.
- **RF-41** **Fome** 100 → 0 em **2 ciclos de dia e noite** (32 min). Com fome 0, perde 1 de vida a cada 2 s.
- **RF-42** **Fôlego** 0–100. Correr gasta 15 por segundo; recupera 20 por segundo parado ou andando. Sem fôlego, não corre.

## Coleta, crafting e construção

**(G7)**

- **RF-50** Recursos: **madeira** (cortar árvore com machado), **galho** (pegar do chão), **pedra** (pegar do chão ou quebrar pedra grande), **fibra** (de arbusto), **carne**, **couro** (do cervo).
- **RF-51** Receitas (crafting no inventário, sem bancada):

  | Item | Custo |
  |---|---|
  | Machado de pedra | 2 galhos, 2 pedras, 1 fibra |
  | Faca de pedra | 1 galho, 1 pedra, 1 fibra |
  | Tocha | 1 galho, 1 fibra |
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

- **RF-53** No modo de construção (B), a peça aparece transparente: **verde** se pode ser colocada e **vermelha** se não pode. Desmontar devolve metade do custo.
- **RF-54** A criatura **não atravessa paredes nem portas fechadas**. Ela não destrói construções.

## Morte e save

- **RF-60** Ao morrer (M12-A), uma **mochila** com todo o inventário fica no local. O jogador renasce na última cama usada (ou no ponto inicial). Se morrer de novo antes de pegar a mochila, a mochila antiga continua lá (podem existir várias).
- **RF-61** O jogo salva automaticamente a cada **60 s**, ao dormir e ao pausar (G6, T3-A). Um único mundo salvo por vez; "Novo mundo" pede confirmação antes de apagar o atual.
- **RF-62** Dormir na cama, de noite e sem a criatura a menos de 30 m, pula para o amanhecer.
