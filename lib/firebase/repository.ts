/**
 * Camada de compatibilidade do host legado.
 *
 * Os SPAs independentes importam explicitamente os repositórios de leitura,
 * escrita e autenticação para que o app do colaborador não possa incorporar
 * operações administrativas por engano.
 */
export * from './authRepository';
export * from './readRepository';
export * from './writeRepository';
