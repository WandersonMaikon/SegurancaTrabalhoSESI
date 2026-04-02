/**
 * @param { import("knex").Knex } knex
 */
exports.up = function(knex) {
  return knex.schema.createTable('unidade', (table) => {
    // Cria a coluna id_unidade como CHAR(36) e Chave Primária
    table.specificType('id_unidade', 'CHAR(36)').primary().notNullable();
    
    table.string('nome_fantasia', 255).notNullable();
    table.string('razao_social', 255);
    table.string('cnpj', 18).notNullable().unique();
    table.string('cidade', 100);
    table.string('estado', 2);
    table.boolean('ativo').defaultTo(true);
    
    // Controle de Auditoria (created_at e updated_at)
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
  });
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = function(knex) {
  // Se precisarmos desfazer, ele dropa a tabela
  return knex.schema.dropTable('unidade');
};