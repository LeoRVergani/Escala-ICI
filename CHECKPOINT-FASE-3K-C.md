# Checkpoint — Fase 3K-C

## Objetivo

Disponibilizar o laboratório Firebase da Escala ICI pela rede corporativa
interna, permitindo que gestores testem o Dashboard pelo IPv4 da VM antes da
configuração de DNS e do Firebase de homologação.

## Entrega

- launcher Linux compatível com Oracle Linux 9, abertura opcional do
  `firewalld` e diagnóstico final;
- Dashboard em `0.0.0.0:4173`, App em `0.0.0.0:4174`, Authentication em 9099,
  Firestore em 8080 e Emulator UI em 4000;
- autorização restrita ao IPv4 privado informado, ao ambiente `local` e à flag
  `VITE_FIREBASE_LAN_MODE=true`;
- configuração localhost anterior preservada;
- escrita oficial bloqueada no laboratório;
- build Docker do Dashboard capaz de receber a configuração LAN pública do
  Firebase Web SDK;
- preflight e testes negativos contra IP público, host divergente, staging e
  produção.

## Execução na VM

```bash
chmod +x executar-laboratorio-lan-linux.sh
./executar-laboratorio-lan-linux.sh --host=172.31.6.111 --open-firewall
```

Contas totalmente fictícias:

- gestora: `marina.azevedo@teste.local`;
- colaborador: `caio.monteiro@teste.local`;
- senha: `EscalaLocal#2026`.

## Validação

```bash
npm run check:phase3kc
```

Resultado automatizado em 03/08/2026:

- 42 testes unitários aprovados;
- 26 testes de fronteira aprovados;
- 14 verificações de configuração Firebase aprovadas;
- 16 testes integrados de Authentication, Firestore, regras, importação,
  publicação e rollback aprovados;
- 5 contratos específicos do laboratório LAN aprovados;
- builds independentes do Dashboard e do App/PWA aprovados;
- contratos Docker, Cloudflare Pages, staging e bloqueio de produção aprovados.

Os avisos de `PERMISSION_DENIED` exibidos durante os testes integrados são
esperados: eles comprovam que colaborador, gestor de outra equipe e operações
imutáveis continuam bloqueados pelas regras do Firestore.

O aceite manual exige importar, salvar rascunho, publicar, receber a
atualização em tempo real no App e executar rollback, tudo acessando pelo IP
interno da VM e sem `F5`.
