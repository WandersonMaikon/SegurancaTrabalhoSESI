/**
 * @param { import("knex").Knex } knex
 */
exports.up = function(knex) {
  return knex.schema
    // 1. Tabela PERFIL
    .createTable('perfil', (table) => {
      table.specificType('id_perfil', 'CHAR(36)').primary().notNullable();
      table.string('nome_perfil', 100).notNullable().unique();
      table.text('descricao');
      table.boolean('ativo').defaultTo(true);
    })
    
    // 2. Tabela MÓDULO SISTEMA
    .createTable('modulo_sistema', (table) => {
      table.specificType('id_modulo', 'CHAR(36)').primary().notNullable();
      table.string('nome_modulo', 100).notNullable().unique();
      table.string('chave_sistema', 50).notNullable().unique();
    })
    
    // 3. Tabela PERFIL PERMISSÃO (Liga o Perfil ao Módulo)
    .createTable('perfil_permissao', (table) => {
      table.specificType('id_permissao', 'CHAR(36)').primary().notNullable();
      table.specificType('id_perfil', 'CHAR(36)').notNullable();
      table.specificType('id_modulo', 'CHAR(36)').notNullable();
      
      table.boolean('pode_ver').defaultTo(false);
      table.boolean('pode_criar').defaultTo(false);
      table.boolean('pode_editar').defaultTo(false);
      table.boolean('pode_inativar').defaultTo(false);
      table.boolean('tudo').defaultTo(false);
      
      // Chaves Estrangeiras com CASCADE (se deletar o perfil, deleta as permissões dele)
      table.foreign('id_perfil').references('id_perfil').inTable('perfil').onDelete('CASCADE');
      table.foreign('id_modulo').references('id_modulo').inTable('modulo_sistema').onDelete('CASCADE');
    });
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = function(knex) {
  // O "down" precisa ser na ordem INVERSA da criação por causa das chaves estrangeiras!
  return knex.schema
    .dropTableIfExists('perfil_permissao')
    .dropTableIfExists('modulo_sistema')
    .dropTableIfExists('perfil');
};