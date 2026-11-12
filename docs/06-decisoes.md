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
| O2-A | Um PR pequeno por issue; o usuário revisa antes do merge, várias vezes por dia. |
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

## Pendentes (proposto)

Nenhuma no momento.
