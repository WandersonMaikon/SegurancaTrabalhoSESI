/**
 * @param { import("knex").Knex } knex
 */
exports.up = function(knex) {
  return knex.schema
    // 1. Tabela EPI
    .createTable('epi', (table) => {
      table.increments('id_epi').primary(); // INT AUTO_INCREMENT
      table.specificType('id_unidade', 'CHAR(36)').nullable(); // Pode ser global (null) ou exclusivo
      
      table.string('ca', 50).notNullable();
      table.string('nome_equipamento', 255).notNullable();
      table.date('validade_ca');
      table.boolean('ativo').defaultTo(true);
      
      table.foreign('id_unidade').references('id_unidade').inTable('unidade');
    })

    // 2. Tabela EPC
    .createTable('epc', (table) => {
      table.increments('id_epc').primary();
      table.specificType('id_unidade', 'CHAR(36)').nullable();
      
      table.string('nome', 255).notNullable();
      table.text('observacoes');
      table.boolean('ativo').defaultTo(true);
      
      table.foreign('id_unidade').references('id_unidade').inTable('unidade');
    })

    // 3. Tabela 24 eSocial
    .createTable('tabela_24_esocial', (table) => {
      table.increments('id_tabela_24').primary();
      table.string('codigo', 20);
      table.string('grupo', 100);
      table.text('descricao').notNullable();
    })

    // 4. Tabela RISCO
    .createTable('risco', (table) => {
      table.increments('id_risco').primary();
      table.specificType('id_unidade', 'CHAR(36)').nullable();
      table.integer('id_tabela_24').unsigned().nullable(); // Unsigned é necessário para FK de increments
      
      table.string('codigo_interno', 50);
      table.string('nome_risco', 255).notNullable();
      table.string('tipo_risco', 50);
      table.datetime('deleted_at').nullable();
      
      table.foreign('id_unidade').references('id_unidade').inTable('unidade');
      table.foreign('id_tabela_24').references('id_tabela_24').inTable('tabela_24_esocial');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('risco')
    .dropTableIfExists('tabela_24_esocial')
    .dropTableIfExists('epc')
    .dropTableIfExists('epi');
};