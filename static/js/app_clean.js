// API Configuration
const API_BASE_URL = 'http://localhost:5000/api';

// Global Variables
let currentConfig = null;
let currentDate = new Date();
let speechSynthesis = window.speechSynthesis;

// Utility Functions
function formatDate(date) {
    return date.toISOString().split('T')[0];
}

function formatTime(date) {
    return date.toLocaleTimeString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
}

function formatDateTime(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleString('es-ES');
}

// Mobile Menu Functions
function toggleMobileMenu() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('mobile-open');
}

// Navigation Functions
function showPage(pageName, event = null) {
    // Hide all pages
    document.querySelectorAll('.page-content').forEach(page => {
        page.classList.remove('active');
    });

    // Remove active class from all nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    // Show selected page
    document.getElementById(pageName).classList.add('active');

    // Add active class to selected nav item (if event exists)
    if (event && event.target.closest('.nav-item')) {
        event.target.closest('.nav-item').classList.add('active');
    }

    // Close mobile menu if open
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.remove('mobile-open');

    // Load page-specific data
    switch(pageName) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'llamado-turno':
            loadQueue();
            loadStatistics();
            break;
        case 'asignar-cita':
            loadServices();
            break;
        case 'calendario':
            loadCalendar();
            break;
        case 'qr-citas':
            loadQRHistory();
            break;
        case 'configuracion':
            loadConfiguration();
            break;
    }
}

// API Functions
async function apiRequest(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API request failed:', error);
        showNotification('Error de conexión con el servidor', 'error');
        throw error;
    }
}

// Configuration Functions
async function loadConfigurationData() {
    try {
        currentConfig = await apiRequest('/configuracion');
        updateSidebarInfo();
    } catch (error) {
        console.error('Error loading configuration:', error);
    }
}

function updateSidebarInfo() {
    if (currentConfig) {
        document.getElementById('sidebarTitle').textContent = currentConfig.nombre_empresa;
        const logoImg = document.getElementById('sidebarLogo');
        if (currentConfig.logo_url) {
            logoImg.src = currentConfig.logo_url;
        }
    }
}

