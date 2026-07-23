let state = {
    employees: [
        { name: 'Michel Maldonado', dni: 'admin', role: 'admin' },
        { name: 'Juan Perez', dni: '12345678', role: 'worker' }
    ],
    wos: [
        { id: '82702210', title: 'Centro de Costos REP' },
        { id: 'WO-1001', title: 'Mantenimiento Preventivo' },
        { id: 'WO-1002', title: 'Cambio de Forros' },
        { id: 'WO-1003', title: 'Reparación de Bomba' }
    ],
    logs: [],
    settings: {
        webhookUrl: 'https://default5c5456f4c40240c5a73de78777e7bf.9e.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/2be87a1eee2d4e16b7e4f1da5a1ce135/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=AmYY8MuXOiE1Dx3jiAc0ROnk_uZwUomthZ6EIt29iVc'
    },
    currentUser: null,
    currentDate: new Date().toISOString().split('T')[0]
};

let editingLogId = null;

// Theme Logic Init
const savedTheme = localStorage.getItem('tareo_theme');
if (savedTheme === 'light') {
    document.body.classList.add('theme-light');
}

// Sound Logic Init
let soundEnabled = true;
const savedSound = localStorage.getItem('tareo_sound');
if (savedSound === 'off') {
    soundEnabled = false;
}

// Load state from localStorage
function loadState() {
    try {
        const savedState = localStorage.getItem('tareo_state_v6');
        if (savedState) {
            const parsed = JSON.parse(savedState);
            state.employees = parsed.employees || state.employees;
            state.wos = parsed.wos || state.wos;
            if (state.wos.length > 0 && typeof state.wos[0] === 'string') {
                state.wos = state.wos.map(w => ({ id: w, title: '' }));
            }
            
            // Inyectar WO de Centro de Costos si el caché antiguo no la tiene
            if (!state.wos.find(w => w.id === '82702210')) {
                state.wos.unshift({ id: '82702210', title: 'Centro de Costos REP' });
            }
            state.logs = parsed.logs || [];
            state.settings = parsed.settings || state.settings;
        }
    } catch (e) {
        console.warn("LocalStorage no está disponible o está bloqueado por el navegador.", e);
    }
    
    // Sobrescribir con configuración global (config.js) si existe
    if (typeof CONFIGURACION_GLOBAL !== 'undefined') {
        state.settings.webhookUrl = CONFIGURACION_GLOBAL.webhookUrl;
        
        if (CONFIGURACION_GLOBAL.wosRawText) {
            const lines = CONFIGURACION_GLOBAL.wosRawText.split('\n').map(l => l.trim()).filter(l => l);
            state.wos = lines.map(line => {
                if (line.includes('\t')) {
                    const parts = line.split('\t');
                    return { id: parts[0].trim(), title: parts.slice(1).join(' ').trim() };
                } else if (line.includes('|')) {
                    const parts = line.split('|');
                    return { id: parts[0].trim(), title: parts.slice(1).join(' ').trim() };
                } else {
                    const firstSpace = line.indexOf(' ');
                    if (firstSpace > -1) {
                        return { id: line.substring(0, firstSpace).trim(), title: line.substring(firstSpace).trim() };
                    }
                    return { id: line, title: '' };
                }
            });
        }
        
        if (CONFIGURACION_GLOBAL.empleadosRawText) {
            const lines = CONFIGURACION_GLOBAL.empleadosRawText.split('\n').map(l => l.trim()).filter(l => l);
            const loadedEmployees = [];
            
            // Mantenemos siempre al admin por seguridad
            const existingAdmin = state.employees.find(e => e.role === 'admin');
            if (existingAdmin) loadedEmployees.push(existingAdmin);
            
            const toTitleCase = (str) => {
                return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
            };
            
            lines.forEach(line => {
                if (line.includes('\t')) {
                    const parts = line.split('\t');
                    // Si hay 6 columnas (con nombre corto): Nombres | Nombre Corto | DNI | P/N | Cargo | Área
                    // Si hay 5 columnas: Nombres | DNI | P/N | Cargo | Área
                    if (parts.length >= 6) {
                        loadedEmployees.push({
                            fullName: toTitleCase(parts[0].trim()),
                            name: toTitleCase(parts[1].trim()),
                            dni: parts[2].trim(),
                            pn: parts[3] ? parts[3].trim() : '',
                            cargo: toTitleCase(parts[4] ? parts[4].trim() : ''),
                            area: toTitleCase(parts[5] ? parts[5].trim() : ''),
                            role: 'worker'
                        });
                    } else if (parts.length >= 2) {
                        loadedEmployees.push({
                            fullName: toTitleCase(parts[0].trim()),
                            name: toTitleCase(parts[0].trim()),
                            dni: parts[1].trim(),
                            pn: parts[2] ? parts[2].trim() : '',
                            cargo: toTitleCase(parts[3] ? parts[3].trim() : ''),
                            area: toTitleCase(parts[4] ? parts[4].trim() : ''),
                            role: 'worker'
                        });
                    }
                }
            });
            
            if (loadedEmployees.length > (existingAdmin ? 1 : 0)) {
                state.employees = loadedEmployees;
            }
        }
    }
}

function saveState() {
    try {
        localStorage.setItem('tareo_state_v6', JSON.stringify({
            employees: state.employees,
            wos: state.wos,
            logs: state.logs,
            settings: state.settings
        }));
    } catch (e) {
        console.warn("No se pudo guardar en LocalStorage.", e);
        // Fallback silencioso: los datos viven en la variable 'state' mientras no se recargue la página.
    }
}

// --- CONSTANTS ---
const ACTIVIDADES = [
    "RECEPCIÓN", "DESMONTAJE Y LIMPIEZA", "EVALUACIÓN DE COMPONENTES", "REPARACIÓN DE FISURAS",
    "PRE MECANIZADO", "RECUPERACIÓN DE DESGASTE", "MECANIZADO", "ENSAMBLE", "ACABADOS",
    "EMBALAJE", "DESPACHO", "MOVIMIENTO DE COMPONENTES", "ORDEN Y LIMPIEZA", "CAPACITACIONES",
    "FESTIVIDADES", "HABILITACIONES", "PERMISOS - COMPENSADO POR HE", "ELABORACIÓN DE PLANOS / MEMORIA DE CALCULO",
    "DESCANSO MEDICO", "ELABORACION DE DOCUMENTOS", "ARMADO (FABRICACIONES)", "CITA O CONSULTA MÉDICA",
    "EXAMEN MEDICO ANUAL"
];

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    // Theme Toggle Setup
    const themeToggle = document.getElementById('theme-toggle');
    const iconSun = document.getElementById('icon-sun');
    const iconMoon = document.getElementById('icon-moon');
    if (themeToggle) {
        if (savedTheme === 'light') {
            iconSun.style.display = 'block';
            iconMoon.style.display = 'none';
        } else {
            iconSun.style.display = 'none';
            iconMoon.style.display = 'block';
        }
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('theme-light');
            const isLight = document.body.classList.contains('theme-light');
            localStorage.setItem('tareo_theme', isLight ? 'light' : 'dark');
            iconSun.style.display = isLight ? 'block' : 'none';
            iconMoon.style.display = isLight ? 'none' : 'block';
        });
    }

    // Sound Toggle Setup
    const soundToggle = document.getElementById('sound-toggle');
    const iconSoundOn = document.getElementById('icon-sound-on');
    const iconSoundOff = document.getElementById('icon-sound-off');
    if (soundToggle) {
        if (soundEnabled) {
            iconSoundOn.style.display = 'block';
            iconSoundOff.style.display = 'none';
        } else {
            iconSoundOn.style.display = 'none';
            iconSoundOff.style.display = 'block';
        }
        
        soundToggle.addEventListener('click', () => {
            soundEnabled = !soundEnabled;
            localStorage.setItem('tareo_sound', soundEnabled ? 'on' : 'off');
            iconSoundOn.style.display = soundEnabled ? 'block' : 'none';
            iconSoundOff.style.display = soundEnabled ? 'none' : 'block';
        });
    }

    loadState();
    setupUI();
    setupEventListeners();
});

