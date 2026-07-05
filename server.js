import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pool, { initDb, getTenantPool, initTenantDb } from './db.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware para JSON e dados de formulário
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware para habilitar CORS (necessário para o aplicativo móvel Capacitor acessar a API)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (origin.includes('localhost') || origin.startsWith('capacitor://'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Rota de status do banco de dados (usada na aba de Configurações do frontend)
import crypto from 'crypto';

// Funções utilitárias de criptografia nativa
function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Middleware de Autenticação
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Não autorizado. Token de sessão ausente.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const sessionQuery = `
      SELECT s.token, u.id, u.username, u.parent_user_id, u.db_name,
             p.db_name as parent_db_name
      FROM sessoes s
      JOIN usuarios u ON s.usuario_id = u.id
      LEFT JOIN usuarios p ON u.parent_user_id = p.id
      WHERE s.token = $1
    `;
    const { rows } = await pool.query(sessionQuery, [token]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
    }

    const userRow = rows[0];
    const mainUserId = userRow.parent_user_id || userRow.id;
    const dbName = userRow.db_name || userRow.parent_db_name;

    req.user = {
      id: userRow.id,
      username: userRow.username,
      mainUserId,
      dbName
    };

    if (dbName) {
      req.tenantPool = getTenantPool(dbName);
    } else {
      req.tenantPool = pool;
    }

    next();
  } catch (error) {
    console.error('Erro de autenticação:', error);
    return res.status(500).json({ error: 'Erro interno no servidor ao validar sessão.' });
  }
}

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

// --- API ROTAS PARA AUTENTICAÇÃO ---

// 1. Status de setup (verifica se existem usuários no banco)
app.get('/api/auth/setup-status', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT COUNT(*) FROM usuarios');
    const count = parseInt(rows[0].count);
    return res.json({ needsSetup: count === 0 });
  } catch (error) {
    console.error('Erro ao verificar setup:', error);
    return res.status(500).json({ error: 'Erro ao verificar primeiro acesso.' });
  }
});

// 2. Registrar um novo usuário principal (com banco próprio)
app.post('/api/auth/register', async (req, res) => {
  const { username, password, passcode } = req.body;
  if (!username || !password || username.trim() === '' || password.trim() === '') {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
  }

  // Verificar código de autorização
  if (passcode !== '253545') {
    return res.status(400).json({ error: 'Código de autorização inválido para criação de conta.' });
  }

  const trimmedUsername = username.trim();
  let newUser = null;

  try {
    // Verificar se usuário já existe
    const existsRes = await pool.query('SELECT 1 FROM usuarios WHERE username = $1', [trimmedUsername]);
    if (existsRes.rowCount > 0) {
      return res.status(400).json({ error: 'Nome de usuário já está em uso.' });
    }

    const salt = generateSalt();
    const passwordHash = hashPassword(password, salt);

    // Inserir usuário na base global/master
    const insertQuery = `
      INSERT INTO usuarios (username, password_hash, salt)
      VALUES ($1, $2, $3)
      RETURNING id, username
    `;
    const { rows } = await pool.query(insertQuery, [trimmedUsername, passwordHash, salt]);
    newUser = rows[0];

    // Criar o banco de dados específico para o usuário
    const tenantDbName = `dinheiro_db_user_${newUser.id}`;
    
    // Tentar criar o banco de dados físico no postgres
    await pool.query(`CREATE DATABASE ${tenantDbName}`);
    console.log(`[Multi-tenant] Banco de dados '${tenantDbName}' criado com sucesso para o usuário ${newUser.username}.`);

    // Atualizar a coluna db_name na tabela usuarios master
    await pool.query('UPDATE usuarios SET db_name = $1 WHERE id = $2', [tenantDbName, newUser.id]);

    // Inicializar as tabelas no banco de dados do novo tenant
    await initTenantDb(tenantDbName);

    // Criar sessão automaticamente na base master
    const token = generateToken();
    await pool.query('INSERT INTO sessoes (token, usuario_id) VALUES ($1, $2)', [token, newUser.id]);

    return res.status(201).json({
      message: 'Usuário registrado e banco de dados inicializado com sucesso!',
      token,
      user: { id: newUser.id, username: newUser.username }
    });
  } catch (error) {
    console.error('Erro no registro de usuário principal:', error);
    
    // Rollback do usuário inserido na master se a criação ou inicialização do banco falhar
    if (newUser && newUser.id) {
      try {
        await pool.query('DELETE FROM usuarios WHERE id = $1', [newUser.id]);
      } catch (delError) {
        console.error('Erro ao deletar usuário após falha na criação do banco:', delError);
      }
    }
    
    return res.status(500).json({ error: 'Erro ao registrar usuário principal e inicializar banco de dados.' });
  }
});

