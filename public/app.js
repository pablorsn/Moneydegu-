// --- AUTHENTICATION HELPERS ---
const getAuthToken = () => localStorage.getItem('finvue_token');
const setAuthToken = (token) => {
    if (token) localStorage.setItem('finvue_token', token);
    else localStorage.removeItem('finvue_token');
};

async function apiFetch(url, options = {}) {
    const token = getAuthToken();
    const headers = options.headers || {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(url, { ...options, headers });
}

function addMonths(dateStr, months) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1 + months, 1);
    const maxDay = new Date(year, month + months, 0).getDate();
    const targetDay = Math.min(day, maxDay);
    date.setDate(targetDay);
    return date.toISOString().split('T')[0];
}

// --- ESTADO GLOBAL DA APLICAÇÃO ---
const AppState = {
    user: null,
    transactions: [],
    forecastEvents: [],
    isLoading: false,
    isDemoMode: false,
    
    // Paginação
    currentPage: 1,
    pageSize: 10,
    filteredTransactions: [],

    // Gráficos (instâncias do Chart.js)
    balanceChart: null,
    categoryChart: null
};

// --- DADOS DE SIMULAÇÃO (MODO DEMO) ---
const DEMO_TRANSACTIONS = [
    // Janeiro 2026
    { Data: "2026-01-05", Descrição: "Salário Recebido", Categoria: "Salário", Valor: 6500.00, Tipo: "Entrada", Recorrência: "Mensal" },
    { Data: "2026-01-10", Descrição: "Aluguel e Condomínio", Categoria: "Moradia", Valor: 1800.00, Tipo: "Saída", Recorrência: "Mensal" },
    { Data: "2026-01-12", Descrição: "Supermercado Semanal", Categoria: "Alimentação", Valor: 350.50, Tipo: "Saída", Recorrência: "Única" },
    { Data: "2026-01-15", Descrição: "Assinatura Netflix & Spotify", Categoria: "Lazer", Valor: 75.90, Tipo: "Saída", Recorrência: "Mensal" },
    { Data: "2026-01-20", Descrição: "Gasolina", Categoria: "Transporte", Valor: 180.00, Tipo: "Saída", Recorrência: "Única" },
    { Data: "2026-01-25", Descrição: "Consulta Odontológica", Categoria: "Saúde", Valor: 220.00, Tipo: "Saída", Recorrência: "Única" },
    { Data: "2026-01-28", Descrição: "Freelance Desenvolvimento", Categoria: "Investimentos", Valor: 1200.00, Tipo: "Entrada", Recorrência: "Única" },
    
    // Fevereiro 2026
    { Data: "2026-02-05", Descrição: "Salário Recebido", Categoria: "Salário", Valor: 6500.00, Tipo: "Entrada", Recorrência: "Mensal" },
    { Data: "2026-02-10", Descrição: "Aluguel e Condomínio", Categoria: "Moradia", Valor: 1800.00, Tipo: "Saída", Recorrência: "Mensal" },
    { Data: "2026-02-11", Descrição: "Supermercado Semanal", Categoria: "Alimentação", Valor: 420.00, Tipo: "Saída", Recorrência: "Única" },
    { Data: "2026-02-14", Descrição: "Jantar Especial Namorados", Categoria: "Lazer", Valor: 250.00, Tipo: "Saída", Recorrência: "Única" },
    { Data: "2026-02-15", Descrição: "Assinatura Netflix & Spotify", Categoria: "Lazer", Valor: 75.90, Tipo: "Saída", Recorrência: "Mensal" },
    { Data: "2026-02-18", Descrição: "Curso online JavaScript", Categoria: "Educação", Valor: 150.00, Tipo: "Saída", Recorrência: "Única" },
    { Data: "2026-02-22", Descrição: "Gasolina", Categoria: "Transporte", Valor: 210.00, Tipo: "Saída", Recorrência: "Única" },

    // Março 2026
    { Data: "2026-03-05", Descrição: "Salário Recebido", Categoria: "Salário", Valor: 6500.00, Tipo: "Entrada", Recorrência: "Mensal" },
    { Data: "2026-03-10", Descrição: "Aluguel e Condomínio", Categoria: "Moradia", Valor: 1800.00, Tipo: "Saída", Recorrência: "Mensal" },
    { Data: "2026-03-12", Descrição: "Supermercado", Categoria: "Alimentação", Valor: 390.00, Tipo: "Saída", Recorrência: "Única" },
    { Data: "2026-03-15", Descrição: "Assinatura Netflix & Spotify", Categoria: "Lazer", Valor: 75.90, Tipo: "Saída", Recorrência: "Mensal" },
    { Data: "2026-03-20", Descrição: "Gasolina", Categoria: "Transporte", Valor: 160.00, Tipo: "Saída", Recorrência: "Única" },
    { Data: "2026-03-24", Descrição: "Remédios Farmácia", Categoria: "Saúde", Valor: 85.30, Tipo: "Saída", Recorrência: "Única" },
    { Data: "2026-03-30", Descrição: "Dividendos FIIs", Categoria: "Investimentos", Valor: 320.00, Tipo: "Entrada", Recorrência: "Mensal" },

    // Abril 2026
    { Data: "2026-04-05", Descrição: "Salário Recebido", Categoria: "Salário", Valor: 6500.00, Tipo: "Entrada", Recorrência: "Mensal" },
    { Data: "2026-04-10", Descrição: "Aluguel e Condomínio", Categoria: "Moradia", Valor: 1800.00, Tipo: "Saída", Recorrência: "Mensal" },
    { Data: "2026-04-12", Descrição: "Supermercado Quizenal", Categoria: "Alimentação", Valor: 480.00, Tipo: "Saída", Recorrência: "Única" },
    { Data: "2026-04-15", Descrição: "Assinatura Netflix & Spotify", Categoria: "Lazer", Valor: 75.90, Tipo: "Saída", Recorrência: "Mensal" },
    { Data: "2026-04-18", Descrição: "Manutenção Carro", Categoria: "Transporte", Valor: 650.00, Tipo: "Saída", Recorrência: "Única" },
    { Data: "2026-04-20", Descrição: "Gasolina", Categoria: "Transporte", Valor: 190.00, Tipo: "Saída", Recorrência: "Única" },
    { Data: "2026-04-30", Descrição: "Dividendos FIIs", Categoria: "Investimentos", Valor: 325.00, Tipo: "Entrada", Recorrência: "Mensal" },

    // Maio 2026 (Mês Atual - Simulação até o momento)
    { Data: "2026-05-05", Descrição: "Salário Recebido", Categoria: "Salário", Valor: 6500.00, Tipo: "Entrada", Recorrência: "Mensal" },
    { Data: "2026-05-10", Descrição: "Aluguel e Condomínio", Categoria: "Moradia", Valor: 1800.00, Tipo: "Saída", Recorrência: "Mensal" },
    { Data: "2026-05-12", Descrição: "Supermercado", Categoria: "Alimentação", Valor: 375.00, Tipo: "Saída", Recorrência: "Única" },
    { Data: "2026-05-15", Descrição: "Assinatura Netflix & Spotify", Categoria: "Lazer", Valor: 75.90, Tipo: "Saída", Recorrência: "Mensal" },
    { Data: "2026-05-20", Descrição: "Gasolina", Categoria: "Transporte", Valor: 180.00, Tipo: "Saída", Recorrência: "Única" },
    { Data: "2026-05-25", Descrição: "Cinema e Jantar", Categoria: "Lazer", Valor: 140.00, Tipo: "Saída", Recorrência: "Única" },
    { Data: "2026-05-28", Descrição: "Dividendos FIIs", Categoria: "Investimentos", Valor: 330.00, Tipo: "Entrada", Recorrência: "Mensal" }
];

const DEFAULT_CATEGORIES = ["Alimentação", "Transporte", "Moradia", "Lazer", "Saúde", "Educação", "Salário", "Investimentos", "Outros"];

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupEventListeners();
});

function initApp() {
    // Configura os ícones do Lucide
    lucide.createIcons();

    // Define a data máxima/padrão no formulário como hoje
    const today = new Date().toISOString().split('T')[0];
    const txDateEl = document.getElementById('tx-date');
    if (txDateEl) txDateEl.value = today;

    // Define o mês atual nas configurações do planejador de eventos
    const currentYearMonth = today.substring(0, 7); // YYYY-MM
    const feDateEl = document.getElementById('fe-date');
    if (feDateEl) feDateEl.value = currentYearMonth;

    checkDatabaseStatus();
    checkAuthentication();
}

async function checkAuthentication() {
    const token = getAuthToken();
    if (!token) {
        await checkSetupStatus();
        return;
    }
    
    try {
        const res = await apiFetch('/api/auth/me');
        if (res.ok) {
            const data = await res.json();
            showAuthenticatedApp(data.user);
        } else {
            setAuthToken(null);
            await checkSetupStatus();
        }
    } catch (error) {
        console.error('Erro ao validar sessão:', error);
        const cached = localStorage.getItem('finvue_cached_transactions');
        if (cached) {
            showToast('Erro de conexão. Exibindo dados locais offline.', 'warning');
            showAuthenticatedApp({ username: 'Usuário Offline' });
        } else {
            await checkSetupStatus();
        }
    }
}

async function checkSetupStatus() {
    try {
        AppState.user = null;
        const errorAlert = document.getElementById('login-error-alert');
        if (errorAlert) errorAlert.style.display = 'none';

        // Reset form inputs display and requirements
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.querySelectorAll('.form-group').forEach(el => el.style.display = '');
        }
        const usernameInput = document.getElementById('login-username');
        const passwordInput = document.getElementById('login-password');
        if (usernameInput) usernameInput.required = true;
        if (passwordInput) passwordInput.required = true;

        const res = await fetch('/api/auth/setup-status');
        if (!res.ok) {
            throw new Error('Servidor offline ou erro no banco.');
        }
        const data = await res.json();
        
        const loginScreen = document.getElementById('login-screen');
        const appContainer = document.querySelector('.app-container');
        
        loginScreen.classList.add('active');
        appContainer.style.display = 'none';
        
        if (data.needsSetup) {
            document.getElementById('login-title').innerText = 'Primeiro Acesso';
            document.getElementById('login-subtitle').innerText = 'Crie sua conta de administrador para começar.';
            document.getElementById('login-btn-text').innerText = 'Cadastrar e Entrar';
            document.getElementById('login-btn-icon').className = '';
            document.getElementById('login-btn-icon').setAttribute('data-lucide', 'user-plus');
            document.getElementById('login-toggle-text').style.display = 'none';
            document.getElementById('login-form').setAttribute('data-mode', 'setup-register');
        } else {
            document.getElementById('login-title').innerText = 'Fazer Login';
            document.getElementById('login-subtitle').innerText = 'Acesse seu gestor tempo real.';
            document.getElementById('login-btn-text').innerText = 'Entrar';
            document.getElementById('login-btn-icon').className = '';
            document.getElementById('login-btn-icon').setAttribute('data-lucide', 'log-in');
            document.getElementById('login-toggle-text').style.display = 'none';
            document.getElementById('login-form').setAttribute('data-mode', 'login');
        }
        lucide.createIcons();
    } catch (error) {
        console.error('Erro ao verificar setup:', error);
        enableDemoMode();
        
        // Adapt card to allow entering Demo Mode when backend/DB is offline
        document.getElementById('login-title').innerText = 'Banco Desconectado';
        document.getElementById('login-subtitle').innerText = 'Não foi possível conectar ao banco de dados. Você pode testar no Modo Simulação.';
        document.getElementById('login-btn-text').innerText = 'Entrar em Modo Simulação';
        
        const btnIcon = document.getElementById('login-btn-icon');
        if (btnIcon) {
            btnIcon.className = '';
            btnIcon.setAttribute('data-lucide', 'play');
        }
        
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.setAttribute('data-mode', 'demo');
            loginForm.querySelectorAll('.form-group').forEach(el => el.style.display = 'none');
        }
        
        const usernameInput = document.getElementById('login-username');
        const passwordInput = document.getElementById('login-password');
        if (usernameInput) usernameInput.required = false;
        if (passwordInput) passwordInput.required = false;
        
        lucide.createIcons();
    }
}

