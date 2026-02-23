-- ============================================
-- SISTEMA DE SEGURANÇA DO TRABALHO - V4.5
-- Com UUID (Mobile Ready) + Multi-unidade + Soft Deletes
-- Atualizações: Cartão Vantagem, Prazo OS, e Estrutura Relacional de Riscos (eSocial)
-- ============================================

CREATE DATABASE IF NOT EXISTS seguranca_trabalho;
USE seguranca_trabalho;

-- ============================================
-- 1. ESTRUTURA ORGANIZACIONAL
-- ============================================

CREATE TABLE unidade (
    id_unidade CHAR(36) NOT NULL PRIMARY KEY, -- UUID
    nome_fantasia VARCHAR(255) NOT NULL,
    razao_social VARCHAR(255),
    cnpj VARCHAR(18) NOT NULL UNIQUE,
    cidade VARCHAR(100),
    estado VARCHAR(2),
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 2. ACESSO E PERMISSÕES
-- ============================================

CREATE TABLE perfil (
    id_perfil CHAR(36) NOT NULL PRIMARY KEY, -- UUID
    nome_perfil VARCHAR(100) NOT NULL UNIQUE,
    descricao TEXT,
    ativo BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE modulo_sistema (
    id_modulo CHAR(36) NOT NULL PRIMARY KEY, -- UUID
    nome_modulo VARCHAR(100) NOT NULL UNIQUE,
    chave_sistema VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE perfil_permissao (
    id_permissao CHAR(36) NOT NULL PRIMARY KEY, -- UUID
    id_perfil CHAR(36) NOT NULL,
    id_modulo CHAR(36) NOT NULL,
    pode_ver BOOLEAN DEFAULT FALSE,
    pode_criar BOOLEAN DEFAULT FALSE,
    pode_editar BOOLEAN DEFAULT FALSE,
    pode_inativar BOOLEAN DEFAULT FALSE,
    tudo BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (id_perfil) REFERENCES perfil(id_perfil) ON DELETE CASCADE,
    FOREIGN KEY (id_modulo) REFERENCES modulo_sistema(id_modulo) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE usuario (
    id_usuario CHAR(36) NOT NULL PRIMARY KEY, -- UUID
    id_unidade CHAR(36) NOT NULL,
    nome_completo VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    id_perfil CHAR(36) NOT NULL,
    ativo BOOLEAN DEFAULT TRUE,
    
    -- Controle de Auditoria e Sync
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL, -- Soft Delete
    
    FOREIGN KEY (id_unidade) REFERENCES unidade(id_unidade),
    FOREIGN KEY (id_perfil) REFERENCES perfil(id_perfil)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 3. TABELAS DE NEGÓCIO (Sincronizáveis com Mobile)
-- ============================================

CREATE TABLE cliente (
    id_cliente CHAR(36) NOT NULL PRIMARY KEY, -- UUID
    id_unidade CHAR(36) NOT NULL,
    nome_empresa VARCHAR(255) NOT NULL,
    industria BOOLEAN NOT NULL DEFAULT FALSE,
    cnpj VARCHAR(18) NOT NULL,
    email VARCHAR(255),
    cartao_vantagem DECIMAL(5, 2) DEFAULT 0.00, -- Ex: 10.50 para 10,5%
    telefone VARCHAR(20),
    num_colaboradores INT,
    nome_representante VARCHAR(255),
    cpf_mf VARCHAR(14),
    rg_ci VARCHAR(20),
    cep VARCHAR(10),
    logradouro VARCHAR(255),
    numero VARCHAR(10),
    bairro VARCHAR(100),
    cidade VARCHAR(100),
    estado VARCHAR(2),
    ativo BOOLEAN DEFAULT TRUE,
    -- Controle de Auditoria e Sync
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL, -- Soft Delete
    
    FOREIGN KEY (id_unidade) REFERENCES unidade(id_unidade),
    INDEX idx_sync (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE servico (
    id_servico CHAR(36) NOT NULL PRIMARY KEY, -- UUID
    id_unidade CHAR(36),
    nome_servico VARCHAR(255) NOT NULL,
    descricao TEXT,
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    FOREIGN KEY (id_unidade) REFERENCES unidade(id_unidade)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE servico_responsavel (
    id_servico CHAR(36) NOT NULL,
    id_usuario CHAR(36) NOT NULL,
    PRIMARY KEY (id_servico, id_usuario),
    FOREIGN KEY (id_servico) REFERENCES servico(id_servico) ON DELETE CASCADE,
    FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE ordem_servico (
    id_ordem_servico CHAR(36) NOT NULL PRIMARY KEY, -- UUID
    id_unidade CHAR(36) NOT NULL,
    contrato_numero VARCHAR(50) NOT NULL,
    id_cliente CHAR(36) NOT NULL,
    valor_total_contrato DECIMAL(15, 2) NOT NULL,
    valor_previsto_fomento DECIMAL(15, 2) NULL,
    data_abertura DATE NOT NULL,
    status ENUM('Aberta', 'Em Andamento', 'Concluída', 'Cancelada') DEFAULT 'Aberta',
    criado_por CHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    FOREIGN KEY (id_unidade) REFERENCES unidade(id_unidade),
    FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente),
    FOREIGN KEY (criado_por) REFERENCES usuario(id_usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE ordem_servico_item (
    id_item CHAR(36) NOT NULL PRIMARY KEY, -- UUID
    id_ordem_servico CHAR(36) NOT NULL,
    id_servico CHAR(36) NOT NULL,
    id_responsavel_execucao CHAR(36) NOT NULL,
    quantidade INT DEFAULT 1,
    status_item ENUM('Pendente', 'Em Execução', 'Feito') DEFAULT 'Pendente',
    prazo_execucao_dias INT NOT NULL, 
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    FOREIGN KEY (id_ordem_servico) REFERENCES ordem_servico(id_ordem_servico) ON DELETE CASCADE,
    FOREIGN KEY (id_servico) REFERENCES servico(id_servico),
    FOREIGN KEY (id_responsavel_execucao) REFERENCES usuario(id_usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 4. TABELAS GLOBAIS
-- ============================================

CREATE TABLE epi (
    id_epi INT AUTO_INCREMENT PRIMARY KEY,
    id_unidade CHAR(36) NULL, -- NULL = Global, Preenchido = Exclusivo da Unidade
    ca VARCHAR(50) NOT NULL, 
    nome_equipamento VARCHAR(255) NOT NULL,
    validade_ca DATE,
    ativo BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (id_unidade) REFERENCES unidade(id_unidade)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE epc (
    id_epc INT AUTO_INCREMENT PRIMARY KEY,
    id_unidade CHAR(36) NULL, 
    nome VARCHAR(255) NOT NULL,
    observacoes TEXT,
    ativo BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (id_unidade) REFERENCES unidade(id_unidade)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE tabela_24_esocial (
    id_tabela_24 INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(20),
    grupo VARCHAR(100),
    descricao TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE risco (
    id_risco INT AUTO_INCREMENT PRIMARY KEY,
    id_unidade CHAR(36) NULL, -- Híbrido: Se NULL, todos veem. Se preenchido, é customizado.
    id_tabela_24 INT,
    codigo_interno VARCHAR(50), -- NOVO: Guarda o código original da planilha (Ex: '686', '774')
    nome_risco VARCHAR(255) NOT NULL,
    tipo_risco VARCHAR(50),
    deleted_at DATETIME DEFAULT NULL,
    FOREIGN KEY (id_unidade) REFERENCES unidade(id_unidade),
    FOREIGN KEY (id_tabela_24) REFERENCES tabela_24_esocial(id_tabela_24)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 5. LOGS E NOTIFICAÇÕES
-- ============================================

CREATE TABLE log_atividade (
    id_log INT AUTO_INCREMENT PRIMARY KEY,
    id_unidade CHAR(36) NOT NULL,
    id_usuario CHAR(36),
    acao VARCHAR(50) NOT NULL,
    tabela_afetada VARCHAR(50),
    id_registro_afetado CHAR(36),
    dados_anteriores JSON,
    dados_novos JSON,
    data_acao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_unidade) REFERENCES unidade(id_unidade),
    FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE notificacao (
    id_notificacao INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario_destino CHAR(36) NOT NULL,
    titulo VARCHAR(100),
    mensagem TEXT,
    lida BOOLEAN DEFAULT FALSE,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_usuario_destino) REFERENCES usuario(id_usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 6. MÓDULO LEVANTAMENTO DE PERIGOS
-- ============================================

-- Tabela Principal (Cabeçalho + Caracterização do Ambiente)
CREATE TABLE levantamento_perigo (
    id_levantamento CHAR(36) NOT NULL PRIMARY KEY, -- UUID
    id_unidade CHAR(36) NOT NULL,
    id_cliente CHAR(36) NOT NULL,
    
    -- Cabeçalho
    data_levantamento DATE NOT NULL,
    id_responsavel_tecnico CHAR(36) NOT NULL, -- Vínculo com usuário (avaliador)
    responsavel_empresa_nome VARCHAR(255), -- Nome avulso
    trabalho_externo BOOLEAN DEFAULT FALSE,
    
    -- Caracterização do Ambiente (Arquitetura)
    tipo_construcao JSON, 
    tipo_piso JSON,
    tipo_paredes JSON,
    tipo_cobertura JSON,
    tipo_iluminacao JSON,
    tipo_ventilacao JSON,
    possui_climatizacao BOOLEAN,
    
    -- Estruturas Auxiliares (Checkboxes)
    estruturas_auxiliares JSON, 
    
    -- Dimensões e Observações Gerais
    area_m2 DECIMAL(10,2),
    pe_direito_m DECIMAL(10,2),
    largura_m DECIMAL(10,2),
    comprimento_m DECIMAL(10,2),
    obs_condicoes_gerais TEXT,
    
    -- Assinaturas (Armazenar Base64 ou Caminho do Arquivo)
    assinatura_responsavel_empresa LONGTEXT,
    assinatura_avaliador LONGTEXT,

    -- Flags de Controle de Risco
    ausencia_risco_ambiental BOOLEAN DEFAULT FALSE,
    ausencia_risco_ergonomico BOOLEAN DEFAULT FALSE,
    ausencia_risco_mecanico BOOLEAN DEFAULT FALSE,
    
    -- Auditoria
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    FOREIGN KEY (id_unidade) REFERENCES unidade(id_unidade),
    FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente),
    FOREIGN KEY (id_responsavel_tecnico) REFERENCES usuario(id_usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabela Filha: Grupos de Exposição Similar (GES)
CREATE TABLE levantamento_ges (
    id_ges CHAR(36) NOT NULL PRIMARY KEY, -- UUID
    id_levantamento CHAR(36) NOT NULL,   
    nome_grupo_ges VARCHAR(255),
    setor VARCHAR(255),
    cargos TEXT,
    nome_trabalhador_excecao VARCHAR(255),
    observacoes TEXT,
    
    FOREIGN KEY (id_levantamento) REFERENCES levantamento_perigo(id_levantamento) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabela Filha: Inventário de Produtos Químicos
CREATE TABLE levantamento_quimico (
    id_quimico CHAR(36) NOT NULL PRIMARY KEY, -- UUID
    id_levantamento CHAR(36) NOT NULL, 
    nome_rotulo VARCHAR(255),
    estado_fisico ENUM('Sólido', 'Líquido', 'Gasoso'),
    tipo_exposicao VARCHAR(255),
    processo_quantidade VARCHAR(255),
    observacoes TEXT,
    
    FOREIGN KEY (id_levantamento) REFERENCES levantamento_perigo(id_levantamento) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabela Filha: Detalhamento dos Perigos Identificados
CREATE TABLE levantamento_risco_identificado (
    id_risco_identificado CHAR(36) NOT NULL PRIMARY KEY, -- UUID
    id_levantamento CHAR(36) NOT NULL,
    id_risco INT, -- NOVO: Chave estrangeira ligando ao cadastro matriz de riscos
    
    -- Classificação (Mantidos para histórico de laudo)
    grupo_perigo VARCHAR(50), 
    codigo_perigo VARCHAR(20), 
    descricao_perigo VARCHAR(255),
    
    -- Detalhamento (Tabela final do PDF)
    fontes_geradoras TEXT,
    tipo_tempo_exposicao VARCHAR(255),
    anexo_imagem VARCHAR(255) NULL,
    observacoes TEXT,
    
    FOREIGN KEY (id_levantamento) REFERENCES levantamento_perigo(id_levantamento) ON DELETE CASCADE,
    FOREIGN KEY (id_risco) REFERENCES risco(id_risco) -- NOVO: Trava relacional
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabelas de Ligação N:N para EPIs e EPCs nos Riscos
CREATE TABLE levantamento_risco_has_epi (
    id_risco_identificado CHAR(36) NOT NULL,
    id_epi INT NOT NULL,
    PRIMARY KEY (id_risco_identificado, id_epi),
    FOREIGN KEY (id_risco_identificado) REFERENCES levantamento_risco_identificado(id_risco_identificado) ON DELETE CASCADE,
    FOREIGN KEY (id_epi) REFERENCES epi(id_epi)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE levantamento_risco_has_epc (
    id_risco_identificado CHAR(36) NOT NULL,
    id_epc INT NOT NULL,
    PRIMARY KEY (id_risco_identificado, id_epc),
    FOREIGN KEY (id_risco_identificado) REFERENCES levantamento_risco_identificado(id_risco_identificado) ON DELETE CASCADE,
    FOREIGN KEY (id_epc) REFERENCES epc(id_epc)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;