// 3. Fazer login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
  }

  try {
    const { rows } = await pool.query('SELECT id, username, password_hash, salt FROM usuarios WHERE username = $1', [username.trim()]);
    if (rows.length === 0) {
      return res.status(400).json({ error: 'Credenciais inválidas.' });
    }

    const user = rows[0];
    const calculatedHash = hashPassword(password, user.salt);
    if (calculatedHash !== user.password_hash) {
      return res.status(400).json({ error: 'Credenciais inválidas.' });
    }

    const token = generateToken();
    await pool.query('INSERT INTO sessoes (token, usuario_id) VALUES ($1, $2)', [token, user.id]);

    return res.json({
      message: 'Login realizado com sucesso!',
      token,
      user: { id: user.id, username: user.username }
    });
  } catch (error) {
    console.error('Erro no login:', error);
    return res.status(500).json({ error: 'Erro ao autenticar usuário.' });
  }
});

// 4. Fazer logout
app.post('/api/auth/logout', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(400).json({ error: 'Token não fornecido.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    await pool.query('DELETE FROM sessoes WHERE token = $1', [token]);
    return res.json({ success: true, message: 'Logout realizado com sucesso.' });
  } catch (error) {
    console.error('Erro no logout:', error);
    return res.status(500).json({ error: 'Erro ao deslogar.' });
  }
});

// 5. Obter dados do usuário atual logado
app.get('/api/auth/me', requireAuth, (req, res) => {
  return res.json({ user: req.user });
});

// 6. Alterar senha do usuário logado
app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword.trim() === '') {
    return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias.' });
  }

  try {
    const { rows } = await pool.query('SELECT password_hash, salt FROM usuarios WHERE id = $1', [req.user.id]);
    const user = rows[0];

    const calculatedHash = hashPassword(currentPassword, user.salt);
    if (calculatedHash !== user.password_hash) {
      return res.status(400).json({ error: 'Senha atual incorreta.' });
    }

    const newSalt = generateSalt();
    const newHash = hashPassword(newPassword, newSalt);

    await pool.query('UPDATE usuarios SET password_hash = $1, salt = $2 WHERE id = $3', [newHash, newSalt, req.user.id]);
    
    // Deletar todas as sessões antigas deste usuário exceto a atual
    const authHeader = req.headers.authorization;
    const currentToken = authHeader.split(' ')[1];
    await pool.query('DELETE FROM sessoes WHERE usuario_id = $1 AND token != $2', [req.user.id, currentToken]);

    return res.json({ success: true, message: 'Senha alterada com sucesso.' });
  } catch (error) {
    console.error('Erro ao alterar senha:', error);
    return res.status(500).json({ error: 'Erro ao atualizar senha no banco de dados.' });
  }
});

// 7. Listar todos os usuários da mesma família/tenant
app.get('/api/users', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, username, parent_user_id, created_at FROM usuarios WHERE id = $1 OR parent_user_id = $1 ORDER BY id ASC',
      [req.user.mainUserId]
    );
    return res.json(rows);
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    return res.status(500).json({ error: 'Erro ao buscar usuários no banco de dados.' });
  }
});

// 7.1. Criar um novo sub-usuário vinculado ao usuário ativo
app.post('/api/users', requireAuth, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password || username.trim() === '' || password.trim() === '') {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
  }

  const trimmedUsername = username.trim();

  try {
    // Verificar se o nome de usuário já existe na master
    const existsRes = await pool.query('SELECT 1 FROM usuarios WHERE username = $1', [trimmedUsername]);
    if (existsRes.rowCount > 0) {
      return res.status(400).json({ error: 'Nome de usuário já está em uso.' });
    }

    const salt = generateSalt();
    const passwordHash = hashPassword(password, salt);

    // Inserir sub-user vinculando ao mainUserId
    const insertQuery = `
      INSERT INTO usuarios (username, password_hash, salt, parent_user_id)
      VALUES ($1, $2, $3, $4)
      RETURNING id, username, parent_user_id
    `;
    const { rows } = await pool.query(insertQuery, [trimmedUsername, passwordHash, salt, req.user.mainUserId]);
    
    return res.status(201).json({
      message: 'Sub-usuário criado com sucesso!',
      user: rows[0]
    });
  } catch (error) {
    console.error('Erro ao criar sub-usuário:', error);
    return res.status(500).json({ error: 'Erro ao criar sub-usuário.' });
  }
});