function showAuthenticatedApp(user) {
    AppState.user = user;
    document.getElementById('login-screen').classList.remove('active');
    document.querySelector('.app-container').style.display = 'flex';
    
    const welcomeEl = document.getElementById('welcome-title');
    if (welcomeEl) {
        welcomeEl.innerHTML = `Olá, <span>${user.username}</span>!`;
    }
    
    switchTab('dashboard');
    loadDataFromServer();
}

async function checkDatabaseStatus() {
    const badge = document.getElementById('db-status-badge');
    if (!badge) return;

    badge.className = 'badge';
    badge.style.background = 'rgba(245, 158, 11, 0.2)';
    badge.style.color = '#f59e0b';
    badge.innerText = 'Verificando conexão...';

    try {
        const res = await fetch('/api/db-status');
        const data = await res.json();
        if (res.ok && data.status === 'connected') {
            badge.style.background = 'rgba(16, 185, 129, 0.2)';
            badge.style.color = '#10b981';
            badge.innerText = 'Conectado (PostgreSQL local)';
        } else {
            throw new Error(data.error || 'Banco inacessível');
        }
    } catch (error) {
        console.error(error);
        badge.style.background = 'rgba(244, 63, 94, 0.2)';
        badge.style.color = '#f43f5e';
        badge.innerText = 'Banco Desconectado / Erro';
    }
}

// --- SETUP DOS LISTENERS DE EVENTOS ---
function setupEventListeners() {
    // 1. Navegação por abas
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = item.getAttribute('data-tab');
            switchTab(tabId);
        });
    });

    // Link "Ver Todas" no dashboard direciona para a aba de transações
    document.getElementById('btn-see-all-transactions').addEventListener('click', () => {
        switchTab('transactions');
    });

    // 2. Modais (Abertura/Fechamento)
    const txModal = document.getElementById('transaction-modal');
    const feModal = document.getElementById('forecast-event-modal');
    
    document.getElementById('btn-open-modal').addEventListener('click', () => {
        document.getElementById('tx-id').value = '';
        document.getElementById('modal-title').innerText = 'Nova Transação';
        document.getElementById('submit-btn-text').innerText = 'Adicionar';
        const submitIcon = document.getElementById('submit-btn-icon');
        if (submitIcon) {
            submitIcon.className = '';
            submitIcon.setAttribute('data-lucide', 'plus');
        }
        document.getElementById('tx-custom-category-group').style.display = 'none';
        document.getElementById('tx-custom-category').value = '';
        document.getElementById('tx-custom-category').required = false;
        openModal(txModal);
        lucide.createIcons();
    });
    document.getElementById('btn-close-modal').addEventListener('click', () => closeModal(txModal));
    document.getElementById('btn-cancel-modal').addEventListener('click', () => closeModal(txModal));
    
    const fdModal = document.getElementById('forecast-details-modal');
    document.getElementById('btn-open-forecast-event-modal').addEventListener('click', () => openModal(feModal));
    document.getElementById('btn-close-forecast-modal').addEventListener('click', () => closeModal(feModal));
    document.getElementById('btn-cancel-forecast-modal').addEventListener('click', () => closeModal(feModal));
    
    document.getElementById('btn-close-fd-modal').addEventListener('click', () => closeModal(fdModal));
    document.getElementById('btn-close-fd-footer').addEventListener('click', () => closeModal(fdModal));

    // Fechar modais ao clicar fora
    window.addEventListener('click', (e) => {
        if (e.target === txModal) closeModal(txModal);
        if (e.target === feModal) closeModal(feModal);
        if (e.target === fdModal) closeModal(fdModal);
    });

    // 3. Submissão de Formulários
    document.getElementById('transaction-form').addEventListener('submit', handleTransactionSubmit);
    document.getElementById('forecast-event-form').addEventListener('submit', handleForecastEventSubmit);

    // Evento de Categoria Personalizada
    const txCategorySelect = document.getElementById('tx-category');
    const customCategoryGroup = document.getElementById('tx-custom-category-group');
    const customCategoryInput = document.getElementById('tx-custom-category');

    txCategorySelect.addEventListener('change', (e) => {
        if (e.target.value === 'Outros') {
            customCategoryGroup.style.display = 'flex';
            customCategoryInput.required = true;
            customCategoryInput.focus();
        } else {
            customCategoryGroup.style.display = 'none';
            customCategoryInput.required = false;
            customCategoryInput.value = '';
        }
    });

    // Evento de Recorrência Parcelada
    const txRecurrenceSelect = document.getElementById('tx-recurrence');
    const installmentsGroup = document.getElementById('tx-installments-group');
    const installmentsInput = document.getElementById('tx-installments');

    if (txRecurrenceSelect && installmentsGroup && installmentsInput) {
        txRecurrenceSelect.addEventListener('change', (e) => {
            if (e.target.value === 'Parcelado') {
                installmentsGroup.style.display = 'flex';
                installmentsInput.required = true;
                installmentsInput.focus();
            } else {
                installmentsGroup.style.display = 'none';
                installmentsInput.required = false;
            }
        });
    }

    // 4. Filtros da Tabela de Transações
    document.getElementById('filter-search').addEventListener('input', applyFilters);
    document.getElementById('filter-month').addEventListener('change', applyFilters);
    document.getElementById('filter-category').addEventListener('change', applyFilters);
    document.getElementById('filter-type').addEventListener('change', applyFilters);
    document.getElementById('btn-clear-filters').addEventListener('click', clearFilters);

    // 5. Configurações da Previsão (Forecast)
    document.getElementById('forecast-history-months').addEventListener('change', () => {
        calculateForecastAndRender();
        showToast('Parâmetros de previsão atualizados!', 'info');
    });
    document.getElementById('forecast-growth-rate').addEventListener('input', () => {
        calculateForecastAndRender();
    });

    // 6. Configurações da API
    const btnRecheck = document.getElementById('btn-recheck-db');
    if (btnRecheck) {
        btnRecheck.addEventListener('click', () => {
            checkDatabaseStatus();
            showToast('Verificando conexão com o banco de dados...', 'info');
        });
    }

    // 7. Paginação
    document.getElementById('btn-prev-page').addEventListener('click', () => {
        if (AppState.currentPage > 1) {
            AppState.currentPage--;
            renderTransactionsTable();
        }
    });
    document.getElementById('btn-next-page').addEventListener('click', () => {
        const totalPages = Math.ceil(AppState.filteredTransactions.length / AppState.pageSize);
        if (AppState.currentPage < totalPages) {
            AppState.currentPage++;
            renderTransactionsTable();
        }
    });

    // 8. Autenticação e Gerenciamento de Usuários
    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.addEventListener('submit', handleLoginSubmit);

    const logoutBtn = document.getElementById('nav-logout');
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    const formChangePass = document.getElementById('form-change-password');
    if (formChangePass) formChangePass.addEventListener('submit', handleChangePasswordSubmit);

    const formRegisterUser = document.getElementById('form-register-user');
    if (formRegisterUser) formRegisterUser.addEventListener('submit', handleSettingsRegisterSubmit);

    const formEditUser = document.getElementById('form-edit-user');
    if (formEditUser) formEditUser.addEventListener('submit', handleEditUserSubmit);

    const btnCancelEditUser = document.getElementById('btn-cancel-edit-user');
    if (btnCancelEditUser) {
        btnCancelEditUser.addEventListener('click', () => {
            const editUserContainer = document.getElementById('edit-user-container');
            if (editUserContainer) editUserContainer.style.display = 'none';
            if (formEditUser) formEditUser.reset();
        });
    }

    setupSettingsUserTabs();
}

async function handleLoginSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const mode = form.getAttribute('data-mode');
    
    const errorAlert = document.getElementById('login-error-alert');
    if (errorAlert) errorAlert.style.display = 'none';
    
    if (mode === 'demo') {
        showToast('Entrando no Modo Simulação local.', 'info');
        showAuthenticatedApp({ username: 'Visitante' });
        form.reset();
        return;
    }
    
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    
    const submitBtn = document.getElementById('btn-login-submit');
    const submitBtnText = document.getElementById('login-btn-text');
    const oldText = submitBtnText.innerText;
    
    submitBtnText.innerText = 'Processando...';
    submitBtn.disabled = true;
    
    try {
        let url = '/api/auth/login';
        if (mode === 'register' || mode === 'setup-register') {
            url = '/api/auth/register';
        }
        
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await res.json();
        if (res.ok) {
            setAuthToken(data.token);
            showToast(data.message || 'Sucesso!', 'success');
            showAuthenticatedApp(data.user);
            form.reset();
        } else {
            if (errorAlert) {
                document.getElementById('login-error-message').innerText = data.error || 'Erro na operação.';
                errorAlert.style.display = 'flex';
                lucide.createIcons();
            }
            showToast(data.error || 'Erro na operação.', 'error');
        }
    } catch (error) {
        console.error('Erro de autenticação:', error);
        if (errorAlert) {
            document.getElementById('login-error-message').innerText = 'Erro ao se conectar com o servidor.';
            errorAlert.style.display = 'flex';
            lucide.createIcons();
        }
        showToast('Erro ao se conectar com o servidor.', 'error');
    } finally {
        submitBtnText.innerText = oldText;
        submitBtn.disabled = false;
        lucide.createIcons();
    }
}

async function handleLogout(e) {
    if (e) e.preventDefault();
    
    const token = getAuthToken();
    if (token) {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } catch (error) {
            console.error('Erro ao deslogar no servidor:', error);
        }
    }
    
    setAuthToken(null);
    showToast('Sessão encerrada com sucesso.', 'info');
    
    // Limpar dados do estado
    AppState.user = null;
    AppState.transactions = [];
    AppState.forecastEvents = [];
    
    // Resetar dashboard e tabelas
    processAndRefreshUI();
    
    // Voltar para tela de login
    await checkSetupStatus();
}

async function handleChangePasswordSubmit(e) {
    e.preventDefault();
    const currentPassword = document.getElementById('change-pass-current').value;
    const newPassword = document.getElementById('change-pass-new').value;
    const confirmPassword = document.getElementById('change-pass-confirm').value;
    
    if (newPassword !== confirmPassword) {
        showToast('A nova senha e a confirmação não coincidem.', 'warning');
        return;
    }
    
    try {
        const res = await apiFetch('/api/auth/change-password', {
            method: 'POST',
            body: { currentPassword, newPassword }
        });
        const data = await res.json();
        if (res.ok) {
            showToast('Senha alterada com sucesso!', 'success');
            e.target.reset();
        } else {
            showToast(data.error || 'Erro ao alterar senha.', 'error');
        }
    } catch (error) {
        console.error('Erro ao alterar senha:', error);
        showToast('Erro ao alterar senha no servidor.', 'error');
    }
}

