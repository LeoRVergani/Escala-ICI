import {
  DIAS_SEMANA,
  NOMES_DIA_SEMANA,
  duracaoMinutosPadraoHorarioPlantaoDia,
  horarioPlantaoValido,
  obterPadraoHorarioParaDia,
  type DiaSemana,
  type PadraoHorarioPlantaoDia,
} from '@escala-ici/contrato';

export interface PadraoHorarioSemanalCampoProps {
  valor: PadraoHorarioPlantaoDia[] | undefined;
  onAlterar: (novo: PadraoHorarioPlantaoDia[] | undefined) => void;
}

/**
 * Resumo legível de uma entrada — nunca expõe `fimDiaOffset` cru ao
 * usuário (§ 23 do pedido). `valida: false` também cobre o caso de campos
 * ainda vazios logo depois de ligar o dia (nunca uma duração calculada a
 * partir de horário incompleto). Exportada (pura, sem React) para ser
 * testável sem depender de renderização de DOM — este projeto não usa
 * uma biblioteca de testes de componente.
 */
export function previewPadraoHorarioPlantaoDia(entrada: PadraoHorarioPlantaoDia): { texto: string; valida: boolean } {
  if (!horarioPlantaoValido(entrada.horaInicio) || !horarioPlantaoValido(entrada.horaFim)) {
    return { texto: 'Informe início e fim (HH:mm).', valida: false };
  }
  const duracaoMinutos = duracaoMinutosPadraoHorarioPlantaoDia(entrada);
  if (duracaoMinutos <= 0) {
    return { texto: 'Duração inválida — o fim precisa ser depois do início (ou marque "dia seguinte").', valida: false };
  }
  const horas = Math.floor(duracaoMinutos / 60);
  const minutosRestantes = duracaoMinutos % 60;
  const rotuloDuracao = minutosRestantes === 0 ? `${horas}h` : `${horas}h${String(minutosRestantes).padStart(2, '0')}`;
  const sufixoDia = entrada.fimDiaOffset === 1 ? ' (+1 dia)' : '';
  return { texto: `${entrada.horaInicio} → ${entrada.horaFim}${sufixoDia} · ${rotuloDuracao}`, valida: true };
}

/**
 * Habilitar um dia sem padrão cria uma entrada vazia (nunca um horário
 * pré-preenchido, nunca inventando um valor "comum" — § 25 do pedido);
 * desabilitar remove a entrada por completo (nunca `ativo: false`
 * guardado à parte). Resultado vazio vira `undefined` — "nenhum padrão
 * configurado" é sempre ausência do campo, nunca `[]` persistido à toa.
 */
export function alternarDiaNoPadraoHorarioSemanal(
  valor: readonly PadraoHorarioPlantaoDia[] | undefined,
  diaSemana: DiaSemana,
): PadraoHorarioPlantaoDia[] | undefined {
  const existente = obterPadraoHorarioParaDia(valor, diaSemana);
  if (existente !== null) {
    const proximos = (valor ?? []).filter((entrada) => entrada.diaSemana !== diaSemana);
    return proximos.length === 0 ? undefined : proximos;
  }
  const nova: PadraoHorarioPlantaoDia = { diaSemana, horaInicio: '', horaFim: '', fimDiaOffset: 0 };
  return [...(valor ?? []), nova];
}

export function atualizarDiaNoPadraoHorarioSemanal(
  valor: readonly PadraoHorarioPlantaoDia[] | undefined,
  diaSemana: DiaSemana,
  alteracoes: Partial<PadraoHorarioPlantaoDia>,
): PadraoHorarioPlantaoDia[] {
  return (valor ?? []).map((entrada) => (entrada.diaSemana === diaSemana ? { ...entrada, ...alteracoes } : entrada));
}

/**
 * Fase PLANTAO-PADRAO-1 — seção "Padrão de horário" de `ModalGrupoPlantao`.
 * Componente de apresentação puro (sem Firebase) — todo o estado vive no
 * `form` do modal (`padraoHorarioSemanal?: PadraoHorarioPlantaoDia[]`),
 * este componente só traduz toggle/edição de campo em `onAlterar(novo)`.
 * Um dia desativado nunca deixa dado residual: desligar remove a entrada
 * do array (nunca `ativo: false` guardado à parte). `onAlterar(undefined)`
 * quando o resultado fica vazio — "nenhum padrão configurado" é sempre
 * ausência do campo, nunca um array vazio persistido à toa.
 */
export function PadraoHorarioSemanalCampo({ valor, onAlterar }: PadraoHorarioSemanalCampoProps) {
  function alternarDia(diaSemana: DiaSemana) {
    onAlterar(alternarDiaNoPadraoHorarioSemanal(valor, diaSemana));
  }

  function atualizarDia(diaSemana: DiaSemana, alteracoes: Partial<PadraoHorarioPlantaoDia>) {
    onAlterar(atualizarDiaNoPadraoHorarioSemanal(valor, diaSemana, alteracoes));
  }

  return (
    <fieldset className="admin-form-full">
      <legend>Padrão de horário</legend>
      <p className="admin-form-preview">
        Defina os horários normalmente usados neste Grupo. Eles poderão ser usados como sugestão ao criar novos plantões.
      </p>
      <ul className="padrao-horario-semanal-lista">
        {DIAS_SEMANA.map((diaSemana) => {
          const entrada = obterPadraoHorarioParaDia(valor, diaSemana);
          const ativo = entrada !== null;
          const preview = entrada !== null ? previewPadraoHorarioPlantaoDia(entrada) : null;
          const idBase = `padrao-horario-dia-${diaSemana}`;
          return (
            <li key={diaSemana} className="padrao-horario-semanal-dia">
              <label className="checkbox-row" htmlFor={`${idBase}-ativo`}>
                <input
                  id={`${idBase}-ativo`}
                  type="checkbox"
                  checked={ativo}
                  onChange={() => alternarDia(diaSemana)}
                />
                <span>{NOMES_DIA_SEMANA[diaSemana]}</span>
              </label>
              {entrada !== null && (
                <div className="padrao-horario-semanal-campos">
                  <label htmlFor={`${idBase}-inicio`}>
                    Início
                    <input
                      id={`${idBase}-inicio`}
                      type="time"
                      aria-label={`${NOMES_DIA_SEMANA[diaSemana]} — horário de início`}
                      value={entrada.horaInicio}
                      onChange={(evento) => atualizarDia(diaSemana, { horaInicio: evento.target.value })}
                    />
                  </label>
                  <label htmlFor={`${idBase}-fim`}>
                    Fim
                    <input
                      id={`${idBase}-fim`}
                      type="time"
                      aria-label={`${NOMES_DIA_SEMANA[diaSemana]} — horário de fim`}
                      value={entrada.horaFim}
                      onChange={(evento) => atualizarDia(diaSemana, { horaFim: evento.target.value })}
                    />
                  </label>
                  <label className="checkbox-row" htmlFor={`${idBase}-offset`}>
                    <input
                      id={`${idBase}-offset`}
                      type="checkbox"
                      checked={entrada.fimDiaOffset === 1}
                      onChange={(evento) => atualizarDia(diaSemana, { fimDiaOffset: evento.target.checked ? 1 : 0 })}
                    />
                    <span>Termina no dia seguinte</span>
                  </label>
                  {preview !== null && (
                    <p className={preview.valida ? 'admin-form-preview' : 'admin-form-erro'}>{preview.texto}</p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
