/**
 * Correção urgente — o Firestore recusa `setDoc()`/`updateDoc()` com qualquer
 * campo `undefined` (mesmo aninhado), gerando "Unsupported field value:
 * undefined". Isso já aconteceu com `usuarios.criadoEm`: cadastros antigos,
 * de antes desse campo existir, chegam ao app como `criadoEm: undefined`
 * (ver `lerUsuario()` em `./shared`) e qualquer ação que regrave o objeto
 * inteiro propaga esse `undefined` de volta para o Firestore.
 *
 * `removerUndefined()` remove só chaves com valor `undefined`, recursivamente
 * em objetos simples e arrays. `null` é preservado (é um valor válido no
 * Firestore, diferente de `undefined`). Qualquer valor que não seja um
 * objeto literal simples — `Date`, `Timestamp`, e sobretudo os sentinels do
 * SDK como `serverTimestamp()`/`arrayUnion()`/`deleteField()` — é devolvido
 * sem alteração: reconstruir esses objetos via `Object.entries()` os
 * transformaria em objetos comuns, e o SDK deixaria de reconhecê-los.
 */

function ehObjetoSimples(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object'
    && valor !== null
    && !Array.isArray(valor)
    && Object.getPrototypeOf(valor) === Object.prototype;
}

export function removerUndefined<T>(valor: T): T {
  if (Array.isArray(valor)) {
    return valor.map((item) => removerUndefined(item)) as T;
  }

  if (ehObjetoSimples(valor)) {
    const resultado: Record<string, unknown> = {};
    for (const [chave, item] of Object.entries(valor)) {
      if (item !== undefined) {
        resultado[chave] = removerUndefined(item);
      }
    }
    return resultado as T;
  }

  return valor;
}