async function handleSettingsRegisterSubmit(e) {
    e.preventDefault();
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;
    const confirm = document.getElementById('register-confirm').value;
    
    if (password !== confirm) {
        showToast('As senhas não coincidem.', 'warning');
        return;
    }
    
    if (AppState.isDemoMode) {
        const cachedUsers = localStorage.getItem('finvue_demo_users');
        let users = cachedUsers ? JSON.parse(cachedUsers) : [];
        
        // Verificar se usuário já existe
        const exists = users.some(u => u.username.toLowerCase() === username.toLowerCase().trim());
        if (exists) {
            showToast('Nome de usuário já está em uso.', 'error');
            return;
        }

        const nextId = users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1;
        users.push({
            id: nextId,
            username: username.trim(),
            created_at: new Date().toISOString()
        });
        localStorage.setItem('finvue_demo_users', JSON.stringify(users));

        showToast(`Usuário "${username}" cadastrado com sucesso! (Modo Simulação)`, 'success');
        e.target.reset();

        const settingsManageUsers = document.getElementById('settings-manage-users');
        if (settingsManageUsers && settingsManageUsers.style.display !== 'none') {
            loadUsersList();
        }
        return;
    }
    
    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (res.ok) {
            showToast(`Usuário "${username}" cadastrado com sucesso!`, 'success');
            e.target.reset();
            const settingsManageUsers = document.getElementById('settings-manage-users');
            if (settingsManageUsers && settingsManageUsers.style.display !== 'none') {
                loadUsersList();
            }
        } else {
            showToast(data.error || 'Erro ao cadastrar usuário.', 'error');
        }
    } catch (error) {
        console.error('Erro ao cadastrar usuário:', error);
        showToast('Erro ao cadastrar usuário no servidor.', 'error');
    }
}

function setupSettingsUserTabs() {
    const btnChangePass = document.getElementById('btn-tab-change-pass');
    const btnCreateUser = document.getElementById('btn-tab-create-user');
    const btnManageUsers = document.getElementById('btn-tab-manage-users');
    const formChangePass = document.getElementById('form-change-password');
    const formCreateUser = document.getElementById('form-register-user');
    const settingsManageUsers = document.getElementById('settings-manage-users');
    const editUserContainer = document.getElementById('edit-user-container');
    
    if (!btnChangePass || !btnCreateUser || !btnManageUsers || !formChangePass || !formCreateUser || !settingsManageUsers) return;
    
    btnChangePass.addEventListener('click', () => {
        btnChangePass.classList.add('active');
        btnCreateUser.classList.remove('active');
        btnManageUsers.classList.remove('active');
        
        formChangePass.classList.add('active');
        formChangePass.style.display = 'block';
        
        formCreateUser.classList.remove('active');
        formCreateUser.style.display = 'none';
        
        settingsManageUsers.classList.remove('active');
        settingsManageUsers.style.display = 'none';
        
        if (editUserContainer) editUserContainer.style.display = 'none';
    });
    
    btnCreateUser.addEventListener('click', () => {
        btnCreateUser.classList.add('active');
        btnChangePass.classList.remove('active');
        btnManageUsers.classList.remove('active');
        
        formCreateUser.classList.add('active');
        formCreateUser.style.display = 'block';
        
        formChangePass.classList.remove('active');
        formChangePass.style.display = 'none';
        
        settingsManageUsers.classList.remove('active');
        settingsManageUsers.style.display = 'none';
        
        if (editUserContainer) editUserContainer.style.display = 'none';
    });

    btnManageUsers.addEventListener('click', () => {
        btnManageUsers.classList.add('active');
        btnChangePass.classList.remove('active');
        btnCreateUser.classList.remove('active');
        
        settingsManageUsers.classList.add('active');
        settingsManageUsers.style.display = 'block';
        
        formChangePass.classList.remove('active');
        formChangePass.style.display = 'none';
        
        formCreateUser.classList.remove('active');
        formCreateUser.style.display = 'none';
        
        if (editUserContainer) editUserContainer.style.display = 'none';
        
        loadUsersList();
    });
}

async function loadUsersList() {
    const usersListBody = document.getElementById('users-list');
    if (!usersListBody) return;

    usersListBody.innerHTML = `
        <tr>
            <td colspan="3" style="text-align: center; padding: 20px;">Carregando usuários...</td>
        </tr>
    `;

    try {
        let users = [];
        if (AppState.isDemoMode) {
            const cachedUsers = localStorage.getItem('finvue_demo_users');
            if (cachedUsers) {
                users = JSON.parse(cachedUsers);
            } else {
                users = [
                    { id: 1, username: 'Visitante', created_at: new Date().toISOString() },
                    { id: 2, username: 'admin_teste', created_at: new Date(Date.now() - 86400000).toISOString() }
                ];
                localStorage.setItem('finvue_demo_users', JSON.stringify(users));
            }
        } else {
            const res = await apiFetch('/api/users');
            if (!res.ok) {
                throw new Error('Falha ao carregar usuários.');
            }
            users = await res.json();
        }
        
        usersListBody.innerHTML = '';
        if (users.length === 0) {
            usersListBody.innerHTML = `
                <tr>
                    <td colspan="3" style="text-align: center; padding: 20px;">Nenhum usuário cadastrado.</td>
                </tr>
            `;
            return;
        }

        // Recuperar o ID do usuário logado do AppState
        const currentUserId = AppState.user ? AppState.user.id : (AppState.isDemoMode ? 1 : null);

        users.forEach(user => {
            const tr = document.createElement('tr');
            
            // Format date to local/friendly format
            let formattedDate = 'N/A';
            if (user.created_at) {
                const dateObj = new Date(user.created_at);
                formattedDate = dateObj.toLocaleDateString('pt-BR') + ' ' + dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            }

            const usernameSpan = document.createElement('span');
            usernameSpan.textContent = user.username;
            if (user.id === currentUserId) {
                usernameSpan.innerHTML += ' <span class="badge" style="background: rgba(99, 102, 241, 0.2); color: #818cf8; font-size: 10px; padding: 2px 6px; margin-left: 6px; border-radius: 4px;">Você</span>';
            }

            const tdUser = document.createElement('td');
            tdUser.appendChild(usernameSpan);

            const tdCreated = document.createElement('td');
            tdCreated.textContent = formattedDate;

            const tdActions = document.createElement('td');
            tdActions.style.textAlign = 'center';
            tdActions.style.display = 'flex';
            tdActions.style.justifyContent = 'center';
            tdActions.style.gap = '8px';

            // Edit button
            const btnEdit = document.createElement('button');
            btnEdit.type = 'button';
            btnEdit.className = 'btn-table-action edit';
            btnEdit.title = 'Editar';
            btnEdit.innerHTML = '<i data-lucide="edit-3"></i>';
            btnEdit.addEventListener('click', () => editUser(user.id, user.username));

            // Delete button (disabled for self)
            const btnDelete = document.createElement('button');
            btnDelete.type = 'button';
            btnDelete.className = 'btn-table-action delete';
            btnDelete.title = 'Excluir';
            btnDelete.innerHTML = '<i data-lucide="trash-2"></i>';
            if (user.id === currentUserId) {
                btnDelete.disabled = true;
                btnDelete.style.opacity = '0.4';
                btnDelete.style.cursor = 'not-allowed';
                btnDelete.title = 'Você não pode excluir a si mesmo';
            } else {
                btnDelete.addEventListener('click', () => deleteUser(user.id, user.username));
            }

            tdActions.appendChild(btnEdit);
            tdActions.appendChild(btnDelete);

            tr.appendChild(tdUser);
            tr.appendChild(tdCreated);
            tr.appendChild(tdActions);

            usersListBody.appendChild(tr);
        });

        lucide.createIcons();
    } catch (error) {
        console.error('Erro ao buscar usuários:', error);
        usersListBody.innerHTML = `
            <tr>
                <td colspan="3" style="text-align: center; padding: 20px; color: var(--danger);">Erro ao carregar usuários.</td>
            </tr>
        `;
        showToast('Erro ao carregar lista de usuários.', 'error');
    }
}

