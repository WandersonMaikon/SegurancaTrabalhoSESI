-- ============================================
-- SISTEMA DE SEGURANÇA DO TRABALHO - V4 (DEFINITIVA)
-- Com UUID (Mobile Ready) + Multi-unidade + Soft Deletes
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
    id_unidade CHAR(36) NOT NULL, -- O VÍNCULO MÁGICO AQUI
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
    
    -- Controle de Auditoria e Sync
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL, -- Soft Delete
    
    FOREIGN KEY (id_unidade) REFERENCES unidade(id_unidade),
    INDEX idx_sync (updated_at) -- Índice para acelerar a sincronização
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE servico (
    id_servico CHAR(36) NOT NULL PRIMARY KEY, -- UUID
    id_unidade CHAR(36), -- NULL = Global, Preenchido = Específico
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
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    FOREIGN KEY (id_ordem_servico) REFERENCES ordem_servico(id_ordem_servico) ON DELETE CASCADE,
    FOREIGN KEY (id_servico) REFERENCES servico(id_servico),
    FOREIGN KEY (id_responsavel_execucao) REFERENCES usuario(id_usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 4. TABELAS GLOBAIS (Estáticas / Pouca mudança)
-- Podem manter ID numérico se quiser, mas UUID padroniza
-- ============================================

CREATE TABLE epi (
    id_epi INT AUTO_INCREMENT PRIMARY KEY, -- Mantive INT pois raramente se cria EPI no mobile offline
    ca VARCHAR(50) NOT NULL UNIQUE,
    nome_equipamento VARCHAR(255) NOT NULL,
    validade_ca DATE,
    ativo BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE epc (
    id_epc INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    observacoes TEXT,
    ativo BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE tabela_24_esocial (
    id_tabela_24 INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(20) NOT NULL UNIQUE,
    grupo VARCHAR(100),
    descricao TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE risco (
    id_risco INT AUTO_INCREMENT PRIMARY KEY,
    id_tabela_24 INT,
    nome_risco VARCHAR(255) NOT NULL,
    tipo_risco VARCHAR(50),
    FOREIGN KEY (id_tabela_24) REFERENCES tabela_24_esocial(id_tabela_24)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 5. LOGS E NOTIFICAÇÕES
-- ============================================

CREATE TABLE log_atividade (
    id_log INT AUTO_INCREMENT PRIMARY KEY, -- Log não precisa de UUID, é só inserção
    id_unidade CHAR(36) NOT NULL,
    id_usuario CHAR(36),
    acao VARCHAR(50) NOT NULL,
    tabela_afetada VARCHAR(50),
    id_registro_afetado CHAR(36), -- Referência ao UUID do registro
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
-- 6. DADOS INICIAIS (Exemplo com UUID)
-- ============================================

-- Nota: No MySQL, você usará a função UUID() para gerar os IDs
-- Exemplo de Insert:
-- INSERT INTO unidade (id_unidade, nome_fantasia, ...) VALUES (UUID(), 'Matriz', ...);