# 02 — Escopo e fases

**Nada fora deste documento é implementado.** Ideia nova vira issue no **Backlog, sem marco**, até o usuário promovê-la.

Prazo: **20/11/2026, até o fim do dia** (G1). Escopo: **tudo o que foi decidido** (O1-A), na ordem abaixo. A ordem coloca primeiro o que os avaliadores mais percebem (clima e criatura). Se atrasarmos, cortamos do fim para o começo (ver [Ordem de corte](#ordem-de-corte)).

## Marcos (fases)

Versões aprovadas no G8. Como o jogo não é publicado (T7), a tag só marca o fim de cada fase. Quem cria a tag é o usuário.

| Marco | Dias | Objetivo | Versão |
|---|---|---|---|
| M0 · Base | 12–13/11 | Projeto rodando, teste de carga aprovado (T0-C), galeria | `v0.1.0` |
| M1 · Floresta sombria | 13–14/11 | Andar na floresta infinita com neblina, dia e noite, ruído e tocha | `v0.2.0` |
| M2 · Ser caçado | 14–15/11 | Criatura completa: espreita, passos, olhos, ataque, fogo afasta | `v0.3.0` |
| M3 · Caçar | 15–17/11 | Coelho e cervo, faca, arco, espingarda, fome, cozinhar | `v0.4.0` |
| M4 · Sobreviver | 17–19/11 | Coleta, crafting, construção em grade, cama, save, mochila | `v0.5.0` |
| M5 · Polimento | 19–20/11 | Som, música, menus, equilíbrio, bugs, instruções | `v1.0.0` |

## Issues por marco

Cada linha vira **uma issue e um PR** (O2-A). Área entre colchetes. No Linear, a issue número *n* é a **NBB-(122 + n)**: a 1 é a NBB-123 e a 30 é a NBB-152.

### M0 · Base
1. **Documentação inicial:** `docs/`, `CLAUDE.md`, README com "como rodar". [Docs]
2. **Projeto base:** Vite + TypeScript + Babylon + Havok, ESLint, Prettier, Vitest; CI no GitHub (formatação, lint, tipos, testes, build), `pr-title`, CodeQL, Dependabot. [Infra]
3. **Teste de carga (T0-C):** chunks procedurais com terreno, árvores provisórias e neblina; contador de FPS; relatório com a medição e a decisão Babylon ou Godot. [Frontend]
4. **Galeria de modelos (A2-C):** cena de desenvolvimento para girar modelos, trocar dia/noite/neblina e tocar animações. [Frontend]

### M1 · Floresta sombria
5. **Jogador em primeira pessoa:** câmera, andar, correr, agachar, pular, colisão (Havok). [Frontend]
6. **Modelos do mundo:** árvores (3 espécies), pedras, arbustos, galhos e folhagem do chão, todos procedurais. [UX]
7. **Mundo infinito:** geração por semente, carregar e descartar chunks, espalhar a vegetação, tipos de chão. [Frontend]
8. **Dia, noite e neblina:** ciclo de luz, neblina densa, céu, noite escura. [Frontend]
9. **Sistema de ruído e medidor no HUD (M1-B, M2-A).** [Frontend]
10. **Tocha e visibilidade pela luz (M3-B).** [Frontend]

### M2 · Ser caçado
11. **Modelo da criatura:** malha, esqueleto, skinning e animações (andar, espreitar, atacar, recuar) (A5-B). [UX]
12. **IA da criatura:** estados, ouvir ruído, ver luz, comportamento de dia e de noite, fogo afasta (M4-B, M5-B). [Frontend]
13. **Presença da criatura:** olhos brilhantes e passos com som 3D (A4-A). [Frontend]
14. **Vida, dano e tela de morte.** [Frontend]

### M3 · Caçar
15. **Modelos do coelho e do cervo:** malha, esqueleto e animações (pastar, alerta, correr, morrer). [UX]
16. **IA das presas:** pastar, perceber (ruído, luz, visão), fugir. [Frontend]
17. **Mãos em primeira pessoa e faca:** golpe e ataque furtivo (M8-A). [Frontend]
18. **Arco e flechas:** mira, puxar, trajetória com Havok, recuperar flechas. [Frontend]
19. **Espingarda:** rara, munição escassa, barulho que chama a criatura. [Frontend]
20. **Carcaça, carne, fome e cozinhar na fogueira (M9-A).** [Frontend]

### M4 · Sobreviver
21. **Coleta e inventário:** cortar árvores, pegar pedras e galhos, inventário e barra rápida. [Frontend]
22. **Crafting:** receitas da tabela em [03-mecanicas](03-mecanicas.md#coleta-crafting-e-construção). [Frontend]
23. **Construção em grade (M10-A):** pré-visualização, encaixe, regra de apoio, desmontar. [Frontend]
24. **Fogueira e cama:** fogueira afasta a criatura e cozinha; cama define onde renascer. [Frontend]
25. **Save no IndexedDB (T3-A):** semente, chunks alterados, construções, jogador, inventário. [Frontend]
26. **Morte com mochila (M12-A).** [Frontend]

### M5 · Polimento
27. **Som:** ambiente (vento, floresta), efeitos, música (fora do Git), créditos (`CREDITS.md` e tela). [UX]
28. **Menus:** principal (novo mundo, continuar), pausa, opções (sensibilidade, volume), fonte. [UX]
29. **Equilíbrio e bugs:** sessão de testes e ajustes de valores. [Frontend]
30. **Entrega:** README final, como rodar, controles, capturas. [Docs]

## Ordem de corte

**(G9)** Se uma fase atrasar mais de meio dia, cortamos nesta ordem (o primeiro item é o primeiro a sair) e o item vai para o Backlog:

1. Espingarda (19)
2. Crafting além de tocha, fogueira, faca, arco e flechas (parte da 22)
3. Telhado e porta (parte da 23)
4. Mochila na morte: vira "renasce sem os itens" (26)
5. Skinning do coelho: vira peças rígidas articuladas (parte da 15)

Os marcos M1 e M2 **não** são cortados: são o coração do desafio.

## Fora do escopo (Backlog)

- Sede, frio e sanidade (M9-B/C).
- Animal que revida, como o javali (M6-C).
- Controle (gamepad) e celular (T4).
- Exportar e importar o save num arquivo (T3).
- Publicação (itch.io, VPS) (T7).
- Seletor de idioma (O4).