function editUser(id, username) {
    const editContainer = document.getElementById('edit-user-container');
    const editIdInput = document.getElementById('edit-user-id');
    const editUsernameInput = document.getElementById('edit-user-username');
    const editPasswordInput = document.getElementById('edit-user-password');
    const editTitleName = document.getElementById('edit-user-title-name');

    if (!editContainer || !editIdInput || !editUsernameInput || !editPasswordInput || !editTitleName) return;

    editIdInput.value = id;
    editUsernameInput.value = username;
    editPasswordInput.value = ''; // Limpar campo de senha
    editTitleName.textContent = username;

    editContainer.style.display = 'block';
    
    // Rolagem suave até o formulário de edição
    editContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function handleEditUserSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('edit-user-id').value;
    const username = document.getElementById('edit-user-username').value;
    const password = document.getElementById('edit-user-password').value;

    if (!username || username.trim() === '') {
        showToast('O nome de usuário não pode ficar vazio.', 'warning');
        return;
    }

    if (AppState.isDemoMode) {
        const cachedUsers = localStorage.getItem('finvue_demo_users');
        let users = cachedUsers ? JSON.parse(cachedUsers) : [];
        
        // Verificar se usuário já existe
        const exists = users.some(u => u.username.toLowerCase() === username.toLowerCase().trim() && u.id !== parseInt(id));
        if (exists) {
            showToast('Nome de usuário já está em uso.', 'error');
            return;
        }

        users = users.map(u => {
            if (u.id === parseInt(id)) {
                return { ...u, username: username.trim() };
            }
            return u;
        });
        localStorage.setItem('finvue_demo_users', JSON.stringify(users));

        showToast(`Usuário "${username}" atualizado com sucesso! (Modo Simulação)`, 'success');

        const currentUserId = AppState.user ? AppState.user.id : 1;
        if (currentUserId === parseInt(id)) {
            if (AppState.user) AppState.user.username = username;
            const welcomeEl = document.getElementById('welcome-title');
            if (welcomeEl) {
                welcomeEl.innerHTML = `Olá, <span>${username}</span>!`;
            }
        }

        // Oculta container e reseta formulário
        const editContainer = document.getElementById('edit-user-container');
        if (editContainer) editContainer.style.display = 'none';
        e.target.reset();

        loadUsersList();
        return;
    }

    try {
        const body = { username };
        if (password && password.trim() !== '') {
            body.password = password;
        }

        const res = await apiFetch(`/api/users/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const data = await res.json();
        if (res.ok) {
            showToast(`Usuário "${username}" atualizado com sucesso!`, 'success');
            
            // Se o usuário editado for ele mesmo, atualiza localmente
            if (AppState.user && AppState.user.id === parseInt(id)) {
                AppState.user.username = username;
                const welcomeEl = document.getElementById('welcome-title');
                if (welcomeEl) {
                    welcomeEl.innerHTML = `Olá, <span>${username}</span>!`;
                }
            }

            // Oculta container e reseta formulário
            const editContainer = document.getElementById('edit-user-container');
            if (editContainer) editContainer.style.display = 'none';
            e.target.reset();

            // Recarrega lista
            loadUsersList();
        } else {
            showToast(data.error || 'Erro ao atualizar usuário.', 'error');
        }
    } catch (error) {
        console.error('Erro ao atualizar usuário:', error);
        showToast('Erro ao se conectar com o servidor.', 'error');
    }
}

async function deleteUser(id, username) {
    const currentUserId = AppState.user ? AppState.user.id : (AppState.isDemoMode ? 1 : null);
    if (currentUserId === parseInt(id)) {
        showToast('Você não pode excluir a si mesmo.', 'warning');
        return;
    }

    const confirmedUser = await showConfirmModal({
        title: 'Excluir usuário',
        message: `Tem certeza que deseja excluir o usuário <strong>"${username}"</strong>?<br>Esta ação não pode ser desfeita.`
    });
    if (!confirmedUser) return;

    if (AppState.isDemoMode) {
        const cachedUsers = localStorage.getItem('finvue_demo_users');
        let users = cachedUsers ? JSON.parse(cachedUsers) : [];
        users = users.filter(u => u.id !== parseInt(id));
        localStorage.setItem('finvue_demo_users', JSON.stringify(users));

        showToast(`Usuário "${username}" excluído com sucesso! (Modo Simulação)`, 'success');

        // Se o formulário de edição estiver aberto para este usuário, oculta-o
        const editIdInput = document.getElementById('edit-user-id');
        if (editIdInput && editIdInput.value == id) {
            const editContainer = document.getElementById('edit-user-container');
            if (editContainer) editContainer.style.display = 'none';
        }

        loadUsersList();
        return;
    }

    try {
        const res = await apiFetch(`/api/users/${id}`, {
            method: 'DELETE'
        });

        const data = await res.json();
        if (res.ok) {
            showToast(`Usuário "${username}" excluído com sucesso!`, 'success');
            
            // Se o formulário de edição estiver aberto para este usuário, oculta-o
            const editIdInput = document.getElementById('edit-user-id');
            if (editIdInput && editIdInput.value == id) {
                const editContainer = document.getElementById('edit-user-container');
                if (editContainer) editContainer.style.display = 'none';
            }

            // Recarrega lista
            loadUsersList();
        } else {
            showToast(data.error || 'Erro ao excluir usuário.', 'error');
        }
    } catch (error) {
        console.error('Erro ao excluir usuário:', error);
        showToast('Erro ao se conectar com o servidor.', 'error');
    }
}

// --- GERENCIAMENTO DE ABAS ---
function switchTab(tabId) {
    // Atualiza classes ativas da barra de navegação
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(nav => {
        if (nav.getAttribute('data-tab') === tabId) {
            nav.classList.add('active');
        } else {
            nav.classList.remove('active');
        }
    });

    // Atualiza visibilidade dos containers
    document.querySelectorAll('.tab-content').forEach(content => {
        if (content.id === tabId) {
            content.classList.add('active');
        } else {
            content.classList.remove('active');
        }
    });

    // Rola para o topo do conteúdo
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Ações específicas ao abrir determinadas abas
    if (tabId === 'dashboard') {
        renderDashboardCharts();
    }
}

// --- CONTROLE DE MODAIS ---
function openModal(modalEl) {
    modalEl.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal(modalEl) {
    modalEl.classList.remove('active');
    document.body.style.overflow = '';
    
    const form = modalEl.querySelector('form');
    if (form) {
        form.reset();
        const dateInput = form.querySelector('input[type="date"]');
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

        if (form.id === 'transaction-form') {
            const customCategoryGroup = document.getElementById('tx-custom-category-group');
            if (customCategoryGroup) customCategoryGroup.style.display = 'none';
            const installmentsGroup = document.getElementById('tx-installments-group');
            if (installmentsGroup) installmentsGroup.style.display = 'none';
        }
    }
}

// --- MODO DEMO ---
function enableDemoMode() {
    AppState.isDemoMode = true;
    
    const localSaved = localStorage.getItem('finvue_demo_transactions');
    if (localSaved) {
        AppState.transactions = JSON.parse(localSaved).map((t, idx) => ({
            Id: t.Id !== undefined ? t.Id : -(idx + 1),
            ...t
        }));
    } else {
        AppState.transactions = DEMO_TRANSACTIONS.map((t, idx) => ({
            Id: -(idx + 1),
            ...t
        }));
        localStorage.setItem('finvue_demo_transactions', JSON.stringify(AppState.transactions));
    }

    const localEvents = localStorage.getItem('finvue_demo_forecast_events');
    AppState.forecastEvents = localEvents ? JSON.parse(localEvents) : [];

    updateConnectionStatusUI('demo');
    processAndRefreshUI();
}

function updateConnectionStatusUI(status) {
    const dot = document.getElementById('status-dot');
    const label = document.getElementById('status-text');
    const card = document.getElementById('status-card');

    if (!dot || !label || !card) return;

    dot.className = 'status-indicator-dot';
    
    if (status === 'online') {
        dot.classList.add('online');
        label.innerText = 'Conectado (Servidor)';
        card.style.borderColor = 'rgba(16, 185, 129, 0.2)';
    } else if (status === 'demo') {
        dot.classList.add('demo-mode');
        label.innerText = 'Modo Simulação';
        card.style.borderColor = 'rgba(245, 158, 11, 0.2)';
    } else if (status === 'syncing') {
        dot.classList.add('demo-mode');
        label.innerText = 'Sincronizando...';
        card.style.borderColor = 'rgba(99, 102, 241, 0.2)';
    } else {
        dot.classList.add('error');
        label.innerText = 'Erro de Conexão';
        card.style.borderColor = 'rgba(244, 63, 94, 0.2)';
    }
}

// --- LEITURA DO SERVIDOR BACKEND ---
async function loadDataFromServer() {
    AppState.isLoading = true;
    updateConnectionStatusUI('syncing');

    try {
        // 1. Carregar transações do backend
        const res = await apiFetch('/api/transactions');
        if (!res.ok) throw new Error('Falha ao obter transações do servidor');
        const data = await res.json();
        
        AppState.transactions = data.map(row => ({
            Id: row.id,
            Data: row.data || '',
            Descrição: row.descricao || 'Sem descrição',
            Categoria: row.categoria || 'Outros',
            Valor: parseFloat(row.valor) || 0,
            Tipo: row.tipo || 'Saída',
            Recorrência: row.recorrencia || 'Única'
        }));

        // 2. Carregar eventos de previsão do backend
        const resEvents = await apiFetch('/api/forecast-events');
        if (resEvents.ok) {
            const eventsData = await resEvents.json();
            AppState.forecastEvents = eventsData.map(row => ({
                id: row.id,
                description: row.description || '',
                amount: parseFloat(row.amount) || 0,
                type: row.type || 'Saída',
                date: row.date || ''
            }));
        }

        AppState.isDemoMode = false;
        updateConnectionStatusUI('online');
        
        // Cacheia localmente para fallback
        localStorage.setItem('finvue_cached_transactions', JSON.stringify(AppState.transactions));
        localStorage.setItem('finvue_cached_forecast_events', JSON.stringify(AppState.forecastEvents));
        
        processAndRefreshUI();
    } catch (error) {
        console.error('Erro ao carregar dados do servidor:', error);
        showToast('Erro ao carregar dados do servidor. Ativando cache/simulação.', 'error');
        updateConnectionStatusUI('error');

        // Fallback para cache local de transações
        const cached = localStorage.getItem('finvue_cached_transactions');
        const cachedEvents = localStorage.getItem('finvue_cached_forecast_events');
        if (cached) {
            AppState.transactions = JSON.parse(cached);
            AppState.forecastEvents = cachedEvents ? JSON.parse(cachedEvents) : [];
            AppState.isDemoMode = false;
            processAndRefreshUI();
        } else {
            enableDemoMode();
        }
    } finally {
        AppState.isLoading = false;
    }
}

// --- GRAVAÇÃO NO SERVIDOR (INSERT) ---
async function addTransactionToSupabase(transaction) {
    if (AppState.isDemoMode) {
        AppState.transactions.unshift(transaction);
        localStorage.setItem('finvue_demo_transactions', JSON.stringify(AppState.transactions));
        showToast('Transação criada localmente (Modo Simulação)!', 'success');
        processAndRefreshUI();
        return true;
    }

    try {
        const res = await apiFetch('/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                data: transaction.Data,
                descricao: transaction.Descrição,
                categoria: transaction.Categoria,
                valor: transaction.Valor,
                tipo: transaction.Tipo,
                recorrencia: transaction.Recorrência
            })
        });

        if (!res.ok) throw new Error('Falha ao gravar no servidor.');
        
        showToast('Transação salva com sucesso!', 'success');
        await loadDataFromServer();
        return true;
    } catch (error) {
        console.error('Erro ao salvar:', error);
        showToast('Erro ao salvar no servidor.', 'error');
        return false;
    }
}

async function addTransactionToSupabaseSilent(transaction) {
    if (AppState.isDemoMode) {
        AppState.transactions.unshift(transaction);
        localStorage.setItem('finvue_demo_transactions', JSON.stringify(AppState.transactions));
        return true;
    }

    try {
        const res = await apiFetch('/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                data: transaction.Data,
                descricao: transaction.Descrição,
                categoria: transaction.Categoria,
                valor: transaction.Valor,
                tipo: transaction.Tipo,
                recorrencia: transaction.Recorrência
            })
        });

        if (!res.ok) throw new Error('Falha ao gravar no servidor.');
        return true;
    } catch (error) {
        console.error('Erro ao salvar silenciosamente:', error);
        return false;
    }
}

// --- ATUALIZAÇÃO NO SERVIDOR (UPDATE) ---
async function updateTransactionInSupabase(transaction) {
    if (AppState.isDemoMode) {
        const idx = AppState.transactions.findIndex(t => t.Id === transaction.Id);
        if (idx !== -1) {
            AppState.transactions[idx] = transaction;
            localStorage.setItem('finvue_demo_transactions', JSON.stringify(AppState.transactions));
            showToast('Transação alterada localmente (Modo Simulação)!', 'success');
            processAndRefreshUI();
            return true;
        }
        return false;
    }

    try {
        const res = await apiFetch(`/api/transactions/${transaction.Id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                data: transaction.Data,
                descricao: transaction.Descrição,
                categoria: transaction.Categoria,
                valor: transaction.Valor,
                tipo: transaction.Tipo,
                recorrencia: transaction.Recorrência
            })
        });

        if (!res.ok) throw new Error('Falha ao atualizar no servidor.');
        
        showToast('Transação atualizada com sucesso!', 'success');
        await loadDataFromServer();
        return true;
    } catch (error) {
        console.error('Erro ao atualizar:', error);
        showToast('Erro ao atualizar transação no servidor.', 'error');
        return false;
    }
}

// --- EXCLUSÃO NO SERVIDOR (DELETE) ---
async function deleteTransactionFromSupabase(id) {
    if (AppState.isDemoMode) {
        AppState.transactions = AppState.transactions.filter(t => t.Id !== id);
        localStorage.setItem('finvue_demo_transactions', JSON.stringify(AppState.transactions));
        showToast('Transação excluída localmente (Modo Simulação)!', 'success');
        processAndRefreshUI();
        return true;
    }

    try {
        const res = await apiFetch(`/api/transactions/${id}`, {
            method: 'DELETE'
        });

        if (!res.ok) throw new Error('Falha ao excluir no servidor.');
        
        showToast('Transação excluída com sucesso!', 'success');
        await loadDataFromServer();
        return true;
    } catch (error) {
        console.error('Erro ao excluir:', error);
        showToast('Erro ao excluir transação no servidor.', 'error');
        return false;
    }
}

// --- PROCESSAMENTO E RENDERIZAÇÃO DA UI ---
function processAndRefreshUI() {
    AppState.transactions.sort((a, b) => new Date(b.Data) - new Date(a.Data));
    populateFilterDropdowns();
    updateMetricsUI();
    renderRecentTransactions();
    applyFilters();
    calculateForecastAndRender();
    renderDashboardCharts();
}

