/**
 * @param { import("knex").Knex } knex
 */
exports.up = function(knex) {
  return knex.schema.createTable('usuario', (table) => {
    table.specificType('id_usuario', 'CHAR(36)').primary().notNullable();
    
    // Chaves Estrangeiras
    table.specificType('id_unidade', 'CHAR(36)').notNullable();
    table.specificType('id_perfil', 'CHAR(36)').notNullable();
    
    // Dados Cadastrais
    table.string('nome_completo', 255).notNullable();
    table.string('cpf', 14);
    table.string('email', 255).notNullable().unique();
    table.string('telefone', 20);
    table.date('data_nascimento');
    table.string('senha_hash', 255).notNullable();
    
    // Flags
    table.boolean('ativo').defaultTo(true);
    table.boolean('primeiro_acesso').defaultTo(true);
    
    // Controle de Auditoria e Sync
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
    table.datetime('deleted_at').nullable(); // Soft Delete (permite nulo)
    
    // Amarrações
    table.foreign('id_unidade').references('id_unidade').inTable('unidade');
    table.foreign('id_perfil').references('id_perfil').inTable('perfil');
  });
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('usuario');
};