// Dashboard Functions
async function loadDashboard() {
    try {
        const stats = await apiRequest('/estadisticas');
        displayDashboardStats(stats);
        displayDashboardSummary(stats);
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

function displayDashboardStats(stats) {
    document.getElementById('dashboardStats').innerHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <span class="stat-number">${stats.total_turnos}</span>
                <span class="stat-label">Total Turnos Hoy</span>
            </div>
            <div class="stat-card pending">
                <span class="stat-number">${stats.pendientes}</span>
                <span class="stat-label">Pendientes</span>
            </div>
            <div class="stat-card called">
                <span class="stat-number">${stats.llamados}</span>
                <span class="stat-label">Llamados</span>
            </div>
            <div class="stat-card completed">
                <span class="stat-number">${stats.atendidos}</span>
                <span class="stat-label">Atendidos</span>
            </div>
            <div class="stat-card cancelled">
                <span class="stat-number">${stats.cancelados}</span>
                <span class="stat-label">Cancelados</span>
            </div>
        </div>
    `;
}

function displayDashboardSummary(stats) {
    const summary = document.getElementById('dashboardSummary');
    const efficiency = stats.total_turnos > 0 ? ((stats.atendidos / stats.total_turnos) * 100).toFixed(1) : 0;
    
    summary.innerHTML = `
        <h3>Resumen del Día</h3>
        <p>Eficiencia: <strong>${efficiency}%</strong></p>
        <p>Tiempo promedio de espera: <strong>${stats.tiempo_promedio_espera || 'N/A'}</strong></p>
        <p>Último turno llamado: <strong>${stats.ultimo_turno_llamado || 'Ninguno'}</strong></p>
    `;
}

// Queue Functions
async function loadQueue() {
    try {
        const queue = await apiRequest('/cola');
        displayQueue(queue);
    } catch (error) {
        console.error('Error loading queue:', error);
    }
}

function displayQueue(queue) {
    const queueContainer = document.getElementById('queueContainer');
    
    if (queue.length === 0) {
        queueContainer.innerHTML = '<p class="empty-state">No hay turnos en cola</p>';
        return;
    }

    queueContainer.innerHTML = `
        <div class="queue-header">
            <h3>Cola de Turnos</h3>
            <button onclick="callNextTurn()" class="btn btn-primary">Llamar Siguiente</button>
        </div>
        <div class="queue-list">
            ${queue.map(turn => `
                <div class="queue-item ${turn.estado.toLowerCase()}" data-id="${turn.id}">
                    <div class="queue-info">
                        <span class="turn-number">${turn.numero}</span>
                        <span class="turn-service">${turn.servicio_nombre}</span>
                        <span class="turn-time">${formatDateTime(turn.fecha_creacion)}</span>
                    </div>
                    <div class="queue-actions">
                        <span class="status-badge ${turn.estado.toLowerCase()}">${turn.estado}</span>
                        ${turn.estado === 'PENDIENTE' ? `
                            <button onclick="callTurn(${turn.id})" class="btn btn-sm btn-primary">Llamar</button>
                            <button onclick="attendTurn(${turn.id})" class="btn btn-sm btn-success">Atender</button>
                            <button onclick="cancelTurn(${turn.id})" class="btn btn-sm btn-danger">Cancelar</button>
                        ` : ''}
                        ${turn.estado === 'LLAMADO' ? `
                            <button onclick="attendTurn(${turn.id})" class="btn btn-sm btn-success">Atender</button>
                            <button onclick="callTurn(${turn.id})" class="btn btn-sm btn-warning">Volver a Llamar</button>
                        ` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

async function callNextTurn() {
    try {
        const result = await apiRequest('/turno/llamar-siguiente', { method: 'POST' });
        if (result.turno) {
            speakTurnNumber(result.turno.numero, result.turno.servicio_nombre);
            showNotification(`Llamando turno ${result.turno.numero}`, 'success');
            loadQueue();
            loadStatistics();
        } else {
            showNotification('No hay turnos pendientes para llamar', 'warning');
        }
    } catch (error) {
        console.error('Error calling next turn:', error);
    }
}

async function callTurn(turnId) {
    try {
        const result = await apiRequest(`/turno/${turnId}/llamar`, { method: 'POST' });
        if (result.success) {
            speakTurnNumber(result.turno.numero, result.turno.servicio_nombre);
            showNotification(`Llamando turno ${result.turno.numero}`, 'success');
            loadQueue();
            loadStatistics();
        }
    } catch (error) {
        console.error('Error calling turn:', error);
    }
}

async function attendTurn(turnId) {
    try {
        const result = await apiRequest(`/turno/${turnId}/atender`, { method: 'POST' });
        if (result.success) {
            showNotification('Turno atendido correctamente', 'success');
            loadQueue();
            loadStatistics();
        }
    } catch (error) {
        console.error('Error attending turn:', error);
    }
}

async function cancelTurn(turnId) {
    if (confirm('¿Está seguro de cancelar este turno?')) {
        try {
            const result = await apiRequest(`/turno/${turnId}/cancelar`, { method: 'POST' });
            if (result.success) {
                showNotification('Turno cancelado', 'success');
                loadQueue();
                loadStatistics();
            }
        } catch (error) {
            console.error('Error canceling turn:', error);
        }
    }
}

function speakTurnNumber(turnNumber, serviceName) {
    if (speechSynthesis && currentConfig && currentConfig.voz_habilitada) {
        const message = `Turno ${turnNumber} para ${serviceName}`;
        const utterance = new SpeechSynthesisUtterance(message);
        utterance.lang = 'es-ES';
        utterance.volume = currentConfig.volumen_voz || 0.8;
        speechSynthesis.speak(utterance);
    }
}

// Statistics Functions
async function loadStatistics() {
    try {
        const stats = await apiRequest('/estadisticas');
        displayStatistics(stats);
    } catch (error) {
        console.error('Error loading statistics:', error);
    }
}

function displayStatistics(stats) {
    const statsContainer = document.getElementById('statisticsContainer');
    if (!statsContainer) return;
    
    statsContainer.innerHTML = `
        <div class="stats-summary">
            <h3>Estadísticas de Hoy</h3>
            <div class="stats-row">
                <div class="stat-item">
                    <span class="stat-label">Total</span>
                    <span class="stat-value">${stats.total_turnos}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Pendientes</span>
                    <span class="stat-value">${stats.pendientes}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Llamados</span>
                    <span class="stat-value">${stats.llamados}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Atendidos</span>
                    <span class="stat-value">${stats.atendidos}</span>
                </div>
            </div>
        </div>
    `;
}

// Appointment Functions
async function loadServices() {
    try {
        const services = await apiRequest('/servicios');
        displayServiceSelector(services);
    } catch (error) {
        console.error('Error loading services:', error);
    }
}

function displayServiceSelector(services) {
    const serviceSelector = document.getElementById('serviceSelector');
    if (!serviceSelector) return;
    
    serviceSelector.innerHTML = `
        <option value="">Seleccione un servicio</option>
        ${services.map(service => `
            <option value="${service.id}">${service.nombre}</option>
        `).join('')}
    `;
}

async function assignAppointment() {
    const serviceId = document.getElementById('serviceSelector').value;
    const clientName = document.getElementById('clientName').value;
    const clientPhone = document.getElementById('clientPhone').value;
    const appointmentDate = document.getElementById('appointmentDate').value;
    const appointmentTime = document.getElementById('appointmentTime').value;
    
    if (!serviceId || !clientName || !appointmentDate || !appointmentTime) {
        showNotification('Por favor complete todos los campos requeridos', 'error');
        return;
    }
    
    try {
        const result = await apiRequest('/turno/asignar', {
            method: 'POST',
            body: JSON.stringify({
                servicio_id: parseInt(serviceId),
                nombre_cliente: clientName,
                telefono_cliente: clientPhone,
                fecha_cita: appointmentDate,
                hora_cita: appointmentTime
            })
        });
        
        if (result.success) {
            showNotification(`Cita asignada. Turno #${result.turno.numero}`, 'success');
            document.getElementById('assignAppointmentForm').reset();
            loadQueue();
        }
    } catch (error) {
        console.error('Error assigning appointment:', error);
    }
}

// Calendar Functions
async function loadCalendar() {
    try {
        const appointments = await apiRequest(`/citas/${formatDate(currentDate)}`);
        displayCalendar(appointments);
    } catch (error) {
        console.error('Error loading calendar:', error);
    }
}

function displayCalendar(appointments) {
    const calendarContainer = document.getElementById('calendarContainer');
    if (!calendarContainer) return;
    
    const dateStr = formatDate(currentDate);
    
    calendarContainer.innerHTML = `
        <div class="calendar-header">
            <button onclick="changeDate(-1)" class="btn btn-outline">« Anterior</button>
            <h3>${currentDate.toLocaleDateString('es-ES', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            })}</h3>
            <button onclick="changeDate(1)" class="btn btn-outline">Siguiente »</button>
        </div>
        <div class="appointments-list">
            ${appointments.length === 0 ? 
                '<p class="empty-state">No hay citas programadas para este día</p>' :
                appointments.map(apt => `
                    <div class="appointment-item ${apt.estado.toLowerCase()}">
                        <div class="appointment-time">${formatTime(new Date(apt.fecha_cita))}</div>
                        <div class="appointment-info">
                            <strong>${apt.nombre_cliente}</strong>
                            <span>${apt.servicio_nombre}</span>
                            <span class="status-badge ${apt.estado.toLowerCase()}">${apt.estado}</span>
                        </div>
                        <div class="appointment-actions">
                            <button onclick="showEditAppointment(${apt.id})" class="btn btn-sm btn-outline">Editar</button>
                            <button onclick="cancelAppointment(${apt.id})" class="btn btn-sm btn-danger">Cancelar</button>
                        </div>
                    </div>
                `).join('')
            }
        </div>
    `;
}

function changeDate(days) {
    currentDate.setDate(currentDate.getDate() + days);
    loadCalendar();
}

async function cancelAppointment(appointmentId) {
    if (confirm('¿Está seguro de cancelar esta cita?')) {
        try {
            const result = await apiRequest(`/cita/${appointmentId}/cancelar`, { method: 'POST' });
            if (result.success) {
                showNotification('Cita cancelada', 'success');
                loadCalendar();
            }
        } catch (error) {
            console.error('Error canceling appointment:', error);
        }
    }
}

// QR Functions
async function loadQRHistory() {
    try {
        const qrHistory = await apiRequest('/qr/historial');
        displayQRHistory(qrHistory);
    } catch (error) {
        console.error('Error loading QR history:', error);
    }
}

function displayQRHistory(qrHistory) {
    const qrContainer = document.getElementById('qrHistoryContainer');
    if (!qrContainer) return;
    
    qrContainer.innerHTML = `
        <div class="qr-header">
            <h3>Códigos QR Generados</h3>
            <button onclick="generateQR()" class="btn btn-primary">Generar Nuevo QR</button>
        </div>
        <div class="qr-history-list">
            ${qrHistory.length === 0 ? 
                '<p class="empty-state">No se han generado códigos QR</p>' :
                qrHistory.map(qr => `
                    <div class="qr-history-item">
                        <div class="qr-info">
                            <strong>QR #${qr.id}</strong>
                            <span>Servicio: ${qr.servicio_nombre}</span>
                            <span>Creado: ${formatDateTime(qr.fecha_creacion)}</span>
                            <span>Usos: ${qr.usos_restantes}/${qr.usos_maximos}</span>
                        </div>
                        <div class="qr-actions">
                            <button onclick="showQRCode(${qr.id})" class="btn btn-sm btn-primary">Ver QR</button>
                            <button onclick="downloadQR(${qr.id})" class="btn btn-sm btn-outline">Descargar</button>
                        </div>
                    </div>
                `).join('')
            }
        </div>
    `;
}

async function generateQR() {
    const serviciosSelect = document.getElementById('qrServiceSelector');
    if (!serviciosSelect) {
        // Load services first
        try {
            const services = await apiRequest('/servicios');
            showGenerateQRModal(services);
        } catch (error) {
            console.error('Error loading services for QR:', error);
        }
    } else {
        showGenerateQRModal();
    }
}

function showGenerateQRModal(services = []) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>Generar Código QR</h3>
            <form id="generateQRForm">
                <div class="form-group">
                    <label>Servicio:</label>
                    <select id="qrServiceSelector" required>
                        <option value="">Seleccione un servicio</option>
                        ${services.map(service => `
                            <option value="${service.id}">${service.nombre}</option>
                        `).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Usos máximos:</label>
                    <input type="number" id="qrMaxUses" min="1" value="10" required>
                </div>
                <div class="form-group">
                    <label>Días de vigencia:</label>
                    <input type="number" id="qrValidDays" min="1" value="7" required>
                </div>
                <div class="form-actions">
                    <button type="button" onclick="closeModal()" class="btn btn-outline">Cancelar</button>
                    <button type="submit" class="btn btn-primary">Generar QR</button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById('generateQRForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = {
            servicio_id: parseInt(document.getElementById('qrServiceSelector').value),
            usos_maximos: parseInt(document.getElementById('qrMaxUses').value),
            dias_vigencia: parseInt(document.getElementById('qrValidDays').value)
        };
        
        try {
            const result = await apiRequest('/qr/generar', {
                method: 'POST',
                body: JSON.stringify(formData)
            });
            
            if (result.success) {
                showNotification('Código QR generado correctamente', 'success');
                closeModal();
                loadQRHistory();
            }
        } catch (error) {
            console.error('Error generating QR:', error);
        }
    });
}

