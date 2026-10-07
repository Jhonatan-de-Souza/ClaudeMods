# Claude Mods

[English](README.md) · **Português**

Mods para o [Claude Code](https://claude.com/claude-code). Um plugin, `zen-toolbox`, adiciona um botão **◆ extra-mods ▲** no canto inferior direito, embaixo do prompt. Ele abre uma barra lateral com quatro ferramentas:

| Ferramenta | O que faz |
|---|---|
| **Modo Zen** | Esconde as chamadas de ferramentas e a saída delas, e mostra o plano do Claude como uma barra de progresso acima do prompt |
| **Tema** | Muda as cores do terminal inteiro com qualquer tema do [terminalcolors.com](https://terminalcolors.com), com prévia ao vivo |
| **Modo** | Define o nível de esforço (effort) e o modo de permissão com que as novas sessões começam |
| **Linha de status** | Modelo, pasta, branch, contexto, limites de 5h/7d e estado do cache, com o botão na mesma linha |

## Instalação

Você precisa do Claude Code 2.1.292 ou mais novo. Rode no terminal:

```
claude plugin marketplace add Jhonatan-de-Souza/ClaudeMods
claude plugin install zen-toolbox@jdsjh-mods --scope user
```

Depois abra uma nova sessão do Claude Code, ou rode `/reload-plugins` numa sessão aberta. O botão aparece no canto inferior direito de todas as sessões.

### Instalar com um agente de IA

Você pode apontar o seu agente de programação para este repositório e pedir que ele instale o mod. Os passos abaixo foram escritos para o agente.

> **Instruções para o agente.** Siga os passos na ordem. Pergunte ao usuário antes do passo 4, porque ele muda as configurações dele.
>
> 1. Confira se o Claude Code está instalado e atualizado: rode `claude --version`. Deve mostrar 2.1.292 ou mais. Se não, pare e peça ao usuário para atualizar o Claude Code.
> 2. Adicione este repositório como marketplace de plugins: rode `claude plugin marketplace add Jhonatan-de-Souza/ClaudeMods`. Deve mostrar `Successfully added marketplace: jdsjh-mods`. Se o marketplace já existir, continue.
> 3. Instale o plugin para todas as sessões: rode `claude plugin install zen-toolbox@jdsjh-mods --scope user`. Deve mostrar `Successfully installed plugin: zen-toolbox@jdsjh-mods`.
> 4. *Opcional, pergunte antes, e só se o usuário não quiser a linha de status do próprio mod:* instale o script de linha de status avulso. Copie `statusline/statusline.py` deste repositório para `~/.claude/statusline.py`. Depois, em `~/.claude/settings.json`, defina `"statusLine": { "type": "command", "command": "python ~/.claude/statusline.py", "refreshInterval": 2 }` (use `python3` no macOS e no Linux). Precisa do Python 3.
> 5. Verifique: rode `claude plugin list`. O `zen-toolbox` deve aparecer como habilitado.
> 6. Peça ao usuário para rodar `/reload-plugins` ou abrir uma nova sessão, e depois clicar em **◆ extra-mods ▲** no canto inferior direito, ou digitar `/tools`.
>
> No Windows, escreva os caminhos com barras normais (`C:/Users/...`) quando o comando rodar num shell POSIX como o Git Bash.

## Como usar

Clique em **◆ extra-mods ▲**, ou digite `/tools`, para abrir a barra lateral. No layout de tela cheia do Claude Code ela fica à direita; nos outros, abre acima do prompt. A barra lateral recebe o teclado: **↑↓** movem, **Enter** seleciona, **b** volta, **Esc** fecha. A cor de fundo acompanha a do seu terminal.

### 1. Modo Zen

- Esconde todas as chamadas de ferramentas e a saída delas. Você só vê o que o Claude escreve.
- Dá ao Claude uma ferramenta `zen_progress` e pede, a cada prompt que você envia, que ele publique o plano primeiro e o atualize quando cada etapa começa e termina.
- Mostra uma barra de progresso acima do prompt: a tarefa, a etapa atual, uma barra, a porcentagem e o tempo decorrido. `[–]` reduz a barra a uma linha.
- Cores da barra: `blue`, `dark`, `light`, `green`, `rainbow`, ou `custom` com suas próprias cores em hex.

### 2. Tema

- Na primeira vez que você abre, ele baixa todos os temas do terminalcolors.com para `~/.claude/zen-toolbox/themes/`.
- Percorrer a lista com as setas ou a roda do mouse mostra uma **prévia** de cada tema na janela inteira. **Enter** escolhe um. Sair sem escolher volta ao tema que você já tinha.
  - **Windows Terminal:** o tema só colore o Claude Code. Quando uma sessão começa, ele é gravado no `settings.json` do Windows Terminal como esquema de cores do perfil em que o Claude Code está rodando. Quando a sessão termina, o perfil volta às cores dele. Outras abas do mesmo perfil também pegam o tema enquanto o Claude Code está aberto. Um backup é salvo antes, como `settings.json.zen-toolbox.bak`.
  - **macOS / Linux:** as cores são enviadas ao terminal como sequências OSC quando a sessão começa, e resetadas quando ela termina. Funciona no iTerm2, Ghostty, kitty, WezTerm, Alacritty e na maioria dos terminais modernos.
- **Reset** volta às suas cores originais.

### 3. Modo

- **Esforço (effort):** `low` / `medium` / `high` / `xhigh` / `max`. O nível que a sessão está usando aparece marcado. Um nível que você escolhe vale para todas as requisições a partir dali, e fica salvo.
- **Rodando em:** o modo de permissão atual. Um mod não consegue trocar o modo de uma sessão em andamento; para isso use **shift+tab**.
- **Novas sessões começam em:** ask, plan, accept edits, auto ou bypass permissions, cada um na cor do próprio Claude Code. O modo atual aparece marcado com **· now**. Sua escolha é salva como `permissions.defaultMode` em `~/.claude/settings.json` (com backup antes).

### 4. Linha de status

- Linha 1: o modelo, a pasta e a branch do git.
- Linha 2: contexto, os limites de 5h e 7d com o tempo até zerarem, e o estado do cache, com **◆ extra-mods** no fim da mesma linha.
- **● cache ok** (verde) enquanto a última resposta do Claude tem menos de uma hora; **● cache over** (vermelho) depois disso.
- Quando o terminal fica estreito, as barras saem primeiro, depois os tempos.
- **On** tira o seu comando `statusLine` do `~/.claude/settings.json` para as duas não aparecerem juntas (com backup antes). **Off** coloca de volta.

`statusline/statusline.py` é a mesma linha de status como script avulso, para quem usa o Claude Code sem o mod (veja o passo 4 das instruções para o agente).

## Desenvolvimento

```
claude --plugin-dir ./plugins/zen-toolbox
claude plugin validate ./plugins/zen-toolbox
claude plugin test ./plugins/zen-toolbox
```
