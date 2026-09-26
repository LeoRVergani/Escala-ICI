import { competenciaOperacional, dataIsoLocal } from '@escala-ici/contrato';

/**
 * HOTFIX-COMPETENCIA-OPERACIONAL-DINAMICA-1 — fonte única de "competência
 * operacional atual" para o Dashboard (o App/PWA já resolve isso inline via
 * `competenciaOperacional(dataIsoLocal(...))`, ver `EmployeeApp.tsx`).
 *
 * Nunca reimplementa a regra 26→25 (isso é `competenciaOperacional()`, em
 * `packages/contrato/src/jornada.ts`) nem decide o dia local por conta
 * própria (isso é `dataIsoLocal()`, mesmo módulo — evita o bug de UTC virar
 * o dia um instante antes/depois do horário local do Brasil).
 *
 * Deve ser avaliada em runtime (nunca congelada em uma constante de módulo
 * calculada no momento do import/build), por isso é sempre função — cada
 * chamador decide quando reavaliar (mount do componente, restauração de
 * sessão, etc.), e o parâmetro `data` permite teste determinístico sem
 * mockar `Date` globalmente.
 */
export function competenciaOperacionalAtual(data: Date = new Date()): string {
  return competenciaOperacional(dataIsoLocal(data));
}