function populateFilterDropdowns() {
    const monthSelect = document.getElementById('filter-month');
    const categorySelect = document.getElementById('filter-category');

    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Preserva seleção atual (ou usa o mês corrente na 1ª carga)
    const currentMonthSel = monthSelect.value || currentYearMonth;
    const currentCategorySel = categorySelect.value;

    const months = new Set();
    const categories = new Set(DEFAULT_CATEGORIES);

    AppState.transactions.forEach(t => {
        if (t.Data) months.add(t.Data.substring(0, 7));
        if (t.Categoria) categories.add(t.Categoria);
    });

    // Garante que o mês atual sempre aparece no filtro
    months.add(currentYearMonth);

    // Separa em: atual, futuros (ordem crescente) e passados (ordem decrescente)
    const allMonths = Array.from(months);
    const futureMonths = allMonths.filter(m => m > currentYearMonth).sort();          // crescente
    const pastMonths   = allMonths.filter(m => m < currentYearMonth).sort().reverse(); // decrescente

    const formatMonth = (m) => {
        const [year, month] = m.split('-');
        const dateObj = new Date(year, parseInt(month) - 1, 1);
        const name = dateObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        return name.charAt(0).toUpperCase() + name.slice(1);
    };

    monthSelect.innerHTML = '<option value="all">Todos os Meses</option>';

    // Mês atual destacado
    monthSelect.innerHTML += `<option value="${currentYearMonth}">● ${formatMonth(currentYearMonth)} (atual)</option>`;

    // Meses futuros
    if (futureMonths.length > 0) {
        futureMonths.forEach(m => {
            monthSelect.innerHTML += `<option value="${m}">${formatMonth(m)}</option>`;
        });
    }

    // Meses passados
    if (pastMonths.length > 0) {
        pastMonths.forEach(m => {
            monthSelect.innerHTML += `<option value="${m}">${formatMonth(m)}</option>`;
        });
    }

    categorySelect.innerHTML = '<option value="all">Todas Categorias</option>';
    Array.from(categories).sort().forEach(c => {
        categorySelect.innerHTML += `<option value="${c}">${c}</option>`;
    });

    // Restaura seleção (usa mês atual se não houver valor preservado)
    monthSelect.value = currentMonthSel;
    if (!monthSelect.value) monthSelect.value = currentYearMonth;
    categorySelect.value = currentCategorySel;
}

function updateMetricsUI() {
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    console.log("updateMetricsUI -> currentYearMonth (local):", currentYearMonth);
    
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevYearMonth = prevMonthDate.toISOString().substring(0, 7);

    let currentMonthIncome = 0;
    let currentMonthExpense = 0;
    let prevMonthIncome = 0;
    let prevMonthExpense = 0;
    let totalBalance = 0;

    AppState.transactions.forEach(t => {
        const amount = t.Valor;
        const type = t.Tipo;
        const dateStr = t.Data;
        const tYearMonth = dateStr.substring(0, 7);

        if (tYearMonth <= currentYearMonth) {
            if (type === 'Entrada') totalBalance += amount;
            else totalBalance -= amount;
        } else {
            console.log("updateMetricsUI -> Ignorando do Saldo Atual (Futuro):", t.Descrição, t.Data, "tYearMonth:", tYearMonth);
        }

        if (tYearMonth === currentYearMonth) {
            if (type === 'Entrada') currentMonthIncome += amount;
            else currentMonthExpense += amount;
        }

        if (tYearMonth === prevYearMonth) {
            if (type === 'Entrada') prevMonthIncome += amount;
            else prevMonthExpense += amount;
        }
    });

    document.getElementById('metric-income').innerText = formatCurrency(currentMonthIncome);
    document.getElementById('metric-expense').innerText = formatCurrency(currentMonthExpense);
    document.getElementById('metric-balance').innerText = formatCurrency(totalBalance);

    const balanceCardValue = document.getElementById('metric-balance');
    if (totalBalance < 0) balanceCardValue.style.color = 'var(--danger)';
    else balanceCardValue.style.color = '#ffffff';

    const incomeTrendEl = document.getElementById('income-trend');
    if (prevMonthIncome > 0) {
        const pctDiff = ((currentMonthIncome - prevMonthIncome) / prevMonthIncome) * 100;
        renderTrendIndicator(incomeTrendEl, pctDiff);
    } else {
        incomeTrendEl.innerHTML = `<i data-lucide="minus"></i> N/A`;
        incomeTrendEl.className = 'trend text-muted';
    }

    const expenseTrendEl = document.getElementById('expense-trend');
    if (prevMonthExpense > 0) {
        const pctDiff = ((currentMonthExpense - prevMonthExpense) / prevMonthExpense) * 100;
        renderTrendIndicator(expenseTrendEl, pctDiff, true);
    } else {
        expenseTrendEl.innerHTML = `<i data-lucide="minus"></i> N/A`;
        expenseTrendEl.className = 'trend text-muted';
    }

    lucide.createIcons();
}

function renderTrendIndicator(element, pct, isInverted = false) {
    const formatted = Math.abs(pct).toFixed(0) + '%';
    const isPositive = pct > 0;

    element.innerHTML = '';
    
    if (pct === 0) {
        element.innerHTML = `<i data-lucide="minus"></i> 0%`;
        element.className = 'trend text-muted';
    } else if (isPositive) {
        element.innerHTML = `<i data-lucide="trending-up"></i> +${formatted}`;
        element.className = isInverted ? 'trend negative' : 'trend positive';
    } else {
        element.innerHTML = `<i data-lucide="trending-down"></i> -${formatted}`;
        element.className = isInverted ? 'trend positive' : 'trend negative';
    }
}

function renderRecentTransactions() {
    const container = document.getElementById('recent-transactions-list');
    const titleEl = document.getElementById('recent-transactions-title');
    container.innerHTML = '';

    // Filtra pelo mês atual
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                        'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const monthLabel = `${monthNames[now.getMonth()]} de ${now.getFullYear()}`;
    if (titleEl) titleEl.textContent = `Transações de ${monthLabel}`;

    const monthTransactions = AppState.transactions
        .filter(t => t.Data && t.Data.startsWith(currentYearMonth))
        .sort((a, b) => new Date(b.Data) - new Date(a.Data));

    if (monthTransactions.length === 0) {
        container.innerHTML = `<tr><td colspan="6" class="empty-state-text">Nenhuma transação em ${monthLabel}.</td></tr>`;
        return;
    }

    monthTransactions.forEach(t => {
        const row = document.createElement('tr');
        const formattedDate = formatDateBR(t.Data);
        const formattedVal = formatCurrency(t.Valor);
        const valClass = t.Tipo === 'Entrada' ? 'tx-val income' : 'tx-val expense';
        const sign = t.Tipo === 'Entrada' ? '+' : '-';
        const catColors = getCategoryColorStyles(t.Categoria);
        
        row.innerHTML = `
            <td>${formattedDate}</td>
            <td style="font-weight: 500;">${t.Descrição}</td>
            <td><span class="category-tag" style="color: ${catColors.solid}; background-color: ${catColors.bg}; border: 1px solid ${catColors.border};"><i data-lucide="${getCategoryIcon(t.Categoria)}" style="color: ${catColors.solid};"></i> ${t.Categoria}</span></td>
            <td><span class="badge badge-recurrence ${t.Recorrência !== 'Única' ? 'active' : ''}">${t.Recorrência}</span></td>
            <td class="${valClass}">${sign} ${formattedVal}</td>
            <td>
                <div class="table-actions">
                    <button class="btn-table-action edit" title="Editar"><i data-lucide="edit-3"></i></button>
                    <button class="btn-table-action delete" title="Excluir"><i data-lucide="trash-2"></i></button>
                </div>
            </td>
        `;
        
        row.querySelector('.edit').addEventListener('click', () => editTransaction(t.Id));
        row.querySelector('.delete').addEventListener('click', () => deleteTransaction(t.Id));
        
        container.appendChild(row);
    });

    lucide.createIcons();
}

function applyFilters() {
    const searchQuery = document.getElementById('filter-search').value.toLowerCase();
    const filterMonth = document.getElementById('filter-month').value;
    const filterCategory = document.getElementById('filter-category').value;
    const filterType = document.getElementById('filter-type').value;

    // Atualiza título do histórico com o mês selecionado
    const historyTitle = document.getElementById('history-transactions-title');
    if (historyTitle) {
        if (filterMonth === 'all') {
            historyTitle.textContent = 'Histórico de Transações';
        } else {
            const [year, month] = filterMonth.split('-');
            const dateObj = new Date(year, parseInt(month) - 1, 1);
            const name = dateObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
            historyTitle.textContent = name.charAt(0).toUpperCase() + name.slice(1);
            historyTitle.textContent = `Transações de ${name.charAt(0).toUpperCase() + name.slice(1)}`;
        }
    }

    // Filtra transações reais
    let realFiltered = AppState.transactions.filter(t => {
        const matchesSearch = t.Descrição.toLowerCase().includes(searchQuery) ||
                              t.Categoria.toLowerCase().includes(searchQuery);
        const matchesMonth = filterMonth === 'all' || t.Data.startsWith(filterMonth);
        const matchesCategory = filterCategory === 'all' || t.Categoria === filterCategory;
        const matchesType = filterType === 'all' || t.Tipo === filterType;
        return matchesSearch && matchesMonth && matchesCategory && matchesType;
    });

    // Projeção virtual de recorrentes ao filtrar por mês específico
    if (filterMonth !== 'all') {
        AppState.transactions.forEach(t => {
            const tYearMonth = t.Data.substring(0, 7);

            let shouldProject = false;
            if (t.Recorrência === 'Mensal' && tYearMonth < filterMonth) {
                shouldProject = true;
            } else if (t.Recorrência === 'Anual' && tYearMonth < filterMonth) {
                // Só projeta se o mês do ano bater (ex: cadastrado em jan/2025 → projeta em jan/2026)
                const tMonth = t.Data.substring(5, 7);
                const filterMonthNum = filterMonth.substring(5, 7);
                if (tMonth === filterMonthNum) shouldProject = true;
            }

            if (!shouldProject) return;

            // Verifica se já existe uma transação real para esse mês com a mesma descrição
            const alreadyReal = AppState.transactions.some(r =>
                r.Data.startsWith(filterMonth) &&
                r.Descrição === t.Descrição &&
                r.Recorrência === t.Recorrência
            );
            if (alreadyReal) return;

            // Aplica os demais filtros
            const matchesSearch = t.Descrição.toLowerCase().includes(searchQuery) ||
                                  t.Categoria.toLowerCase().includes(searchQuery);
            const matchesCategory = filterCategory === 'all' || t.Categoria === filterCategory;
            const matchesType = filterType === 'all' || t.Tipo === filterType;
            if (!matchesSearch || !matchesCategory || !matchesType) return;

            // Cria entrada virtual (mantendo o dia original mas trocando o mês)
            const origDay = t.Data.substring(8, 10);
            const virtualDate = `${filterMonth}-${origDay}`;
            realFiltered.push({
                ...t,
                Id: `virtual_${t.Id}_${filterMonth}`,
                Data: virtualDate,
                _virtual: true
            });
        });

        // Reordena por data decrescente
        realFiltered.sort((a, b) => new Date(b.Data) - new Date(a.Data));
    }

    AppState.filteredTransactions = realFiltered;
    AppState.currentPage = 1;
    renderTransactionsTable();
}

function clearFilters() {
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    document.getElementById('filter-search').value = '';
    document.getElementById('filter-month').value = currentYearMonth;
    document.getElementById('filter-category').value = 'all';
    document.getElementById('filter-type').value = 'all';
    applyFilters();
    showToast('Filtros limpos!', 'info');
}

