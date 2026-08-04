# Checkpoint Fase 3E — Firebase seguro e sessão restaurável

## Base preservada

- Fases 3A, 3B, 3C e 3D preservadas
- App do colaborador continua somente leitura
- Dashboard continua sendo o único produto que conhece operações de escrita
- Produção e Firebase oficial não alterados
- Símbolo oficial e PWA preservados

## Autenticação

- sessão Firebase restaurada ao reabrir o App ou Dashboard;
- persistência local no dispositivo confiável;
- persistência somente durante a sessão quando a opção é desmarcada;
- mensagens amigáveis para credencial inválida, bloqueio e falha de rede;
- colaborador sem nível de gestor é desconectado ao tentar abrir o Dashboard;
- logout encerra a sessão e tenta limpar o cache local do Firestore.

## Segurança operacional

- `VITE_ALLOW_OFFICIAL_FIRESTORE_WRITE=false` por padrão;
- todas as cinco operações administrativas exigem habilitação explícita;
- Dashboard real entra em modo de validação somente leitura enquanto a flag
  estiver desativada;
- App do colaborador não importa código de escrita;
- conexão com emuladores aceita apenas `localhost` e `127.0.0.1`.

## Validação local das regras

O projeto emulado `demo-escala-ici-fase3e` não possui recursos reais e impede
qualquer acesso acidental fora dos emuladores.

Os testes confirmam:

- visitante não lê dados operacionais;
- colaborador lê a própria identidade, colegas da equipe e escalas publicadas;
- colaborador não lê rascunhos e não grava;
- outra equipe permanece isolada;
- gestor revisa e cria rascunhos somente na própria equipe;
- colaborador altera somente o próprio nome;
- configuração pública continua imutável.

## Limite desta fase

Não existem credenciais Firebase no ambiente de desenvolvimento desta entrega.
Por isso, login e leitura no projeto real devem ser confirmados pelo responsável
em um dispositivo autorizado antes de qualquer publicação.

## Próximo checkpoint

A Fase 3F fará a convergência visual com os mockups aprovados:

- **Hoje primeiro** no celular;
- cartões leves e compactos;
- semana/calendário mais visual;
- composição específica para desktop, tablet e mobile;
- tema claro fiel aos mockups e tema escuro com a paleta SOC;
- agenda móvel e navegação inferior refinadas.
