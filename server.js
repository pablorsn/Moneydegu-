import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pool, { initDb } from './db.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware para JSON e dados de formulário
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rota de status do banco de dados (usada na aba de Configurações do frontend)
app.get('/api/db-status', async (req, res) => {
  try {
    const result = await pool.query('SELECT 1');
    if (result.rowCount > 0) {
      return res.json({ status: 'connected', message: 'Conectado com sucesso ao PostgreSQL local!' });
    }
    throw new Error('Nenhum resultado retornado do banco.');
  } catch (error) {
    console.error("Erro no status do banco:", error);
    return res.status(500).json({ status: 'disconnected', error: error.message });
  }
});

// --- API ROTAS PARA TRANSAÇÕES ---

// 1. Listar todas as transações
app.get('/api/transactions', async (req, res) => {
  try {
    const query = `
      SELECT 
        id, 
        to_char(data, 'YYYY-MM-DD') as data, 
        descricao, 
        categoria, 
        valor, 
        tipo, 
        recorrencia 
      FROM transacoes 
      ORDER BY data DESC, id DESC
    `;
    const { rows } = await pool.query(query);
    return res.json(rows);
  } catch (error) {
    console.error("Erro ao listar transações:", error);
    return res.status(500).json({ error: 'Erro ao buscar transações no banco de dados.' });
  }
});

// 2. Criar uma nova transação
app.post('/api/transactions', async (req, res) => {
  const { data, descricao, categoria, valor, tipo, recorrencia } = req.body;

  if (!data || !descricao || !categoria || valor === undefined || !tipo || !recorrencia) {
    return res.status(400).json({ error: 'Todos os campos obrigatórios devem ser preenchidos.' });
  }

  try {
    const query = `
      INSERT INTO transacoes (data, descricao, categoria, valor, tipo, recorrencia)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, to_char(data, 'YYYY-MM-DD') as data, descricao, categoria, valor, tipo, recorrencia
    `;
    const values = [data, descricao, categoria, valor, tipo, recorrencia];
    const { rows } = await pool.query(query, values);
    return res.status(201).json(rows[0]);
  } catch (error) {
    console.error("Erro ao criar transação:", error);
    return res.status(500).json({ error: 'Erro ao salvar transação no banco de dados.' });
  }
});

// 3. Atualizar uma transação existente
app.put('/api/transactions/:id', async (req, res) => {
  const { id } = req.params;
  const { data, descricao, categoria, valor, tipo, recorrencia } = req.body;

  if (!data || !descricao || !categoria || valor === undefined || !tipo || !recorrencia) {
    return res.status(400).json({ error: 'Todos os campos obrigatórios devem ser preenchidos.' });
  }

  try {
    const query = `
      UPDATE transacoes 
      SET data = $1, descricao = $2, categoria = $3, valor = $4, tipo = $5, recorrencia = $6
      WHERE id = $7
      RETURNING id, to_char(data, 'YYYY-MM-DD') as data, descricao, categoria, valor, tipo, recorrencia
    `;
    const values = [data, descricao, categoria, valor, tipo, recorrencia, id];
    const { rows } = await pool.query(query, values);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Transação não encontrada.' });
    }

    return res.json(rows[0]);
  } catch (error) {
    console.error("Erro ao atualizar transação:", error);
    return res.status(500).json({ error: 'Erro ao atualizar transação no banco de dados.' });
  }
});

// 4. Excluir uma transação
app.delete('/api/transactions/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const query = 'DELETE FROM transacoes WHERE id = $1 RETURNING id';
    const { rows } = await pool.query(query, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Transação não encontrada.' });
    }

    return res.json({ success: true, message: 'Transação excluída com sucesso.' });
  } catch (error) {
    console.error("Erro ao excluir transação:", error);
    return res.status(500).json({ error: 'Erro ao excluir transação no banco de dados.' });
  }
});

// --- API ROTAS PARA FORECAST EVENTS (EVENTOS PLANEJADOS) ---

// 1. Listar todos os eventos planejados
app.get('/api/forecast-events', async (req, res) => {
  try {
    const query = 'SELECT id, description, amount, type, date FROM forecast_events ORDER BY date ASC, id ASC';
    const { rows } = await pool.query(query);
    return res.json(rows);
  } catch (error) {
    console.error("Erro ao listar eventos de projeção:", error);
    return res.status(500).json({ error: 'Erro ao buscar eventos planejados.' });
  }
});

// 2. Criar um novo evento planejado
app.post('/api/forecast-events', async (req, res) => {
  const { description, amount, type, date } = req.body;

  if (!description || amount === undefined || !type || !date) {
    return res.status(400).json({ error: 'Todos os campos devem ser informados.' });
  }

  try {
    const query = `
      INSERT INTO forecast_events (description, amount, type, date)
      VALUES ($1, $2, $3, $4)
      RETURNING id, description, amount, type, date
    `;
    const values = [description, amount, type, date];
    const { rows } = await pool.query(query, values);
    return res.status(201).json(rows[0]);
  } catch (error) {
    console.error("Erro ao criar evento planejado:", error);
    return res.status(500).json({ error: 'Erro ao salvar evento planejado.' });
  }
});

// 3. Excluir um evento planejado
app.delete('/api/forecast-events/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const query = 'DELETE FROM forecast_events WHERE id = $1 RETURNING id';
    const { rows } = await pool.query(query, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Evento planejado não encontrado.' });
    }

    return res.json({ success: true, message: 'Evento planejado excluído.' });
  } catch (error) {
    console.error("Erro ao excluir evento planejado:", error);
    return res.status(500).json({ error: 'Erro ao excluir evento planejado.' });
  }
});


// Servir os arquivos estáticos do frontend (HTML, CSS, JS) da pasta public
app.use(express.static(path.join(__dirname, 'public')));

// Fallback para qualquer rota não mapeada servir o index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Inicializar banco e escutar porta
async function startServer() {
  try {
    // Se a DATABASE_URL estiver disponível, tenta rodar o script de migração.
    // Se não, o app subirá em modo simulação (para testes locais rápidos).
    if (process.env.DATABASE_URL) {
      await initDb();
    } else {
      console.warn("Iniciando sem banco de dados configurado (DATABASE_URL em branco). O app rodará em Modo Simulação (local storage).");
    }
  } catch (error) {
    console.error("Não foi possível conectar ao banco de dados durante a inicialização. Mas o servidor Express continuará tentando subir.", error);
  }

  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`Acesse: http://localhost:${PORT}`);
  });
}

startServer();
