import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, LoaderCircle, Upload, X } from 'lucide-react';
import type { TipoTurno } from '@escala-ici/contrato';

import type { Usuario } from '@/lib/modelos';
import {
  gravarImportacao6x1App,
  prepararImportacao6x1App,
  type PreparoImportacao6x1App,
} from '@/lib/firebase/importacao6x1App';

/**
 * IMPORTAR-6X1-APP-1 — o coordenador importa a escala 6x1 do mês pelo App:
 * Planilha → Conferir → Publicar (mesmo fluxo e visual da importação de
 * Plantão). Fala só com o módulo dedicado; as Rules decidem quem grava.
 */
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function nomeCompetencia(competencia: string): string {
  const [ano, mes] = competencia.split('-').map(Number);
  const nome = MESES[(mes ?? 1) - 1] ?? competencia;
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${ano}`;
}

function competenciaSeguinte(competencia: string): string {
  const [ano, mes] = competencia.split('-').map(Number);
  const base = new Date(Date.UTC(ano ?? 1970, mes ?? 1, 1));
  return `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, '0')}`;
}

type Etapa = 'arquivo' | 'lendo' | 'resumo' | 'gravando' | 'pronto';

export function ImportarEscala6x1Coordenacao({
  equipe,
  competenciaAtual,
  catalogo,
  autor,
  onFechar,
  onConcluido,
}: {
  equipe: { id: string; nome: string };
  competenciaAtual: string;
  catalogo: Record<string, TipoTurno>;
  autor: Usuario;
  onFechar: () => void;
  onConcluido: () => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [competencia, setCompetencia] = useState(competenciaAtual);
  const [etapa, setEtapa] = useState<Etapa>('arquivo');
  const [preparo, setPreparo] = useState<PreparoImportacao6x1App | null>(null);
  const [erro, setErro] = useState('');
  const [publicado, setPublicado] = useState(false);

  async function lerArquivo(arquivo: File) {
    setErro('');
    setEtapa('lendo');
    try {
      const resultado = await prepararImportacao6x1App(await arquivo.arrayBuffer(), arquivo.name, equipe.id, competencia, catalogo);
      if (resultado.tipo !== 'OK') {
        setErro(resultado.motivo);
        setEtapa('arquivo');
        return;
      }
      setPreparo(resultado.preparo);
      setEtapa('resumo');
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível ler a planilha.');
      setEtapa('arquivo');
    }
  }

  async function gravar(publicar: boolean) {
    if (!preparo) return;
    setErro('');
    setEtapa('gravando');
    try {
      const resultado = await gravarImportacao6x1App(preparo, autor, publicar);
      setPublicado(resultado.publicado);
      setEtapa('pronto');
      onConcluido();
    } catch (falha) {
      const mensagem = falha instanceof Error ? falha.message : '';
      setErro(/permission|insufficient/iu.test(mensagem)
        ? 'Você não tem permissão para gravar a escala desta equipe.'
        : mensagem || 'Não foi possível gravar agora. Tente de novo em instantes.');
      setEtapa('resumo');
    }
  }

  const destino = typeof document === 'undefined' ? null : document.querySelector('.app-shell') ?? document.body;
  if (destino === null) return null;
  const atual = etapa === 'arquivo' || etapa === 'lendo' ? 0 : etapa === 'resumo' || etapa === 'gravando' ? 1 : 2;
  const reconhecidos = preparo ? preparo.linhas.filter((linha) => linha.login !== null).length : 0;

  return createPortal(
    <div className="modal-backdrop modal-backdrop-sheet" role="presentation" onMouseDown={etapa === 'gravando' ? undefined : onFechar}>
      <section className="edit-modal importar-plantao-app importar-6x1-app" role="dialog" aria-modal="true" aria-labelledby="importar-6x1-titulo"
        onMouseDown={(evento) => evento.stopPropagation()}>
        <div className="panel-title">
          <div>
            <p className="eyebrow">Importar escala 6x1</p>
            <h2 id="importar-6x1-titulo">{equipe.nome}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onFechar} disabled={etapa === 'gravando'} aria-label="Fechar"><X size={18} /></button>
        </div>
        <ol className="importar-plantao-passos" aria-label="Passos">
          {['Planilha', 'Conferir', 'Publicar'].map((nome, indice) => (
            <li key={nome} data-estado={indice < atual ? 'feito' : indice === atual ? 'atual' : 'depois'}>
              <span>{indice < atual ? <CheckCircle2 size={14} /> : indice + 1}</span> {nome}
            </li>
          ))}
        </ol>
        {erro && <div className="alert error" role="alert">{erro}</div>}

        {(etapa === 'arquivo' || etapa === 'lendo') && (
          <>
            <div className="importar-6x1-competencia" role="radiogroup" aria-label="Competência">
              {[competenciaAtual, competenciaSeguinte(competenciaAtual)].map((opcao) => (
                <button key={opcao} type="button" role="radio" aria-checked={competencia === opcao}
                  className={competencia === opcao ? 'active' : ''} disabled={etapa === 'lendo'} onClick={() => setCompetencia(opcao)}>
                  {nomeCompetencia(opcao)}
                </button>
              ))}
            </div>
            <button type="button" className="importar-plantao-arquivo" onClick={() => entrada.current?.click()} disabled={etapa === 'lendo'}>
              {etapa === 'lendo' ? <LoaderCircle className="spin" size={28} /> : <Upload size={28} />}
              <strong>{etapa === 'lendo' ? 'Lendo a planilha…' : 'Escolher a planilha'}</strong>
              <small>Arquivo .xls ou .xlsx da escala 6x1 de {nomeCompetencia(competencia)}.</small>
              <input ref={entrada} type="file" hidden
                accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(evento) => {
                  const arquivo = evento.target.files?.[0];
                  evento.target.value = '';
                  if (arquivo) void lerArquivo(arquivo);
                }} />
            </button>
          </>
        )}

        {preparo !== null && (etapa === 'resumo' || etapa === 'gravando') && (
          <div className="importar-plantao-resumo">
            <p className="importar-plantao-arquivo-nome"><FileSpreadsheet size={15} /> {preparo.nomeArquivo}</p>
            <div className="importar-plantao-mes">
              <strong>{nomeCompetencia(preparo.competencia)}</strong>
              <span>{preparo.resultado.periodoInicio} → {preparo.resultado.periodoFim}</span>
            </div>
            <div className="importar-plantao-numeros">
              <div><small>Pessoas</small><strong>{preparo.pessoas}</strong></div>
              <div><small>Reconhecidas</small><strong>{reconhecidos}</strong></div>
              <div><small>Dias</small><strong>{preparo.resultado.totalDias}</strong></div>
            </div>
            {preparo.podePublicar ? (
              <p className="importar-plantao-ok"><CheckCircle2 size={16} /> Tudo certo: todos os nomes foram reconhecidos e não há erros.</p>
            ) : (
              <div className="alert warning" role="status">
                <strong><AlertTriangle size={15} /> Precisa de ajuste no Dashboard antes de ir para a equipe:</strong>
                <ul>
                  {preparo.pendenciasNomes > 0 && <li>{preparo.pendenciasNomes} nome(s) sem cadastro ou com conflito.</li>}
                  {preparo.errosBloqueantes.slice(0, 5).map((item) => (
                    <li key={`${item.linha}-${item.coluna}-${item.motivo}`}>Linha {item.linha}{item.coluna ? `, coluna ${item.coluna}` : ''}: {item.motivo}</li>
                  ))}
                  {preparo.errosBloqueantes.length > 5 && <li>… e mais {preparo.errosBloqueantes.length - 5} erro(s).</li>}
                  {preparo.pessoas === 0 && <li>Ninguém da equipe foi encontrado na planilha.</li>}
                </ul>
                {preparo.nomesPendentes.length > 0 && <small>Sem cadastro: {preparo.nomesPendentes.join(', ')}</small>}
              </div>
            )}
            {preparo.outrosAvisos.length > 0 && (
              <details className="importar-plantao-atipicas">
                <summary>{preparo.outrosAvisos.length} aviso(s) da leitura (não impedem publicar)</summary>
                <ul>{preparo.outrosAvisos.map((aviso) => <li key={aviso}>{aviso}</li>)}</ul>
              </details>
            )}
          </div>
        )}

        {etapa === 'pronto' && (
          <div className="importar-plantao-pronto">
            <CheckCircle2 size={40} />
            <strong>{publicado ? 'Escala publicada para a equipe!' : 'Salvo como rascunho.'}</strong>
            <span>{publicado
              ? 'A equipe já vê a escala no App e quem teve mudança recebe o aviso no celular.'
              : 'Abra o Dashboard → Escalas para resolver os ajustes e publicar.'}</span>
          </div>
        )}

        <div className="rollback-actions">
          {etapa === 'resumo' || etapa === 'gravando' ? (
            <>
              <button className="secondary-button" type="button" disabled={etapa === 'gravando'} onClick={() => { setPreparo(null); setEtapa('arquivo'); }}>
                Trocar arquivo
              </button>
              {preparo?.podePublicar ? (
                <button className="primary-button" type="button" disabled={etapa === 'gravando'} onClick={() => void gravar(true)}>
                  {etapa === 'gravando' ? 'Publicando…' : 'Publicar para a equipe'}
                </button>
              ) : (
                <button className="primary-button" type="button" disabled={etapa === 'gravando' || (preparo?.pessoas ?? 0) === 0} onClick={() => void gravar(false)}>
                  {etapa === 'gravando' ? 'Salvando…' : 'Salvar e ajustar no Dashboard'}
                </button>
              )}
            </>
          ) : (
            <button className="secondary-button" type="button" onClick={onFechar}>{etapa === 'pronto' ? 'Fechar' : 'Cancelar'}</button>
          )}
        </div>
      </section>
    </div>,
    destino,
  );
}