// 8. Atualizar um usuário (username e/ou senha)
app.put('/api/users/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { username, password } = req.body;
  
  if (!username || username.trim() === '') {
    return res.status(400).json({ error: 'Nome de usuário é obrigatório.' });
  }
  
  try {
    // Verificar se o usuário pertence à mesma família/tenant
    const userCheck = await pool.query(
      'SELECT id FROM usuarios WHERE id = $1 AND (id = $2 OR parent_user_id = $2)',
      [id, req.user.mainUserId]
    );
    if (userCheck.rowCount === 0) {
      return res.status(403).json({ error: 'Você não tem permissão para editar este usuário.' });
    }

    // Verificar se o nome de usuário já existe para outro id
    const existsRes = await pool.query('SELECT id FROM usuarios WHERE username = $1 AND id != $2', [username.trim(), id]);
    if (existsRes.rowCount > 0) {
      return res.status(400).json({ error: 'Nome de usuário já está em uso.' });
    }
    
    let query, values;
    if (password && password.trim() !== '') {
      const salt = generateSalt();
      const passwordHash = hashPassword(password, salt);
      query = 'UPDATE usuarios SET username = $1, password_hash = $2, salt = $3 WHERE id = $4 RETURNING id, username';
      values = [username.trim(), passwordHash, salt, id];
    } else {
      query = 'UPDATE usuarios SET username = $1 WHERE id = $2 RETURNING id, username';
      values = [username.trim(), id];
    }
    
    const { rows } = await pool.query(query, values);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    
    // Se mudou a senha ou o próprio usuário, invalidar sessões daquele usuário
    if (password && password.trim() !== '') {
      const authHeader = req.headers.authorization;
      const currentToken = authHeader ? authHeader.split(' ')[1] : '';
      await pool.query('DELETE FROM sessoes WHERE usuario_id = $1 AND token != $2', [id, currentToken]);
    }
    
    return res.json({ message: 'Usuário atualizado com sucesso.', user: rows[0] });
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    return res.status(500).json({ error: 'Erro ao atualizar usuário no banco de dados.' });
  }
});

// 9. Excluir um usuário da família
app.delete('/api/users/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  
  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ error: 'Você não pode excluir sua própria conta.' });
  }
  
  try {
    // Garantir exclusão apenas se for sub-usuário do mainUserId ativo
    const deleteQuery = 'DELETE FROM usuarios WHERE id = $1 AND parent_user_id = $2 RETURNING id';
    const { rows } = await pool.query(deleteQuery, [id, req.user.mainUserId]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado ou sem permissão para exclusão.' });
    }
    return res.json({ message: 'Usuário excluído com sucesso.' });
  } catch (error) {
    console.error('Erro ao excluir usuário:', error);
    return res.status(500).json({ error: 'Erro ao excluir usuário no banco de dados.' });
  }
});

// --- API ROTAS PARA TRANSAÇÕES ---

// 1. Listar todas as transações
app.get('/api/transactions', requireAuth, async (req, res) => {
  try {
    const query = `
      SELECT 
        id, 
        to_char(data, 'YYYY-MM-DD') as data, 
        descricao, 
        categoria, 
        valor, 
        tipo, 
        recorrencia,
        metodo_pagamento,
        cartao_id
      FROM transacoes 
      WHERE usuario_id = $1
      ORDER BY data DESC, id DESC
    `;
    const { rows } = await req.tenantPool.query(query, [req.user.mainUserId]);
    return res.json(rows);
  } catch (error) {
    console.error("Erro ao listar transações:", error);
    return res.status(500).json({ error: 'Erro ao buscar transações no banco de dados.' });
  }
});

