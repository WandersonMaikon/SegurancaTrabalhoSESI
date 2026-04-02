/**
 * @param { import("knex").Knex } knex
 */
exports.up = function(knex) {
  return knex.schema.createTable('checklist_job_stress', (table) => {
    table.specificType('id_checklist', 'CHAR(36)').primary().notNullable();
    table.specificType('id_unidade', 'CHAR(36)').notNullable();
    table.specificType('id_cliente', 'CHAR(36)').notNullable();
    table.specificType('id_responsavel', 'CHAR(36)').notNullable();
    
    table.date('data_aplicacao').notNullable();
    table.string('setor_cargo', 255);
    
    table.json('respostas').notNullable();
    table.enum('status_sessao', ['Em Andamento', 'Concluido']).defaultTo('Em Andamento');
    
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
    table.datetime('deleted_at').nullable();
    
    table.foreign('id_unidade').references('id_unidade').inTable('unidade');
    table.foreign('id_cliente').references('id_cliente').inTable('cliente');
    table.foreign('id_responsavel').references('id_usuario').inTable('usuario');
  });
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('checklist_job_stress');
};