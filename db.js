import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// O Coolify ou o ambiente local vai injetar a string de conexão na variável DATABASE_URL
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("AVISO: A variável de ambiente DATABASE_URL não está configurada.");
}

let isLocal = !connectionString;
let sslDisabled = false;

if (connectionString) {
  if (connectionString.includes('sslmode=disable') || connectionString.includes('ssl=false')) {
    sslDisabled = true;
  }
  try {
    // Replace postgresql:// with http:// to ensure standard URL parser works flawlessly
    const url = new URL(connectionString.replace('postgresql://', 'http://').replace('postgres://', 'http://'));
    const host = url.hostname;
    isLocal = host === 'localhost' || 
              host === '127.0.0.1' || 
              !host.includes('.') || // Docker service names like 'db' or 'postgres' don't have dots
              host.startsWith('172.') || 
              host.startsWith('10.') || 
              host.startsWith('192.168.');
  } catch (e) {
    isLocal = connectionString.includes('localhost') || 
              connectionString.includes('127.0.0.1') || 
              connectionString.includes('@db:') || 
              connectionString.includes('@postgres:');
  }
}

const useSsl = process.env.NODE_ENV === 'production' && !isLocal && !sslDisabled && process.env.DB_SSL !== 'false';

console.log(`[Banco de Dados] Conexão: ${connectionString ? 'Configurada' : 'NÃO configurada (usando padrões)'}`);
console.log(`[Banco de Dados] Host local detectado: ${isLocal}`);
console.log(`[Banco de Dados] SSL desativado explicitamente: ${sslDisabled}`);
console.log(`[Banco de Dados] SSL Ativo: ${useSsl}`);

const pool = new Pool({
  connectionString,
  ssl: useSsl ? { rejectUnauthorized: false } : false
});

// Cache de pools para os bancos de dados dos tenants
const tenantPools = new Map();

export function getTenantPool(dbName) {
  if (tenantPools.has(dbName)) {
    return tenantPools.get(dbName);
  }

  let tenantConnectionString = connectionString;
  try {
    const url = new URL(connectionString);
    url.pathname = `/${dbName}`;
    tenantConnectionString = url.toString();
  } catch (e) {
    const qIndex = connectionString.indexOf('?');
    let base = qIndex !== -1 ? connectionString.substring(0, qIndex) : connectionString;
    const lastSlash = base.lastIndexOf('/');
    if (lastSlash !== -1) {
      const prefix = base.substring(0, lastSlash + 1);
      const suffix = qIndex !== -1 ? connectionString.substring(qIndex) : '';
      tenantConnectionString = prefix + dbName + suffix;
    }
  }

  const tenantPool = new Pool({
    connectionString: tenantConnectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : false
  });

  tenantPools.set(dbName, tenantPool);
  return tenantPool;
}