// 2. Criar uma nova transação
app.post('/api/transactions', requireAuth, async (req, res) => {
  const { data, descricao, categoria, valor, tipo, recorrencia, metodo_pagamento, cartao_id } = req.body;

  if (!data || !descricao || !categoria || valor === undefined || !tipo || !recorrencia) {
    return res.status(400).json({ error: 'Todos os campos obrigatórios devem ser preenchidos.' });
  }

  try {
    const query = `
      INSERT INTO transacoes (data, descricao, categoria, valor, tipo, recorrencia, metodo_pagamento, cartao_id, usuario_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, to_char(data, 'YYYY-MM-DD') as data, descricao, categoria, valor, tipo, recorrencia, metodo_pagamento, cartao_id
    `;
    const values = [data, descricao, categoria, valor, tipo, recorrencia, metodo_pagamento || null, cartao_id || null, req.user.mainUserId];
    const { rows } = await req.tenantPool.query(query, values);
    return res.status(201).json(rows[0]);
  } catch (error) {
    console.error("Erro ao criar transação:", error);
    return res.status(500).json({ error: 'Erro ao salvar transação no banco de dados.' });
  }
});

// 3. Atualizar uma transação existente
app.put('/api/transactions/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { data, descricao, categoria, valor, tipo, recorrencia, metodo_pagamento, cartao_id } = req.body;

  if (!data || !descricao || !categoria || valor === undefined || !tipo || !recorrencia) {
    return res.status(400).json({ error: 'Todos os campos obrigatórios devem ser preenchidos.' });
  }

  try {
    const query = `
      UPDATE transacoes 
      SET data = $1, descricao = $2, categoria = $3, valor = $4, tipo = $5, recorrencia = $6, metodo_pagamento = $7, cartao_id = $8
      WHERE id = $9 AND usuario_id = $10
      RETURNING id, to_char(data, 'YYYY-MM-DD') as data, descricao, categoria, valor, tipo, recorrencia, metodo_pagamento, cartao_id
    `;
    const values = [data, descricao, categoria, valor, tipo, recorrencia, metodo_pagamento || null, cartao_id || null, id, req.user.mainUserId];
    const { rows } = await req.tenantPool.query(query, values);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Transação não encontrada ou acesso negado.' });
    }

    return res.json(rows[0]);
  } catch (error) {
    console.error("Erro ao atualizar transação:", error);
    return res.status(500).json({ error: 'Erro ao atualizar transação no banco de dados.' });
  }
});

// 4. Excluir uma transação
app.delete('/api/transactions/:id', requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const query = 'DELETE FROM transacoes WHERE id = $1 AND usuario_id = $2 RETURNING id';
    const { rows } = await req.tenantPool.query(query, [id, req.user.mainUserId]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Transação não encontrada ou acesso negado.' });
    }

    return res.json({ success: true, message: 'Transação excluída com sucesso.' });
  } catch (error) {
    console.error("Erro ao excluir transação:", error);
    return res.status(500).json({ error: 'Erro ao excluir transação no banco de dados.' });
  }
});

// --- API ROTAS PARA FORECAST EVENTS (EVENTOS PLANEJADOS) ---

// 1. Listar todos os eventos planejados
app.get('/api/forecast-events', requireAuth, async (req, res) => {
  try {
    const query = 'SELECT id, description, amount, type, date FROM forecast_events WHERE usuario_id = $1 ORDER BY date ASC, id ASC';
    const { rows } = await req.tenantPool.query(query, [req.user.mainUserId]);
    return res.json(rows);
  } catch (error) {
    console.error("Erro ao listar eventos de projeção:", error);
    return res.status(500).json({ error: 'Erro ao buscar eventos planejados.' });
  }
});

// 2. Criar um novo evento planejado
app.post('/api/forecast-events', requireAuth, async (req, res) => {
  const { description, amount, type, date } = req.body;

  if (!description || amount === undefined || !type || !date) {
    return res.status(400).json({ error: 'Todos os campos devem ser informados.' });
  }

  try {
    const query = `
      INSERT INTO forecast_events (description, amount, type, date, usuario_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, description, amount, type, date
    `;
    const values = [description, amount, type, date, req.user.mainUserId];
    const { rows } = await req.tenantPool.query(query, values);
    return res.status(201).json(rows[0]);
  } catch (error) {
    console.error("Erro ao criar evento planejado:", error);
    return res.status(500).json({ error: 'Erro ao salvar evento planejado.' });
  }
});

