import { Clock3, GraduationCap, StickyNote, Stethoscope, type LucideIcon } from 'lucide-react';

import type { IconeInformacao } from '@/lib/informacoesDia';

/** INFORMACOES-DIA-1 — o ícone de cada tipo de informação (Dashboard e App usam o mesmo). */
export const ICONE_INFORMACAO: Record<IconeInformacao, LucideIcon> = { relogio: Clock3, atestado: Stethoscope, curso: GraduationCap, nota: StickyNote };