async function showQRCode(qrId) {
    try {
        const qr = await apiRequest(`/qr/${qrId}`);
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>Código QR #${qr.id}</h3>
                <div class="qr-display">
                    <img src="data:image/png;base64,${qr.qr_code}" alt="QR Code" style="max-width: 300px;">
                </div>
                <p>Servicio: <strong>${qr.servicio_nombre}</strong></p>
                <p>Usos restantes: <strong>${qr.usos_restantes}/${qr.usos_maximos}</strong></p>
                <p>Válido hasta: <strong>${formatDateTime(qr.fecha_expiracion)}</strong></p>
                <div class="form-actions">
                    <button onclick="closeModal()" class="btn btn-primary">Cerrar</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    } catch (error) {
        console.error('Error showing QR code:', error);
    }
}

function downloadQR(qrId) {
    const link = document.createElement('a');
    link.href = `${API_BASE_URL}/qr/${qrId}/download`;
    link.download = `qr_code_${qrId}.png`;
    link.click();
}

// Configuration Functions
async function loadConfiguration() {
    try {
        const config = await apiRequest('/configuracion');
        displayConfiguration(config);
    } catch (error) {
        console.error('Error loading configuration:', error);
    }
}

function displayConfiguration(config) {
    const configContainer = document.getElementById('configurationContainer');
    if (!configContainer) return;
    
    configContainer.innerHTML = `
        <form id="configurationForm">
            <div class="config-section">
                <h3>Configuración General</h3>
                <div class="form-group">
                    <label>Nombre de la empresa:</label>
                    <input type="text" id="companyName" value="${config.nombre_empresa || ''}" required>
                </div>
                <div class="form-group">
                    <label>URL del logo:</label>
                    <input type="url" id="logoUrl" value="${config.logo_url || ''}">
                </div>
            </div>
            
            <div class="config-section">
                <h3>Configuración de Turnos</h3>
                <div class="form-group">
                    <label>Tiempo de espera antes de cancelar (minutos):</label>
                    <input type="number" id="waitTimeout" value="${config.tiempo_espera_cancelacion || 30}" min="5">
                </div>
                <div class="form-group">
                    <label>Reiniciar numeración diariamente:</label>
                    <input type="checkbox" id="dailyReset" ${config.reinicio_diario ? 'checked' : ''}>
                </div>
            </div>
            
            <div class="config-section">
                <h3>Configuración de Voz</h3>
                <div class="form-group">
                    <label>Habilitar síntesis de voz:</label>
                    <input type="checkbox" id="voiceEnabled" ${config.voz_habilitada ? 'checked' : ''}>
                </div>
                <div class="form-group">
                    <label>Volumen (0.1 - 1.0):</label>
                    <input type="range" id="voiceVolume" min="0.1" max="1.0" step="0.1" value="${config.volumen_voz || 0.8}">
                    <span id="volumeDisplay">${config.volumen_voz || 0.8}</span>
                </div>
            </div>
            
            <div class="form-actions">
                <button type="submit" class="btn btn-primary">Guardar Configuración</button>
            </div>
        </form>
    `;
    
    // Add event listeners
    document.getElementById('voiceVolume').addEventListener('input', (e) => {
        document.getElementById('volumeDisplay').textContent = e.target.value;
    });
    
    document.getElementById('configurationForm').addEventListener('submit', saveConfiguration);
}