function setupUI() {
    // Poblar Actividades
    const actSelect = document.getElementById('actividad');
    ACTIVIDADES.forEach(act => {
        const option = document.createElement('option');
        option.value = act;
        option.textContent = act;
        actSelect.appendChild(option);
    });

    // Set Default Date
    document.getElementById('fecha').value = state.currentDate;
    document.getElementById('admin-fecha-omision').value = state.currentDate;
    
    // Set Default Dates for Accumulated Permits (First and Last day of current month)
    const today = new Date(state.currentDate + "T00:00:00");
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    const formatDate = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };
    
    const inputDesde = document.getElementById('permiso-desde');
    const inputHasta = document.getElementById('permiso-hasta');
    if (inputDesde) inputDesde.value = formatDate(firstDay);
    if (inputHasta) inputHasta.value = formatDate(lastDay);

    const extraDesde = document.getElementById('extra-desde');
    const extraHasta = document.getElementById('extra-hasta');
    if (extraDesde) extraDesde.value = formatDate(firstDay);
    if (extraHasta) extraHasta.value = formatDate(lastDay);

    initDateCustomFormats();
    renderPersonalTable();
}

function updateDateCustomFormat(input) {
    if (!input || !input.value) {
        input.setAttribute("data-date", "");
        return;
    }
    const parts = input.value.split('-'); // YYYY-MM-DD
    if (parts.length === 3) {
        input.setAttribute("data-date", `${parts[2]}/${parts[1]}/${parts[0]}`);
    } else {
        input.setAttribute("data-date", input.value);
    }
}

function initDateCustomFormats() {
    const dateInputs = document.querySelectorAll('.date-custom');
    dateInputs.forEach(input => {
        updateDateCustomFormat(input);
        input.addEventListener('input', () => updateDateCustomFormat(input));
        input.addEventListener('change', () => updateDateCustomFormat(input));
    });
}

function setupEventListeners() {
    // Autocompletado (solo se inicializa una vez)
    setupAutocomplete(document.getElementById('wo'));

    // Navigation
    const navButtons = document.querySelectorAll('.admin-nav .btn-tab');
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('logout-btn').addEventListener('click', handleLogout);

    // Formulario de Tareo
    document.getElementById('tareo-form').addEventListener('submit', handleTareoSubmit);
    
    // Listeners para el Acumulado de Permisos
    const inputDesde = document.getElementById('permiso-desde');
    const inputHasta = document.getElementById('permiso-hasta');
    if (inputDesde) inputDesde.addEventListener('change', updateAccumulatedPermisos);
    if (inputHasta) inputHasta.addEventListener('change', updateAccumulatedPermisos);
    
    // Listeners para el Acumulado de Extras
    const extraDesde = document.getElementById('extra-desde');
    const extraHasta = document.getElementById('extra-hasta');
    if (extraDesde) extraDesde.addEventListener('change', updateAccumulatedExtra);
    if (extraHasta) extraHasta.addEventListener('change', updateAccumulatedExtra);
    
    // Título dinámico para la WO
    document.getElementById('wo').addEventListener('input', (e) => {
        const val = e.target.value.trim();
        const display = document.getElementById('wo-title-display');
        if (!display) return;
        
        const found = state.wos.find(w => w.id === val);
        
        if (!val) {
            display.value = '';
            display.style.color = 'var(--text-muted)';
            display.style.borderColor = 'var(--border-glass)';
        } else if (found) {
            display.value = found.title || 'WO válida (sin título)';
            display.style.color = 'var(--accent-primary)';
            display.style.borderColor = 'var(--accent-primary)';
        } else {
            display.value = '⚠️ WO NO EXISTE EN BASE DE DATOS';
            display.style.color = 'var(--danger)';
            display.style.borderColor = 'var(--danger)';
        }
    });
    
    // Reproceso Toggle
    document.getElementById('reproceso').addEventListener('change', (e) => {
        const group = document.getElementById('reproceso-motivo-group');
        const input = document.getElementById('reproceso-motivo');
        if (e.target.checked) {
            group.style.display = 'block';
            input.required = true;
        } else {
            group.style.display = 'none';
            input.required = false;
            input.value = '';
        }
    });

    // Update progress on date/turno change
    document.getElementById('fecha').addEventListener('change', (e) => {
        state.currentDate = e.target.value;
        updateWorkerDashboard();
        renderDailyLogs();
    });
    document.getElementById('turno').addEventListener('change', updateWorkerDashboard);

    // Admin Tabs
    document.querySelectorAll('#admin-view .btn-tab').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('#admin-view .btn-tab').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('#admin-view .tab-content').forEach(c => c.style.display = 'none');
            
            e.target.classList.add('active');
            if (e.target.dataset.tab) {
                document.getElementById(e.target.dataset.tab).style.display = 'block';
            }
        });
    });

    // Admin Actions (Guardar configuración eliminado, ahora se lee de config.js)

    document.getElementById('admin-fecha-omision').addEventListener('change', renderOmisiones);
    document.getElementById('btn-copiar-whatsapp').addEventListener('click', copyOmisionesToClipboard);

    const matrixWeek = document.getElementById('matrix-week');
    if (matrixWeek) matrixWeek.addEventListener('change', renderWeeklyMatrix);
    const matrixSearch = document.getElementById('matrix-search');
    if (matrixSearch) matrixSearch.addEventListener('input', renderWeeklyMatrix);
    const workerMatrixWeek = document.getElementById('worker-matrix-week');
    if (workerMatrixWeek) workerMatrixWeek.addEventListener('change', renderWorkerMatrix);

    document.getElementById('form-add-personal').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('new-user-name').value.trim();
        const dni = document.getElementById('new-user-dni').value.trim();
        state.employees.push({ name, dni, role: 'worker' });
        saveState();
        renderPersonalTable();
        e.target.reset();
    });

    document.getElementById('export-csv-btn').addEventListener('click', exportToCSV);
    document.getElementById('clear-data-btn').addEventListener('click', () => {
        if(confirm('¿Estás seguro de borrar todos los registros de tareo? Esto no se puede deshacer.')) {
            state.logs = [];
            saveState();
            updateAdminDashboard();
            alert('Datos borrados.');
        }
    });
}

// --- CORE LOGIC ---

function handleLogin(e) {
    e.preventDefault();
    const user = document.getElementById('login-user').value.trim();
    const dni = document.getElementById('login-dni').value.trim();

    const employee = state.employees.find(emp => 
        (emp.name.toLowerCase() === user.toLowerCase() || (emp.fullName && emp.fullName.toLowerCase() === user.toLowerCase())) && 
        emp.dni === dni
    );
    if (employee) {
        state.currentUser = employee;
        document.getElementById('current-user-name').textContent = employee.name;
        
        document.getElementById('login-screen').classList.remove('active');
        document.getElementById('app-screen').classList.add('active');
        window.scrollTo(0, 0);

        if (employee.role === 'admin') {
            document.getElementById('greeting-title').textContent = `Hola, ${employee.name.split(' ')[0]} 👋`;
            document.getElementById('greeting-subtitle').textContent = 'Bienvenido al panel de administración.';
            document.getElementById('worker-view').classList.remove('active');
            document.getElementById('admin-view').style.display = 'block';
            
            const clearDataBtn = document.getElementById('clear-data-btn');
            if (clearDataBtn) {
                if (employee.name === 'Michel Maldonado') {
                    clearDataBtn.style.display = 'inline-block';
                } else {
                    clearDataBtn.style.display = 'none';
                }
            }
            
            // Set default week to today
            currentAdminMatrixDate = new Date();
            
            updateAdminDashboard();
            renderOmisiones();
            if(typeof renderWeeklyMatrix === 'function') renderWeeklyMatrix();
        } else {
            const workerPhrases = [
                "¡Qué tal tu turno! Empecemos con tu reporte de actividades.",
                "¡Bienvenido! Registra tus horas de forma rápida y sencilla.",
                "¡Gran trabajo hoy! No olvides registrar todas tus actividades.",
                "Tu reporte es importante. ¡Vamos a registrar tu progreso de hoy!",
                "¡Excelente turno! Aseguremos que todas tus horas queden guardadas.",
                "Un turno seguro es un buen turno. ¡Vamos con tu reporte de horas!",
                "Mantén tu tareo al día. ¡Tus horas de esfuerzo cuentan mucho!",
                "¡Hola! Tómate unos minutos para dejar registrado tu excelente trabajo."
            ];
            const randomPhrase = workerPhrases[Math.floor(Math.random() * workerPhrases.length)];
            
            document.getElementById('greeting-title').textContent = `Hola, ${employee.name.split(' ')[0]} 👋`;
            document.getElementById('greeting-subtitle').textContent = randomPhrase;
            document.getElementById('admin-view').style.display = 'none';
            document.getElementById('worker-view').classList.add('active');
            
            // Setup worker matrix default week
            currentWorkerMatrixDate = new Date();

            updateWorkerDashboard();
            renderDailyLogs();
            if (typeof renderWorkerMatrix === 'function') renderWorkerMatrix();
        }
    } else {
        playErrorSound();
        alert('Usuario o Clave (DNI) incorrectos. Verifica tus datos.');
    }
}

