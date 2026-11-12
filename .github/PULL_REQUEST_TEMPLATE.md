<!--
Título do PR = commit na main (squash). Formato: tipo(escopo): descrição [NBB-xx]
Ex.: feat(ai): criatura espreita no limite da neblina [NBB-134]
Tipos: feat, fix, perf, security, docs, refactor, test, chore, ci
-->

## Issue

NBB-xx: <o que a issue pede, em uma frase>. Decisões do usuário em AAAA-MM-DD: <códigos>.

## O que muda

<!-- Por arquivo ou por assunto, em linguagem simples, com o porquê. Termo técnico: uma frase dizendo o que é. -->

-

## Pontos para revisar (decididos por mim)

<!--
Tudo o que não veio de uma decisão do usuário: textos, nomes, valores, detalhes de implementação,
correções fora do escopo. Depois do OK, troque o título para
"(decididos por mim; aprovados pelo usuário em AAAA-MM-DD)". Sem pontos: "Nenhuma decisão nova".
-->

1.

## Como testar

<!-- Teste a branch localmente: npm install && npm run dev. Modelos: abra /?galeria. -->

1.

## Testes

<!-- O que rodou (formatação, lint, tipos, testes, build) e o que foi conferido à mão (capturas, FPS). -->

-

## Modelos (se o PR tiver modelo 3D)

<!-- Capturas de dia, noite e neblina. Apague a seção se não houver modelo. -->

- [ ] Escala correta em relação ao jogador
- [ ] Estilo coerente com o resto (paleta, flat shading)
- [ ] Silhueta legível na neblina
- [ ] Animações sem partes atravessando a malha
- [ ] Triângulos dentro do limite (`docs/05-arquitetura.md`)

## Checklist de segurança

- [ ] Nenhum segredo, dado real ou dado pessoal em código, log ou teste
- [ ] Nenhum arquivo de música ou som com licença que proíba redistribuir (fica em `assets-private/`)

## Documentação

- [ ] `docs/` atualizado (ou não se aplica)
- [ ] Linear Docs sincronizados (ou não se aplica)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
