# 05 — Arquitetura

## Stack

| Peça | Escolha | Por quê |
|---|---|---|
| Linguagem | TypeScript 6.0, modo `strict` (T1-A, V1-A, I3-A) | O Babylon é escrito em TypeScript; os tipos evitam erros num projeto grande. O 7 espera o suporte do `typescript-eslint`. |
| Build e servidor local | Vite 8 (T1-A) | Sobe o jogo localmente em segundos e gera os arquivos finais. |
| Motor 3D | Babylon.js 9 (`@babylonjs/core`) (T0-C, X1-C) | Escolha do usuário; definitivo desde 2026-11-16, sem teste de carga. |
| Física | Havok (`@babylonjs/havok`) (T2-B) | Motor de física oficial do Babylon (colisões, controle do personagem, flechas). |
| Organização | Behaviors + Observables do Babylon (T5a-C) | Nativo, sem biblioteca extra. |
| Save | IndexedDB (T3-A) | Banco de dados do próprio navegador; sem servidor. |
| Testes | Vitest (T6-A, X1-C) | Instalado e rodando no CI, mas **sem testes novos** desde 2026-11-16 (X1-C), para ganhar tempo. |
| Qualidade | ESLint 10 (`typescript-eslint`, `import-x`) + Prettier (I3-A, V2-A) | Padrão de código e formatação; o CI (`ci.yml`) roda formatação, lint, tipos, testes, build e auditoria. |
| Depuração | Babylon Inspector, só em desenvolvimento, tecla F9 (I2-A) | Mostra malhas, luzes, FPS e triângulos. Carregado só dentro de `import.meta.env.DEV`, para não entrar no build. |
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

### A IA da criatura (NBB-134)

- **Onde fica:** `src/ai/creatureBrain.ts` tem o `CreatureBrainBehavior`, pendurado no nó raiz da criatura.
- **A cada quadro:**
  1. **Percebe:** ruídos do `NoiseSystem`, se vê o jogador (`VisibilitySystem`) e se está sendo olhada.
  2. **Escolhe o estado:** rondar, espreitar, investigar, atacar ou recuar.
  3. **Move o corpo:** velocidade, desvio, altura do terreno, direção e animação.
- **Valores:** todos em `CONFIG.creature`.
- **Desvio (IA1-A):** `src/ai/steering.ts`, com funções puras. Pergunta ao `ChunkManager.obstaclesNear()` pelos troncos e pedras grandes num raio de ~3,5 m e desvia para o lado. Se mesmo assim entrar num tronco, é empurrada para fora. A mais de 100 m do jogador não desvia: ninguém vê e os chunks podem não estar carregados.
- **Sem física (IA7-A):** a posição é calculada pelo cérebro e a altura vem do `Terrain.heightAt()`.
- **Animações:** misturadas na troca (*blending*); a velocidade de cada uma acompanha a do corpo.
- **Ganchos para depois:**
  - `onPlayerHit` avisa o golpe; a NBB-136 tira a vida.
  - A lista `fires` recebe as fogueiras da NBB-146.
- **Presença (NBB-135):** `src/ai/creaturePresence.ts`.
  - **Olhos:** esmaece os olhos com a distância (a neblina é desligada neles).
  - **Sons:** passos no ritmo da animação (`brain.gait`), respiração ao espreitar perto e rosnado quando o estado vira "atacar" (`onStateChanged`).
  - **Motor de áudio:** o `AudioEngineV2` do Babylon (`src/core/audio.ts`) escuta pela câmera.
  - **Arquivos:** em `public/sounds/`, com a origem no `CREDITS.md`. Se não carregarem, o jogo segue sem eles.
- **Só em desenvolvimento:**
  - `silentHunt.creature()`: mostra o estado.
  - `silentHunt.creatureState("atacar")`: força um estado.
  - `silentHunt.creatureStep(s)`: simula `s` segundos sem desenhar.
  - `silentHunt.faceCreature()`: vira a câmera para ela.

## Mundo infinito (M11-C)

**(G5)**