function handleLogout() {
    state.currentUser = null;
    document.getElementById('app-screen').classList.remove('active');
    document.getElementById('login-screen').classList.add('active');
    document.getElementById('login-form').reset();
    
    // Clear chat history
    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages) {
        chatMessages.innerHTML = `
            <div class="chat-message bot">
                <div class="bubble">
                    ¡Bip bop! Hola, soy tu asistente virtual. Conozco todas las reglas de Tareo Planta y tengo acceso a tus registros. ¿En qué te puedo ayudar hoy?
                </div>
            </div>
        `;
    }
    
    window.scrollTo(0, 0);
}

function getDailyNormalHours(workerName, date, turnoParam = null) {
    return state.logs
        .filter(l => l.usuario === workerName && l.fecha === date && l.tipo_hora === 'Normales' && (!turnoParam || l.turno === turnoParam))
        .reduce((sum, l) => sum + parseFloat(l.horas), 0);
}

function getDailyExtraHours(workerName, date, turnoParam = null) {
    return state.logs
        .filter(l => l.usuario === workerName && l.fecha === date && (l.tipo_hora === 'SHE' || l.tipo_hora === 'DHE') && (!turnoParam || l.turnoParam === turnoParam || l.turno === turnoParam))
        .reduce((sum, l) => sum + parseFloat(l.horas), 0);
}

function setupAutocomplete(inp) {
    let currentFocus;
    if (!inp) return;
    
    // Función para cerrar las listas
    function closeAllLists(elmnt) {
        var x = document.getElementsByClassName("autocomplete-items");
        for (var i = 0; i < x.length; i++) {
            if (elmnt != x[i] && elmnt != inp) {
                x[i].parentNode.removeChild(x[i]);
            }
        }
    }
    
    // Al escribir
    inp.addEventListener("input", function(e) {
        let a, b, i, val = this.value;
        const arr = state.wos; // Siempre leer el estado actualizado
        closeAllLists();
        if (!val) { return false; }
        currentFocus = -1;
        
        a = document.createElement("DIV");
        a.setAttribute("id", this.id + "-autocomplete-list");
        a.setAttribute("class", "autocomplete-items");
        this.parentNode.appendChild(a);
        
        let count = 0;
        for (i = 0; i < arr.length; i++) {
            const searchStr = String(arr[i].id).toUpperCase() + " " + (arr[i].title || '').toUpperCase();
            if (searchStr.includes(val.toUpperCase()) && count < 30) {
                b = document.createElement("DIV");
                b.innerHTML = `<strong>${arr[i].id}</strong> - ${arr[i].title || ''}`;
                b.innerHTML += `<input type='hidden' value='${arr[i].id}'>`;
                b.addEventListener("click", function(e) {
                    inp.value = this.getElementsByTagName("input")[0].value;
                    inp.dispatchEvent(new Event('input')); // Disparar evento para actualizar titulo
                    closeAllLists();
                });
                a.appendChild(b);
                count++;
            }
        }
    });

    // Al enfocar (mostrar algunas opciones por defecto o si ya hay texto)
    inp.addEventListener("focus", function() {
        if (this.value !== "") {
            this.dispatchEvent(new Event('input'));
        }
    });

    document.addEventListener("click", function (e) {
        closeAllLists(e.target);
    });
}

// --- GAMIFICATION LOGIC ---
function playSuccessSound() {
    if (!soundEnabled) return;
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.1); // C6
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
    } catch(e) {}
}

function playUpdateSound() {
    if (!soundEnabled) return;
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
        osc.frequency.setValueAtTime(1108.73, ctx.currentTime + 0.1); // C#6
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.2);
    } catch(e) {}
}

function playErrorSound() {
    if (!soundEnabled) return;
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, ctx.currentTime); // Sonido grave de error
        osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
    } catch(e) {}
}

function calculateStreaks(employeeName) {
    const dParts = state.currentDate.split('-');
    const today = new Date(dParts[0], dParts[1] - 1, dParts[2]); 
    let dailyStreak = 0;
    const userLogs = state.logs.filter(l => l.usuario === employeeName);
    const hasLogOnDate = (dateStr) => userLogs.some(l => l.fecha === dateStr);
    
    const formatDate = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    let checkDate = new Date(today);
    let isStreakAlive = true;
    
    for (let i = 0; i < 365; i++) {
        if (!isStreakAlive) break;
        const dateStr = formatDate(checkDate);
        const dayOfWeek = checkDate.getDay(); 
        const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
        const logged = hasLogOnDate(dateStr);
        
        if (logged) {
            dailyStreak++;
        } else {
            if (i === 0) {
                // Today missing is fine
            } else if (isWeekend) {
                // Weekend missing is fine
            } else {
                isStreakAlive = false;
            }
        }
        checkDate.setDate(checkDate.getDate() - 1);
    }
    
    let missedDays = 0;
    if (dailyStreak === 0) {
        let missCheckDate = new Date(today);
        missCheckDate.setDate(missCheckDate.getDate() - 1); 
        for (let i = 0; i < 30; i++) {
            const dateStr = formatDate(missCheckDate);
            const dayOfWeek = missCheckDate.getDay();
            const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
            if (!isWeekend) {
                if (!hasLogOnDate(dateStr)) {
                    missedDays++;
                } else {
                    break;
                }
            }
            missCheckDate.setDate(missCheckDate.getDate() - 1);
        }
    }

    const currentWeekMonday = new Date(today);
    const diff = today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1);
    currentWeekMonday.setDate(diff);
    
    let weeklyStreak = 0;
    let checkWeekMonday = new Date(currentWeekMonday);
    
    for (let i = 0; i < 52; i++) {
        let weekNormalHours = 0;
        let weekDates = [];
        for (let d = 0; d < 7; d++) {
            const curr = new Date(checkWeekMonday);
            curr.setDate(checkWeekMonday.getDate() + d);
            weekDates.push(formatDate(curr));
        }
        
        userLogs.forEach(l => {
            if (weekDates.includes(l.fecha) && l.tipo_hora === 'Normales') {
                weekNormalHours += parseFloat(l.horas) || 0;
            }
        });
        
        if (weekNormalHours >= 46.25) {
            weeklyStreak++;
        } else {
            if (i === 0) {
                // Current week missing is fine
            } else {
                break;
            }
        }
        checkWeekMonday.setDate(checkWeekMonday.getDate() - 7);
    }
    
    return { dailyStreak, weeklyStreak, missedDays };
}

function updateWorkerDashboard() {
    if (!state.currentUser) return;
    const date = document.getElementById('fecha').value;
    const turno = document.getElementById('turno').value;
    
    let maxNormal = turno === 'Día' ? 9.25 : 11.25;
    if (date) {
        const dParts = date.split('-');
        const selectedDate = new Date(dParts[0], dParts[1] - 1, dParts[2]);
        const weekDates = getDatesOfWeekFromDate(selectedDate);
        
        let previousNormalHours = 0;
        state.logs.forEach(l => {
            if (l.usuario === state.currentUser.name && weekDates.includes(l.fecha) && l.fecha < date) {
                if (l.tipo_hora === 'Normales') {
                    previousNormalHours += parseFloat(l.horas) || 0;
                }
            }
        });
        
        const remainingWeekly = Math.max(0, 46.25 - previousNormalHours);
        maxNormal = Math.min(maxNormal, remainingWeekly);
        
        // Actualizar el texto del dropdown para que sea dinámico
        const turnoSelect = document.getElementById('turno');
        if (turnoSelect) {
            turnoSelect.options[0].text = `Día (Max ${Math.min(9.25, remainingWeekly).toFixed(2)}h normales)`;
            turnoSelect.options[1].text = `Noche (Max ${Math.min(11.25, remainingWeekly).toFixed(2)}h normales)`;
        }
    }
    
    // Solo calcular horas para el turno seleccionado en el dashboard
    const normalLogged = getDailyNormalHours(state.currentUser.name, date, turno);
    const extraLogged = getDailyExtraHours(state.currentUser.name, date, turno);

    const progressPercent = Math.min((normalLogged / maxNormal) * 100, 100);
    document.getElementById('normal-progress-bar').style.width = progressPercent + '%';
    
    const faltan = maxNormal - normalLogged;
    document.getElementById('normal-hours-text').textContent = 
        `${normalLogged.toFixed(2)} / ${maxNormal.toFixed(2)} hh ${faltan > 0 ? `(Faltan ${faltan.toFixed(2)} hh)` : '(Completado)'}`;
        
    const extraEl = document.getElementById('extra-hours-text');
    if(extraEl) extraEl.textContent = `${extraLogged.toFixed(2)} hh`;

    // --- CÁLCULOS SEMANALES ---
    // (Movidos a renderWorkerMatrix para sincronizar con la matriz)
    
    // UI Rachas
    const badgesContainer = document.getElementById('worker-badges');
    const mascotContainer = document.getElementById('mascot-container');
    const mascotBubble = document.getElementById('mascot-bubble');
    
    if (state.currentUser.role === 'worker') {
        const streaks = calculateStreaks(state.currentUser.name);
        
        if (badgesContainer) {
            badgesContainer.style.display = (streaks.dailyStreak > 0 || streaks.weeklyStreak > 0) ? 'flex' : 'none';
            document.getElementById('daily-streak-text').textContent = `${streaks.dailyStreak} días`;
            document.getElementById('weekly-streak-text').textContent = `${streaks.weeklyStreak} sem`;
        }
        
        if (mascotContainer) {
            mascotContainer.style.display = 'flex';
            const mascotImg = document.getElementById('mascot-image');
            if (mascotBubble && mascotImg) {
                if (streaks.dailyStreak === 0) {
                    if (streaks.missedDays > 1) {
                        mascotBubble.textContent = "¡Me estoy congelando! 🥶";
                        mascotImg.src = "mascot-frozen.png";
                    } else {
                        mascotBubble.textContent = "¡Ey! Llenemos ese tareo 📝";
                        mascotImg.src = "mascot-sad.png";
                    }
                } else if (streaks.dailyStreak < 3) {
                    mascotBubble.textContent = "¡Buen inicio! 🌱";
                    mascotImg.src = "mascot.png";
                } else if (streaks.dailyStreak < 7) {
                    mascotBubble.textContent = "¡En racha! 💪";
                    mascotImg.src = "mascot.png";
                } else {
                    mascotBubble.textContent = "¡Estás imparable! 🔥";
                    mascotImg.src = "mascot-fire.png";
                }
            }
        }
    } else {
        if (mascotContainer) mascotContainer.style.display = 'none';
        if (badgesContainer) badgesContainer.style.display = 'none';
    }
}

