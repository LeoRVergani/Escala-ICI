# Checkpoint — Fase 3J-C.2

## Correção do laboratório Windows

- O inicializador não reutiliza mais cegamente qualquer serviço nas portas 4173 e 4174.
- Uma instância atual, conectada ao Firebase local, continua sendo reutilizada.
- Uma instância Vite antiga é identificada pela linha de comando, encerrada e reiniciada com a versão atual.
- Processos que não sejam Vite não são encerrados; o conflito é informado ao usuário.
- A verificação final continua exigindo Dashboard e App conectados ao projeto local `demo-escala-ici-fase3i`.

## Segurança preservada

- Nenhuma escrita no Firebase oficial é habilitada.
- O encerramento automático é limitado a processos Vite que estejam escutando exatamente nas portas do laboratório.
- Emuladores já ativos continuam sendo reutilizados.
