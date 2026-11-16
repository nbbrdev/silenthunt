# Silent Hunt — instruções para agentes

Jogo de sobrevivência em primeira pessoa numa floresta infinita com neblina, onde você caça e é caçado (slug técnico `silenthunt`). TypeScript, Vite, Babylon.js 9 e Havok, rodando **localmente no navegador** (sem deploy). Feito para um desafio informal com prazo em **20/11/2026**.
Repo: `nbbrdev/silenthunt` (público) · Linear: time "Nbbr dev" (chave `NBB`), projeto "Silent Hunt".

## Fontes da verdade
- **Conteúdo:** `docs/`. Leia `docs/README.md` primeiro. Escopo em `docs/02-escopo.md`: **nada fora dele é implementado**.
- **Decisões:** `docs/06-decisoes.md`, com os códigos usados na conversa (C1, M4-B, G12...).
- **Planejamento:** Linear, time "Nbbr dev", projeto "Silent Hunt". Toda tarefa de código tem issue; branches e commits citam o ID. A issue número *n* de `docs/02-escopo.md` é a **NBB-(122 + n)** (ex.: issue 3 = NBB-125).
- Mudou `docs/`? Atualize o Linear Doc correspondente na mesma sessão, e vice-versa.

## Fase atual
**M2 · Ser caçado** (meta: `v0.3.0`). O M0 e o M1 terminaram em 2026-11-16 (M1: NBB-127 a NBB-132). Ordem do M2: NBB-133 (modelo da criatura) → NBB-134 (IA da criatura) → NBB-135 (olhos e passos) → NBB-136 (vida, dano e morte). Em 2026-11-16 o usuário decidiu manter todo o escopo até 20/11 (R1-B), sem PRs (R2) e **sem testes automáticos novos** (X1-C).

Lembretes:
- A conta ativa do `gh` foi trocada para `nbbrdev` em 2026-11-12 (vale para todos os terminais).
- Push pelo apelido SSH `github-indie` (`git@github-indie:nbbrdev/silenthunt.git`).

Stack de ferramentas: Node 24, npm, Vite, Vitest, ESLint, Prettier.

## Como trabalhar com o usuário
- Siga a skill **`modo-de-trabalho`** (decisões, pt-BR, PRs, Linear).
- O usuário quer **participar das decisões técnicas e aprender**. **Nenhuma decisão sozinho, nem as pequenas** (valores, nomes, textos da interface, configurações extras): explique o problema, as opções com prós e contras e uma recomendação, e pergunte **antes** de escrever. Se algo foi decidido sem ele, aponte antes do merge.
- Decisão que ele não confirmou fica como **proposto** nos docs.
- Explicações de uma decisão vão **no chat**, num turno que termina com a pergunta em texto.
- Responda sempre em **pt-BR**.
- **Eu implemento, ele revisa — sem PRs (R2, 2026-11-16):** commits direto na `main`, um ou mais por issue. Ao terminar uma issue, explicar no chat o que mudou e por quê e listar os **pontos decididos por mim** (também num comentário da issue no Linear). Ajustes pedidos viram novos commits.
- **Antes de cada push:** formatação, lint, tipos, testes existentes e build verdes localmente (não há PR para barrar erros). Não escrever testes novos (X1-C).

## Regras de trabalho (definidas pelo usuário)
1. **Sempre use as ferramentas Write e Edit para criar ou editar arquivos.** Nada de scripts Python, `sed`, `awk`, heredocs ou redirecionamento de shell para modificar arquivos. Exceção: geradores e CLIs oficiais (`npm create vite`, `npm install`) e o Prettier; arquivos binários só com autorização do usuário.
2. **Código sempre em inglês:** variáveis, funções, classes, tipos e arquivos de código. Textos do jogo e mensagens ao jogador em pt-BR.

## Regras inegociáveis
- **Regra do desafio: nenhum modelo 3D pronto.** Todo modelo é gerado por código TypeScript (`src/models/`). Sons prontos e texturas geradas por IA são permitidos.
- **Licenças:** só sons CC0, CC-BY (com crédito no `CREDITS.md`) ou do Epidemic Sound. Arquivos que não podem ser redistribuídos (música do Epidemic Sound) ficam em `assets-private/`, fora do Git.
- **Modelos são revisados pelo usuário** na galeria (`/?galeria`) e por capturas no chat e na issue (dia, noite, neblina), quantas vezes for preciso.
- **Todos os valores ajustáveis** (raios, tempos, dano, receitas) ficam em `src/config.ts`.
- **Desempenho:** respeitar os limites de triângulos de `docs/05-arquitetura.md`; meta de 60 FPS.
- **Repo público:** nenhum segredo ou dado pessoal em código, docs ou testes.
- Commits em Conventional Commits, pt-BR, com o ID do Linear (ex.: `feat(ai): criatura espreita [NBB-134]`).
- O agente **nunca** cria tags nem releases: quem marca o fim de cada fase é o usuário.
- Regras numeradas (RF, ADR) nunca são renumeradas.