async function handleTareoSubmit(e) {
    e.preventDefault();
    const fecha = document.getElementById('fecha').value;
    const turno = document.getElementById('turno').value;
    const horasInput = parseFloat(document.getElementById('horas').value);
    const tipoHora = document.getElementById('tipo-hora').value;
    const woInput = document.getElementById('wo').value.trim();

    // Validación de Turno Cruzado
    const otherShiftLogs = state.logs.filter(l => l.usuario === state.currentUser.name && l.fecha === fecha && l.turno !== turno && l.id !== editingLogId);
    if (otherShiftLogs.length > 0) {
        playErrorSound();
        alert(`Error: Ya tienes registros en el Turno ${otherShiftLogs[0].turno} para esta fecha (${fecha}).\n\nNo puedes mezclar horas de Día y Noche en un mismo día. Si doblaste turno, registra el excedente como Horas Extra en tu turno original.`);
        return;
    }

    // Validación estricta de WO
    if (!state.wos.find(w => w.id === woInput)) {
        playErrorSound();
        alert("La Orden de Trabajo (WO) ingresada no existe en la base de datos.\n\nPor favor, selecciona una válida de la lista desplegable.");
        return;
    }

    // Validación de límites de horas normales
    if (tipoHora === 'Normales') {
        const maxNormal = turno === 'Día' ? 9.25 : 11.25;
        let currentNormal = getDailyNormalHours(state.currentUser.name, fecha, turno);
        
        if (editingLogId) {
            const oldLog = state.logs.find(l => l.id === editingLogId);
            if (oldLog && oldLog.tipo_hora === 'Normales' && oldLog.fecha === fecha) {
                currentNormal -= parseFloat(oldLog.horas);
            }
        }
        
        if (currentNormal + horasInput > maxNormal) {
            playErrorSound();
            alert(`No puedes registrar ${horasInput} horas normales.\n\nTu acumulado hoy sería ${currentNormal + horasInput}h, y el límite para turno ${turno} es ${maxNormal}h.\n\nPor favor, registra el excedente como Horas Extra (SHE/DHE).`);
            return;
        }
    } else if (tipoHora === 'SHE' || tipoHora === 'DHE') {
        const maxExtra = 12; // Límite de seguridad para evitar errores (ej. 20 en vez de 2)
        let currentExtra = getDailyExtraHours(state.currentUser.name, fecha, turno);
        
        if (editingLogId) {
            const oldLog = state.logs.find(l => l.id === editingLogId);
            if (oldLog && (oldLog.tipo_hora === 'SHE' || oldLog.tipo_hora === 'DHE') && oldLog.fecha === fecha) {
                currentExtra -= parseFloat(oldLog.horas);
            }
        }
        
        if (currentExtra + horasInput > maxExtra) {
            playErrorSound();
            alert(`Seguridad: Para evitar errores de tipeo, el sistema bloquea registros mayores a ${maxExtra} horas extra en un solo día.\n\nActualmente tienes ${currentExtra}h extra hoy, y estás intentando registrar ${horasInput}h más.`);
            return;
        }
    }

    // Obtener datos extra del usuario actual
    const userMeta = state.employees.find(e => e.name === state.currentUser.name) || {};
    
    // Obtener título de la WO
    const woObj = state.wos.find(w => w.id === woInput);
    const woTitulo = woObj ? woObj.title : '';
    
    // Calcular día de la semana (Lunes, Martes...)
    const dateParts = fecha.split('-');
    const dateObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const diaSemana = dias[dateObj.getDay()];

    const logEntry = {
        id: editingLogId ? editingLogId : Date.now().toString(),
        accion: editingLogId ? 'EDICION' : 'NUEVO',
        usuario: state.currentUser.name,
        pn: userMeta.pn || '',
        fecha: fecha,
        dia: diaSemana,
        turno: turno,
        wo: woInput,
        wo_titulo: woTitulo,
        horas: horasInput,
        tipo_hora: tipoHora,
        etapa: document.getElementById('etapa').value,
        actividad: document.getElementById('actividad').value,
        descripcion: document.getElementById('descripcion').value.trim(),
        maquina: document.getElementById('maquina').value,
        reproceso: document.getElementById('reproceso').checked ? 'Sí' : 'No',
        reproceso_motivo: document.getElementById('reproceso-motivo').value.trim(),
        cargo: userMeta.cargo || '',
        area: userMeta.area || '',
        timestamp: new Date().toISOString()
    };

    if (editingLogId) {
        const index = state.logs.findIndex(l => l.id === editingLogId);
        if (index !== -1) state.logs[index] = logEntry;
        editingLogId = null;
        const btn = e.target.querySelector('button[type="submit"]');
        btn.textContent = "Registrar Actividad";
        playUpdateSound(); // Sonido de actualización
    } else {
        // Guardar Local
        state.logs.push(logEntry);
        playSuccessSound(); // Sonido de nuevo registro
    }
    saveState();

    // Enviar a Microsoft Power Automate Webhook silenciosamente
    if (state.settings.webhookUrl) {
        try {
            fetch(state.settings.webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(logEntry)
            }).catch(err => console.error("Error Webhook:", err));
        } catch(e) {}
    }

    // Actualizar UI
    updateWorkerDashboard();
    renderDailyLogs();
    if (typeof renderWorkerMatrix === 'function') renderWorkerMatrix();
    updateAccumulatedPermisos();
    updateAccumulatedExtra();

    // Limpiar campos variables (WO, horas, act, desc)
    document.getElementById('wo').value = '';
    document.getElementById('horas').value = '';
    document.getElementById('descripcion').value = '';
    document.getElementById('reproceso').checked = false;
    document.getElementById('reproceso-motivo-group').style.display = 'none';
    document.getElementById('reproceso-motivo').required = false;
    document.getElementById('reproceso-motivo').value = '';
    
    document.getElementById('wo').focus();
    
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.textContent = "¡Guardado!";
    btn.style.backgroundColor = "var(--accent-hover)";
    setTimeout(() => {
        btn.textContent = originalText;
        btn.style.backgroundColor = "";
    }, 1500);
}

