# 04 — Arte e som

## Regra do desafio

**Nenhum modelo 3D pronto.** Todos os modelos são **gerados por código TypeScript no Babylon** (A1-A). Texturas e imagens geradas por outra IA são permitidas (A3). Sons prontos são permitidos.

## Estilo visual (C4-A)

- **Low-poly escuro:** formas simples, faces chapadas (*flat shading*) e **cor por vértice** (a cor fica gravada em cada ponto da malha, então quase não precisamos de texturas).
- **Paleta (G14):** verdes-acinzentados e marrons apagados de dia; azul-escuro e quase preto à noite. A única cor forte do jogo é o **brilho dos olhos da criatura** e o **laranja do fogo**.
- **Neblina** sempre presente: é parte da arte, não um efeito por cima.
- **Pós-processamento (G14):** leve granulado e vinheta (bordas mais escuras), e brilho (*glow*) só nos olhos e no fogo.

## Como os modelos são feitos (A1-A)

Cada modelo é uma função de TypeScript que **monta a malha** a partir de formas básicas e regras:

- **Formas básicas** do Babylon (cilindro, esfera, caixa, "tubo" ao longo de uma curva) unidas e recortadas com o **CSG2** (operações de somar e subtrair sólidos).
- **Ruído** para deformar os vértices e tirar o aspecto "perfeito demais" (troncos tortos, pedras irregulares).
- **Semente:** o mesmo gerador cria variações (cada árvore sai diferente, mas sempre igual para a mesma semente).
- **Animais e criatura (A5-B):** malha do corpo + **esqueleto** (ossos) + **skinning** (cada vértice segue um ou mais ossos com um "peso"). As animações são quadros-chave (*keyframes*) dos ossos, também escritos em código.

### Lista de modelos

| Modelo | Animações | Issue |
|---|---|---|
| Pinheiro, carvalho, árvore morta | balanço leve com o vento | 6 |
| Arbusto, pedras, galhos, folhagem do chão | — | 6 |
| Criatura | andar, espreitar, atacar, recuar | 11 |
| Coelho | pastar, alerta, correr, morrer | 15 |
| Cervo | pastar, alerta, correr, morrer | 15 |
| Mãos e braços em primeira pessoa | segurar, golpear, puxar o arco, recarregar | 17 |
| Faca, machado, arco, flecha, espingarda, tocha | — | 17–19, 22 |
| Fogueira, cama, mochila, carcaça | fogo (partículas) | 20, 24, 26 |
| Peças de construção | porta abrindo | 23 |
| Cabana abandonada e baú (para a espingarda) | — | 19 |

### A criatura

**(G15)** É a "cara" do jogo e o modelo mais revisado: **alta e magra** (cerca de 2,5 m), membros longos, anda curvada e às vezes sobre quatro apoios, sem rosto definido, só **dois olhos brilhantes branco-amarelados** (destacam na neblina azulada e não se confundem com o laranja do fogo). A silhueta precisa ser reconhecível na neblina.

## Revisão dos modelos (A2-C)

1. **Galeria** (issue 4): cena só de desenvolvimento, aberta por uma URL própria (ex.: `/?galeria`). Mostra um modelo por vez, com rotação pelo mouse, troca entre **dia / noite / neblina**, botão para cada animação, contagem de triângulos e uma **semente** para ver variações.
2. **Capturas no PR:** todo PR de modelo traz capturas dentro do jogo (dia, noite, neblina) e o checklist:
   - [ ] Escala correta em relação ao jogador
   - [ ] Estilo coerente com o resto (paleta, flat shading)
   - [ ] Silhueta legível na neblina
   - [ ] Animações sem partes atravessando a malha
   - [ ] Triângulos dentro do limite (ver [05-arquitetura](05-arquitetura.md))
3. O modelo é revisado **quantas vezes forem necessárias**: cada rodada de ajuste é um commit no mesmo PR, até o OK.

## Som (A4-A)

- **Som espacial 3D** do Babylon: o volume e o lado (esquerdo/direito) mudam com a posição da fonte. Os passos da criatura dependem disso.
- **Fontes (O6-C):** Epidemic Sound e Freesound (só **CC0** e **CC-BY**). Todo som CC-BY entra no `CREDITS.md` e na tela de créditos.
- **Lista inicial:** passos do jogador por tipo de chão (terra, musgo, folhas, galho estalando), passos da criatura, respiração e rosnado baixo, vento, pássaros de dia, grilos e corujas à noite, fogo crepitando, faca, arco, espingarda, machado na madeira, coelho e cervo fugindo.

### Música

**(G10)** A música do Epidemic Sound **não vai para o Git** (O5-A): fica na pasta `assets-private/music/`, que está no `.gitignore`. O jogo funciona sem ela (só fica sem música). Para os avaliadores: o usuário envia a pasta à parte (ex.: um link de download) e explica no README onde colocar. Antes disso, o usuário confere se a licença do Epidemic Sound permite uso em jogo.

> Se os efeitos sonoros do Epidemic Sound também não puderem ser redistribuídos, eles vão para a mesma pasta privada.

## Fonte de letra (O7-A)

Uma fonte do Google Fonts (licença OFL, que permite incluir os arquivos no repositório), **escolhida pelo usuário**. Usada no menu, no HUD e nos créditos.
