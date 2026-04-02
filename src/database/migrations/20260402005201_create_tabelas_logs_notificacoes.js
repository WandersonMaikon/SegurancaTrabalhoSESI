/**
 * @param { import("knex").Knex } knex
 */
exports.up = function(knex) {
  return knex.schema
    // 1. Tabela LOG ATIVIDADE
    .createTable('log_atividade', (table) => {
      table.increments('id_log').primary();
      table.specificType('id_unidade', 'CHAR(36)').notNullable();
      table.specificType('id_usuario', 'CHAR(36)').nullable();
      
      table.string('acao', 50).notNullable();
      table.string('tabela_afetada', 50);
      table.specificType('id_registro_afetado', 'CHAR(36)');
      
      // O Knex tem suporte nativo para JSON
      table.json('dados_anteriores');
      table.json('dados_novos');
      table.timestamp('data_acao').defaultTo(knex.fn.now());
      
      table.foreign('id_unidade').references('id_unidade').inTable('unidade');
      table.foreign('id_usuario').references('id_usuario').inTable('usuario');
    })

    // 2. Tabela NOTIFICAÇÃO
    .createTable('notificacao', (table) => {
      table.increments('id_notificacao').primary();
      table.specificType('id_usuario_destino', 'CHAR(36)').notNullable();
      
      table.string('titulo', 100);
      table.text('mensagem');
      table.boolean('lida').defaultTo(false);
      table.timestamp('data_criacao').defaultTo(knex.fn.now());
      
      table.foreign('id_usuario_destino').references('id_usuario').inTable('usuario');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('notificacao')
    .dropTableIfExists('log_atividade');
};