function renderTransactionsTable() {
    const container = document.getElementById('all-transactions-list');
    container.innerHTML = '';

    const startIdx = (AppState.currentPage - 1) * AppState.pageSize;
    const endIdx = startIdx + AppState.pageSize;
    const pageItems = AppState.filteredTransactions.slice(startIdx, endIdx);

    const totalItems = AppState.filteredTransactions.length;
    const showingCount = pageItems.length;
    document.getElementById('pagination-info').innerText = `Mostrando ${totalItems > 0 ? startIdx + 1 : 0} a ${startIdx + showingCount} de ${totalItems} transações`;

    document.getElementById('btn-prev-page').disabled = AppState.currentPage === 1;
    const totalPages = Math.ceil(totalItems / AppState.pageSize);
    document.getElementById('btn-next-page').disabled = AppState.currentPage >= totalPages || totalPages === 0;

    if (pageItems.length === 0) {
        container.innerHTML = `<tr><td colspan="7" class="empty-state-text">Nenhuma transação encontrada.</td></tr>`;
        return;
    }

    pageItems.forEach(t => {
        const row = document.createElement('tr');
        const isVirtual = !!t._virtual;
        if (isVirtual) row.classList.add('tx-virtual');

        const formattedDate = formatDateBR(t.Data);
        const formattedVal = formatCurrency(t.Valor);
        const valClass = t.Tipo === 'Entrada' ? 'tx-val income' : 'tx-val expense';
        const sign = t.Tipo === 'Entrada' ? '+' : '-';
        const badgeClass = t.Tipo === 'Entrada' ? 'badge badge-income' : 'badge badge-expense';

        const actionsCell = isVirtual
            ? `<td><div class="table-actions"><span class="badge-projected" title="Recorrência projetada automaticamente">↺ Recorrente</span></div></td>`
            : `<td><div class="table-actions">
                    <button class="btn-table-action edit" title="Editar"><i data-lucide="edit-3"></i></button>
                    <button class="btn-table-action delete" title="Excluir"><i data-lucide="trash-2"></i></button>
               </div></td>`;

        const catColors = getCategoryColorStyles(t.Categoria);

        row.innerHTML = `
            <td>${formattedDate}</td>
            <td style="font-weight: 600;">${t.Descrição}</td>
            <td><span class="category-tag" style="color: ${catColors.solid}; background-color: ${catColors.bg}; border: 1px solid ${catColors.border};"><i data-lucide="${getCategoryIcon(t.Categoria)}" style="color: ${catColors.solid};"></i> ${t.Categoria}</span></td>
            <td><span class="badge badge-recurrence ${t.Recorrência !== 'Única' ? 'active' : ''}">${t.Recorrência}</span></td>
            <td><span class="${badgeClass}">${t.Tipo}</span></td>
            <td class="${valClass}">${sign} ${formattedVal}</td>
            ${actionsCell}
        `;

        if (!isVirtual) {
            row.querySelector('.edit').addEventListener('click', () => editTransaction(t.Id));
            row.querySelector('.delete').addEventListener('click', () => deleteTransaction(t.Id));
        }

        container.appendChild(row);
    });

    lucide.createIcons();
}

async function handleTransactionSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const amount = parseFloat(formData.get('Valor'));
    if (isNaN(amount) || amount <= 0) {
        showToast('Por favor, informe um valor maior que zero.', 'warning');
        return;
    }

    const txId = formData.get('id');
    let category = formData.get('Categoria');
    if (category === 'Outros') {
        const customCategoryVal = document.getElementById('tx-custom-category').value.trim();
        if (customCategoryVal) {
            category = customCategoryVal;
        }
    }

    const recurrence = formData.get('Recorrência');
    const submitBtn = document.getElementById('btn-submit-tx');
    const oldText = document.getElementById('submit-btn-text').innerText;
    document.getElementById('submit-btn-text').innerText = 'Gravando...';
    submitBtn.disabled = true;

    try {
        let success = false;
        if (txId) {
            const tx = {
                Id: AppState.isDemoMode ? parseInt(txId) : (isNaN(txId) ? txId : parseInt(txId)),
                Data: formData.get('Data'),
                Descrição: formData.get('Descrição'),
                Categoria: category,
                Valor: amount,
                Tipo: formData.get('Tipo'),
                Recorrência: recurrence
            };
            success = await updateTransactionInSupabase(tx);
        } else {
            if (recurrence === 'Parcelado') {
                const N = parseInt(document.getElementById('tx-installments').value) || 2;
                if (N < 2) {
                    showToast('A quantidade de parcelas deve ser pelo menos 2.', 'warning');
                    throw new Error('Número de parcelas inválido');
                }
                const baseDate = formData.get('Data');
                const baseDesc = formData.get('Descrição');
                const valTotal = amount;
                
                const baseVal = parseFloat((valTotal / N).toFixed(2));
                const diff = parseFloat((valTotal - (baseVal * N)).toFixed(2));

                let allSuccess = true;
                for (let i = 1; i <= N; i++) {
                    const installmentDate = addMonths(baseDate, i - 1);
                    const installmentDesc = `${baseDesc} (${String(i).padStart(2, '0')}/${String(N).padStart(2, '0')})`;
                    const installmentVal = (i === 1) ? parseFloat((baseVal + diff).toFixed(2)) : baseVal;

                    const tx = {
                        Data: installmentDate,
                        Descrição: installmentDesc,
                        Categoria: category,
                        Valor: installmentVal,
                        Tipo: formData.get('Tipo'),
                        Recorrência: 'Parcelado'
                    };

                    if (AppState.isDemoMode) {
                        const nextId = AppState.transactions.length > 0 ? Math.min(...AppState.transactions.map(t => t.Id)) - 1 : -1;
                        tx.Id = nextId;
                    }
                    const singleSuccess = await addTransactionToSupabaseSilent(tx);
                    if (!singleSuccess) {
                        allSuccess = false;
                    }
                }

                if (allSuccess) {
                    showToast(`${N} parcelas gravadas com sucesso!`, 'success');
                    if (!AppState.isDemoMode) {
                        await loadDataFromServer();
                    } else {
                        processAndRefreshUI();
                    }
                    success = true;
                } else {
                    showToast('Algumas parcelas falharam ao ser gravadas.', 'warning');
                    if (!AppState.isDemoMode) {
                        await loadDataFromServer();
                    } else {
                        processAndRefreshUI();
                    }
                }
            } else {
                const tx = {
                    Data: formData.get('Data'),
                    Descrição: formData.get('Descrição'),
                    Categoria: category,
                    Valor: amount,
                    Tipo: formData.get('Tipo'),
                    Recorrência: recurrence
                };
                if (AppState.isDemoMode) {
                    const nextId = AppState.transactions.length > 0 ? Math.min(...AppState.transactions.map(t => t.Id)) - 1 : -1;
                    tx.Id = nextId;
                }
                success = await addTransactionToSupabase(tx);
            }
        }

        if (success) {
            closeModal(document.getElementById('transaction-modal'));
        }
    } catch (err) {
        console.error(err);
    } finally {
        document.getElementById('submit-btn-text').innerText = oldText;
        submitBtn.disabled = false;
    }
}

// --- EDICÃO E EXCLUSÃO (UI HANDLERS) ---
function editTransaction(id) {
    const tx = AppState.transactions.find(t => t.Id === id);
    if (!tx) {
        showToast('Transação não encontrada.', 'error');
        return;
    }

    // Preenche os campos do formulário
    document.getElementById('tx-id').value = tx.Id;
    document.getElementById('tx-description').value = tx.Descrição;
    document.getElementById('tx-amount').value = tx.Valor;
    
    // Tratamento para categoria padrão vs customizada
    const standardCategories = ["Alimentação", "Transporte", "Moradia", "Lazer", "Saúde", "Educação", "Salário", "Investimentos"];
    if (standardCategories.includes(tx.Categoria)) {
        document.getElementById('tx-category').value = tx.Categoria;
        document.getElementById('tx-custom-category-group').style.display = 'none';
        document.getElementById('tx-custom-category').value = '';
        document.getElementById('tx-custom-category').required = false;
    } else {
        document.getElementById('tx-category').value = 'Outros';
        document.getElementById('tx-custom-category-group').style.display = 'flex';
        document.getElementById('tx-custom-category').value = tx.Categoria;
        document.getElementById('tx-custom-category').required = true;
    }
    
    document.getElementById('tx-date').value = tx.Data;
    document.getElementById('tx-recurrence').value = tx.Recorrência;

    // Ocultar campo de parcelas ao editar
    const installmentsGroup = document.getElementById('tx-installments-group');
    if (installmentsGroup) installmentsGroup.style.display = 'none';

    if (tx.Tipo === 'Entrada') {
        document.getElementById('tx-type-income').checked = true;
    } else {
        document.getElementById('tx-type-expense').checked = true;
    }

    // Altera título do modal e botão
    document.getElementById('modal-title').innerText = 'Editar Transação';
    document.getElementById('submit-btn-text').innerText = 'Salvar';
    
    const submitIcon = document.getElementById('submit-btn-icon');
    if (submitIcon) {
        submitIcon.className = '';
        submitIcon.setAttribute('data-lucide', 'check');
    }

    openModal(document.getElementById('transaction-modal'));
    lucide.createIcons();
}

async function deleteTransaction(id) {
    const tx = AppState.transactions.find(t => t.Id === id);
    if (!tx) return;

    const confirmed = await showConfirmModal({
        title: 'Excluir transação',
        message: `Deseja realmente excluir <strong>"${tx.Descrição}"</strong><br>no valor de <strong>${formatCurrency(tx.Valor)}</strong>?`
    });
    if (confirmed) {
        await deleteTransactionFromSupabase(id);
    }
}

// --- DETALHES DE PREVISÃO MENSAL (MODAL) ---
function showForecastDetails(index) {
    const p = AppState.forecastProjections[index];
    if (!p) return;

    document.getElementById('fd-title').innerText = `Detalhamento — ${p.monthLabel}`;
    
    // Constrói itens de Receita
    let incomeItemsHtml = `
        <div class="fd-item">
            <span class="name"><i data-lucide="arrow-down-left"></i> Fixas / Recorrentes</span>
            <span class="val">${formatCurrency(p.details.recorrenteEntrada)}</span>
        </div>
        <div class="fd-item">
            <span class="name"><i data-lucide="plus-circle"></i> Variáveis Estimadas (Média)</span>
            <span class="val">${formatCurrency(p.details.mediaVariavelEntrada)}</span>
        </div>
    `;
    
    if (p.details.avulsoEntrada > 0) {
        incomeItemsHtml += `
            <div class="fd-item">
                <span class="name"><i data-lucide="sparkles"></i> Planejados Avulsos</span>
                <span class="val">${formatCurrency(p.details.avulsoEntrada)}</span>
            </div>
        `;
    }

    // Constrói itens de Despesa
    let expenseItemsHtml = `
        <div class="fd-item">
            <span class="name"><i data-lucide="arrow-up-right"></i> Fixas / Recorrentes</span>
            <span class="val">${formatCurrency(p.details.recorrenteSaida)}</span>
        </div>
        <div class="fd-item">
            <span class="name"><i data-lucide="minus-circle"></i> Variáveis Estimadas (+Ajuste)</span>
            <span class="val">${formatCurrency(p.details.mediaVariavelSaida)}</span>
        </div>
    `;

    if (p.details.avulsoSaida > 0) {
        expenseItemsHtml += `
            <div class="fd-item">
                <span class="name"><i data-lucide="alert-circle"></i> Planejados Avulsos</span>
                <span class="val">${formatCurrency(p.details.avulsoSaida)}</span>
            </div>
        `;
    }

    // Listagem de eventos avulsos específicos
    let eventsHtml = '';
    if (p.details.eventos && p.details.eventos.length > 0) {
        eventsHtml = `
            <div class="fd-section">
                <h4 class="fd-section-title">Eventos Avulsos do Mês</h4>
                <ul class="fd-list">
        `;
        
        p.details.eventos.forEach(ev => {
            const evSign = ev.type === 'Entrada' ? '+' : '-';
            const evClass = ev.type === 'Entrada' ? 'val text-success' : 'val text-danger';
            eventsHtml += `
                <li class="fd-item">
                    <span class="name"><i data-lucide="calendar-check"></i> ${ev.description}</span>
                    <span class="${evClass}">${evSign} ${formatCurrency(ev.amount)}</span>
                </li>
            `;
        });
        
        eventsHtml += `
                </ul>
            </div>
        `;
    }

    const netClass = p.net >= 0 ? 'value positive' : 'value negative';
    const balanceClass = p.balance >= 0 ? 'value positive' : 'value negative';
    const netSign = p.net >= 0 ? '+' : '';

    const html = `
        <div class="fd-section">
            <h4 class="fd-section-title income">Receitas Previstas <span class="val">${formatCurrency(p.income)}</span></h4>
            <div class="fd-list">
                ${incomeItemsHtml}
            </div>
        </div>
        
        <div class="fd-section">
            <h4 class="fd-section-title expense">Despesas Previstas <span class="val">${formatCurrency(p.expense)}</span></h4>
            <div class="fd-list">
                ${expenseItemsHtml}
            </div>
        </div>
        
        ${eventsHtml}
        
        <div class="fd-section">
            <div class="fd-summary-box">
                <div class="fd-summary-item">
                    <span class="label">Fluxo do Mês</span>
                    <span class="${netClass}">${netSign}${formatCurrency(p.net)}</span>
                </div>
                <div class="fd-summary-item">
                    <span class="label">Saldo Final Acumulado</span>
                    <span class="${balanceClass}">${formatCurrency(p.balance)}</span>
                </div>
            </div>
        </div>
    `;

    document.getElementById('fd-body').innerHTML = html;
    openModal(document.getElementById('forecast-details-modal'));
    lucide.createIcons();
}

