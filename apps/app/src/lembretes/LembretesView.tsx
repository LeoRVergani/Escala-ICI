/**
 * Orquestra o modo "Lembretes" da Agenda (Fase 4): calendário do mês +
 * painel do dia selecionado, dentro do MESMO `.schedule-explorer` já usado
 * pelos modos Calendário/Agenda (reaproveita o grid/colapso mobile
 * existente — nenhum CSS responsivo novo para o layout 2 colunas/1 coluna).
 *
 * Estado local e explícito, sem misturar com o resto do EmployeeApp:
 * `mesVisivel`/`dataSelecionada` aqui NUNCA são os mesmos states da Agenda
 * (`dataSelecionada`) nem da tela Hoje (`dataConsultaEquipe`).
 */
import { adicionarDias } from '@escala-ici/contrato';
import { useMemo, useState } from 'react';

import type { EntradaLembrete, EntradaSerieLembrete } from '@/lib/lembretes';
import {
  contarLembretesPorData,
  lembretesDoDia,
  mesDeData,
  proximosLembretesAgrupados,
  unificarLembretesAtivos,
  type ItemLembreteAtribuido,
  type ItemLembretePessoal,
  type ItemLembreteUnificado,
} from '@/lib/lembretesUi';
import { LembreteAtribuidoDetalheModal } from '@/components/lembretes/LembreteAtribuidoDetalheModal';
import { LembreteFormModal } from '@/components/lembretes/LembreteFormModal';
import { LembretesCalendario } from '@/components/lembretes/LembretesCalendario';
import { LembretesDia } from '@/components/lembretes/LembretesDia';
import { useLembretes } from './useLembretes';

type ModalLembrete =
  | { modo: 'criar' }
  | { modo: 'editar'; lembrete: ItemLembretePessoal }
  | { modo: 'detalhe-atribuido'; lembrete: ItemLembreteAtribuido }
  | null;

export function LembretesView({
  login,
  nomeGestorDemo,
  modoDemonstracao,
  listenersLiberados,
  dataHoje,
}: {
  login: string | null;
  nomeGestorDemo: string;
  modoDemonstracao: boolean;
  listenersLiberados: boolean;
  dataHoje: string;
}) {
  const [mesVisivel, setMesVisivel] = useState(() => mesDeData(dataHoje));
  const [dataSelecionadaLembretes, setDataSelecionadaLembretes] = useState(dataHoje);
  const [modal, setModal] = useState<ModalLembrete>(null);

  const { pessoais, atribuidos, erro, criarPessoal, criarSeriePessoal, editarPessoal, excluirPessoal } = useLembretes({
    login,
    nomeGestorDemo,
    modoDemonstracao,
    listenersLiberados,
    mesVisivel,
    dataHoje,
  });

  const itensAtivos = useMemo(
    () => unificarLembretesAtivos(pessoais, atribuidos),
    [pessoais, atribuidos],
  );
  const contagemPorData = useMemo(() => contarLembretesPorData(itensAtivos), [itensAtivos]);
  const itensDoDia = useMemo(
    () => lembretesDoDia(itensAtivos, dataSelecionadaLembretes),
    [itensAtivos, dataSelecionadaLembretes],
  );
  const proximos = useMemo(
    () => proximosLembretesAgrupados(itensAtivos, adicionarDias(dataSelecionadaLembretes, 1), 5),
    [itensAtivos, dataSelecionadaLembretes],
  );

  function selecionarItem(item: ItemLembreteUnificado) {
    if (item.tipo === 'PESSOAL') {
      setModal({ modo: 'editar', lembrete: item });
    } else {
      setModal({ modo: 'detalhe-atribuido', lembrete: item });
    }
  }

  async function salvarUnico(entrada: EntradaLembrete): Promise<void> {
    if (modal?.modo === 'editar') {
      await editarPessoal(modal.lembrete.lembreteId, entrada);
    } else {
      await criarPessoal(entrada);
    }
  }

  async function salvarSerie(entrada: EntradaSerieLembrete): Promise<void> {
    await criarSeriePessoal(entrada);
  }

  return (
    <>
      <div className="schedule-view-panel">
        {erro && <div className="alert error" role="alert">{erro}</div>}
        <LembretesCalendario
          mesVisivel={mesVisivel}
          dataHoje={dataHoje}
          dataSelecionada={dataSelecionadaLembretes}
          contagemPorData={contagemPorData}
          onSelecionarDia={setDataSelecionadaLembretes}
          onMudarMes={setMesVisivel}
        />
      </div>
      <LembretesDia
        data={dataSelecionadaLembretes}
        dataHoje={dataHoje}
        itens={itensDoDia}
        proximos={proximos}
        onNovoLembrete={() => setModal({ modo: 'criar' })}
        onSelecionarItem={selecionarItem}
      />

      {modal?.modo === 'criar' && (
        <LembreteFormModal
          modo="criar"
          dataInicial={dataSelecionadaLembretes}
          onFechar={() => setModal(null)}
          onSalvarUnico={salvarUnico}
          onSalvarSerie={salvarSerie}
        />
      )}
      {modal?.modo === 'editar' && (
        <LembreteFormModal
          modo="editar"
          dataInicial={modal.lembrete.data}
          lembreteEmEdicao={modal.lembrete}
          onFechar={() => setModal(null)}
          onSalvarUnico={salvarUnico}
          onSalvarSerie={salvarSerie}
          onExcluir={() => excluirPessoal(modal.lembrete.lembreteId)}
        />
      )}
      {modal?.modo === 'detalhe-atribuido' && (
        <LembreteAtribuidoDetalheModal
          lembrete={modal.lembrete}
          onFechar={() => setModal(null)}
        />
      )}
    </>
  );
}
