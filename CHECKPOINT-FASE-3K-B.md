# Checkpoint — Fase 3K-B

## Resultado

A base aprovada na Fase 3K-A foi preparada para homologação online sem abrir
acesso à produção.

- App PWA: build independente, somente leitura e publicável em Cloudflare
  Pages temporário com sufixo `-staging`;
- Dashboard: Docker com escrita liberada apenas para Firebase staging;
- Firebase: preflight sanitizado, regras e índices sob confirmação explícita;
- dados: contas e planilhas exclusivamente fictícias;
- produção: escrita bloqueada no cliente mesmo que a flag seja ligada;
- segredos: nenhum Service Account, chave privada, senha ou configuração Web
  real foi incluído.

## Validação local

```bash
npm run check:phase3kb
```

Resultado desta entrega:

- 40 testes unitários aprovados;
- 26 testes de fronteiras aprovados;
- 12 testes de preflight Firebase aprovados;
- 16 testes integrados Auth/Firestore aprovados;
- seed, smoke vivo, regras, PWA, builds e artefatos aprovados;
- 3 testes exclusivos do contrato staging aprovados;
- home, App e Dashboard conferidos na visualização executável sem erro da
  aplicação.

O pacote não contém credenciais e não cria projetos externos sozinho. O aceite
online termina após o roteiro de PC e celular em
`deploy/firebase-staging/README.md`.
