# Silent Hunt

Jogo de sobrevivência em primeira pessoa numa floresta infinita coberta de neblina, onde você caça para comer enquanto uma criatura caça você. **O silêncio é a sua melhor arma.**

Feito com [Babylon.js](https://www.babylonjs.com/) para um desafio com os temas **Sobrevivência**, **Floresta sombria** e **Furtividade e caça**. Todos os modelos 3D são gerados por código.

|                                                                                |                                                            |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| ![O menu sobre a floresta](docs/images/menu.jpg)                               | ![A floresta de dia](docs/images/day.jpg)                  |
| ![A criatura espreitando à noite, além da luz da tocha](docs/images/night.jpg) | ![Um abrigo com fogueira à noite](docs/images/shelter.jpg) |

## Como rodar

Requisito: [Node.js](https://nodejs.org/) 24.

```bash
npm install
npm run build
npm run preview
```

Depois abra no navegador o endereço que aparecer no terminal (normalmente http://localhost:4173) e clique em **Novo mundo**. O jogo salva sozinho no navegador; ao voltar, **Continuar** retoma o mesmo mundo.

### Música (opcional)

A música do dia não vem no repositório. Para ouvi-la, coloque os arquivos (`.mp3`, `.ogg`, `.m4a` ou `.wav`, com qualquer nome) na pasta `assets-private/music/`, na raiz do projeto, e rode o `npm run build` de novo. Sem a pasta, o jogo funciona normalmente, só sem música de dia.

A música da perseguição já vem com o jogo (CC0). Para trocá-la, coloque uma faixa na pasta `assets-private/music/chase/`; se houver mais de uma, vale a primeira em ordem alfabética.

### Para desenvolver

```bash
npm run dev
```

Em desenvolvimento há ferramentas extras: a galeria de modelos em `/?galeria`, o painel de teste na tecla F2, o tempo acelerado na T, os anéis de ruído na N, o Inspector do Babylon na F9 e os comandos `silentHunt.*` no console do navegador.

## Controles

| Ação                                                         | Tecla                                                               |
| ------------------------------------------------------------ | ------------------------------------------------------------------- |
| Andar                                                        | W A S D                                                             |
| Olhar                                                        | Mouse                                                               |
| Correr                                                       | Shift (segurar)                                                     |
| Agachar                                                      | C                                                                   |
| Pular                                                        | Espaço                                                              |
| Usar o item da mão (atacar, cortar, atirar, comer, colocar)  | Botão esquerdo                                                      |
| Mirar com o arco ou a espingarda                             | Botão direito (segurar)                                             |
| Interagir (pegar, limpar carcaça, acender, cozinhar, dormir) | E (algumas ações pedem para segurar)                                |
| Acender ou guardar a tocha                                   | F                                                                   |
| Recarregar a espingarda                                      | R                                                                   |
| Escolher o item da mão                                       | 1 a 6 ou a roda do mouse                                            |
| Inventário e receitas                                        | Tab                                                                 |
| Modo de construção                                           | B (1 a 4 escolhem a peça, R gira, segurar o botão direito desmonta) |
| Pausa                                                        | Esc                                                                 |

## Como jogar

- **Você começa sem nada.** Junte galhos, pedras e fibra e faça a faca, o machado, o arco e a fogueira no inventário (Tab).
- **Faça silêncio.** Correr, pisar em galhos secos e atirar fazem barulho; andar agachado e no musgo, quase nenhum. A neblina esconde você tanto quanto esconde o resto.
- **A noite é da criatura.** De dia ela só observa de longe. À noite, ela espreita e ataca. Fogueiras acesas a mantêm longe, e encará-la com a tocha acesa a faz recuar.
- **Coma.** Cace coelhos e cervos, limpe a carcaça e cozinhe a carne na fogueira. A gordura vira tochas.
- **Morrer custa caro.** Seus itens ficam numa mochila onde você caiu, e você renasce na última cama que colocou ou usou. Construa um abrigo antes que a noite chegue.

## Créditos

Os sons, a fonte e as tecnologias usadas estão em [`CREDITS.md`](CREDITS.md), e também na tela de créditos do jogo.

## Tecnologia e documentação

TypeScript, Vite, Babylon.js 9 e Havok. O design do jogo, as decisões e a arquitetura estão em [`docs/`](docs/README.md).

## Licença

O código está sob a licença [MIT](LICENSE). Os sons, a fonte e a música seguem as próprias licenças, listadas em [`CREDITS.md`](CREDITS.md).