function renderDailyLogs() {
    if (!state.currentUser) return;
    const date = document.getElementById('fecha').value;
    const container = document.getElementById('daily-logs-list');
    
    const todaysLogs = state.logs.filter(l => l.usuario === state.currentUser.name && l.fecha === date);
    
    if (todaysLogs.length === 0) {
        container.innerHTML = '<p class="empty-state">No hay registros para la fecha seleccionada.</p>';
        return;
    }

    container.innerHTML = '';
    todaysLogs.forEach(log => {
        const div = document.createElement('div');
        div.className = 'log-item';
        div.innerHTML = `
            <div class="log-item-header">
                <span>${log.wo}</span>
                <span>${log.horas} hh (${log.tipo_hora})</span>
            </div>
            <div class="log-item-body">
                <strong>Turno:</strong> ${log.turno}<br>
                <strong>Actividad:</strong> ${log.actividad}<br>
                <strong>Máquina:</strong> ${log.maquina}<br>
                ${log.descripcion}
            </div>
            <div class="log-actions" style="display: flex; gap: 8px;">
                <button class="btn-primary btn-small" onclick="editLog('${log.id}')">Editar</button>
                <button class="btn-outline-primary btn-small" onclick="duplicateLog('${log.id}')" title="Copiar estos datos para un nuevo registro">Duplicar</button>
            </div>
        `;
        container.appendChild(div);
    });
}

window.editLog = function(id) {
    const log = state.logs.find(l => l.id === id);
    if(log) {
        document.getElementById('wo').value = log.wo;
        document.getElementById('horas').value = log.horas;
        document.getElementById('tipo-hora').value = log.tipo_hora;
        document.getElementById('etapa').value = log.etapa;
        document.getElementById('actividad').value = log.actividad;
        document.getElementById('maquina').value = log.maquina;
        document.getElementById('descripcion').value = log.descripcion;
        
        if (log.reproceso === 'Sí') {
            document.getElementById('reproceso').checked = true;
            document.getElementById('reproceso-motivo-group').style.display = 'block';
            document.getElementById('reproceso-motivo').value = log.reproceso_motivo;
        } else {
            document.getElementById('reproceso').checked = false;
            document.getElementById('reproceso-motivo-group').style.display = 'none';
            document.getElementById('reproceso-motivo').value = '';
        }
        
        editingLogId = id;
        document.querySelector('#tareo-form button[type="submit"]').textContent = "Actualizar Actividad";
        document.getElementById('horas').focus();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}


window.duplicateLog = function(id) {
    const log = state.logs.find(l => l.id === id);
    if(log) {
        document.getElementById('wo').value = log.wo;
        document.getElementById('horas').value = log.horas;
        document.getElementById('tipo-hora').value = log.tipo_hora;
        document.getElementById('etapa').value = log.etapa;
        document.getElementById('actividad').value = log.actividad;
        document.getElementById('maquina').value = log.maquina;
        document.getElementById('descripcion').value = log.descripcion;
        
        if (log.reproceso === 'Sí') {
            document.getElementById('reproceso').checked = true;
            document.getElementById('reproceso-motivo-group').style.display = 'block';
            document.getElementById('reproceso-motivo').value = log.reproceso_motivo;
        } else {
            document.getElementById('reproceso').checked = false;
            document.getElementById('reproceso-motivo-group').style.display = 'none';
            document.getElementById('reproceso-motivo').value = '';
        }
        
        editingLogId = null; // Important: this makes it a NEW record
        document.querySelector('#tareo-form button[type="submit"]').textContent = "Registrar (Copia)";
        document.getElementById('horas').focus();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// --- ADMIN LOGIC ---
function updateAdminDashboard() {
    const today = new Date();
    const currentMonthStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
    
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const monthName = meses[today.getMonth()];
    
    const lblRegistros = document.getElementById('label-registros');
    if (lblRegistros) {
        lblRegistros.textContent = `Total Registros (${monthName})`;
        document.getElementById('label-normales').textContent = `Horas Normales (${monthName})`;
        document.getElementById('label-extra').textContent = `Horas Extra (${monthName})`;
    }
    
    const logsDelMes = state.logs.filter(l => l.fecha.startsWith(currentMonthStr));
    
    document.getElementById('admin-total-logs').textContent = logsDelMes.length;
    
    const normalTotal = logsDelMes.filter(l => l.tipo_hora === 'Normales').reduce((sum, l) => sum + parseFloat(l.horas), 0);
    document.getElementById('admin-total-normal').textContent = normalTotal.toFixed(2) + ' hh';
    
    const extraTotal = logsDelMes.filter(l => l.tipo_hora === 'SHE' || l.tipo_hora === 'DHE').reduce((sum, l) => sum + parseFloat(l.horas), 0);
    const extraEl = document.getElementById('admin-total-extra');
    if (extraEl) extraEl.textContent = extraTotal.toFixed(2) + ' hh';
}

function renderPersonalTable() {
    const tbody = document.getElementById('personal-table-body');
    if(!tbody) return;
    tbody.innerHTML = '';
    state.employees.filter(e => e.role !== 'admin').forEach((emp, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${emp.name}</td>
            <td>${emp.dni}</td>
            <td><button class="btn-danger btn-small" onclick="deleteEmployee('${emp.name}')">Eliminar</button></td>
        `;
        tbody.appendChild(tr);
    });
}

window.deleteEmployee = function(name) {
    if(confirm(`¿Eliminar al trabajador ${name}?`)) {
        state.employees = state.employees.filter(e => e.name !== name);
        saveState();
        renderPersonalTable();
    }
}

function renderOmisiones() {
    const fecha = document.getElementById('admin-fecha-omision').value;
    const reportContainer = document.getElementById('omisiones-reporte');
    if(!fecha) return;

    let html = `<h3>Reporte del día: ${fecha}</h3><ul>`;
    let count = 0;

    state.employees.filter(e => e.role === 'worker').forEach(emp => {
        const logsNormales = getDailyNormalHours(emp.name, fecha);
        
        if (logsNormales === 0) {
            html += `<li><span style="color:var(--danger)">Ausente / Sin registros:</span> ${emp.name}</li>`;
            count++;
        } else if (logsNormales < 9.25) {
            html += `<li><span style="color:#f59e0b">Incompleto:</span> ${emp.name} (Registró ${logsNormales} hh)</li>`;
            count++;
        }
    });

    if (count === 0) {
        html += `<li>Todos los trabajadores han completado sus horas normales.</li>`;
    }
    html += `</ul>`;
    reportContainer.innerHTML = html;
}

function copyOmisionesToClipboard() {
    const fecha = document.getElementById('admin-fecha-omision').value;
    let texto = `⚠️ *Reporte de Tareo Pendiente - ${fecha}* ⚠️\n\nLos siguientes trabajadores no han completado su tareo de hoy:\n`;
    let count = 0;

    state.employees.filter(e => e.role === 'worker').forEach(emp => {
        const logsNormales = getDailyNormalHours(emp.name, fecha);
        if (logsNormales === 0) {
            texto += `- ${emp.name} (Sin registros)\n`;
            count++;
        } else if (logsNormales < 9.25) {
            texto += `- ${emp.name} (Incompleto: ${logsNormales} hh)\n`;
            count++;
        }
    });

    if (count === 0) {
        texto = `✅ Tareo del ${fecha} completado por todo el personal.`;
    } else {
        texto += `\n*Por favor, completar su tareo a la brevedad.*`;
    }

    navigator.clipboard.writeText(texto).then(() => {
        alert('Reporte copiado al portapapeles. Listo para pegar en WhatsApp o correo.');
    }).catch(err => {
        alert('No se pudo copiar. Intente seleccionar el texto manualmente.');
    });
}

function exportToCSV() {
    if (state.logs.length === 0) {
        alert('No hay datos para exportar.');
        return;
    }

    const headers = [
        'Usuario', 'P/N', 'Fecha', 'DIA', 'Turno', 'WO', 'TITULO DE LA WO', 
        'Horas', 'Tipo_Hora', 'Etapa', 'Actividad', 'Maquina', 'Reproceso', 
        'Motivo_Reproceso', 'Descripcion', 'ID_App', 'CARGO', 'AREA'
    ];
    
    const rows = state.logs.map(log => {
        const userMeta = state.employees.find(e => e.name === log.usuario) || {};
        const woObj = state.wos.find(w => w.id === log.wo);
        const woTitulo = woObj ? woObj.title : '';
        
        const dateParts = log.fecha.split('-');
        const dateObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
        const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const diaSemana = dias[dateObj.getDay()];
        
        return [
            `"${log.usuario}"`,
            `"${userMeta.pn || ''}"`,
            log.fecha,
            diaSemana,
            log.turno,
            `"${log.wo}"`,
            `"${woTitulo}"`,
            log.horas,
            log.tipo_hora,
            `"${log.etapa}"`,
            `"${log.actividad}"`,
            `"${log.maquina}"`,
            log.reproceso,
            `"${log.reproceso_motivo.replace(/"/g, '""')}"`,
            `"${log.descripcion.replace(/"/g, '""')}"`,
            `"${log.id}"`,
            `"${userMeta.cargo || ''}"`,
            `"${userMeta.area || ''}"`
        ];
    });

    let csvContent = headers.join(',') + '\n' + rows.map(e => e.join(',')).join('\n');

    // Añadir BOM para que Excel lea los tildes correctamente
    const bom = "\uFEFF";
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tareos_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// --- WEEKLY MATRIX LOGIC ---
let currentWorkerMatrixDate = new Date();
let currentAdminMatrixDate = new Date();

window.changeWorkerWeek = function(days) {
    currentWorkerMatrixDate.setDate(currentWorkerMatrixDate.getDate() + days);
    if(typeof renderWorkerMatrix === 'function') renderWorkerMatrix();
};

window.changeAdminWeek = function(days) {
    currentAdminMatrixDate.setDate(currentAdminMatrixDate.getDate() + days);
    if(typeof renderWeeklyMatrix === 'function') renderWeeklyMatrix();
};

function getDatesOfWeekFromDate(d) {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d);
    monday.setDate(diff);
    
    const dates = [];
    for (let i = 0; i < 7; i++) {
        const current = new Date(monday);
        current.setDate(monday.getDate() + i);
        const y = current.getFullYear();
        const m = String(current.getMonth() + 1).padStart(2, '0');
        const d_day = String(current.getDate()).padStart(2, '0');
        dates.push(`${y}-${m}-${d_day}`);
    }
    return dates;
}

