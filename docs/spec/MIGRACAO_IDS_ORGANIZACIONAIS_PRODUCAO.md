# Migração de IDs organizacionais para produção

**Status:** planejada e obrigatória antes do primeiro go-live de produção  
**Execução atual:** proibida em staging **por edição/renomeação silenciosa em runtime** — a única forma permitida de staging adotar os IDs canônicos é o corte controlado descrito em `docs/spec/STAGING_RESET_HIERARQUIA_ICI.md` (fase STAGING-RESET-HIERARQUIA-ICI-1: backup recuperável, reset completo, reseed do zero já com IDs canônicos, validação pós-seed, aprovação humana em cada passo — nunca um `UPDATE`/renomeação de documento existente)\
**Fonte organizacional:** `ESTRUTURA_ORGANIZACIONAL_REFERENCIA.md`

## 1. Decisão normativa

Antes da fase STAGING-RESET-HIERARQUIA-ICI-1, o staging preservava seus IDs
legados para não quebrar usuários, escalas, Matriz de Responsáveis, Plantões,
trocas e históricos já usados nos testes — `EQ_SOC`, `EQ_NOC` e
`EQ_PLANTAO_COSI` eram válidos **somente como chaves legadas desse
ambiente**, até o corte controlado.

A partir da fase STAGING-RESET-HIERARQUIA-ICI-1, o staging é reiniciado do
zero (backup + reset + seed, nunca renomeação em runtime — ver
`docs/spec/STAGING_RESET_HIERARQUIA_ICI.md`) e passa a nascer diretamente com
os IDs canônicos da tabela abaixo. Isso ANTECIPA para staging, sob a mesma
disciplina, o que esta spec já exigia para o corte de produção — não a
contradiz: produção continua exigindo seu próprio corte formal (backup, dry-
run, auditoria referencial, aprovação humana), a partir de uma base vazia,
nunca copiada diretamente do staging (mesmo o staging canônico novo).

A base definitiva de produção deve nascer com IDs técnicos canônicos derivados
da estrutura organizacional confirmada do ICI. Para o recorte atual:

| ID legado de staging | ID canônico de produção |
|---|---|
| `EQ_SOC` | `GEDSI_COSI_SOC` |
| `EQ_NOC` | `GEDSI_CODB_NOC` |
| `EQ_PLANTAO_COSI` | `GEDSI_COSI_PLANTAO` |

O padrão de novos IDs de equipe é:

```text
<GERENCIA>_<COORDENACAO>_<FUNCAO_OU_LOCALIDADE>
```

**STAGING-RESET-HIERARQUIA-ICI-2** — o mesmo raciocínio vale para
`unidadeId` de uma COORDENAÇÃO: nunca a sigla solta, sempre prefixada pela
gerência-mãe (`<GERENCIA>_<COORDENACAO>`):

| Sigla de referência | `unidadeId` canônico |
|---|---|
| `COSI` | `GEDSI_COSI` |
| `CODB` | `GEDSI_CODB` |
| `COCR` | `GEDSI_COCR` |
| `CSTE` | `GESUP_CSTE` |
| `COAT` | `GESUP_COAT` |
| `COSD` | `GESUP_COSD` |
| `COAC` | `GEOPE_COAC` |
| `COPC` | `GEOPE_COPC` |

Uma vez criado e referenciado em produção, o ID volta a ser imutável. Mudança
posterior de organograma altera a apresentação/caminho, não renomeia a chave.
Portanto, esta fase é um **bootstrap/migração antes do go-live**, não uma função
normal da tela Administração e não uma renomeação automática em runtime.

## 2. O que não pode acontecer agora

- Não renomear documentos no staging (`UPDATE` de `equipeId`/`grupoId`/IDs em
  runtime). O único caminho aprovado para staging adotar os IDs canônicos é
  o reset+reseed controlado de `docs/spec/STAGING_RESET_HIERARQUIA_ICI.md` —
  apagar e recriar do zero, nunca editar um ID existente no lugar.
- Não trocar `equipeId`, `equipeResponsavelId`, `equipesConsulta` ou `alvoId`
  isoladamente.
- Não manter dois IDs ativos para a mesma equipe como fallback silencioso.
- Não hardcodar os exemplos acima nas Rules ou no código de negócio.
- Não copiar a base de staging diretamente para produção sem transformar e
  validar todas as referências.
