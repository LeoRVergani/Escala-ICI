import { LembreteFormModal } from '@/components/lembretes/LembreteFormModal';
import { criarLembreteParaEquipeApp, type AlvoLembreteEquipe } from '@/lib/firebase/lembreteEquipeApp';

/**
 * LEMBRETE-EQUIPE-APP-1 — o coordenador cria um lembrete (com aviso no
 * celular) para alguém da equipe 6x1 ou do Plantão. Fala só com o módulo
 * dedicado do App; quem pode criar é decidido pelas Rules.
 */
export type { AlvoLembreteEquipe };

export function CriarLembreteEquipe({
  alvo,
  autor,
  dataInicial,
  onFechar,
  onCriado,
}: {
  alvo: AlvoLembreteEquipe;
  autor: { login: string; nome: string };
  dataInicial: string;
  onFechar: () => void;
  onCriado: (nome: string) => void;
}) {
  return (
    <LembreteFormModal
      modo="criar"
      dataInicial={dataInicial}
      paraQuem={alvo.nome}
      onFechar={onFechar}
      onSalvarUnico={async (entrada) => {
        await criarLembreteParaEquipeApp(alvo, autor, { unico: entrada });
        onCriado(alvo.nome);
      }}
      onSalvarSerie={async (entrada) => {
        await criarLembreteParaEquipeApp(alvo, autor, { serie: entrada });
        onCriado(alvo.nome);
      }}
    />
  );
}
