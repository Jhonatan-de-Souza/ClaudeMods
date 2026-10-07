# Claude Mods

[English](README.md) · **Português**

Mods para o [Claude Code](https://claude.com/claude-code). Um plugin, `extra-mods`, adiciona um botão **◆ extra-mods ▲** no canto inferior direito, embaixo do prompt. Ele abre uma barra lateral com quatro ferramentas:

| Ferramenta | O que faz |
|---|---|
| **Modo Zen** | Esconde as chamadas de ferramentas e a saída delas, e mostra o plano do Claude como uma barra de progresso acima do prompt |
| **Tema** | Colore o Claude Code com qualquer tema do [terminalcolors.com](https://terminalcolors.com), com prévia ao vivo |
| **Modo** | Define o nível de esforço (effort) e o modo de permissão com que as novas sessões começam |
| **Linha de status** | Modelo, pasta, branch, contexto, limites de 5h/7d e estado do cache, com o botão na mesma linha |

## Instalação

Você precisa do Claude Code 2.1.292 ou mais novo. Rode no terminal:

```
claude plugin marketplace add Jhonatan-de-Souza/ClaudeMods
claude plugin install extra-mods@jdsjh-mods --scope user
```

Depois abra uma nova sessão do Claude Code, ou rode `/reload-plugins` numa sessão aberta. O botão aparece no canto inferior direito de todas as sessões.

Para atualizar para a versão mais recente depois:

```
claude plugin marketplace update jdsjh-mods
claude plugin update extra-mods@jdsjh-mods
```

### Instalar com um agente de IA

Você pode apontar o seu agente de programação para este repositório e pedir que ele instale o mod. Os passos abaixo foram escritos para o agente.

> **Instruções para o agente.** Siga os passos na ordem. Pergunte ao usuário antes do passo 4, porque ele muda as configurações dele.
>
> 1. Confira se o Claude Code está instalado e atualizado: rode `claude --version`. Deve mostrar 2.1.292 ou mais. Se não, pare e peça ao usuário para atualizar o Claude Code.
> 2. Adicione este repositório como marketplace de plugins: rode `claude plugin marketplace add Jhonatan-de-Souza/ClaudeMods`. Deve mostrar `Successfully added marketplace: jdsjh-mods`. Se o marketplace já existir, continue.
> 3. Instale o plugin para todas as sessões: rode `claude plugin install extra-mods@jdsjh-mods --scope user`. Deve mostrar `Successfully installed plugin: extra-mods@jdsjh-mods`.
> 4. *Opcional, pergunte antes, e só se o usuário não quiser a linha de status do próprio mod:* instale o script de linha de status avulso. Copie `statusline/statusline.py` deste repositório para `~/.claude/statusline.py`. Depois, em `~/.claude/settings.json`, defina `"statusLine": { "type": "command", "command": "python ~/.claude/statusline.py", "refreshInterval": 2 }` (use `python3` no macOS e no Linux). Precisa do Python 3.
> 5. Verifique: rode `claude plugin list`. O `extra-mods` deve aparecer como habilitado.
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

> **Testado só no Windows até agora** (Windows Terminal). No macOS e no Linux o tema colore a interface do Claude Code, mas o fundo do terminal ainda não muda; essa parte vem quando for testada num Mac.

- Na primeira vez que você abre, ele baixa todos os temas do terminalcolors.com para `~/.claude/extra-mods/themes/`.
- Percorrer a lista com as setas ou a roda do mouse mostra uma **prévia** de cada tema no Claude Code. **Enter** escolhe um. Sair sem escolher volta ao tema que você já tinha.
- Cada tema vira um tema personalizado do Claude Code, `~/.claude/themes/extra-mods.json`, e fica salvo como `theme` em `~/.claude/settings.json`. O Claude Code recarrega ao vivo e lembra dele entre sessões.
- Ele define todas as cores da interface do Claude Code: texto, a cor de destaque, bordas, sucesso/erro/aviso, os modos de permissão, diffs, seleção, spinners, subagentes e o fundo das suas mensagens.
- Um tema do Claude Code não muda o fundo do terminal. **No Windows Terminal**, o mod também põe o tema, com fundo e tudo, no perfil em que o Claude Code está rodando, enquanto a sessão durar: prévias e escolhas repintam a aba ao vivo, e o perfil volta às cores dele quando a sessão termina (ou, depois de um travamento, quando a próxima terminar). O Windows Terminal colore perfis inteiros, então outras abas abertas no mesmo perfil também ficam com o tema enquanto o Claude Code roda. O `settings.json` do Windows Terminal ganha um backup antes, `settings.json.extra-mods.bak`.
- Na primeira vez, reinicie o Claude Code uma vez: ele lê a configuração de tema ao abrir, e só carrega `~/.claude/themes/` quando essa configuração já é um tema personalizado. Depois disso, escolher um tema muda o Claude Code ao vivo.
- **Back to Claude Code's previous theme** volta ao tema que você usava antes, e devolve ao perfil do Windows Terminal as cores dele.

### 3. Modo

- **Esforço (effort):** `low` / `medium` / `high` / `xhigh` / `max`. O nível que a sessão está usando aparece marcado. Um nível que você escolhe vale para todas as requisições a partir dali, e fica salvo.
- **Rodando em:** o modo de permissão atual. Um mod não consegue trocar o modo de uma sessão em andamento; para isso use **shift+tab**.
- **Novas sessões começam em:** ask, plan, accept edits, auto ou bypass permissions, cada um na cor do próprio Claude Code. O modo atual aparece marcado com **· now**. Sua escolha é salva como `permissions.defaultMode` em `~/.claude/settings.json` (com backup antes).

### 4. Linha de status

- Uma linha só, ao lado do rótulo de modo do próprio Claude Code: o modelo, a pasta e a branch do git, depois contexto, os limites de 5h e 7d com o tempo até zerarem, e o estado do cache, com **◆ extra-mods** no fim.
- **● cache ok** (verde) enquanto a última resposta do Claude tem menos de uma hora; **● cache over** (vermelho) depois disso.
- Quando o terminal fica estreito, as barras saem primeiro, depois os tempos, depois o modelo e a pasta.
- Vem **ligada** por padrão, para o **◆ extra-mods** ficar na linha de status. **On** tira o seu comando `statusLine` do `~/.claude/settings.json` para as duas não aparecerem juntas (com backup antes). **Off** coloca de volta.

`statusline/statusline.py` é a mesma linha de status como script avulso, para quem usa o Claude Code sem o mod (veja o passo 4 das instruções para o agente).

## Desenvolvimento

```
claude --plugin-dir ./plugins/extra-mods
claude plugin validate ./plugins/extra-mods
claude plugin test ./plugins/extra-mods
```
