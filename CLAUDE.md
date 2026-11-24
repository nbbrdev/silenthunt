# Silent Hunt — instruções para agentes

Jogo de sobrevivência em primeira pessoa numa floresta infinita com neblina, onde você caça e é caçado (slug técnico `silenthunt`). TypeScript, Vite, Babylon.js 9 e Havok, rodando **localmente no navegador** (sem deploy). Feito para um desafio informal com prazo em **20/11/2026**.
Repo: `nbbrdev/silenthunt` (público) · Linear: time "Nbbr dev" (chave `NBB`), projeto "Silent Hunt".

## Fontes da verdade
- **Conteúdo:** `docs/`. Leia `docs/README.md` primeiro. Escopo em `docs/02-escopo.md`: **nada fora dele é implementado**.
- **Decisões:** `docs/06-decisoes.md`, com os códigos usados na conversa (C1, M4-B, G12...).
- **Planejamento:** Linear, time "Nbbr dev", projeto "Silent Hunt". Toda tarefa de código tem issue; branches e commits citam o ID. A issue número *n* de `docs/02-escopo.md` é a **NBB-(122 + n)** (ex.: issue 3 = NBB-125).
- Mudou `docs/`? Atualize o Linear Doc correspondente na mesma sessão, e vice-versa.

## Fase atual
**M6 · Pós-entrega** (meta `v1.1.0`, FN0-A): NBB-153 perseguição (concluída em 2026-11-23: corrida a 5,8 m/s contra 6 da criatura, coração, bordas, tremor, ofegar e música tensa; PS1-A a PS9-A, MT1-C a MT4), NBB-155 golpe fatal (concluída em 2026-11-23: o golpe mata, a tocha segura sem espantar, "pego", morrer à noite leva ao amanhecer, volumes revistos; GF1-A a GF9, VL1-A a VL4), NBB-154 moitas (concluída em 2026-11-23: agachado na moita e sem tocha, ninguém vê; a criatura procura e fareja; MI1-A a MI11), NBB-158 arremessar pedra (issue 36, nova; concluída em 2026-11-23: segurar G mira com o arco, soltar arremessa, 20 m de ruído onde cai; PD0-A a PD9, TR0-A a TR7), NBB-156 objetivo (concluída em 2026-11-24: fuga pelo rádio com cabanas, bilhetes e bússola, ritual dos crânios, última noite vermelha e telas de vitória; OB1 a OB15, MD1-A) e NBB-157 mapa (concluída em 2026-11-24: M abre o mapa de papel, só o explorado, marcações e destino na bússola; MP1-A a MP9). Todas as issues do M6 estão concluídas; o status do marco e a tag `v1.1.0` ficam com o usuário. O M0 e o M1 terminaram em 2026-11-16; o M2 (NBB-133 a NBB-136) e o M3 (NBB-137 a NBB-142, meta `v0.4.0`, a tag é do usuário) em 2026-11-17. A rodada de **progressão** foi decidida em 2026-11-17 (PG1-A a PG6: começa sem nada, tocha com gordura, fogueira com combustível; os atalhos provisórios saem com o inventário e o crafting). M4 (NBB-143 a NBB-148, meta `v0.5.0`, a tag é do usuário) concluído em 2026-11-18: coleta e inventário, crafting e machado, construção em grade, fogueira e cama, save no IndexedDB e morte com mochila. M5 em andamento: NBB-149 (som: passos, ambiente, animais, ferramentas, fogo e ações, música da pasta privada) concluída em 2026-11-18; a licença do Epidemic Sound para jogo ainda é conferida pelo usuário; NBB-150 (menus principal, pausa que congela tudo, opções, créditos lidos do `CREDITS.md`, fonte Crimson Pro) concluída em 2026-11-18; NBB-151 (equilíbrio: mais pedras soltas, jogador mais rápido; painel F2 de teste; FPS não medido) concluída em 2026-11-23; NBB-152 (entrega: README final, capturas, licença MIT) concluída em 2026-11-23, fechando o M5. As tags e releases `v0.1.0` a `v1.0.0` foram criadas em 2026-11-23 por Claude, como exceção pedida pelo usuário (EN8); a regra de não criar tags continua. Próximo: as features novas do M6 (issues 31 a 35 do docs/02), cada uma com rodada própria. Em 2026-11-16 o usuário decidiu manter todo o escopo (R1-B), sem PRs (R2) e **sem testes automáticos novos** (X1-C). Em 2026-11-17 (PZ1): **esquecer o prazo**: sem cortes nem pressa por causa da data.

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
