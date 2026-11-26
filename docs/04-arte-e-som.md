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

### Vegetação (revisão da NBB-128, 2026-11-16)

Depois da 1ª revisão, o usuário pediu modelos inspirados em referências mais naturais. A vegetação passou a usar:

- **Crescimento recursivo de galhos** (`src/models/branching.ts`): cada galho gera 2–3 filhos mais curtos e finos, com curvas aleatórias, até as pontas. Opcionais: um filho "líder" que continua a direção (afina o tronco sem corte reto) e galhinhos finos nas pontas.
- **Placas de folhas** (`src/models/cards.ts`): quadrados com uma textura de folhas, agulhas ou capim **desenhada por código** num canvas (`src/models/textures.ts`, sem arquivos de imagem). Transparência por recorte (*alpha test*). As normais apontam para fora da copa, para ela ser iluminada como um volume.
- **Sombreamento suave** na madeira e nas folhas; as faces chapadas (*flat shading*) ficaram só na pedra.
- A cor continua vindo dos vértices (paleta G14 no `src/config.ts`); as texturas são em tons de cinza.
- **Texturas de superfície** (revisão 2, `src/models/surfaceTextures.ts`): casca, pedra e chão de floresta, desenhadas por código com ruído fractal que se repete sem emendas. Cada uma tem um **mapa de relevo** (*normal map*) calculado a partir do próprio desenho, para rachaduras e grãos parecerem fundos sem custar triângulos. A casca se repete a cada 0,8 m e o chão a cada 3 m (`CONFIG.surfaces`). O chão tem cor própria (`groundDirt`, `groundLitter`, `groundMoss` na paleta).

### Lista de modelos

| Modelo | Animações | Issue |
|---|---|---|
| Pinheiro, carvalho, árvore morta | balanço leve com o vento | 6 |
| Árvores adultas ~2× maiores, tronco limpo embaixo; um quarto jovens (FL1-A a FL3-A, FL8-A) | balanço leve com o vento | 47 |
| Feixes de luz: três folhas cruzadas com luz desenhada por código (FL5-A) | seguem o sol | 47 |
| Grama viva, samambaia, folhas caídas, cogumelos, flores, pedrinhas; grãos de terra no chão (SL1-A) | balanço leve com o vento (plantas) | 48 |
| Poste com placa em seta, "Cabana" escrito à mão por código (PL3-A) | — | 49 |
| Espuma da correnteza (shader próprio, mapa de fluxo) e ondinhas em duas escalas (AF1-A, AF2-A) | espuma levada pela água | 50 |
| Arbusto, pedras, galhos, folhagem do chão | — | 6 |
| Bétula, juncos, capim alto, paredão, pedra grande, poça de lama (BM4-A) | balanço leve com o vento (bétula, juncos, capim) | 41 |
| Cachoeira: cortina de água com listras, espuma e névoa (CC3-A, CC9-B) | listras descendo; partículas | 43 |
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

**Implementação (NBB-133, CR1–CR4):**
- **Corpo:** cerca de 2,3 m até o alto do crânio (3 m com as galhadas). Costelas marcadas, braços que passam dos joelhos, garras curvas e pernas com o joelho para trás, como a pata traseira de um cervo.
- **Pele:** quase preta, seca e rachada (CR2).
- **Cabeça (CR4a):** crânio de cervo claro com galhadas e os olhos no fundo das órbitas. Ele não tem expressão nenhuma: é o "sem alma" do CR4.
- **Esqueleto e animações:** uma só malha com skinning em 23 ossos, 3.610 triângulos (limite de 4.000). Animações: Andar, Espreitar, Atacar e Recuar (CR3).
- **À noite:** só o crânio claro e os olhos aparecem.

## Revisão dos modelos (A2-C)