export async function initDb() {
  if (!connectionString) {
    console.error("Erro: Não é possível inicializar o banco sem DATABASE_URL.");
    return false;
  }

  const client = await pool.connect();
  try {
    console.log("Inicializando tabelas globais do banco de dados (Master)...");

    // Tabela de usuarios
    await client.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        salt VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);

    // Tabela de sessoes
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessoes (
        token VARCHAR(255) PRIMARY KEY,
        usuario_id INT REFERENCES usuarios(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);

    // Adicionar colunas parent_user_id e db_name à tabela usuarios para multi-tenancy
    await client.query(`
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS parent_user_id INT REFERENCES usuarios(id) ON DELETE CASCADE;
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS db_name VARCHAR(100);
    `);

    // Também inicializamos as tabelas transações/forecast/cartões na master apenas para compatibilidade
    await client.query(`
      CREATE TABLE IF NOT EXISTS transacoes (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        data DATE NOT NULL,
        descricao TEXT NOT NULL,
        categoria TEXT NOT NULL,
        valor NUMERIC(12, 2) NOT NULL,
        tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('Entrada', 'Saída')),
        recorrencia VARCHAR(10) NOT NULL CHECK (recorrencia IN ('Única', 'Mensal', 'Anual'))
      );
    `);

    // Tabela de forecast_events (eventos planejados para a previsão)
    await client.query(`
      CREATE TABLE IF NOT EXISTS forecast_events (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        description TEXT NOT NULL,
        amount NUMERIC(12, 2) NOT NULL,
        type VARCHAR(10) NOT NULL CHECK (type IN ('Entrada', 'Saída')),
        date VARCHAR(7) NOT NULL
      );
    `);

    // Tabela de cartoes de credito
    await client.query(`
      CREATE TABLE IF NOT EXISTS cartoes (
        id SERIAL PRIMARY KEY,
        usuario_id INT NOT NULL,
        nome VARCHAR(100) NOT NULL,
        vencimento INT NOT NULL CHECK (vencimento >= 1 AND vencimento <= 31),
        fechamento INT NOT NULL CHECK (fechamento >= 1 AND fechamento <= 31),
        banco VARCHAR(50) NOT NULL,
        cor_personalizada VARCHAR(7),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);

    // Adicionar coluna usuario_id para isolamento de dados
    await client.query(`
      ALTER TABLE transacoes ADD COLUMN IF NOT EXISTS usuario_id INT REFERENCES usuarios(id) ON DELETE CASCADE;
      ALTER TABLE forecast_events ADD COLUMN IF NOT EXISTS usuario_id INT REFERENCES usuarios(id) ON DELETE CASCADE;
      ALTER TABLE transacoes ADD COLUMN IF NOT EXISTS metodo_pagamento VARCHAR(10);
      ALTER TABLE transacoes ADD COLUMN IF NOT EXISTS cartao_id INT REFERENCES cartoes(id) ON DELETE SET NULL;
    `);

    // Atualizar restrição check para aceitar 'Parcelado'
    try {
      await client.query(`
        ALTER TABLE transacoes DROP CONSTRAINT IF EXISTS transacoes_recorrencia_check;
        ALTER TABLE transacoes ADD CONSTRAINT transacoes_recorrencia_check CHECK (recorrencia IN ('Única', 'Mensal', 'Anual', 'Parcelado'));
      `);
    } catch (err) {
      console.warn("Aviso ao atualizar restrição de recorrência:", err.message);
    }

    console.log("Banco de dados master verificado e pronto para uso.");
    return true;
  } catch (error) {
    console.error("Falha ao inicializar banco de dados master:", error);
    throw error;
  } finally {
    client.release();
  }
}

export async function initTenantDb(dbName) {
  const tenantPool = getTenantPool(dbName);
  const client = await tenantPool.connect();
  try {
    console.log(`Inicializando tabelas no banco de dados do tenant: ${dbName}...`);
    
    // Tabela de cartoes do tenant
    await client.query(`
      CREATE TABLE IF NOT EXISTS cartoes (
        id SERIAL PRIMARY KEY,
        usuario_id INT NOT NULL,
        nome VARCHAR(100) NOT NULL,
        vencimento INT NOT NULL CHECK (vencimento >= 1 AND vencimento <= 31),
        fechamento INT NOT NULL CHECK (fechamento >= 1 AND fechamento <= 31),
        banco VARCHAR(50) NOT NULL,
        cor_personalizada VARCHAR(7),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);

    // Tabela de transacoes do tenant
    await client.query(`
      CREATE TABLE IF NOT EXISTS transacoes (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        data DATE NOT NULL,
        descricao TEXT NOT NULL,
        categoria TEXT NOT NULL,
        valor NUMERIC(12, 2) NOT NULL,
        tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('Entrada', 'Saída')),
        recorrencia VARCHAR(10) NOT NULL CHECK (recorrencia IN ('Única', 'Mensal', 'Anual', 'Parcelado')),
        usuario_id INT NOT NULL,
        metodo_pagamento VARCHAR(10),
        cartao_id INT REFERENCES cartoes(id) ON DELETE SET NULL
      );
    `);

    // Tabela de forecast_events do tenant
    await client.query(`
      CREATE TABLE IF NOT EXISTS forecast_events (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        description TEXT NOT NULL,
        amount NUMERIC(12, 2) NOT NULL,
        type VARCHAR(10) NOT NULL CHECK (type IN ('Entrada', 'Saída')),
        date VARCHAR(7) NOT NULL,
        usuario_id INT NOT NULL
      );
    `);

    console.log(`Banco de dados do tenant ${dbName} inicializado com sucesso.`);
    return true;
  } catch (error) {
    console.error(`Erro ao inicializar banco de dados do tenant ${dbName}:`, error);
    throw error;
  } finally {
    client.release();
  }
}

export default pool;
