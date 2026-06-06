import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// O Coolify ou o ambiente local vai injetar a string de conexão na variável DATABASE_URL
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("AVISO: A variável de ambiente DATABASE_URL não está configurada.");
}

const pool = new Pool({
  connectionString,
  // Se for conectar ao banco de dados externo do Supabase ou similar que necessite SSL
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export async function initDb() {
  if (!connectionString) {
    console.error("Erro: Não é possível inicializar o banco sem DATABASE_URL.");
    return false;
  }

  const client = await pool.connect();
  try {
    console.log("Inicializando tabelas do banco de dados...");

    // Tabela de transacoes
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

    console.log("Banco de dados verificado e pronto para uso.");
    return true;
  } catch (error) {
    console.error("Falha ao inicializar banco de dados:", error);
    throw error;
  } finally {
    client.release();
  }
}

export default pool;
