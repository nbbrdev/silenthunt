# 05 — Arquitetura

## Stack

| Peça | Escolha | Por quê |
|---|---|---|
| Linguagem | TypeScript (T1-A) | O Babylon é escrito em TypeScript; os tipos evitam erros num projeto grande. |
| Build e servidor local | Vite (T1-A) | Sobe o jogo localmente em segundos e gera os arquivos finais. |
| Motor 3D | Babylon.js 9 (`@babylonjs/core`) (T0-C) | Escolha do usuário, validada pelo teste de carga. |
| Física | Havok (`@babylonjs/havok`) (T2-B) | Motor de física oficial do Babylon (colisões, controle do personagem, flechas). |
| Organização | Behaviors + Observables do Babylon (T5a-C) | Nativo, sem biblioteca extra. |
| Save | IndexedDB (T3-A) | Banco de dados do próprio navegador; sem servidor. |
| Testes | Vitest (T6-A) | Testes rápidos da lógica (ruído, IA, receitas, save, geração). |
| Qualidade | ESLint + Prettier | Padrão de código e formatação. |
| Ambiente | Node 24, npm | Já instalados na máquina do usuário. |

Executar: `npm install` e `npm run dev`, depois abrir o endereço que o Vite mostrar. Não há deploy (T7).

## Organização do código

(G16)

```
src/
  main.ts                 // cria o motor, a cena e inicia o jogo
  config.ts               // TODOS os valores ajustáveis (raios, tempos, dano...)
  core/                   // laço do jogo, entrada (teclado e mouse), relógio do dia
  world/                  // semente, ruído, chunks, terreno, vegetação, tipos de chão
  models/                 // geradores procedurais: trees/, rocks/, creature/, animals/, items/, building/
  player/                 // controle em primeira pessoa, necessidades, inventário
  ai/                     // percepção (ouvir, ver), máquina de estados, criatura, presas
  systems/                // ruído, visibilidade, crafting, construção, save
  ui/                     // HUD, menus, galeria
  audio/                  // sons 3D, ambiente, música
tests/                    // testes do Vitest, espelhando src/
```

### Como as peças conversam (T5a-C)

- **Behaviors:** um comportamento reutilizável pendurado num objeto da cena. Ex.: `CreatureBrainBehavior` na criatura, `PreyBrainBehavior` no coelho e no cervo, `NoiseEmitterBehavior` em quem faz barulho.
- **Observables:** avisos que os sistemas escutam. Ex.: o `NoiseSystem` publica "ruído de 15 m em (x, z)" e as IAs próximas reagem; o relógio publica "anoiteceu".
- **Lógica separada do Babylon sempre que possível:** regras como "qual o raio de ruído agora" ou "pode colocar esta parede aqui" ficam em funções puras (sem cena 3D), para o Vitest testar sem abrir o navegador.

## Mundo infinito (M11-C)

**(G5)**

- O mundo é dividido em **chunks de 64 × 64 m**. Ficam carregados os chunks num raio de **2 chunks** em volta do jogador (5 × 5 = 25 chunks, cerca de 160 m em cada direção). Como a neblina esconde tudo depois de ~40 m, o jogador não vê os chunks aparecendo.
- Cada chunk é gerado da **semente do mundo + coordenadas do chunk**: sempre o mesmo resultado.
- **Instâncias:** as árvores da mesma espécie usam uma malha só, desenhada muitas vezes (*thin instances*), o que é bem mais leve para a placa de vídeo.
- **Mudanças no mundo** (árvore cortada, pedra pega, construção) ficam numa lista por chunk. Só essa lista vai para o save.
- **Precisão longe da origem:** muito longe do ponto (0, 0) os números de posição perdem precisão e o jogo "treme". Se for preciso, reposicionamos o mundo em volta do jogador (*floating origin*). Fica no Backlog até aparecer.

## Teste de carga (T0-C)

**(G5)** Issue 3, logo no M0:

- Cena com os 25 chunks carregados, **~80 árvores por chunk** (≈ 2.000 árvores), terreno, neblina, luz de noite com uma tocha e 3 modelos animados provisórios andando.
- Jogador andando sem parar numa direção por 2 minutos (carregando e descartando chunks).
- **Aprovado** se, no computador do usuário, em tela cheia: **média ≥ 60 FPS** e **sem travadas acima de 100 ms** ao trocar de chunk.
- Reprovado: apresentamos ao usuário otimizações possíveis ou a troca para o Godot (decisão dele).

## Limites de desempenho (G16)

| Item | Limite |
|---|---|
| Árvore | até 600 triângulos |
| Animal | até 2.500 triângulos |
| Criatura | até 4.000 triângulos |
| Peça de construção | até 200 triângulos |
| Ossos por esqueleto | até 30 |

## Save (T3-A)

Um registro no IndexedDB com: versão do formato, semente, hora do dia, jogador (posição, vida, fome, fôlego, inventário, cama), mudanças por chunk, construções, mochilas e estado da espingarda e dos baús. A **versão do formato** permite mudar a estrutura no futuro sem quebrar mundos salvos.

## ADRs (registros de decisão de arquitetura)

| ADR | Decisão | Status |
|---|---|---|
| ADR-01 | Babylon.js no navegador, validado por teste de carga; Godot como plano B (T0-C) | Aceito |
| ADR-02 | Havok para física (T2-B) | Aceito |
| ADR-03 | Behaviors + Observables em vez de ECS (T5a-C) | Aceito |
| ADR-04 | Modelos 100% procedurais em TypeScript (A1-A) | Aceito |
| ADR-05 | Esqueleto com skinning nos animais e na criatura (A5-B) | Aceito |
| ADR-06 | Mundo em chunks de 64 m com raio 2 e thin instances (G5) | Aceito |
| ADR-07 | Save em IndexedDB com versão do formato (T3-A) | Aceito |
| ADR-08 | Todos os valores ajustáveis em `src/config.ts` (G16) | Aceito |