- Não fazer deploy, importação ou migração sem aprovação humana explícita,
  export recuperável e relatório de dry-run.

## 3. Grafo mínimo de referências a migrar

A migração deve inventariar o projeto Firebase de origem e transformar de modo
atômico ou por importação em base vazia, incluindo no mínimo:

- `equipes/{equipeId}` e o campo `Equipe.id`;
- `usuarios.equipeId`, `usuarios.equipesPermitidas` e metadados operacionais
  cujo alvo seja uma Jornada;
- `gruposPlantao.equipeResponsavelId` e `gruposPlantao.equipesConsulta`;
- `escoposOperacionais` cujo `tipo` seja `JORNADA` e referências de equipe da
  Matriz de Responsáveis;
- rascunhos, turnos, publicações, versões, históricos, importações, eventos e
  trocas que possuam `equipeId` ou que embutam o ID da equipe no documento;
- quaisquer novas coleções encontradas por uma varredura de schema/dados antes
  do corte.

O `grupoId` de Plantão é uma identidade de domínio separada. Ele só muda se uma
spec própria aprovar essa migração; adotar `GEDSI_COSI_PLANTAO` como
`equipeResponsavelId` não autoriza renomear `PLANTAO_COSI` automaticamente.

## 4. Firestore Rules e índices de produção

As Rules devem continuar genéricas: autorizam pelos IDs presentes nos
documentos e pela Matriz, nunca pelo texto `GEDSI`, `COSI`, `SOC`, `NOC` ou
`PLANTAO`. O corte para produção exige:

1. executar todos os testes de Rules também com IDs canônicos de produção;
2. confirmar que consultas compostas e índices usam campos, não valores
   legados hardcoded;
3. publicar Rules e índices no projeto de produção pelo pipeline aprovado;
4. importar os dados já transformados ou executar a migração controlada;
5. testar com `ADMIN_SISTEMA`, coordenador responsável, supervisor,
   colaborador e usuário sem responsabilidade;
6. provar que Jornada, Plantão, Matriz, cadastro de usuários, rascunho,
   publicação, histórico e trocas resolvem somente o novo ID.

Produção não pode depender de fallback legado nem de Rules temporariamente
amplas. Uma recusa deve permanecer `permission-denied`, com diagnóstico claro,
até que dado, matriz e autorização estejam coerentes.

## 5. Procedimento obrigatório de corte

1. Congelar alterações estruturais no staging durante a extração final.
2. Exportar backup recuperável e registrar contagens por coleção.
3. Executar migrador em `--dry-run`, exibindo mapa origem→destino, documentos
   afetados, colisões, referências ausentes e IDs embutidos recalculados.
4. Bloquear o corte diante de colisão, referência órfã ou sigla organizacional
   não confirmada.
5. Preparar uma base de produção vazia e aplicar schema, índices e Rules
   revisadas.
6. Importar os documentos transformados usando um único ID canônico por equipe.
7. Executar auditoria referencial e as suítes obrigatórias.
8. Fazer smoke test autenticado por perfil e obter aceite humano.
9. Somente então liberar escrita e tráfego de produção.

Rollback significa descartar/restaurar a base de produção a partir do backup;
nunca tentar desfazer parcialmente IDs já referenciados por clientes ativos.

## 6. Critérios de aceite

- Nenhum documento de produção referencia `EQ_SOC`, `EQ_NOC` ou
  `EQ_PLANTAO_COSI` fora de metadados explícitos de auditoria da migração.
- A equipe responsável pelo Plantão COSI é `GEDSI_COSI_PLANTAO`.
- `usuarios`, `gruposPlantao`, Matriz e escalas apontam para a mesma identidade
  canônica, sem aliases de autorização.
- As Rules de produção não contêm condicionais para siglas ou IDs reais.
- Não existe fallback operacional legado habilitado em produção.
- Backup, dry-run, relatório de integridade, testes de Rules e smoke test estão
  anexados ao checklist de go-live.

## 7. Relação com a imutabilidade atual

As specs que chamam `Equipe.id` de imutável continuam corretas: uma chave já
referenciada não pode ser renomeada por uma edição comum. Esta spec acrescenta
o contrato de preparação de um **novo ambiente definitivo**. O staging não é
renomeado; seus dados são transformados para IDs canônicos antes de entrar na
base vazia de produção.
