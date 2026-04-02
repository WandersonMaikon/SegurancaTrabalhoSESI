/**
 * @param { import("knex").Knex } knex
 */
exports.up = function(knex) {
  return knex.schema
    // 1. Tabela Principal (Cabeçalho)
    .createTable('levantamento_perigo', (table) => {
      table.specificType('id_levantamento', 'CHAR(36)').primary().notNullable();
      table.specificType('id_unidade', 'CHAR(36)').notNullable();
      table.specificType('id_cliente', 'CHAR(36)').notNullable();
      
      table.date('data_levantamento').notNullable();
      table.specificType('id_responsavel_tecnico', 'CHAR(36)').notNullable();
      table.string('responsavel_empresa_nome', 255);
      table.string('responsavel_empresa_cargo', 255);
      table.boolean('trabalho_externo').defaultTo(false);
      
      // JSONs para Caracterização do Ambiente
      table.json('tipo_construcao');
      table.json('tipo_piso');
      table.json('divisoes_internas_material');
      table.json('tipo_paredes');
      table.json('tipo_cobertura');
      table.json('tipo_forro');
      table.json('tipo_iluminacao');
      table.string('cor_paredes', 100);
      table.json('tipo_ventilacao');
      table.json('escadas_tipo');
      table.boolean('possui_climatizacao');
      table.json('passarelas_tipo');
      table.json('estruturas_auxiliares');
      
      // Dimensões e Obs
      table.decimal('area_m2', 10, 2);
      table.decimal('pe_direito_m', 10, 2);
      table.decimal('largura_m', 10, 2);
      table.decimal('comprimento_m', 10, 2);
      table.text('obs_condicoes_gerais');
      table.string('nome_grupo_ges', 255);
      
      // Assinaturas em Base64 (LONGTEXT)
      table.text('assinatura_responsavel_empresa', 'longtext');
      table.text('assinatura_avaliador', 'longtext');

      // Flags de Risco
      table.boolean('ausencia_risco_ambiental').defaultTo(false);
      table.boolean('ausencia_risco_ergonomico').defaultTo(false);
      table.boolean('ausencia_risco_mecanico').defaultTo(false);
      table.boolean('ausencia_risco_quimico').defaultTo(false);
      table.boolean('ausencia_risco_biologico').defaultTo(false);

      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
      table.datetime('deleted_at').nullable();
      
      table.foreign('id_unidade').references('id_unidade').inTable('unidade');
      table.foreign('id_cliente').references('id_cliente').inTable('cliente');
      table.foreign('id_responsavel_tecnico').references('id_usuario').inTable('usuario');
    })

    // 2. Tabela Filha: GES
    .createTable('levantamento_ges', (table) => {
      table.specificType('id_ges', 'CHAR(36)').primary().notNullable();
      table.specificType('id_levantamento', 'CHAR(36)').notNullable();
      table.string('setor', 255);
      table.text('cargos');
      table.string('nome_trabalhador_excecao', 255);
      table.text('observacoes');
      
      table.foreign('id_levantamento').references('id_levantamento').inTable('levantamento_perigo').onDelete('CASCADE');
    })

    // 3. Tabela Filha: Produtos Químicos
    .createTable('levantamento_quimico', (table) => {
      table.specificType('id_quimico', 'CHAR(36)').primary().notNullable();
      table.specificType('id_levantamento', 'CHAR(36)').notNullable();
      table.string('nome_rotulo', 255);
      table.enum('estado_fisico', ['Sólido', 'Líquido', 'Gasoso']);
      table.string('tipo_exposicao', 255);
      table.string('processo_quantidade', 255);
      table.text('observacoes');
      
      table.foreign('id_levantamento').references('id_levantamento').inTable('levantamento_perigo').onDelete('CASCADE');
    })

    // 4. Tabela Filha: Detalhamento de Riscos Identificados
    .createTable('levantamento_risco_identificado', (table) => {
      table.specificType('id_risco_identificado', 'CHAR(36)').primary().notNullable();
      table.specificType('id_levantamento', 'CHAR(36)').notNullable();
      table.integer('id_risco').unsigned().nullable(); // Ligação com a matriz global
      
      table.string('grupo_perigo', 50);
      table.string('codigo_perigo', 20);
      table.string('descricao_perigo', 255);
      table.text('fontes_geradoras');
      table.string('tipo_tempo_exposicao', 255);
      table.string('anexo_imagem', 255).nullable();
      table.text('observacoes');
      
      table.foreign('id_levantamento').references('id_levantamento').inTable('levantamento_perigo').onDelete('CASCADE');
      table.foreign('id_risco').references('id_risco').inTable('risco');
    })

    // 5. N:N EPIs do Risco
    .createTable('levantamento_risco_has_epi', (table) => {
      table.specificType('id_risco_identificado', 'CHAR(36)').notNullable();
      table.integer('id_epi').unsigned().notNullable();
      
      table.primary(['id_risco_identificado', 'id_epi']);
      table.foreign('id_risco_identificado').references('id_risco_identificado').inTable('levantamento_risco_identificado').onDelete('CASCADE');
      table.foreign('id_epi').references('id_epi').inTable('epi');
    })

    // 6. N:N EPCs do Risco
    .createTable('levantamento_risco_has_epc', (table) => {
      table.specificType('id_risco_identificado', 'CHAR(36)').notNullable();
      table.integer('id_epc').unsigned().notNullable();
      
      table.primary(['id_risco_identificado', 'id_epc']);
      table.foreign('id_risco_identificado').references('id_risco_identificado').inTable('levantamento_risco_identificado').onDelete('CASCADE');
      table.foreign('id_epc').references('id_epc').inTable('epc');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('levantamento_risco_has_epc')
    .dropTableIfExists('levantamento_risco_has_epi')
    .dropTableIfExists('levantamento_risco_identificado')
    .dropTableIfExists('levantamento_quimico')
    .dropTableIfExists('levantamento_ges')
    .dropTableIfExists('levantamento_perigo');
};