function updateTableHeaders(tableId, dates) {
    const table = document.getElementById(tableId);
    if (!table || !dates || dates.length === 0) return;
    const ths = table.querySelectorAll('thead th');
    const days = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
    for(let i = 0; i < 7; i++) {
        if (dates[i] && ths[i+1]) { // ths[0] is 'Apellidos y Nombres'
            const parts = dates[i].split('-'); // "2026-07-20" -> ["2026", "07", "20"]
            ths[i+1].textContent = `${days[i]} ${parts[2]}/${parts[1]}`;
        }
    }
}

function formatWeekDisplayFromDate(d) {
    const dates = getDatesOfWeekFromDate(d);
    if (dates.length === 0) return { title: '', range: '' };
    
    // Calcular número de semana (ISO 8601)
    const date = new Date(d.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    const weekNumber = 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    
    const year = date.getFullYear();
    const startParts = dates[0].split('-');
    const endParts = dates[6].split('-');
    
    return {
        title: `Lunes ${startParts[2]}/${startParts[1]} al Domingo ${endParts[2]}/${endParts[1]}`,
        range: `Semana ${weekNumber}, ${year}`
    };
}

window.renderWeeklyMatrix = function() {
    const searchInput = document.getElementById('matrix-search');
    if (!searchInput) return;
    
    const searchStr = searchInput.value.toLowerCase();
    const dates = getDatesOfWeekFromDate(currentAdminMatrixDate);
    
    const displayData = formatWeekDisplayFromDate(currentAdminMatrixDate);
    const titleLabel = document.getElementById('admin-week-display');
    const rangeLabel = document.getElementById('admin-matrix-date-range');
    if (titleLabel) titleLabel.textContent = displayData.title;
    if (rangeLabel) rangeLabel.textContent = displayData.range;
    
    updateTableHeaders('matrix-dia', dates);
    updateTableHeaders('matrix-noche', dates);
    
    const tbodyDia = document.querySelector('#matrix-dia tbody');
    const tbodyNoche = document.querySelector('#matrix-noche tbody');
    if (!tbodyDia || !tbodyNoche) return;
    
    tbodyDia.innerHTML = '';
    tbodyNoche.innerHTML = '';
    
    if (dates.length === 0) return;
    
    state.employees.filter(e => e.role !== 'admin').forEach(emp => {
        if (searchStr && !emp.name.toLowerCase().includes(searchStr)) return;
        
        let totalDiaHours = 0;
        let totalNocheHours = 0;
        const hnDiaDaily = [0, 0, 0, 0, 0, 0, 0];
        const hnNocheDaily = [0, 0, 0, 0, 0, 0, 0];
        
        dates.forEach((date, i) => {
            const logs = state.logs.filter(l => l.usuario === emp.name && l.fecha === date && l.tipo_hora === 'Normales');
            logs.forEach(l => {
                const h = parseFloat(l.horas) || 0;
                if (l.turno === 'Día') {
                    hnDiaDaily[i] += h;
                    totalDiaHours += h;
                }
                if (l.turno === 'Noche') {
                    hnNocheDaily[i] += h;
                    totalNocheHours += h;
                }
            });
        });
        
        const renderAdminRow = (tbody, dataArr, totalWeek, limit) => {
            if (totalWeek === 0) return; // No crear fila si no hay horas en la semana para este turno
            
            const tr = document.createElement('tr');
            let html = `<td style="text-align: left; padding: 4px;">${emp.name}</td>`;
            
            dataArr.forEach(h => {
                let className = '';
                if (h === 0) {
                    // vacio
                } else if (h >= limit) {
                    className = 'cell-green';
                } else if (h < limit) {
                    className = 'cell-yellow';
                }
                // Rojo si pasa el limite (no deberia pasar por validacion, pero por si acaso)
                if (h > limit) className = 'cell-red';
                
                html += `<td class="${className}">${h > 0 ? h.toFixed(2) : ''}</td>`;
            });
            
            html += `<td><strong>${totalWeek > 0 ? totalWeek.toFixed(2) : ''}</strong></td>`;
            tr.innerHTML = html;
            tbody.appendChild(tr);
        };
        
        renderAdminRow(tbodyDia, hnDiaDaily, totalDiaHours, 9.25);
        renderAdminRow(tbodyNoche, hnNocheDaily, totalNocheHours, 11.25);
    });
}

// --- WORKER MATRIX LOGIC ---

function updateAccumulatedPermisos() {
    if (!state.currentUser) return;
    
    const inputDesde = document.getElementById('permiso-desde');
    const inputHasta = document.getElementById('permiso-hasta');
    const textElement = document.getElementById('accumulated-permisos-text');
    
    if (!inputDesde || !inputHasta || !textElement) return;
    
    const desde = inputDesde.value;
    const hasta = inputHasta.value;
    
    if (!desde || !hasta) return;
    
    let totalAcumulado = 0;
    
    state.logs.forEach(l => {
        if (l.usuario === state.currentUser.name && l.actividad === 'PERMISOS - COMPENSADO POR HE') {
            if (l.fecha >= desde && l.fecha <= hasta) {
                totalAcumulado += parseFloat(l.horas) || 0;
            }
        }
    });
    
    textElement.textContent = `${totalAcumulado.toFixed(2)} hh`;
}

function updateAccumulatedExtra() {
    if (!state.currentUser) return;
    
    const inputDesde = document.getElementById('extra-desde');
    const inputHasta = document.getElementById('extra-hasta');
    const textElement = document.getElementById('accumulated-extra-hours-text');
    
    if (!inputDesde || !inputHasta || !textElement) return;
    
    const desde = inputDesde.value;
    const hasta = inputHasta.value;
    
    if (!desde || !hasta) return;
    
    let totalAcumulado = 0;
    
    state.logs.forEach(l => {
        if (l.usuario === state.currentUser.name && (l.tipo_hora === 'SHE' || l.tipo_hora === 'DHE')) {
            if (l.fecha >= desde && l.fecha <= hasta) {
                totalAcumulado += parseFloat(l.horas) || 0;
            }
        }
    });
    
    textElement.textContent = `${totalAcumulado.toFixed(2)} hh`;
}

function renderWorkerMatrix() {
    if (!state.currentUser || state.currentUser.role === 'admin') return;
    
    const dates = getDatesOfWeekFromDate(currentWorkerMatrixDate);
    
    const displayData = formatWeekDisplayFromDate(currentWorkerMatrixDate);
    const titleLabel = document.getElementById('worker-week-display');
    const rangeLabel = document.getElementById('worker-matrix-date-range');
    if (titleLabel) titleLabel.textContent = displayData.title;
    if (rangeLabel) rangeLabel.textContent = displayData.range;
    
    updateTableHeaders('worker-matrix-dia', dates);
    updateTableHeaders('worker-matrix-noche', dates);
    updateTableHeaders('worker-matrix-she', dates);
    updateTableHeaders('worker-matrix-dhe', dates);
    
    const tbodyHnDia = document.querySelector('#worker-matrix-dia tbody');
    const tbodyHnNoche = document.querySelector('#worker-matrix-noche tbody');
    const tbodyShe = document.querySelector('#worker-matrix-she tbody');
    const tbodyDhe = document.querySelector('#worker-matrix-dhe tbody');
    
    if (!tbodyHnDia || !tbodyHnNoche || !tbodyShe || !tbodyDhe) return;
    
    tbodyHnDia.innerHTML = '';
    tbodyHnNoche.innerHTML = '';
    tbodyShe.innerHTML = '';
    tbodyDhe.innerHTML = '';
    
    if (dates.length === 0) return;
    
    const empName = state.currentUser.name;
    
    // Arrays para guardar las horas por día
    const hnDiaDaily = [0, 0, 0, 0, 0, 0, 0];
    const hnNocheDaily = [0, 0, 0, 0, 0, 0, 0];
    const sheDaily = [0, 0, 0, 0, 0, 0, 0];
    const dheDaily = [0, 0, 0, 0, 0, 0, 0];
    let totalSemanaNormales = 0;
    let totalSemanaPermisos = 0;
    let totalSemanaExtra = 0;
    
    dates.forEach((date, i) => {
        // En worker matrix mostramos Lunes a Domingo (7 dias)
        if (i > 6) return; // Asegurar que no sobrepase
        const logs = state.logs.filter(l => l.usuario === empName && l.fecha === date);
        logs.forEach(l => {
            const h = parseFloat(l.horas) || 0;
            if (l.tipo_hora === 'Normales') {
                if (l.turno === 'Día') hnDiaDaily[i] += h;
                if (l.turno === 'Noche') hnNocheDaily[i] += h;
                totalSemanaNormales += h;
            } else if (l.tipo_hora === 'SHE') {
                sheDaily[i] += h;
                totalSemanaExtra += h;
            } else if (l.tipo_hora === 'DHE') {
                dheDaily[i] += h;
                totalSemanaExtra += h;
            }
            if (l.actividad === 'PERMISOS - COMPENSADO POR HE') {
                totalSemanaPermisos += h;
            }
        });
    });
    
    // Actualizar UI del Resumen Semanal
    const weeklyProgressPercent = Math.min((totalSemanaNormales / 46.25) * 100, 100);
    const weeklyBar = document.getElementById('weekly-normal-progress-bar');
    if (weeklyBar) weeklyBar.style.width = weeklyProgressPercent + '%';
    
    const weeklyText = document.getElementById('weekly-normal-hours-text');
    if (weeklyText) {
        const faltanSemana = 46.25 - totalSemanaNormales;
        weeklyText.textContent = `${totalSemanaNormales.toFixed(2)} / 46.25 hh ${faltanSemana > 0 ? `(Faltan ${faltanSemana.toFixed(2)} hh)` : '(Completado)'}`;
    }
    
    const permisosText = document.getElementById('weekly-permisos-text');
    if (permisosText) permisosText.textContent = `${totalSemanaPermisos.toFixed(2)} hh`;
    
    // Función helper para renderizar una fila
    const renderRow = (tbody, dataArr, applyColors, limit) => {
        const total = dataArr.reduce((a, b) => a + b, 0);
        const tr = document.createElement('tr');
        let html = `<td style="text-align: left; padding: 4px;">${empName}</td>`;
        
        dataArr.forEach(h => {
            let className = '';
            if (applyColors && limit) {
                if (h > 0 && h >= limit) className = 'cell-green';
                else if (h > 0 && h < limit) className = 'cell-yellow';
                if (h > limit) className = 'cell-red';
            }
            html += `<td class="${className}">${h > 0 ? h.toFixed(2) : ''}</td>`;
        });
        
        html += `<td><strong>${total > 0 ? total.toFixed(2) : ''}</strong></td>`;
        tr.innerHTML = html;
        tbody.appendChild(tr);
    };
    
    // Renderizamos ambas tablas si hay datos, o siempre (una fila por trabajador en su propia vista)
    renderRow(tbodyHnDia, hnDiaDaily, true, 9.25);
    renderRow(tbodyHnNoche, hnNocheDaily, true, 11.25);
    renderRow(tbodyShe, sheDaily, false);
    renderRow(tbodyDhe, dheDaily, false);
}

window.clearAllLogs = function() {
    if (confirm("⚠️ ADVERTENCIA: Estás a punto de borrar TODOS los registros de todos los trabajadores.\n\n¿Estás completamente seguro de que deseas continuar? Esta acción es irreversible.")) {
        let password = prompt("Para confirmar, por favor ingresa la palabra: BORRAR");
        if (password === "BORRAR") {
            state.logs = [];
            localStorage.setItem('tareo_state_v6', JSON.stringify(state));
            alert("✅ Todos los registros han sido eliminados del sistema.");
            location.reload();
        } else {
            alert("❌ Acción cancelada. No se borró nada.");
        }
    }
};

// --- WORKER VIEW TABS ---
window.switchWorkerView = function(clickedBtn, tabName) {
    document.querySelectorAll('#worker-view .btn-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('#worker-view > .tab-content, #worker-view > .view').forEach(c => c.style.display = 'none');
    
    if(clickedBtn) clickedBtn.classList.add('active');
    
    if (tabName === 'daily') {
        document.getElementById('tab-worker-registro').style.display = 'block';
    } else if (tabName === 'history') {
        document.getElementById('tab-worker-historial').style.display = 'block';
        updateAccumulatedExtra();
        updateAccumulatedPermisos();
        renderWorkerMatrix();
    } else if (tabName === 'assistant') {
        document.getElementById('tab-worker-assistant').style.display = 'block';
        // Scroll to bottom of chat
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
    }
};

// --- CHATBOT LOGIC ---
document.addEventListener('DOMContentLoaded', () => {
    const chatForm = document.getElementById('chat-form');
    if (chatForm) {
        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const input = document.getElementById('chat-input');
            const message = input.value.trim();
            if (!message) return;
            
            appendChatMessage(message, 'user');
            if(typeof playChatUserSound === 'function') playChatUserSound();
            input.value = '';
            
            // Simular un poco de "pensamiento"
            setTimeout(() => {
                const response = getBotResponse(message);
                appendChatMessage(response, 'bot');
                if(typeof playChatBotSound === 'function') playChatBotSound();
            }, 500);
        });
    }
});

