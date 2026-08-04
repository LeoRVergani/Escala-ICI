# Checkpoint Fase 3D — PWA instalável

## Base preservada

- Fases 3A, 3B e 3C preservadas
- Dashboard continua sendo o único produto que escreve e publica
- PWA limitado ao App do colaborador em `/app`
- Cache persistente do Firebase preservado
- Produção não alterada nesta fase

## Identidade oficial

- Símbolo enviado pelo usuário adotado como marca padrão
- Arquivo original preservado visualmente, sem redesenho por IA
- Versões `any` transparentes em 192 px e 512 px
- Versões `maskable` em 192 px e 512 px com área segura
- Ícone Apple Touch e favicon
- Marca aplicada na navegação, login, entrada e metadados

## PWA entregue

- `manifest.webmanifest`
- Nome e nome curto **Escala ICI**
- Início e escopo em `/app`
- Modo `standalone`
- Orientação livre para celular, tablet e desktop
- Service worker limitado à experiência do colaborador
- Shell do App e ativos visuais em cache
- Navegação do App com fallback offline
- Dados locais de demonstração com estratégia rede-primeiro
- Recursos estáticos com cache por conteúdo
- Chamadas externas, Firebase e autenticação fora do cache do service worker
- Aviso acessível de estado offline
- Instalação guiada quando o navegador disponibiliza o evento
- Instrução específica para Safari no iPhone e iPad

## Atualização segura

- O service worker não usa `skipWaiting()` automaticamente
- Nova versão fica aguardando
- O App informa que há atualização pronta
- A ativação ocorre após ação explícita do usuário
- O registro consulta atualizações ao retornar ao App e a cada hora
- O script do service worker é registrado com `updateViaCache: none`

## Validação

```bash
npm run check:phase3d
```

O validador específico confirma:

- campos obrigatórios do manifesto;
- dimensões reais dos ícones;
- presença das versões `maskable`;
- escopo exclusivo em `/app`;
- arquivos PWA nos artefatos de build;
- ausência de ativação forçada durante a instalação.

## Próximo checkpoint

A Fase 3E fará a validação integrada:

- Firebase real;
- autenticação e permissões;
- leitura da escala publicada;
- cache e retorno offline;
- instalação real em celular e computador;
- checklist final antes de qualquer troca da produção.