// 3. Excluir um evento planejado
app.delete('/api/forecast-events/:id', requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const query = 'DELETE FROM forecast_events WHERE id = $1 AND usuario_id = $2 RETURNING id';
    const { rows } = await req.tenantPool.query(query, [id, req.user.mainUserId]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Evento planejado não encontrado ou acesso negado.' });
    }

    return res.json({ success: true, message: 'Evento planejado excluído.' });
  } catch (error) {
    console.error("Erro ao excluir evento planejado:", error);
    return res.status(500).json({ error: 'Erro ao excluir evento planejado.' });
  }
});

// --- API ROTAS PARA CARTÕES DE CRÉDITO ---

// 1. Listar todos os cartões do usuário
app.get('/api/credit-cards', requireAuth, async (req, res) => {
  try {
    const query = `
      SELECT id, nome, vencimento, fechamento, banco, cor_personalizada
      FROM cartoes
      WHERE usuario_id = $1
      ORDER BY nome ASC, id ASC
    `;
    const { rows } = await req.tenantPool.query(query, [req.user.mainUserId]);
    return res.json(rows);
  } catch (error) {
    console.error("Erro ao listar cartões de crédito:", error);
    return res.status(500).json({ error: 'Erro ao buscar cartões de crédito.' });
  }
});

// 2. Criar/cadastrar um novo cartão
app.post('/api/credit-cards', requireAuth, async (req, res) => {
  const { nome, vencimento, fechamento, banco, cor_personalizada } = req.body;

  if (!nome || vencimento === undefined || fechamento === undefined || !banco) {
    return res.status(400).json({ error: 'Todos os campos obrigatórios devem ser preenchidos.' });
  }

  const venc = parseInt(vencimento);
  const fech = parseInt(fechamento);

  if (isNaN(venc) || venc < 1 || venc > 31 || isNaN(fech) || fech < 1 || fech > 31) {
    return res.status(400).json({ error: 'Os dias de vencimento e fechamento devem estar entre 1 e 31.' });
  }

  try {
    const query = `
      INSERT INTO cartoes (nome, vencimento, fechamento, banco, cor_personalizada, usuario_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, nome, vencimento, fechamento, banco, cor_personalizada
    `;
    const values = [nome.trim(), venc, fech, banco, cor_personalizada || null, req.user.mainUserId];
    const { rows } = await req.tenantPool.query(query, values);
    return res.status(201).json(rows[0]);
  } catch (error) {
    console.error("Erro ao criar cartão de crédito:", error);
    return res.status(500).json({ error: 'Erro ao salvar cartão de crédito no banco de dados.' });
  }
});


// 3. Excluir um cartão de crédito
app.delete('/api/credit-cards/:id', requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const query = 'DELETE FROM cartoes WHERE id = $1 AND usuario_id = $2 RETURNING id';
    const { rows } = await req.tenantPool.query(query, [id, req.user.mainUserId]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Cartão de crédito não encontrado ou acesso negado.' });
    }

    return res.json({ success: true, message: 'Cartão de crédito excluído com sucesso.' });
  } catch (error) {
    console.error("Erro ao excluir cartão de crédito:", error);
    return res.status(500).json({ error: 'Erro ao excluir cartão de crédito.' });
  }
});

// 4. Editar um cartão de crédito
app.put('/api/credit-cards/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { nome, vencimento, fechamento, banco, cor_personalizada } = req.body;

  if (!nome || vencimento === undefined || fechamento === undefined || !banco) {
    return res.status(400).json({ error: 'Todos os campos obrigatórios devem ser preenchidos.' });
  }

  const venc = parseInt(vencimento);
  const fech = parseInt(fechamento);

  if (isNaN(venc) || venc < 1 || venc > 31 || isNaN(fech) || fech < 1 || fech > 31) {
    return res.status(400).json({ error: 'Os dias de vencimento e fechamento devem estar entre 1 e 31.' });
  }

  try {
    const query = `
      UPDATE cartoes
      SET nome = $1, vencimento = $2, fechamento = $3, banco = $4, cor_personalizada = $5
      WHERE id = $6 AND usuario_id = $7
      RETURNING id, nome, vencimento, fechamento, banco, cor_personalizada
    `;
    const values = [nome.trim(), venc, fech, banco, cor_personalizada || null, id, req.user.mainUserId];
    const { rows } = await req.tenantPool.query(query, values);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Cartão de crédito não encontrado ou acesso negado.' });
    }

    return res.json(rows[0]);
  } catch (error) {
    console.error("Erro ao atualizar cartão de crédito:", error);
    return res.status(500).json({ error: 'Erro ao atualizar cartão de crédito no banco de dados.' });
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