1. **Galeria** (issue 4, NBB-126): cena só de desenvolvimento (`npm run dev`), aberta por `/?galeria`, com o painel feito no Babylon GUI (GL1-B). Cada modelo novo entra com uma linha em `src/models/registry.ts`. Mostra um modelo por vez, com rotação pelo mouse, troca entre **dia / noite / neblina**, botão para cada animação, contagem de triângulos e uma **semente** para ver variações.
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
- **Lista inicial:** passos do jogador por tipo de chão (terra, musgo, folhas, galho estalando), passos da criatura, respiração e rosnado baixo, a mordida do golpe fatal (GF7-A), o farfalhar da moita (MI9-A), a pedra arremessada caindo (PD7-C), vento, pássaros de dia, grilos e corujas à noite, fogo crepitando, faca, arco, espingarda, machado na madeira, coelho e cervo fugindo.
- **Lista final (SM1-A):** a inicial mais pouso, fogueira (acender, apagar), tocha, machado na pedra e árvore caindo, bufo de alarme do cervo, grito dos animais ao morrer, pegar coisas, limpar carcaça, comer, peças de construção, porta e baú. Sem sons de interface. CC0 de preferência, CC-BY só quando claramente melhor (SM3-A).
- **Mais efeitos (NBB-162, FX1 a FX15):** a criatura ganha um chamado distante (1 ou 2 por noite, só rondando a 60–100 m, vindo de onde ela está), um grito quando o fogo ou a tocha a fazem recuar e no ritual, e o farejar na moita; a tocha tem loop próprio e apagar a tocha e a fogueira tem som; o rádio chia e uma voz responde; um helicóptero chega nos 10 s antes da vitória do resgate; papel no bilhete e no mapa; os crânios queimando; o jogador sem voz: baque e respiração presa ao levar dano, o coração dá duas batidas lentas e para ao morrer, o estômago ronca com fome; a mochila abre e fecha, o item fabricado bate madeira, pegar coisas tem som próprio; arremesso, flecha voando e espingarda vazia; o coelho bate a pata ao fugir e grita ao morrer; árvores rangendo, rajadas e galhos caindo entre os sons soltos. A interface tem um clique de madeira (mais agudo ao passar, mais grave ao confirmar, mais suave ao voltar), tocado fora do motor de áudio do jogo para soar também na pausa. Muda a SM1-A, que deixava a interface sem som.
- **Água (NBB-164, AG14 a AG17-A):** um mergulho ao cair na água funda ("splash_1", genel), o mesmo mais baixo ao sair, braçadas em loop enquanto nada na superfície ("POOL SWIMMING R-L", tbsounddesigns), um som de fundo próprio embaixo d'água ("Underwater Ambience", Fission9), com efeitos e ambiente abafados a 40%, e a respiração presa ao voltar depois de 3 s embaixo. Na água rasa, os passos são os da lama. Todos CC0. As cachoeiras (NBB-165, CC10-1) rugem em loop 3D, ouvidas até 40 m ("Ambiance_Waterfall_Small_Close_Loop_02_Stereo", Nox_Sound, CC0), no grupo do ambiente; só as três mais perto tocam.
- **Ambiente (SM4-A):** camadas em loop (vento; pássaros de dia; grilos à noite) que trocam no entardecer e no amanhecer, e sons soltos 3D de vez em quando (coruja, pássaro distante, galho estalando longe).
- **Volumes (SM7):** mestre, efeitos, ambiente e música no `config.ts`. Desde a VL1-A a VL3-A (2026-11-23): mestre 0,6; grupos de efeitos 1, ambiente 0,7 e música 0,8; as faixas de música têm volume próprio de 0,45 (MF16; era 0,375) e os trechos do amanhecer e do entardecer 0,6, e a da perseguição toca a 1 no grupo de música; o coração vai de 0,9 a 1,8 e o ofegar até 1.

### Música

**(NBB-161, MF1-A a MF16)** Todas as músicas **vêm com o jogo**: faixas CC0 e CC-BY do Freesound em `public/sounds/music/`, creditadas no `CREDITS.md`. A pasta privada das faixas do dia (G10, MU1-A) saiu (MF15-A); a da perseguição continua (abaixo).

- **Menu principal (MF4-A, MF8-A):** um tema sombrio em loop ("Uneasy Horror Ambience Music", Evan Boyerman), que entra em 2 s ao abrir o menu principal e sai em 1,5 s ao entrar no jogo; recomeça a cada volta ao menu. A pausa fica em silêncio (MN3-A).
- **Dia (SM5-A, MU2, MF5-A, MF9):** rara e baixa, só de dia: quatro faixas calmas e melancólicas (dois pianos, duas guitarras), em ordem aleatória sem repetir, a primeira 1–3 min depois de entrar no jogo e depois uma a cada 5–10 min com silêncio entre elas. À noite, nada, para o jogador ouvir a floresta e a criatura.
- **Amanhecer e entardecer (MF10-B, MF11-A, MF13-B, MF14-B):** um trecho curto e repentino com uma mensagem no alto da tela. No amanhecer, "VOCÊ SOBREVIVEU" (noite vivida acordado) ou "AMANHECER" (depois de dormir); depois de morrer, nada. No entardecer, um sino e "A NOITE CHEGA" (não durante uma perseguição).
- **Vitória (MF12-A):** uma faixa calma e esperançosa, uma vez, enquanto a tela de vitória está aberta.

**Música da perseguição (NBB-153; MT1-C, MT2, MT3-D):** a exceção à SM5-A. Quando a criatura ataca à noite, entra junto com o rosnado uma música tensa ("Orchestral Suspense Loop 1", de awrmacd, CC0), em 0,5 s, e toca em loop enquanto o ataque dura (perseguição, golpe ou hesitação). Quando o ataque termina (fuga, golpe ou desistência), ela some em 3 s. Sai pelo grupo de música, então o controle "Música" das opções também vale para ela. A faixa vem com o jogo (`public/sounds/music/chase.mp3`, 80 s em loop sem emenda). Se houver uma faixa em `assets-private/music/chase/` (ex.: do Epidemic Sound), ela toma o lugar; com mais de uma, vale a primeira em ordem alfabética. O plugin do Vite a lista em `/music/chase.json`.

> Se os efeitos sonoros do Epidemic Sound também não puderem ser redistribuídos, eles vão para uma pasta privada como a da perseguição.

## Fonte de letra (O7-A)

Uma fonte do Google Fonts (licença OFL, que permite incluir os arquivos no repositório), **escolhida pelo usuário**. Usada no menu, no HUD e nos créditos. **Escolhida (MN1-C): Crimson Pro**, uma serifa clássica de livro, sóbria e legível em qualquer tamanho.
