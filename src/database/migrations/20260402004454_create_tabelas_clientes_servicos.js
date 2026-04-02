/**
 * @param { import("knex").Knex } knex
 */
exports.up = function(knex) {
  return knex.schema
    // 1. Tabela CLIENTE
    .createTable('cliente', (table) => {
      table.specificType('id_cliente', 'CHAR(36)').primary().notNullable();
      table.specificType('id_unidade', 'CHAR(36)').notNullable();
      
      table.string('nome_empresa', 255).notNullable();
      table.boolean('industria').defaultTo(false);
      table.string('cnpj', 18).notNullable();
      table.string('email', 255);
      table.decimal('cartao_vantagem', 5, 2).defaultTo(0.00);
      table.string('telefone', 20);
      table.integer('num_colaboradores');
      table.string('nome_representante', 255);
      table.string('cpf_mf', 14);
      table.string('rg_ci', 20);
      table.string('cep', 10);
      table.string('logradouro', 255);
      table.string('numero', 10);
      table.string('bairro', 100);
      table.string('cidade', 100);
      table.string('estado', 2);
      table.boolean('ativo').defaultTo(true);

      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
      table.datetime('deleted_at').nullable();

      table.foreign('id_unidade').references('id_unidade').inTable('unidade');
      table.index(['updated_at'], 'idx_sync');
    })

    // 2. Tabela SERVICO
    .createTable('servico', (table) => {
      table.specificType('id_servico', 'CHAR(36)').primary().notNullable();
      table.specificType('id_unidade', 'CHAR(36)').nullable();
      
      table.string('nome_servico', 255).notNullable();
      table.text('descricao');
      table.boolean('ativo').defaultTo(true);

      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
      table.datetime('deleted_at').nullable();

      table.foreign('id_unidade').references('id_unidade').inTable('unidade');
    })

    // 3. Tabela N:N SERVICO_RESPONSAVEL
    .createTable('servico_responsavel', (table) => {
      table.specificType('id_servico', 'CHAR(36)').notNullable();
      table.specificType('id_usuario', 'CHAR(36)').notNullable();
      
      table.primary(['id_servico', 'id_usuario']);
      table.foreign('id_servico').references('id_servico').inTable('servico').onDelete('CASCADE');
      table.foreign('id_usuario').references('id_usuario').inTable('usuario').onDelete('CASCADE');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('servico_responsavel')
    .dropTableIfExists('servico')
    .dropTableIfExists('cliente');
};