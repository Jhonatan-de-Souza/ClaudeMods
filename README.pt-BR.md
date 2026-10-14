# Claude Mods

<p align="center"><a href="README.md">English</a> · <b>Português</b></p>

Uma barra lateral para o [Claude Code](https://claude.com/claude-code): modo Zen, temas, modelo e esforço, e uma linha de status.

<p>
  <img src="docs/screenshots/zen.png" alt="Aba Zen" width="24%"> <img src="docs/screenshots/theme.png" alt="Aba Tema" width="24%"> <img src="docs/screenshots/mode.png" alt="Aba Modo" width="24%"> <img src="docs/screenshots/status.png" alt="Aba Status" width="24%">
</p>

## Instalação

Precisa do Claude Code 2.1.292 ou mais novo.

```
claude plugin marketplace add Jhonatan-de-Souza/ClaudeMods
claude plugin install extra-mods@jdsjh-mods --scope user
```

Rode `/reload-plugins` (ou abra uma nova sessão) e clique em **◆ extra-mods ▲** no canto inferior direito, ou digite `/tools`.

Para atualizar: `claude plugin marketplace update jdsjh-mods && claude plugin update extra-mods@jdsjh-mods`

## O que tem

- **Zen** esconde as chamadas de ferramentas e mostra o plano do Claude numa faixa de progresso acima do prompt.
- **Tema** aplica qualquer um dos mais de 100 temas do [terminalcolors.com](https://terminalcolors.com) com um clique.
- **Modo** troca o modelo e o esforço, e escolhe o modo em que as novas sessões começam.
- **Status** mostra modelo, pasta, branch, contexto, limites de 5h/7d e estado do cache numa linha só.

A barra lateral fala English e Português. Teclas: **Tab** move, **Enter** escolhe, **Esc** fecha.

<details>
<summary><b>Bom saber</b></summary>

- **Zen:** o Claude ganha uma ferramenta `zen_progress` para postar o plano e atualizar cada etapa. `[–]` encolhe a faixa para uma linha. Cores da faixa: blue, dark, light, green, rainbow ou custom.
- **Tema:** os temas são baixados uma vez para `~/.claude/extra-mods/themes/`. O escolhido vira `~/.claude/themes/extra-mods.json` e fica salvo no `~/.claude/settings.json`. Reinicie o Claude Code uma vez na primeira vez; depois disso os temas trocam ao vivo. O fundo do terminal acompanha, no Windows Terminal (durante a sessão, depois volta ao normal) e nos terminais que aceitam cores OSC (Ghostty, iTerm2, kitty, WezTerm, Terminal.app).
- **Modo:** a troca de modelo usa o `/model` do próprio Claude Code. O esforço vale para todas as requisições e fica salvo. O modo de permissão da sessão atual muda com **shift+tab**; a escolha aqui é salva como `permissions.defaultMode`.
- **Status:** vem ligado. Tira o seu `statusLine` do `settings.json` e coloca de volta quando você desliga. Shells e monitores em segundo plano aparecem numa segunda linha; clique para abrir `/tasks`.
- Todo arquivo de configuração ganha um backup antes, como `*.extra-mods.bak`.

</details>

<details>
<summary><b>Instalar com um agente de IA</b></summary>

Aponte seu agente para este repositório e peça para instalar o mod. Passos para o agente (pergunte ao usuário antes do passo 4):

1. Rode `claude --version`; precisa ser 2.1.292 ou maior.
2. Rode `claude plugin marketplace add Jhonatan-de-Souza/ClaudeMods`.
3. Rode `claude plugin install extra-mods@jdsjh-mods --scope user`.
4. *Opcional, só se o usuário não quiser a linha de status do mod:* copie `statusline/statusline.py` para `~/.claude/statusline.py` e defina `"statusLine": { "type": "command", "command": "python ~/.claude/statusline.py", "refreshInterval": 2 }` no `~/.claude/settings.json` (`python3` no macOS e Linux).
5. Confira se `claude plugin list` mostra o `extra-mods` ativado e peça ao usuário para rodar `/reload-plugins`.

No Windows, use barras normais nos caminhos ao rodar no Git Bash.

</details>

## Desenvolver

```
claude --plugin-dir ./plugins/extra-mods
claude plugin validate ./plugins/extra-mods
claude plugin test ./plugins/extra-mods
```