- O mundo é dividido em **chunks de 64 × 64 m**. Ficam carregados os chunks num raio de **2 chunks** em volta do jogador (5 × 5 = 25 chunks, cerca de 160 m em cada direção). Como a neblina esconde tudo depois de ~40 m, o jogador não vê os chunks aparecendo.
- Cada chunk é gerado da **semente do mundo + coordenadas do chunk**: sempre o mesmo resultado.
- **Instâncias:** as árvores da mesma espécie usam uma malha só, desenhada muitas vezes (*thin instances*), o que é bem mais leve para a placa de vídeo.
- **Mudanças no mundo** (árvore cortada, pedra pega, construção) ficam numa lista por chunk. Só essa lista vai para o save.
- **Precisão longe da origem:** muito longe do ponto (0, 0) os números de posição perdem precisão e o jogo "treme". Se for preciso, reposicionamos o mundo em volta do jogador (*floating origin*). Fica no Backlog até aparecer.

### Como foi implementado (NBB-129)

- `src/world/terrain.ts`: altura, tipo de chão e densidade de árvores em qualquer ponto, só a partir da semente (funções puras, sem malhas). Outros sistemas (ruído dos passos, IA) consultam por aqui.
- `src/world/vegetation.ts`: 8 variações de cada modelo (MW3-A), desenhadas com *thin instances*. Cada variação guarda as cópias por chunk; só as cópias perto do jogador vão para a placa de vídeo (árvores até 90 m, arbustos e pedras até 70 m, capim e galhos até 45 m), e a lista é refeita a cada 8 m andados. Sem esse filtro eram ~2,8 milhões de triângulos por quadro; com ele, ~625 mil.
- `src/world/chunks.ts`: carrega no máximo **um chunk por quadro** (o mais próximo primeiro), para não travar ao cruzar uma fronteira. O terreno usa coordenadas do mundo para normais e textura, então os chunks se encaixam sem emenda. **Colisão só nos 3 × 3 chunks em volta do jogador** (terreno, cápsulas nos troncos, esferas nas pedras grandes), num único corpo estático por chunk.
- Ponto de partida numa clareira de 6 m de raio, sem árvores, pedras ou arbustos.

## Teste de carga (T0-C)

> **Cancelado em 2026-11-16 (X1-C):** para ganhar tempo, o usuário decidiu seguir com o Babylon sem o teste de carga. A meta de 60 FPS continua valendo e é conferida no dia a dia pelo contador de FPS.

~~**(G5)** Issue 3, logo no M0:~~

- ~~Cena com os 25 chunks carregados, **~80 árvores por chunk** (≈ 2.000 árvores), terreno, neblina, luz de noite com uma tocha e 3 modelos animados provisórios andando.~~
- ~~Jogador andando sem parar numa direção por 2 minutos (carregando e descartando chunks).~~
- ~~**Aprovado** se, no computador do usuário, em tela cheia: **média ≥ 60 FPS** e **sem travadas acima de 100 ms** ao trocar de chunk.~~
- ~~Reprovado: apresentamos ao usuário otimizações possíveis ou a troca para o Godot (decisão dele).~~

## Limites de desempenho (G16)

| Item | Limite |
|---|---|
| Árvore | ~~até 600 triângulos~~ **até 1.500** (M-T1, 2026-11-16) |
| Animal | até 2.500 triângulos |
| Criatura | até 4.000 triângulos |
| Peça de construção | até 200 triângulos |
| Ossos por esqueleto | até 30 |

## Save (T3-A)

Um registro no IndexedDB com: versão do formato, semente, hora do dia, jogador (posição, vida, fome, fôlego, inventário, cama), mudanças por chunk, construções, mochilas e estado da espingarda e dos baús. A **versão do formato** permite mudar a estrutura no futuro sem quebrar mundos salvos.

## ADRs (registros de decisão de arquitetura)

| ADR | Decisão | Status |
|---|---|---|
| ADR-01 | Babylon.js no navegador. ~~Validado por teste de carga; Godot como plano B (T0-C).~~ Definitivo sem teste de carga (X1-C, 2026-11-16) | Aceito |
| ADR-02 | Havok para física (T2-B) | Aceito |
| ADR-03 | Behaviors + Observables em vez de ECS (T5a-C) | Aceito |
| ADR-04 | Modelos 100% procedurais em TypeScript (A1-A) | Aceito |
| ADR-05 | Esqueleto com skinning nos animais e na criatura (A5-B) | Aceito |
| ADR-06 | Mundo em chunks de 64 m com raio 2 e thin instances (G5) | Aceito |
| ADR-07 | Save em IndexedDB com versão do formato (T3-A) | Aceito |
| ADR-08 | Todos os valores ajustáveis em `src/config.ts` (G16) | Aceito |