window.playChatUserSound = function() {
    if (!soundEnabled) return;
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(400, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.1);
    } catch (e) {}
};

window.playChatBotSound = function() {
    if (!soundEnabled) return;
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(600, audioCtx.currentTime);
        oscillator.frequency.setValueAtTime(800, audioCtx.currentTime + 0.05); // blip
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.15);
    } catch (e) {}
};

function appendChatMessage(text, sender) {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    
    const div = document.createElement('div');
    div.className = `chat-message ${sender}`;
    div.innerHTML = `<div class="bubble">${text}</div>`;
    
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function getBotResponse(message) {
    const msg = message.toLowerCase();
    
    // Obtener datos actuales del usuario
    const empName = state.currentUser ? state.currentUser.name : '';
    const today = state.currentDate;
    const logsToday = state.logs.filter(l => l.usuario === empName && l.fecha === today);
    
    let normalToday = 0;
    let extraToday = 0;
    logsToday.forEach(l => {
        const h = parseFloat(l.horas) || 0;
        if (l.tipo_hora === 'Normales') normalToday += h;
        else if (l.tipo_hora === 'SHE' || l.tipo_hora === 'DHE') extraToday += h;
    });

    // Calcular semana actual
    const dParts = today.split('-');
    const currDateObj = new Date(dParts[0], dParts[1] - 1, dParts[2]);
    const day = currDateObj.getDay();
    const diffToMonday = currDateObj.getDate() - day + (day === 0 ? -6 : 1);
    const startOfWeek = new Date(currDateObj.setDate(diffToMonday));
    const datesOfWeek = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        datesOfWeek.push(`${yyyy}-${mm}-${dd}`);
    }
    
    let normalWeek = 0;
    let extraWeek = 0;
    let permisosWeek = 0;
    
    datesOfWeek.forEach(dStr => {
        const logsDay = state.logs.filter(l => l.usuario === empName && l.fecha === dStr);
        logsDay.forEach(l => {
            const h = parseFloat(l.horas) || 0;
            if (l.tipo_hora === 'Normales') normalWeek += h;
            else if (l.tipo_hora === 'SHE' || l.tipo_hora === 'DHE') extraWeek += h;
            
            if (l.actividad === 'PERMISOS - COMPENSADO POR HE') {
                permisosWeek += h;
            }
        });
    });

    // Reglas del bot
    if (msg.includes('extra') || msg.includes('sobretiempo') || msg.includes('she') || msg.includes('dhe')) {
        return `Hoy tienes <b>${extraToday.toFixed(2)} horas extra</b> registradas.<br>En total, en esta semana llevas <b>${extraWeek.toFixed(2)} horas extra</b>. ¡Buen trabajo! Recuerda que las horas extra deben estar autorizadas.`;
    }
    
    if (msg.includes('falta') || msg.includes('restante') || msg.includes('normales')) {
        let maxNormal = 9.25; // Default Dia
        // Check si tiene algun registro de noche hoy
        if (logsToday.some(l => l.turno === 'Noche')) maxNormal = 11.25;
        
        let faltanHoy = maxNormal - normalToday;
        if (faltanHoy < 0) faltanHoy = 0;
        
        let faltanSemana = 46.25 - normalWeek;
        if (faltanSemana < 0) faltanSemana = 0;

        return `Hoy has registrado <b>${normalToday.toFixed(2)}</b> horas normales. Te faltan <b>${faltanHoy.toFixed(2)}</b> para completar tu turno de ${maxNormal}h.<br><br>Para llegar a la meta semanal de 46.25h, te faltan <b>${faltanSemana.toFixed(2)}h</b>.`;
    }
    
    if (msg.includes('rango') || msg.includes('desde') || msg.includes('hasta') || msg.includes('fechas') || msg.includes('mes') || msg.includes('quincena')) {
        return `📅 <b>Resúmenes por Fechas:</b><br>Si quieres ver cuántas horas extras o permisos has acumulado en un rango específico (por ejemplo, de todo el mes o quincena), ve a la pestaña <b>"Mi Historial"</b>.<br>Allí encontrarás unos calendarios de "Desde" y "Hasta" para que saques tu propio resumen personalizado.`;
    }
    
    if (msg.includes('dia') || msg.includes('día') || msg.includes('incompleto') || msg.includes('olvide') || msg.includes('falto')) {
        // Evitar conflicto con el saludo de "buenos días"
        if (msg.includes('buenos') || msg.includes('hola')) return getBotResponse('hola');
        
        const diasSemanaNombres = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
        let diasFaltantes = [];
        
        const hoyStr = state.currentDate;
        
        for (let i = 0; i < 7; i++) {
            const dStr = datesOfWeek[i];
            if (dStr > hoyStr) break; // No evaluamos dias futuros
            
            const logsDelDia = state.logs.filter(l => l.usuario === empName && l.fecha === dStr);
            let normalDelDia = 0;
            let esNoche = false;
            logsDelDia.forEach(l => {
                if (l.tipo_hora === 'Normales') normalDelDia += parseFloat(l.horas) || 0;
                if (l.turno === 'Noche') esNoche = true;
            });
            
            const metaDiaria = esNoche ? 11.25 : 9.25;
            
            // Si el día está por debajo de la meta, está incompleto
            if (normalDelDia < (metaDiaria - 0.1)) {
                diasFaltantes.push(`<b>${diasSemanaNombres[i]}</b> (Registraste ${normalDelDia.toFixed(2)}h)`);
            }
        }
        
        if (diasFaltantes.length === 0) {
            return `¡Estás al día! 🌟 Hasta hoy, has completado tus horas normales de todos los días de esta semana.`;
        } else {
            return `🗓️ <b>Días Incompletos:</b><br>Revisando tu registro de esta semana (hasta hoy), te falta completar tu tareo en estos días:<br><br>👉 ${diasFaltantes.join('<br>👉 ')}<br><br>¡Recuerda ponerte al día para no afectar tu racha!`;
        }
    }
    
    if (msg.includes('resumen') || msg.includes('semana')) {
        return `📊 <b>Tu Resumen Semanal:</b><br>- Horas Normales: ${normalWeek.toFixed(2)} / 46.25<br>- Horas Extra: ${extraWeek.toFixed(2)}<br>- Permisos: ${permisosWeek.toFixed(2)}`;
    }
    
    if (msg.includes('permiso') || msg.includes('permisos')) {
        return `Esta semana has registrado <b>${permisosWeek.toFixed(2)} horas de permiso</b> (compensado por HE). Recuerda que yo solo llevo el conteo de lo que registraste en el tareo de esta semana.`;
    }
    
    if (msg.includes('cruzar') || msg.includes('turno') || msg.includes('mezclar')) {
        return `⚠️ <b>Regla de Turnos:</b> El sistema no permite registrar horas de "Día" y "Noche" en la misma fecha calendario. Si te quedaste doblando turno, debes registrar todo ese excedente en tu turno original (como SHE o DHE).`;
    }
    
    if (msg.includes('limite') || msg.includes('límite') || msg.includes('maximo') || msg.includes('máximo') || (msg.includes('hora') && msg.includes('dia'))) {
        return `🕒 <b>Límites diarios de Horas Normales:</b><br>- Turno Día: 9.25 horas.<br>- Turno Noche: 11.25 horas.<br><br>Todo lo que exceda de ese límite debe registrarse como Horas Extra (SHE o DHE).`;
    }

    if (msg.includes('edit') || msg.includes('corregir') || msg.includes('modific') || msg.includes('borrar') || msg.includes('equivoc') || msg.includes('error')) {
        return `✏️ <b>¿Te equivocaste en un registro?</b><br>No te preocupes. Ve a la pestaña "Registro Diario" y baja hasta la sección "Tus Registros de Hoy". <br>Busca la tarjeta del registro que quieres cambiar y presiona el botón naranja <b>"Editar"</b>. Podrás corregir las horas o cualquier otro dato y volver a guardarlo.`;
    }

    if (msg.includes('llenar') || msg.includes('registrar') || msg.includes('instrucciones') || msg.includes('funciona') || msg.includes('ayuda')) {
        return `📝 <b>¿Cómo registrar tu tareo?</b><br>1. Ve a la pestaña <b>Registro Diario</b>.<br>2. Selecciona la <b>Fecha</b> y tu <b>Turno</b>.<br>3. Busca tu <b>WO (Orden de Trabajo)</b>.<br>4. Ingresa las <b>Horas</b> (ej. 2.5) y el <b>Tipo</b> (Normales, SHE...).<br>5. Selecciona la <b>Actividad</b> y la <b>Máquina</b> (si aplica).<br>6. Dale al botón <b>"Guardar Registro"</b>.<br>¡Listo! Tus horas se sumarán en las barras de arriba.`;
    }

    if (msg.includes('hola') || msg.includes('buenos') || msg.includes('tardes') || msg.includes('dias')) {
        return `¡Hola, ${empName.split(' ')[0]}! 👋 Soy tu Asistente virtual.<br><br><b>💡 Puedes preguntarme sobre:</b><br><br>⏱️ <i>"¿Cuántas horas extra tengo?"</i><br>🎯 <i>"¿Cuánto me falta para terminar hoy?"</i><br>📊 <i>"Dame mi resumen semanal"</i><br>📅 <i>"¿Cómo veo mi resumen por fechas?"</i><br>📝 <i>"¿Cómo llenar mi tareo?"</i><br>🏖️ <i>"¿Cuántos permisos tengo?"</i><br>🌙 <i>"¿Puedo cruzar turnos de día y noche?"</i><br>🚧 <i>"Límites de horas por día"</i><br>✏️ <i>"¿Cómo edito un registro?"</i><br>👯 <i>"¿Cómo duplicar un registro?"</i>`;
    }
    
    if (msg.includes('gracias') || msg.includes('agradecid') || msg.includes('excelente')) {
        return `¡De nada! 🦾🤖 Estoy aquí 24/7 para ayudarte a que tu tareo sea más fácil y rápido. ¡Que tengas un gran turno!`;
    }
    
    if (msg.includes('duplicar') || msg.includes('copiar') || msg.includes('repetir')) {
        return `👯 <b>¿Hiciste lo mismo otra vez?</b><br>¡Te ahorramos trabajo! Ve a la pestaña "Registro Diario", busca el registro en "Tus Registros de Hoy" y presiona el botón <b>"Duplicar"</b>. <br>Se copiarán todos los datos a los campos de arriba para que solo le des a guardar.`;
    }

    // Default Fallback
    return `¡Bip bop! 🤖 Creo que no te entendí del todo.<br><br><b>💡 Intenta preguntarme sobre:</b><br><br>⏱️ <i>"Mis horas extra"</i><br>🎯 <i>"Cuánto me falta hoy"</i><br>📊 <i>"Resumen semanal"</i><br>📅 <i>"Resúmenes por fechas"</i><br>📝 <i>"Cómo llenar mi tareo"</i><br>🏖️ <i>"Mis permisos"</i><br>🌙 <i>"Reglas de cruce de turnos"</i><br>🚧 <i>"Límites por día"</i><br>✏️ <i>"Cómo editar un registro"</i>`;
}
