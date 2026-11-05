import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, LoaderCircle, Upload, X } from 'lucide-react';
import { formatarCompetencia, type GrupoPlantao } from '@escala-ici/contrato';

import {
  gravarImportacaoPlantaoApp,
  prepararImportacaoPlantaoApp,
  type PreparoImportacaoPlantaoApp,
} from '@/lib/firebase/importacaoPlantaoApp';
import { listarUsuarios } from '@/lib/firebase/readRepository';
import type { Usuario } from '@/lib/modelos';

/**
 * IMPORTAR-PLANTAO-APP-1 — importação rápida de Plantão pelo celular, só
 * para quem coordena: escolher a planilha → conferir o resumo → publicar para
 * a equipe. Qualquer pendência salva o rascunho e manda resolver no Dashboard.
 */
type Etapa = 'arquivo' | 'lendo' | 'resumo' | 'gravando' | 'pronto';

function dataCurta(data: string): string {
  return `${data.slice(8, 10)}/${data.slice(5, 7)}`;
}

export function ImportarPlantaoCoordenacao({
  grupo,
  loginAtual,
  onFechar,
  onConcluido,
}: {
  grupo: GrupoPlantao;
  loginAtual: string;
  onFechar: () => void;
  onConcluido: () => void;
}) {
  const [etapa, setEtapa] = useState<Etapa>('arquivo');
  const [erro, setErro] = useState('');
  const [preparo, setPreparo] = useState<PreparoImportacaoPlantaoApp | null>(null);
  const [resultadoFinal, setResultadoFinal] = useState<'NO_AR' | 'SALVO' | null>(null);
  const [usuariosGrupo, setUsuariosGrupo] = useState<Usuario[] | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelado = false;
    void listarUsuarios(grupo.equipeResponsavelId)
      .then((lista) => { if (!cancelado) setUsuariosGrupo(lista); })
      .catch(() => { if (!cancelado) setUsuariosGrupo([]); });
    return () => { cancelado = true; };
  }, [grupo.equipeResponsavelId]);

  async function lerArquivo(arquivo: File) {
    setErro('');
    setEtapa('lendo');
    try {
      const conteudo = await arquivo.arrayBuffer();
      const lido = prepararImportacaoPlantaoApp(conteudo, arquivo.name, grupo, usuariosGrupo ?? []);
      if (!lido.ok) {
        setErro(lido.erro);
        setEtapa('arquivo');
        return;
      }
      setPreparo(lido.preparo);
      setEtapa('resumo');
    } catch {
      setErro('Não foi possível abrir este arquivo.');
      setEtapa('arquivo');
    }
  }

  async function gravar(colocarNoAr: boolean) {
    if (preparo === null) return;
    setErro('');
    setEtapa('gravando');
    try {
      const nomesPorLogin = Object.fromEntries((usuariosGrupo ?? []).map((usuario) => [usuario.login, usuario.nome]));
      const final = await gravarImportacaoPlantaoApp(preparo, { loginAtual, nomesPorLogin, colocarNoAr });
      setResultadoFinal(final);
      setEtapa('pronto');
      onConcluido();
    } catch (falha) {
      const codigo = typeof falha === 'object' && falha !== null && 'code' in falha ? String((falha as { code: unknown }).code) : '';
      setErro(codigo.includes('permission-denied')
        ? 'Você não está como responsável por este Plantão. Peça ao administrador para incluí-lo.'
        : 'Não foi possível gravar agora. Tente de novo em instantes.');
      setEtapa('resumo');
    }
  }

  const semPendencias = preparo !== null && preparo.pendencias.length === 0;
  const destino = typeof document === 'undefined' ? null : document.querySelector('.app-shell') ?? document.body;
  if (destino === null) return null;

  return createPortal(
    <div className="modal-backdrop modal-backdrop-sheet" role="presentation" onMouseDown={etapa === 'gravando' ? undefined : onFechar}>
      <section
        className="edit-modal importar-plantao-app"
        role="dialog"
        aria-modal="true"
        aria-labelledby="importar-plantao-titulo"
        onMouseDown={(evento) => evento.stopPropagation()}
      >
        <div className="panel-title">
          <div>
            <p className="eyebrow">Importar escala do mês</p>
            <h2 id="importar-plantao-titulo">{grupo.nome}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onFechar} disabled={etapa === 'gravando'} aria-label="Fechar"><X size={18} /></button>
        </div>

        <ol className="importar-plantao-passos" aria-label="Passos">
          {['Planilha', 'Conferir', 'Publicar'].map((nome, indice) => {
            const atual = etapa === 'arquivo' || etapa === 'lendo' ? 0 : etapa === 'resumo' ? 1 : 2;
            return (
              <li key={nome} data-estado={indice < atual ? 'feito' : indice === atual ? 'atual' : 'depois'}>
                <span>{indice < atual ? <CheckCircle2 size={14} /> : indice + 1}</span> {nome}
              </li>
            );
          })}
        </ol>

        {erro && <div className="alert error" role="alert">{erro}</div>}

        {(etapa === 'arquivo' || etapa === 'lendo') && (
          <button
            type="button"
            className="importar-plantao-arquivo"
            onClick={() => entrada.current?.click()}
            disabled={etapa === 'lendo' || usuariosGrupo === null}
          >
            {etapa === 'lendo' || usuariosGrupo === null ? <LoaderCircle className="spin" size={28} /> : <Upload size={28} />}
            <strong>{etapa === 'lendo' ? 'Lendo a planilha…' : 'Escolher a planilha'}</strong>
            <small>Arquivo .xls ou .xlsx do relatório de Plantão (do e-mail, WhatsApp ou Arquivos).</small>
            <input
              ref={entrada}
              type="file"
              accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              hidden
              onChange={(evento) => {
                const arquivo = evento.target.files?.[0];
                evento.target.value = '';
                if (arquivo) void lerArquivo(arquivo);
              }}
            />
          </button>
        )}

        {preparo !== null && (etapa === 'resumo' || etapa === 'gravando') && (
          <div className="importar-plantao-resumo">
            <p className="importar-plantao-arquivo-nome"><FileSpreadsheet size={15} /> {preparo.nomeArquivo}</p>
            <div className="importar-plantao-mes">
              <strong>{formatarCompetencia(preparo.competencia)}</strong>
              <span>{dataCurta(preparo.periodoInicio)} → {dataCurta(preparo.periodoFim)}</span>
            </div>
            <div className="importar-plantao-numeros">
              <div><small>Plantões</small><strong>{preparo.totalPlantoes}</strong></div>
              <div><small>Pessoas</small><strong>{preparo.totalPessoas}</strong></div>
              <div><small>Horas</small><strong>{Math.round(preparo.minutos / 60)}h</strong></div>
            </div>
            {preparo.postos.length > 1 && (
              <ul className="importar-plantao-postos">
                {preparo.postos.map((posto) => (
                  <li key={posto.funcao ?? 'unico'}>
                    <span className="plantao-posto-selo" data-funcao={posto.funcao ?? undefined}>{posto.rotulo}</span>
                    <span>{posto.plantoes} plantões · {posto.pessoas} pessoas</span>
                  </li>
                ))}
              </ul>
            )}
            {preparo.atipicas.length > 0 && (
              <details className="importar-plantao-atipicas">
                <summary>{preparo.atipicas.reduce((soma, grupoAtipico) => soma + grupoAtipico.quantidade, 0)} plantão(ões) com duração diferente — normalmente corte do relatório</summary>
                <ul>
                  {preparo.atipicas.map((item) => (
                    <li key={item.chave}><strong>{item.quando}</strong> · {item.duracao}{item.explicacao ? ` — ${item.explicacao}` : ''}</li>
                  ))}
                </ul>
              </details>
            )}
            {semPendencias ? (
              <p className="importar-plantao-ok"><CheckCircle2 size={16} /> Tudo certo: todos os nomes foram reconhecidos.</p>
            ) : (
              <div className="alert warning" role="status">
                <strong><AlertTriangle size={15} /> Precisa de ajuste no Dashboard antes de ir para a equipe:</strong>
                <ul>{preparo.pendencias.map((pendencia) => <li key={pendencia}>{pendencia}</li>)}</ul>
                {preparo.nomesSemVinculo.length > 0 && <small>Sem cadastro: {preparo.nomesSemVinculo.join(', ')}</small>}
              </div>
            )}
          </div>
        )}

        {etapa === 'pronto' && (
          <div className="importar-plantao-pronto">
            <CheckCircle2 size={40} />
            <strong>{resultadoFinal === 'NO_AR' ? 'Escala publicada para a equipe!' : 'Salvo como rascunho.'}</strong>
            <span>
              {resultadoFinal === 'NO_AR'
                ? 'Os plantonistas já veem a escala no App.'
                : 'Abra o Dashboard → Escalas para resolver os ajustes e publicar.'}
            </span>
          </div>
        )}

        <div className="rollback-actions">
          {etapa === 'resumo' || etapa === 'gravando' ? (
            <>
              <button className="secondary-button" type="button" disabled={etapa === 'gravando'} onClick={() => { setPreparo(null); setEtapa('arquivo'); }}>
                Trocar arquivo
              </button>
              {semPendencias ? (
                <button className="primary-button" type="button" disabled={etapa === 'gravando'} onClick={() => void gravar(true)}>
                  {etapa === 'gravando' ? 'Publicando…' : 'Publicar para a equipe'}
                </button>
              ) : (
                <button className="primary-button" type="button" disabled={etapa === 'gravando'} onClick={() => void gravar(false)}>
                  {etapa === 'gravando' ? 'Salvando…' : 'Salvar e ajustar no Dashboard'}
                </button>
              )}
            </>
          ) : (
            <button className="secondary-button" type="button" onClick={onFechar}>{etapa === 'pronto' ? 'Concluir' : 'Cancelar'}</button>
          )}
        </div>
      </section>
    </div>,
    destino,
  );
}
