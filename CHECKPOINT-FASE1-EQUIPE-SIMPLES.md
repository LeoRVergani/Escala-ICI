# CHECKPOINT — FASE1-EQUIPE-SIMPLES (Dashboard simples para quem organiza escala)

PWA (App do colaborador): sem nenhuma mudança.

## Menu
- ADMIN_SISTEMA: igual (Visão geral, Escalas, Trocas, Usuários, Administração).
- Coordenador / supervisor / gestor de unidade: Início, Minha equipe, Escalas, Trocas
  (+ Administração só para gestor de unidade, até o cadastro de equipe chegar em Minha equipe — Fase 3).

## Início
"Primeiros passos" (até a equipe estar pronta): 1. Sua equipe · 2. Pessoas · 3. Montar a escala
(abre o assistente de Nova escala: 6x1 ou Plantão) · 4. Publicar. Cada passo com um botão.

## Minha equipe
- Pessoas da equipe (editar, ativar/desativar, excluir com as travas existentes).
- "Buscar pessoa cadastrada": pesquisa em todo o cadastro. Sem equipe -> Adicionar; de outra
  equipe -> Transferir (confirmação explica que a equipe antiga será avisada). Contas de gestão
  (admin, gestor de unidade, coordenador, supervisor) não são transferíveis pelo coordenador.
- "Cadastrar pessoa nova": formulário de sempre, com a equipe já fixa.
- Avisos "Fulano foi transferido(a)" para a equipe antiga: na tela, no Início (sino) com "Entendi".

## Dados / Rules (PRECISA PUBLICAR)
- `usuarios` read: + `souResponsavelOperacionalElegivel()` (diretório para quem organiza escala;
  colaborador comum continua sem ler outras equipes).
- `usuarios` update: + transferência — só `equipeId`/`atualizadoEm`, destino administrado
  (`podeAdministrarJornada`), alvo com perfil efetivo de analista, nunca a própria conta.
- Nova coleção `avisosGestao` (create pelo destino em nome próprio, schema fechado; read/update
  "lido" por quem administra a equipe avisada; delete só admin).
- `lib/firebase/equipeRepository.ts`: transferência + aviso no MESMO lote (tudo ou nada).

## Testes
- Regras: 5 testes novos (diretório, transferência permitida/negada, avisos) e 4 ajustados para o
  diretório. NÃO executados aqui (emulador indisponível) — rodar na VM antes de publicar.
- vitest 1517 ok · typecheck ok · lint 0 erros · test:boundaries 511/511 · build:apps ok ·
  validate:firebase-contract ok.