// --- MOTOR DE PREVISÕES FINANCEIRAS (FORECAST) ---
function calculateForecastAndRender() {
    const historyMonthsCount = parseInt(document.getElementById('forecast-history-months').value) || 6;
    const growthRate = parseFloat(document.getElementById('forecast-growth-rate').value) / 100 || 0;

    const today = new Date();
    const currentYearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    console.log("calculateForecastAndRender -> currentYearMonth (local):", currentYearMonth);

    let currentTotalBalance = 0;
    AppState.transactions.forEach(t => {
        const tYearMonth = t.Data.substring(0, 7);
        if (tYearMonth <= currentYearMonth) {
            if (t.Tipo === 'Entrada') currentTotalBalance += t.Valor;
            else currentTotalBalance -= t.Valor;
        }
    });

    const historyMonths = [];
    for (let i = 1; i <= historyMonthsCount; i++) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        historyMonths.push(d.toISOString().substring(0, 7));
    }

    let totalHistVarIncome = 0;
    let totalHistVarExpense = 0;

    AppState.transactions.forEach(t => {
        const tMonth = t.Data.substring(0, 7);
        if (historyMonths.includes(tMonth) && t.Recorrência === 'Única') {
            if (t.Tipo === 'Entrada') totalHistVarIncome += t.Valor;
            else totalHistVarExpense += t.Valor;
        }
    });

    const avgVarIncome = totalHistVarIncome / historyMonthsCount;
    const avgVarExpense = totalHistVarExpense / historyMonthsCount;

    const recurringTransactions = AppState.transactions.filter(t => t.Recorrência !== 'Única');

    const projections = [];
    let runningBalance = currentTotalBalance;
    let positiveMonthsCount = 0;
    let totalMargins = 0;

    for (let m = 1; m <= 12; m++) {
        const projDate = new Date(today.getFullYear(), today.getMonth() + m, 1);
        const projYearMonth = projDate.toISOString().substring(0, 7);

        let monthlyRecurIncome = 0;
        recurringTransactions.forEach(t => {
            const tYearMonth = t.Data.substring(0, 7);
            if (tYearMonth <= projYearMonth && t.Tipo === 'Entrada') {
                if (t.Recorrência === 'Mensal') {
                    monthlyRecurIncome += t.Valor;
                } else if (t.Recorrência === 'Anual') {
                    const tMonthStr = t.Data.substring(5, 7);
                    const projMonthStr = projYearMonth.substring(5, 7);
                    if (tMonthStr === projMonthStr) monthlyRecurIncome += t.Valor;
                }
            }
        });

        let monthlyRecurExpense = 0;
        recurringTransactions.forEach(t => {
            const tYearMonth = t.Data.substring(0, 7);
            if (tYearMonth <= projYearMonth && t.Tipo === 'Saída') {
                if (t.Recorrência === 'Mensal') {
                    monthlyRecurExpense += t.Valor;
                } else if (t.Recorrência === 'Anual') {
                    const tMonthStr = t.Data.substring(5, 7);
                    const projMonthStr = projYearMonth.substring(5, 7);
                    if (tMonthStr === projMonthStr) monthlyRecurExpense += t.Valor;
                }
            }
        });

        const inflatedVarExpense = avgVarExpense * Math.pow(1 + growthRate, m);

        let customEventsIncome = 0;
        let customEventsExpense = 0;
        const customEventsThisMonth = [];

        AppState.forecastEvents.forEach(e => {
            if (e.date === projYearMonth) {
                if (e.type === 'Entrada') customEventsIncome += e.amount;
                else customEventsExpense += e.amount;
                customEventsThisMonth.push(e);
            }
        });

        let realFutureIncome = 0;
        let realFutureExpense = 0;
        AppState.transactions.forEach(t => {
            const tYearMonth = t.Data.substring(0, 7);
            // Inclui transações únicas E parcelas já cadastradas para meses futuros
            const isScheduled = t.Recorrência === 'Única' || t.Recorrência === 'Parcelado';
            if (tYearMonth === projYearMonth && isScheduled) {
                if (t.Tipo === 'Entrada') realFutureIncome += t.Valor;
                else realFutureExpense += t.Valor;
                
                customEventsThisMonth.push({
                    description: `[Agendado] ${t.Descrição}`,
                    amount: t.Valor,
                    type: t.Tipo,
                    date: tYearMonth
                });
            }
        });

        const projectedIncome = monthlyRecurIncome + avgVarIncome + customEventsIncome + realFutureIncome;
        const projectedExpense = monthlyRecurExpense + inflatedVarExpense + customEventsExpense + realFutureExpense;
        const netFlow = projectedIncome - projectedExpense;

        runningBalance += netFlow;

        if (netFlow > 0) positiveMonthsCount++;
        totalMargins += netFlow;

        const monthName = projDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        const formattedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

        projections.push({
            monthKey: projYearMonth,
            monthLabel: formattedMonth,
            income: projectedIncome,
            expense: projectedExpense,
            net: netFlow,
            balance: runningBalance,
            details: {
                recorrenteEntrada: monthlyRecurIncome,
                recorrenteSaida: monthlyRecurExpense,
                mediaVariavelEntrada: avgVarIncome,
                mediaVariavelSaida: inflatedVarExpense,
                avulsoEntrada: customEventsIncome + realFutureIncome,
                avulsoSaida: customEventsExpense + realFutureExpense,
                eventos: customEventsThisMonth
            }
        });
    }

    const finalProjectedBalance = projections[11].balance;
    document.getElementById('metric-forecast').innerText = formatCurrency(finalProjectedBalance);
    
    const forecastTrendEl = document.getElementById('forecast-trend');
    if (finalProjectedBalance >= currentTotalBalance) {
        forecastTrendEl.className = 'trend positive';
        forecastTrendEl.innerHTML = `<i data-lucide="sparkles"></i> Estimado crescimento`;
    } else {
        forecastTrendEl.className = 'trend negative';
        forecastTrendEl.innerHTML = `<i data-lucide="trending-down"></i> Estimada queda`;
    }

    const avgMargin = totalMargins / 12;
    const avgMarginEl = document.getElementById('forecast-avg-margin');
    avgMarginEl.innerText = formatCurrency(avgMargin);
    if (avgMargin < 0) {
        avgMarginEl.className = 'stat-value text-danger';
    } else {
        avgMarginEl.className = 'stat-value text-success';
    }
    
    document.getElementById('forecast-positive-months').innerText = `${positiveMonthsCount} / 12`;

    renderForecastMatrix(projections);
    AppState.forecastProjections = projections;
    renderForecastEventsList();
    lucide.createIcons();
}

function renderForecastMatrix(projections) {
    const container = document.getElementById('forecast-matrix-list');
    container.innerHTML = '';

    projections.forEach((p, idx) => {
        const row = document.createElement('tr');
        
        const netClass = p.net >= 0 ? 'val-net positive' : 'val-net negative';
        const balClass = p.balance >= 0 ? 'val-proj positive' : 'val-proj negative';
        const signNet = p.net >= 0 ? '+' : '';

        const titleDetails = `Recorrentes: In R$ ${p.details.recorrenteEntrada.toFixed(0)} / Out R$ ${p.details.recorrenteSaida.toFixed(0)}&#13;Variáveis (médias): In R$ ${p.details.mediaVariavelEntrada.toFixed(0)} / Out R$ ${p.details.mediaVariavelSaida.toFixed(0)}&#13;Planejados: In R$ ${p.details.avulsoEntrada.toFixed(0)} / Out R$ ${p.details.avulsoSaida.toFixed(0)}`;

        row.innerHTML = `
            <td style="font-weight: 600;">${p.monthLabel}</td>
            <td class="tx-val income">${formatCurrency(p.income)}</td>
            <td class="tx-val expense">${formatCurrency(p.expense)}</td>
            <td class="${netClass} text-right">${signNet} ${formatCurrency(p.net)}</td>
            <td class="${balClass} text-right">${formatCurrency(p.balance)}</td>
            <td>
                <button class="btn-details" title="${titleDetails}">
                    <i data-lucide="info"></i> Detalhes
                </button>
            </td>
        `;
        
        row.querySelector('.btn-details').addEventListener('click', () => showForecastDetails(idx));
        container.appendChild(row);
    });

    lucide.createIcons();
}

function renderForecastEventsList() {
    const list = document.getElementById('forecast-events-list');
    const emptyText = document.getElementById('empty-forecast-events');
    list.innerHTML = '';

    AppState.forecastEvents.sort((a, b) => a.date.localeCompare(b.date));

    if (AppState.forecastEvents.length === 0) {
        emptyText.style.display = 'block';
        return;
    }

    emptyText.style.display = 'none';

    AppState.forecastEvents.forEach((e, idx) => {
        const li = document.createElement('li');
        li.className = 'forecast-event-item';
        
        const [year, month] = e.date.split('-');
        const dateObj = new Date(year, parseInt(month) - 1, 1);
        const formattedDate = dateObj.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        
        const valClass = e.type === 'Entrada' ? 'fe-val income' : 'fe-val expense';
        const sign = e.type === 'Entrada' ? '+' : '-';

        li.innerHTML = `
            <div class="fe-info">
                <span class="fe-name">${e.description}</span>
                <span class="fe-meta">${formattedDate.toUpperCase()} • ${e.type}</span>
            </div>
            <div class="fe-value-group">
                <span class="${valClass}">${sign} ${formatCurrency(e.amount)}</span>
                <button class="btn-delete-event" data-index="${idx}" title="Excluir evento">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
        `;

        li.querySelector('.btn-delete-event').addEventListener('click', () => {
            deleteForecastEvent(idx);
        });

        list.appendChild(li);
    });

    lucide.createIcons();
}

async function handleForecastEventSubmit(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const amount = parseFloat(formData.get('amount'));
    if (isNaN(amount) || amount <= 0) {
        showToast('Por favor, informe um valor maior que zero.', 'warning');
        return;
    }

    const event = {
        description: formData.get('description'),
        amount: amount,
        type: formData.get('type'),
        date: formData.get('date')
    };

    if (AppState.isDemoMode) {
        AppState.forecastEvents.push(event);
        localStorage.setItem('finvue_demo_forecast_events', JSON.stringify(AppState.forecastEvents));
        closeModal(document.getElementById('forecast-event-modal'));
        showToast('Evento planejado adicionado (Modo Simulação)!', 'success');
        calculateForecastAndRender();
        renderDashboardCharts();
        return;
    }

    try {
        const res = await apiFetch('/api/forecast-events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(event)
        });

        if (!res.ok) throw new Error('Erro ao salvar evento no servidor.');

        closeModal(document.getElementById('forecast-event-modal'));
        showToast('Evento planejado adicionado à previsão!', 'success');
        await loadDataFromServer();
    } catch (error) {
        console.error(error);
        showToast('Erro ao salvar evento planejado no servidor.', 'error');
    }
}

