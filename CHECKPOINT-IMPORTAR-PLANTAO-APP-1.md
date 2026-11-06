# CHECKPOINT — IMPORTAR-PLANTAO-APP-1 (coordenador importa Plantão pelo App)

Fluxo (só para quem coordena, na aba Equipe › Plantão › "Importar planilha do mês"):
escolher a planilha → conferir (mês, período, plantões, pessoas, horas, postos com selos, durações
atípicas explicadas) → "Publicar para a equipe". Com qualquer pendência (pessoa sem cadastro, postos
que não batem com o grupo, erro de leitura) o App só salva o rascunho e manda ajustar no Dashboard.

- lib/firebase/importacaoPlantaoApp.ts: prepararImportacaoPlantaoApp (puro, 4 testes) e
  gravarImportacaoPlantaoApp — MESMO pipeline do Dashboard (processarArquivoImportado,
  iniciarVinculosPlantao, montar…Rascunho, salvar…, publicarCompetenciaPlantao).
- plantaoWriteRepository: salvarParticipante/Competência/Atribuições e publicar aceitam
  { origemApp: true } (o App não tem a escrita administrativa do Dashboard); quem grava continua
  decidido pelas Rules (administração do Plantão). Sem mudança em firestore.rules.
- Exceção controlada travada por teste: EmployeeApp sem símbolos de gestão; só abre o componente
  ImportarPlantaoCoordenacao, que só fala com o módulo dedicado; botão só na visão de coordenação.
- Nesta fase só Plantão; 6x1 continua no Dashboard.
vitest 1539 ok · typecheck ok · lint 0 erros · test:boundaries 513/513 · build:apps ok (+34 KB).
