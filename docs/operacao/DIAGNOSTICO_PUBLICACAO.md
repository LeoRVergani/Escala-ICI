# Diagnóstico: "por que a publicação foi recusada?"

**DIAGNOSTICO-PUBLICACAO-1.** A mensagem *"As regras de escrita ainda não reconhecem a matriz operacional neste ambiente"* aparece para **qualquer**
`permission-denied` na publicação. Ela não diz qual gravação foi negada nem por quê. Esta ferramenta responde as duas coisas, com os **dados reais do
staging** e as **Regras de verdade** (`firestore.rules`), sem gravar nada no staging.

## Como usar (na VM)

```bash
cd /root/projetos/Escala-ICI && git pull

# 1) LÊ o contexto real do staging (somente leitura) e grava num arquivo local
export GOOGLE_APPLICATION_CREDENTIALS=/opt/escala-ici/secrets/escala-ici-staging-push-worker.json
npm run staging:diagnosticar:publicacao:exportar -- --login=<login de quem está publicando>

# 2) repete a publicação, como essa pessoa, DENTRO DO EMULADOR (nada vai para o staging)
npx firebase emulators:exec --only firestore --project demo-escala-ici-fase3i \
  "node scripts/staging/simular-publicacao.mjs --login=<login> --competencia=2026-12"

# 3) apague o arquivo (tem nomes e e-mails do cadastro)
rm -f /tmp/contexto-regras.json
```

O `login` é o texto antes do `@` do e-mail (por exemplo, `claudio.lis` de `claudio.lis@empresa.com`).

## O que a saída mostra

- **Contexto lido do staging**: perfil, equipe, `equipesPermitidas`, se existe a Matriz `JORNADA_<equipe>`, se está ativa e quem ela lista.
- **Cada passo** da publicação (✓ permitido / ✗ NEGADO): as 3 leituras iniciais, cada gravação sozinha (rascunho, `turnosMes`, `versoesEscala`,
  `eventosEscala`, `historicoPublicacoes`, `publicacoesEscala`) e o **lote inteiro** como o Dashboard faz (9 colaboradores).
- Para cada recusa, a **linha de `firestore.rules`** que negou e o trecho dela.
- Um **veredito** em português. Os casos:
  1. *Nenhuma recusa* → a causa não está nas Regras nem nos dados (confira o Dashboard carregado, a conta logada, "Simular gestor", o console do navegador).
  2. *Nem o rascunho passa* → as Regras não reconhecem o usuário como administrador da Jornada (Matriz, fallback de gestor, de unidade).
  3. *O rascunho passa, mas a publicação não* → a coleção citada é a recusada.
  4. *Cada gravação passa sozinha, mas o lote é recusado* → limite de acessos/expressões por lote.
- Se aparecer *"maximum of 1000 expressions"*: é erro de **avaliação** (a regra é grande demais para esse caminho), não permissão negada de verdade.

## Notas

- Os arquivos: `scripts/staging/exportar-contexto-regras.mjs` (passo 1), `scripts/staging/simular-publicacao.mjs` (passo 2) e a lógica pura, testada, em
  `scripts/staging/diagnosticoPublicacaoLib.mjs`.
- O passo 1 só usa `get()` de coleções (`usuarios`, `equipes`, `escoposOperacionais`, `config`, `gruposPlantao`), as mesmas que as Regras consultam. Um teste de
  fronteira impede qualquer escrita nesse script.
- O passo 2 só escreve no emulador e nunca importa o Admin SDK.
- Publicar **simulando outro gestor** também é recusado (a Regra de `eventosEscala` exige `publicadoPor == conta logada`): o teste
  `PUBLICACAO-LOTE-1` em `tests/firebase/firestore.rules.test.ts` documenta isso.