async function deleteForecastEvent(index) {
    const event = AppState.forecastEvents[index];

    if (AppState.isDemoMode) {
        AppState.forecastEvents.splice(index, 1);
        localStorage.setItem('finvue_demo_forecast_events', JSON.stringify(AppState.forecastEvents));
        showToast('Evento planejado excluído.', 'info');
        calculateForecastAndRender();
        renderDashboardCharts();
        return;
    }

    try {
        const res = await apiFetch(`/api/forecast-events/${event.id}`, {
            method: 'DELETE'
        });

        if (!res.ok) throw new Error('Erro ao excluir no servidor.');

        showToast('Evento planejado excluído.', 'info');
        await loadDataFromServer();
    } catch (error) {
        console.error(error);
        showToast('Erro ao excluir evento do servidor.', 'error');
    }
}

// --- GRÁFICOS DO CHART.JS ---
let chartRenderTimeout = null;
function renderDashboardCharts() {
    const isDashboardActive = document.getElementById('dashboard').classList.contains('active');
    if (!isDashboardActive) return;

    if (chartRenderTimeout) clearTimeout(chartRenderTimeout);
    chartRenderTimeout = setTimeout(() => {
        renderBalanceEvolutionChart();
        renderExpensesCategoryChart();
    }, 100);
}

function renderBalanceEvolutionChart() {
    const ctx = document.getElementById('balanceChart').getContext('2d');
    
    if (AppState.balanceChart) {
        AppState.balanceChart.destroy();
    }

    const historyMap = new Map();
    const sortedChronological = [...AppState.transactions].reverse();

    let accumBalance = 0;
    
    const today = new Date();
    const currentYearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    const historicalMonthsSet = new Set();
    sortedChronological.forEach(t => {
        const m = t.Data.substring(0, 7);
        if (m <= currentYearMonth) {
            historicalMonthsSet.add(m);
        }
    });

    const historicalMonths = Array.from(historicalMonthsSet).sort();
    
    historicalMonths.forEach(month => {
        const monthTransactions = AppState.transactions.filter(t => t.Data.startsWith(month));
        
        let monthNet = 0;
        monthTransactions.forEach(t => {
            if (t.Tipo === 'Entrada') monthNet += t.Valor;
            else monthNet -= t.Valor;
        });
        
        accumBalance += monthNet;
        historyMap.set(month, accumBalance);
    });

    const forecasts = AppState.forecastProjections || [];

    const labels = [];
    const historyData = [];
    const projectionData = [];

    historicalMonths.forEach(m => {
        const [year, month] = m.split('-');
        const d = new Date(year, parseInt(month) - 1, 1);
        labels.push(d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }));
        historyData.push(historyMap.get(m));
        projectionData.push(null);
    });

    const connectionBalance = accumBalance;
    if (historyData.length > 0) {
        projectionData[projectionData.length - 1] = connectionBalance;
    }

    forecasts.forEach(f => {
        const [year, month] = f.monthKey.split('-');
        const d = new Date(year, parseInt(month) - 1, 1);
        labels.push(d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }));
        historyData.push(null);
        projectionData.push(f.balance);
    });

    const histGradient = ctx.createLinearGradient(0, 0, 0, 300);
    histGradient.addColorStop(0, 'rgba(99, 102, 241, 0.25)');
    histGradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

    const projGradient = ctx.createLinearGradient(0, 0, 0, 300);
    projGradient.addColorStop(0, 'rgba(245, 158, 11, 0.18)');
    projGradient.addColorStop(1, 'rgba(245, 158, 11, 0.0)');

    AppState.balanceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Histórico Real',
                    data: historyData,
                    borderColor: '#6366f1',
                    borderWidth: 3,
                    backgroundColor: histGradient,
                    fill: true,
                    tension: 0.35,
                    pointBackgroundColor: '#6366f1',
                    pointBorderColor: 'rgba(255,255,255,0.8)',
                    pointHoverRadius: 6,
                    spanGaps: false
                },
                {
                    label: 'Projeção Futura',
                    data: projectionData,
                    borderColor: '#f59e0b',
                    borderWidth: 3,
                    borderDash: [6, 6],
                    backgroundColor: projGradient,
                    fill: true,
                    tension: 0.35,
                    pointBackgroundColor: '#f59e0b',
                    pointBorderColor: 'rgba(255,255,255,0.8)',
                    pointHoverRadius: 6,
                    spanGaps: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: '#1e293b',
                    titleColor: '#ffffff',
                    bodyColor: '#e2e8f0',
                    borderColor: 'rgba(255, 255, 255, 0.08)',
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) label += formatCurrency(context.parsed.y);
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
                    ticks: {
                        color: '#9ca3af',
                        font: { family: 'Inter', size: 11 },
                        callback: value => 'R$ ' + value.toLocaleString('pt-BR')
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#9ca3af', font: { family: 'Inter', size: 10 } }
                }
            }
        }
    });
}

function renderExpensesCategoryChart() {
    const ctx = document.getElementById('categoryChart').getContext('2d');

    if (AppState.categoryChart) {
        AppState.categoryChart.destroy();
    }

    const now = new Date();
    const currentYearMonth = now.toISOString().substring(0, 7);

    const categoriesTotals = {};
    let totalExpensesThisMonth = 0;

    AppState.transactions.forEach(t => {
        const tMonth = t.Data.substring(0, 7);
        if (tMonth === currentYearMonth && t.Tipo === 'Saída') {
            categoriesTotals[t.Categoria] = (categoriesTotals[t.Categoria] || 0) + t.Valor;
            totalExpensesThisMonth += t.Valor;
        }
    });

    const labels = Object.keys(categoriesTotals);
    const data = Object.values(categoriesTotals);

    if (labels.length === 0) {
        AppState.categoryChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Nenhum gasto registrado'],
                datasets: [{
                    data: [1],
                    backgroundColor: ['rgba(255, 255, 255, 0.05)'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%',
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false }
                }
            }
        });
        return;
    }

    const colors = labels.map(label => getCategoryColorStyles(label).solid);

    AppState.categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: '#111726',
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#9ca3af',
                        font: { family: 'Inter', size: 10 },
                        padding: 12,
                        boxWidth: 8,
                        boxHeight: 8,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    backgroundColor: '#1e293b',
                    titleColor: '#ffffff',
                    bodyColor: '#e2e8f0',
                    borderColor: 'rgba(255, 255, 255, 0.08)',
                    borderWidth: 1,
                    padding: 10,
                    callbacks: {
                        label: function(context) {
                            const val = context.parsed;
                            const pct = ((val / totalExpensesThisMonth) * 100).toFixed(0) + '%';
                            return ` ${context.label}: ${formatCurrency(val)} (${pct})`;
                        }
                    }
                }
            }
        }
    });
}

// --- CONFIGURAÇÕES DE REDE (INFO) ---
// O status do banco é atualizado automaticamente a partir do servidor

// --- AUXILIARES E FORMATAÇÕES ---
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDateBR(dateStr) {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
}

const categoryColorCache = {};

function getCategoryColorStyles(category) {
    if (categoryColorCache[category]) {
        return categoryColorCache[category];
    }

    const defaultColors = {
        "Alimentação": { solid: "#fb7185", bg: "rgba(251, 113, 133, 0.12)", border: "rgba(251, 113, 133, 0.25)" },
        "Transporte": { solid: "#fb923c", bg: "rgba(251, 146, 60, 0.12)", border: "rgba(251, 146, 60, 0.25)" },
        "Moradia": { solid: "#60a5fa", bg: "rgba(96, 165, 250, 0.12)", border: "rgba(96, 165, 250, 0.25)" },
        "Lazer": { solid: "#c084fc", bg: "rgba(192, 132, 252, 0.12)", border: "rgba(192, 132, 252, 0.25)" },
        "Saúde": { solid: "#34d399", bg: "rgba(52, 211, 153, 0.12)", border: "rgba(52, 211, 153, 0.25)" },
        "Educação": { solid: "#22d3ee", bg: "rgba(34, 211, 238, 0.12)", border: "rgba(34, 211, 238, 0.25)" },
        "Investimentos": { solid: "#a3e635", bg: "rgba(163, 230, 53, 0.12)", border: "rgba(163, 230, 53, 0.25)" },
        "Salário": { solid: "#10b981", bg: "rgba(16, 185, 129, 0.12)", border: "rgba(16, 185, 129, 0.25)" },
        "Outros": { solid: "#9ca3af", bg: "rgba(156, 163, 175, 0.12)", border: "rgba(156, 163, 175, 0.25)" }
    };

    if (defaultColors[category]) {
        categoryColorCache[category] = defaultColors[category];
        return defaultColors[category];
    }

    let hash = 0;
    for (let i = 0; i < category.length; i++) {
        hash = category.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    const solid = `hsl(${hue}, 70%, 62%)`;
    const bg = `hsla(${hue}, 70%, 62%, 0.12)`;
    const border = `hsla(${hue}, 70%, 62%, 0.25)`;

    const styles = { solid, bg, border };
    categoryColorCache[category] = styles;
    return styles;
}

function getCategoryIcon(category) {
    const icons = {
        "Alimentação": "shopping-bag",
        "Transporte": "car",
        "Moradia": "home",
        "Lazer": "tv",
        "Saúde": "heart-pulse",
        "Educação": "book-open",
        "Salário": "banknote",
        "Investimentos": "line-chart",
        "Outros": "help-circle"
    };
    return icons[category] || "help-circle";
}

// --- TOAST NOTIFICATIONS HELPER ---
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle';
    if (type === 'error') iconName = 'alert-triangle';
    if (type === 'warning') iconName = 'alert-circle';

    toast.innerHTML = `
        <i data-lucide="${iconName}"></i>
        <div class="toast-message">${message}</div>
        <button class="toast-close"><i data-lucide="x"></i></button>
    `;

    container.appendChild(toast);
    lucide.createIcons();

    toast.querySelector('.toast-close').addEventListener('click', () => {
        removeToast(toast);
    });

    setTimeout(() => {
        removeToast(toast);
    }, 4500);
}

function removeToast(toastEl) {
    if (toastEl.parentNode) {
        toastEl.classList.add('removing');
        toastEl.addEventListener('transitionend', () => {
            toastEl.remove();
        });
    }
}

// --- CONFIRM MODAL (substituição do confirm() nativo) ---
function showConfirmModal({ title = 'Confirmar exclusão', message = 'Tem certeza que deseja excluir este item?' } = {}) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('confirm-modal');
        const titleEl = document.getElementById('confirm-modal-title');
        const msgEl   = document.getElementById('confirm-modal-message');
        const btnOk   = document.getElementById('confirm-modal-ok');
        const btnCancel = document.getElementById('confirm-modal-cancel');

        titleEl.textContent = title;
        msgEl.innerHTML     = message;

        overlay.classList.add('active');
        lucide.createIcons();

        const cleanup = (result) => {
            overlay.classList.remove('active');
            btnOk.removeEventListener('click', onOk);
            btnCancel.removeEventListener('click', onCancel);
            overlay.removeEventListener('click', onBackdrop);
            resolve(result);
        };

        const onOk      = () => cleanup(true);
        const onCancel  = () => cleanup(false);
        const onBackdrop = (e) => { if (e.target === overlay) cleanup(false); };

        btnOk.addEventListener('click', onOk);
        btnCancel.addEventListener('click', onCancel);
        overlay.addEventListener('click', onBackdrop);
    });
}