async function saveConfiguration(e) {
    e.preventDefault();
    
    const configData = {
        nombre_empresa: document.getElementById('companyName').value,
        logo_url: document.getElementById('logoUrl').value,
        tiempo_espera_cancelacion: parseInt(document.getElementById('waitTimeout').value),
        reinicio_diario: document.getElementById('dailyReset').checked,
        voz_habilitada: document.getElementById('voiceEnabled').checked,
        volumen_voz: parseFloat(document.getElementById('voiceVolume').value)
    };
    
    try {
        const result = await apiRequest('/configuracion', {
            method: 'POST',
            body: JSON.stringify(configData)
        });
        
        if (result.success) {
            showNotification('Configuración guardada correctamente', 'success');
            currentConfig = result.config;
            updateSidebarInfo();
        }
    } catch (error) {
        console.error('Error saving configuration:', error);
    }
}

// Utility Functions
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

function closeModal() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (modal.parentNode) {
            modal.parentNode.removeChild(modal);
        }
    });
}

// Modal click outside to close
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        closeModal();
    }
});

// Initialize Application
document.addEventListener('DOMContentLoaded', function() {
    loadConfigurationData();
    showPage('dashboard');
});

// Legacy function for compatibility
function showTab(tabName) {
    showPage(tabName);
}
