/**
 * @param { import("knex").Knex } knex
 */
exports.up = function(knex) {
  return knex.schema
    // 1. Tabela ORDEM_SERVICO
    .createTable('ordem_servico', (table) => {
      table.specificType('id_ordem_servico', 'CHAR(36)').primary().notNullable();
      table.specificType('id_unidade', 'CHAR(36)').notNullable();
      table.specificType('id_cliente', 'CHAR(36)').notNullable();
      table.specificType('criado_por', 'CHAR(36)').notNullable();
      
      table.string('contrato_numero', 50).notNullable();
      table.decimal('valor_total_contrato', 15, 2).notNullable();
      table.decimal('valor_previsto_fomento', 15, 2).nullable();
      table.date('data_abertura').notNullable();
      table.enum('status', ['Aberta', 'Em Andamento', 'Concluída', 'Cancelada']).defaultTo('Aberta');

      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
      table.datetime('deleted_at').nullable();

      table.foreign('id_unidade').references('id_unidade').inTable('unidade');
      table.foreign('id_cliente').references('id_cliente').inTable('cliente');
      table.foreign('criado_por').references('id_usuario').inTable('usuario');
    })

    // 2. Tabela ORDEM_SERVICO_ITEM
    .createTable('ordem_servico_item', (table) => {
      table.specificType('id_item', 'CHAR(36)').primary().notNullable();
      table.specificType('id_ordem_servico', 'CHAR(36)').notNullable();
      table.specificType('id_servico', 'CHAR(36)').notNullable();
      table.specificType('id_responsavel_execucao', 'CHAR(36)').notNullable();
      
      table.integer('quantidade').defaultTo(1);
      table.enum('status_item', ['Pendente', 'Em Execução', 'Feito']).defaultTo('Pendente');
      table.integer('prazo_execucao_dias').notNullable();

      table.datetime('data_conclusao').nullable(); 

      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
      table.datetime('deleted_at').nullable();

      table.foreign('id_ordem_servico').references('id_ordem_servico').inTable('ordem_servico').onDelete('CASCADE');
      table.foreign('id_servico').references('id_servico').inTable('servico');
      table.foreign('id_responsavel_execucao').references('id_usuario').inTable('usuario');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('ordem_servico_item')
    .dropTableIfExists('ordem_servico');
};