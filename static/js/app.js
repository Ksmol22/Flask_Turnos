// Configuración dinámica de API
function getApiBaseUrl() {
    const hostname = window.location.hostname;
    const port = '8080';
    
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return `http://127.0.0.1:${port}/api`;
    } else {
        // Para acceso desde red local, usar la IP actual del servidor
        return `http://${hostname}:${port}/api`;
    }
}

const API_BASE_URL = getApiBaseUrl();

// Global Variables
let currentConfig = null;
let currentDate = new Date();
let calendarDate = new Date(); // Para el calendario
let speechSynthesis = window.speechSynthesis;
let speechEnabled = true;
let selectedDate = null;

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

// Update date and time display
function updateDateTime() {
    const now = new Date();
    const dateTimeElement = document.getElementById('currentDateTime');
    if (dateTimeElement) {
        dateTimeElement.textContent = now.toLocaleString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }
}

// Speaker Functions
function toggleSpeaker() {
    speechEnabled = !speechEnabled;
    const button = document.getElementById('speakerToggle');
    const status = document.getElementById('speakerStatus');
    
    if (speechEnabled) {
        button.classList.remove('disabled');
        status.textContent = 'Activado';
        button.innerHTML = '🔊 <span id="speakerStatus">Activado</span>';
        showNotification('Narrador activado', 'success');
    } else {
        button.classList.add('disabled');
        status.textContent = 'Desactivado';
        button.innerHTML = '🔇 <span id="speakerStatus">Desactivado</span>';
        showNotification('Narrador desactivado', 'info');
    }
}

function speakText(text) {
    if (!speechEnabled || !speechSynthesis) return;
    
    // Cancelar cualquier síntesis en curso
    speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 0.8;
    
    speechSynthesis.speak(utterance);
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
            loadConfigurationIntoForm();
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
        displayNetworkInfo();
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

function displayNetworkInfo() {
    const networkContainer = document.getElementById('networkInfo');
    if (!networkContainer) return;
    
    const hostname = window.location.hostname;
    const port = window.location.port || '8080';
    const protocol = window.location.protocol;
    const currentUrl = `${protocol}//${hostname}:${port}`;
    
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    const networkStatus = isLocalhost ? '🏠 Acceso Local' : '🌐 Acceso de Red';
    const statusColor = isLocalhost ? '#28a745' : '#007bff';
    
    networkContainer.innerHTML = `
        <div class="network-info">
            <div class="network-status" style="color: ${statusColor};">
                <strong>${networkStatus}</strong>
            </div>
            <div class="network-details">
                <p><strong>URL Actual:</strong> <code>${currentUrl}</code></p>
                <p><strong>API Base:</strong> <code>${API_BASE_URL}</code></p>
                <p><strong>Servidor:</strong> ${hostname}:${port}</p>
            </div>
            <div class="network-access">
                <h4>URLs de Acceso:</h4>
                <ul>
                    <li><strong>Local:</strong> <code>http://127.0.0.1:8080</code></li>
                    <li><strong>Red Local:</strong> <code>http://192.168.0.165:8080</code></li>
                </ul>
                <small style="color: #6c757d; font-style: italic;">
                    * La URL de red local permite acceso desde otros dispositivos en la misma red WiFi
                </small>
            </div>
        </div>
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
    
    if (!queueContainer) {
        console.error('Queue container not found');
        return;
    }
    
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
            ${queue.map(item => {
                const turno = item.turno;
                if (!turno) return '';
                
                return `
                    <div class="queue-item ${turno.estado ? turno.estado.toLowerCase() : 'pendiente'}" data-id="${turno.id}">
                        <div class="queue-info">
                            <span class="turn-number">${turno.numero_turno}</span>
                            <span class="turn-client">${turno.nombre_cliente}</span>
                            <span class="turn-service">${turno.servicio}</span>
                            <span class="turn-time">${formatTime(new Date(turno.fecha_cita))}</span>
                        </div>
                        <div class="queue-actions">
                            <span class="status-badge ${turno.estado ? turno.estado.toLowerCase() : 'pendiente'}">${turno.estado || 'PENDIENTE'}</span>
                            ${(!turno.estado || turno.estado === 'pendiente') ? `
                                <button onclick="callTurn(${turno.id})" class="btn btn-sm btn-primary">📢 Llamar</button>
                                <button onclick="attendTurn(${turno.id})" class="btn btn-sm btn-success">✅ Atender</button>
                                <button onclick="cancelTurn(${turno.id})" class="btn btn-sm btn-danger">❌ Cancelar</button>
                            ` : ''}
                            ${turno.estado === 'llamado' ? `
                                <button onclick="attendTurn(${turno.id})" class="btn btn-sm btn-success">✅ Atender</button>
                                <button onclick="callTurn(${turno.id})" class="btn btn-sm btn-warning">🔄 Repetir</button>
                            ` : ''}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

async function callNextTurn() {
    try {
        const result = await apiRequest('/cola/siguiente');
        if (result && result.turno) {
            // Llamar el turno
            await callTurn(result.turno.id);
        } else {
            showNotification('No hay turnos pendientes para llamar', 'warning');
        }
    } catch (error) {
        console.error('Error calling next turn:', error);
        showNotification('No hay turnos pendientes para llamar', 'warning');
    }
}

async function callTurn(turnId) {
    try {
        const result = await apiRequest(`/cola/llamar/${turnId}`, { method: 'POST' });
        if (result && result.turno) {
            const mensaje = result.mensaje_voz || `Turno ${result.turno.numero_turno}, ${result.turno.nombre_cliente}, acérquese por favor`;
            speakText(mensaje);
            showNotification(`Llamando turno ${result.turno.numero_turno}`, 'success');
            loadQueue();
            loadStatistics();
        }
    } catch (error) {
        console.error('Error calling turn:', error);
        showNotification('Error al llamar el turno', 'error');
    }
}

async function attendTurn(turnId) {
    try {
        const result = await apiRequest(`/turnos/${turnId}`, { 
            method: 'PUT',
            body: JSON.stringify({ estado: 'atendido' })
        });
        if (result) {
            showNotification('Turno marcado como atendido', 'success');
            loadQueue();
            loadStatistics();
        }
    } catch (error) {
        console.error('Error attending turn:', error);
        showNotification('Error al marcar turno como atendido', 'error');
    }
}

async function cancelTurn(turnId) {
    if (confirm('¿Está seguro de cancelar este turno?')) {
        try {
            const result = await apiRequest(`/turnos/${turnId}`, { 
                method: 'PUT',
                body: JSON.stringify({ estado: 'cancelado' })
            });
            if (result) {
                showNotification('Turno cancelado correctamente', 'success');
                loadQueue();
                loadStatistics();
            }
        } catch (error) {
            console.error('Error canceling turn:', error);
            showNotification('Error al cancelar el turno', 'error');
        }
    }
}

// Voice Functions
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
    const serviceSelector = document.getElementById('serviceSelect');
    if (!serviceSelector) return;
    
    serviceSelector.innerHTML = `
        <option value="">Seleccionar servicio...</option>
        ${services.map(service => `
            <option value="${service.id}">${service.nombre}</option>
        `).join('')}
    `;
}

async function assignAppointment(event) {
    event.preventDefault();
    
    const serviceSelect = document.getElementById('serviceSelect');
    const serviceId = serviceSelect.value;
    const serviceName = serviceSelect.options[serviceSelect.selectedIndex].text;
    const clientName = document.getElementById('nombre').value;
    const clientPhone = document.getElementById('telefono').value;
    const appointmentDate = document.getElementById('fecha').value;
    const appointmentTime = document.getElementById('hora').value;
    const observations = document.getElementById('observaciones').value;
    
    if (!serviceId || !clientName || !appointmentDate || !appointmentTime) {
        showNotification('Por favor complete todos los campos requeridos', 'error');
        return;
    }
    
    // Combinar fecha y hora
    const fechaHora = `${appointmentDate}T${appointmentTime}:00`;
    
    try {
        const result = await apiRequest('/turnos', {
            method: 'POST',
            body: JSON.stringify({
                nombre_cliente: clientName,
                telefono: clientPhone,
                servicio: serviceName,
                fecha_cita: fechaHora,
                tipo_registro: 'manual',
                observaciones: observations
            })
        });
        
        if (result) {
            showNotification(`Cita asignada. Turno #${result.numero_turno}`, 'success');
            document.getElementById('appointmentForm').reset();
            
            // Mostrar resultado
            const resultDiv = document.getElementById('appointmentResult');
            if (resultDiv) {
                resultDiv.innerHTML = `
                    <div class="card success-card" style="margin-top: 20px; border-left: 4px solid #27ae60;">
                        <div class="card-header">
                            <div class="card-icon">✅</div>
                            <span>Cita Asignada Exitosamente</span>
                        </div>
                        <div class="card-body">
                            <p><strong>Número de Turno:</strong> ${result.numero_turno}</p>
                            <p><strong>Cliente:</strong> ${result.nombre_cliente}</p>
                            <p><strong>Servicio:</strong> ${result.servicio}</p>
                            <p><strong>Fecha:</strong> ${new Date(result.fecha_cita).toLocaleString('es-ES')}</p>
                            ${result.telefono ? `<p><strong>Teléfono:</strong> ${result.telefono}</p>` : ''}
                            ${result.observaciones ? `<p><strong>Observaciones:</strong> ${result.observaciones}</p>` : ''}
                        </div>
                    </div>
                `;
            }
            
            // Recargar datos si estamos en hoy
            const today = new Date().toISOString().split('T')[0];
            if (appointmentDate === today) {
                loadQueue();
                loadStatistics();
            }
        }
    } catch (error) {
        console.error('Error assigning appointment:', error);
        showNotification('Error al asignar la cita. Intente nuevamente.', 'error');
    }
}

// Calendar Functions
let currentCalendarDate = new Date();
let calendarAppointments = {};

async function loadCalendar() {
    try {
        // Cargar citas del mes actual
        await loadCalendarMonth();
        generateCalendarGrid();
    } catch (error) {
        console.error('Error loading calendar:', error);
    }
}

async function loadCalendarMonth() {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    // Obtener primer y último día del mes
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    calendarAppointments = {};
    
    // Cargar citas para cada día del mes
    for (let date = new Date(firstDay); date <= lastDay; date.setDate(date.getDate() + 1)) {
        const dateStr = formatDate(date);
        try {
            const appointments = await apiRequest(`/citas/${dateStr}`);
            calendarAppointments[dateStr] = appointments;
        } catch (error) {
            calendarAppointments[dateStr] = [];
        }
    }
}

function generateCalendarGrid() {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    // Actualizar título
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                       'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    document.getElementById('currentMonthYear').textContent = `${monthNames[month]} ${year}`;
    
    // Generar grid del calendario
    const calendarGrid = document.getElementById('calendarGrid');
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay()); // Empezar desde domingo
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let gridHTML = `
        <div class="calendar-day-header">Dom</div>
        <div class="calendar-day-header">Lun</div>
        <div class="calendar-day-header">Mar</div>
        <div class="calendar-day-header">Mié</div>
        <div class="calendar-day-header">Jue</div>
        <div class="calendar-day-header">Vie</div>
        <div class="calendar-day-header">Sáb</div>
    `;
    
    // Generar 6 semanas (42 días)
    for (let i = 0; i < 42; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);
        
        const dateStr = formatDate(currentDate);
        const appointments = calendarAppointments[dateStr] || [];
        const isCurrentMonth = currentDate.getMonth() === month;
        const isToday = currentDate.getTime() === today.getTime();
        const isSelected = selectedDate && formatDate(selectedDate) === dateStr;
        
        let dayClasses = ['calendar-day'];
        if (!isCurrentMonth) dayClasses.push('other-month');
        if (isToday) dayClasses.push('today');
        if (isSelected) dayClasses.push('selected');
        
        let appointmentsHTML = '';
        if (appointments.length > 0) {
            const visibleAppointments = appointments.slice(0, 3); // Mostrar máximo 3
            appointmentsHTML = visibleAppointments.map(apt => 
                `<div class="calendar-appointment ${apt.estado.toLowerCase()}" title="${apt.nombre_cliente} - ${apt.servicio_nombre}">
                    ${apt.nombre_cliente}
                </div>`
            ).join('');
            
            if (appointments.length > 3) {
                appointmentsHTML += `<div class="calendar-appointment" style="background: #7f8c8d;">+${appointments.length - 3} más</div>`;
            }
        }
        
        gridHTML += `
            <div class="${dayClasses.join(' ')}" onclick="selectCalendarDay('${dateStr}')">
                <div class="calendar-day-number">${currentDate.getDate()}</div>
                <div class="calendar-appointments">
                    ${appointmentsHTML}
                </div>
            </div>
        `;
    }
    
    calendarGrid.innerHTML = gridHTML;
}

function selectCalendarDay(dateStr) {
    selectedDate = new Date(dateStr);
    generateCalendarGrid(); // Regenerar para mostrar selección
    showDayAppointments(dateStr);
}

function showDayAppointments(dateStr) {
    const appointments = calendarAppointments[dateStr] || [];
    const container = document.getElementById('selectedDayAppointments');
    
    const date = new Date(dateStr);
    const dateDisplay = date.toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    if (appointments.length === 0) {
        container.innerHTML = `
            <h4>Citas para ${dateDisplay}</h4>
            <p class="empty-state">No hay citas programadas para este día</p>
        `;
        return;
    }
    
    container.innerHTML = `
        <h4>Citas para ${dateDisplay} (${appointments.length})</h4>
        <div class="appointment-details">
            ${appointments.map(apt => `
                <div class="appointment-item">
                    <div class="appointment-time">${formatTime(new Date(apt.fecha_cita))}</div>
                    <div class="appointment-info">
                        <strong>${apt.nombre_cliente}</strong>
                        <span>${apt.servicio_nombre}</span>
                        <span class="status-badge ${apt.estado.toLowerCase()}">${apt.estado}</span>
                        ${apt.telefono ? `<span>📞 ${apt.telefono}</span>` : ''}
                        ${apt.observaciones ? `<span>💬 ${apt.observaciones}</span>` : ''}
                    </div>
                    <div class="appointment-actions">
                        ${apt.estado === 'pendiente' ? `
                            <button onclick="callAppointment(${apt.id})" class="btn btn-sm btn-primary" title="Llamar">📢</button>
                            <button onclick="markAsAttended(${apt.id})" class="btn btn-sm btn-success" title="Marcar como atendido">✅</button>
                        ` : ''}
                        <button onclick="cancelAppointment(${apt.id})" class="btn btn-sm btn-danger" title="Cancelar">❌</button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function changeMonth(direction) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + direction);
    selectedDate = null; // Limpiar selección al cambiar mes
    loadCalendar();
}

async function callAppointment(appointmentId) {
    try {
        const result = await apiRequest(`/cola/llamar/${appointmentId}`, { method: 'POST' });
        if (result.turno) {
            speakText(result.mensaje_voz);
            showNotification(`Turno ${result.turno.numero_turno} llamado`, 'success');
            loadCalendar(); // Recargar calendario
        }
    } catch (error) {
        console.error('Error calling appointment:', error);
    }
}

async function markAsAttended(appointmentId) {
    try {
        const result = await apiRequest(`/turnos/${appointmentId}`, {
            method: 'PUT',
            body: JSON.stringify({ estado: 'atendido' })
        });
        showNotification('Cita marcada como atendida', 'success');
        loadCalendar(); // Recargar calendario
    } catch (error) {
        console.error('Error marking as attended:', error);
    }
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
        // Mostrar mensaje temporal mientras no existe la ruta
        displayQRHistory([]);
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
                            <strong>Turno: ${qr.numero_turno}</strong>
                            <span>Cliente: ${qr.nombre_cliente}</span>
                            <span>Servicio: ${qr.servicio}</span>
                            <span>Cita: ${formatDateTime(qr.fecha_cita)}</span>
                            <span>Creado: ${formatDateTime(qr.fecha_creacion)}</span>
                            <span class="status ${qr.estado.toLowerCase()}">${qr.estado}</span>
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
    // Load services first
    try {
        const services = await apiRequest('/servicios');
        showGenerateQRModal(services);
    } catch (error) {
        console.error('Error loading services for QR:', error);
        showNotification('Error al cargar servicios', 'error');
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
                            <option value="${service.nombre}">${service.nombre}</option>
                        `).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Nombre del Cliente:</label>
                    <input type="text" id="qrClientName" required>
                </div>
                <div class="form-group">
                    <label>Teléfono:</label>
                    <input type="tel" id="qrClientPhone">
                </div>
                <div class="form-group">
                    <label>Fecha de Cita:</label>
                    <input type="datetime-local" id="qrAppointmentDate" required>
                </div>
                <div class="form-group">
                    <label>Observaciones:</label>
                    <textarea id="qrObservations" rows="2"></textarea>
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
        
        // Generate unique number
        const numeroTurno = `QR${Date.now()}`;
        
        const formData = {
            numero_turno: numeroTurno,
            nombre_cliente: document.getElementById('qrClientName').value,
            telefono: document.getElementById('qrClientPhone').value || '',
            servicio: document.getElementById('qrServiceSelector').value,
            fecha_cita: new Date(document.getElementById('qrAppointmentDate').value).toISOString(),
            observaciones: document.getElementById('qrObservations').value || ''
        };
        
        try {
            const result = await apiRequest('/qr/generate', {
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
            showNotification('Error al generar código QR', 'error');
        }
    });
}

async function showQRCode(turnoId) {
    try {
        const turno = await apiRequest(`/turno/${turnoId}`);
        
        // Generar imagen QR en base64 desde los datos
        const qrData = JSON.parse(turno.qr_code);
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>Código QR - ${turno.numero_turno}</h3>
                <div class="qr-display">
                    <canvas id="qrCanvas" style="max-width: 300px; border: 1px solid #ccc;"></canvas>
                </div>
                <div class="qr-details">
                    <p><strong>Cliente:</strong> ${turno.nombre_cliente}</p>
                    <p><strong>Servicio:</strong> ${turno.servicio}</p>
                    <p><strong>Fecha de Cita:</strong> ${formatDateTime(turno.fecha_cita)}</p>
                    <p><strong>Estado:</strong> <span class="status ${turno.estado.toLowerCase()}">${turno.estado}</span></p>
                </div>
                <div class="form-actions">
                    <button onclick="downloadQR(${turno.id})" class="btn btn-outline">Descargar</button>
                    <button onclick="closeModal()" class="btn btn-primary">Cerrar</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Generar QR en canvas
        generateQRCanvas(turno.qr_code, 'qrCanvas');
        
    } catch (error) {
        console.error('Error showing QR code:', error);
        showNotification('Error al mostrar código QR', 'error');
    }
}

function generateQRCanvas(data, canvasId) {
    // Simple QR representation - for production use a proper QR library
    const canvas = document.getElementById(canvasId);
    const ctx = canvas.getContext('2d');
    canvas.width = 200;
    canvas.height = 200;
    
    // Fill background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 200, 200);
    
    // Simple pattern representation
    ctx.fillStyle = 'black';
    ctx.font = '12px Arial';
    ctx.fillText('QR Code Data:', 10, 30);
    ctx.font = '8px monospace';
    
    // Display data in a readable way
    const lines = data.substring(0, 300).match(/.{1,25}/g) || [];
    lines.forEach((line, index) => {
        ctx.fillText(line, 10, 50 + (index * 10));
    });
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
        <form id="configurationForm" enctype="multipart/form-data">
            <div class="config-section">
                <h3>Configuración General</h3>
                <div class="form-group">
                    <label>Nombre de la empresa:</label>
                    <input type="text" id="companyName" value="${config.nombre_empresa || ''}" required>
                </div>
                <div class="form-group">
                    <label>Logo de la empresa:</label>
                    <div class="logo-upload-area">
                        <div class="current-logo">
                            <img src="${config.logo_url || 'static/img/logo-default.png'}" alt="Logo actual" id="currentLogoPreview" style="max-width: 100px; max-height: 100px;">
                        </div>
                        <input type="file" id="logoFile" accept="image/*" onchange="previewLogo(this)">
                        <button type="button" onclick="document.getElementById('logoFile').click()" class="btn btn-outline">Seleccionar Logo</button>
                        <small>Formatos admitidos: JPG, PNG, GIF (máximo 2MB)</small>
                    </div>
                </div>
                <div class="form-group">
                    <label>URL del logo (alternativo):</label>
                    <input type="url" id="logoUrl" value="${config.logo_url || ''}" placeholder="https://ejemplo.com/logo.png">
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
    
    // Intentar subir logo si hay uno nuevo
    let logoUrl = document.getElementById('logoUrl').value;
    const uploadedLogo = await uploadLogo();
    if (uploadedLogo) {
        logoUrl = uploadedLogo;
    }
    
    const configData = {
        nombre_empresa: document.getElementById('companyName').value,
        logo_url: logoUrl,
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
            
            // Actualizar logo en el header
            const headerLogo = document.querySelector('.logo');
            if (headerLogo && logoUrl) {
                headerLogo.src = logoUrl;
            }
            
            // Actualizar título de la empresa
            const companyTitle = document.querySelector('.company-name');
            if (companyTitle) {
                companyTitle.textContent = configData.nombre_empresa;
            }
        }
    } catch (error) {
        console.error('Error saving configuration:', error);
        showNotification('Error al guardar configuración', 'error');
    }
}

// Logo Functions
function previewLogo(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            document.getElementById('currentLogoPreview').src = e.target.result;
        };
        
        reader.readAsDataURL(input.files[0]);
    }
}

async function uploadLogo() {
    const fileInput = document.getElementById('logoFile');
    const file = fileInput.files[0];
    
    if (!file) return null;
    
    // Validar archivo
    if (file.size > 2 * 1024 * 1024) { // 2MB
        showNotification('El archivo es demasiado grande. Máximo 2MB.', 'error');
        return null;
    }
    
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
        showNotification('Tipo de archivo no permitido. Use JPG, PNG o GIF.', 'error');
        return null;
    }
    
    const formData = new FormData();
    formData.append('logo', file);
    
    try {
        const response = await fetch(`${API_BASE_URL}/upload-logo`, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('Logo subido correctamente', 'success');
            return result.logo_url;
        } else {
            throw new Error(result.error || 'Error al subir logo');
        }
    } catch (error) {
        console.error('Error uploading logo:', error);
        showNotification('Error al subir logo', 'error');
        return null;
    }
}

// Utility Functions
function showNotification(message, type = 'info') {
    const container = document.getElementById('notificationContainer');
    if (!container) return;

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;

    // Contenido con icono y botón cerrar
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon"></span>
            <span class="notification-message">${message}</span>
            <button class="notification-close" title="Cerrar">&times;</button>
        </div>
    `;

    // Cerrar manualmente
    notification.querySelector('.notification-close').onclick = () => {
        notification.classList.add('hide');
        setTimeout(() => notification.remove(), 300);
    };

    container.appendChild(notification);

    // Auto remove after 3 segundos
    setTimeout(() => {
        notification.classList.add('hide');
        setTimeout(() => notification.remove(), 300);
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

// =============== NUEVAS FUNCIONES DE CONFIGURACIÓN ===============

// Función para manejar la actualización de configuración desde el formulario simple
async function updateConfiguration(event) {
    event.preventDefault();
    
    const form = event.target;
    const nombreEmpresa = document.getElementById('configNombreEmpresa').value.trim();
    const logoFile = document.getElementById('logoFile').files[0];
    
    if (!nombreEmpresa) {
        showNotification('Por favor ingrese el nombre de la empresa', 'error');
        return;
    }
    
    try {
        // Mostrar indicador de carga
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<span>⏳</span> Guardando...';
        submitBtn.disabled = true;
        
        let logoUrl = currentConfig ? currentConfig.logo_url : 'static/img/logo-default.png';
        
        // Intentar subir logo si hay uno seleccionado
        if (logoFile) {
            const uploadResult = await uploadLogoFile(logoFile);
            if (uploadResult) {
                logoUrl = uploadResult;
            }
        }
        
        // Preparar datos de configuración
        const configData = {
            nombre_empresa: nombreEmpresa,
            logo_url: logoUrl
        };
        
        // Guardar configuración
        const result = await apiRequest('/configuracion', {
            method: 'POST',
            body: JSON.stringify(configData)
        });
        
        if (result.success) {
            showNotification('Configuración guardada correctamente', 'success');
            
            // Actualizar configuración global
            currentConfig = result.config;
            updateSidebarInfo();
            
            // Actualizar vista previa del logo
            const logoPreview = document.getElementById('logoPreview');
            if (logoPreview && logoUrl) {
                logoPreview.src = logoUrl;
            }
            
            // Limpiar el campo de archivo
            document.getElementById('logoFile').value = '';
            
        } else {
            throw new Error(result.error || 'Error desconocido');
        }
        
    } catch (error) {
        console.error('Error saving configuration:', error);
        showNotification('Error al guardar configuración: ' + error.message, 'error');
    } finally {
        // Restaurar botón
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.innerHTML = '<span>💾</span> Guardar Configuración';
        submitBtn.disabled = false;
    }
}

// Función para subir archivo de logo
async function uploadLogoFile(file) {
    // Validar archivo
    if (file.size > 2 * 1024 * 1024) { // 2MB
        showNotification('El archivo es demasiado grande. Máximo 2MB.', 'error');
        return null;
    }
    
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
        showNotification('Tipo de archivo no permitido. Use JPG, PNG o GIF.', 'error');
        return null;
    }
    
    const formData = new FormData();
    formData.append('logo', file);
    
    try {
        // Mostrar indicador de carga en la vista previa
        const logoPreview = document.querySelector('.logo-preview');
        logoPreview.classList.add('logo-uploading');
        
        const response = await fetch(`${API_BASE_URL}/upload-logo`, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('Logo subido correctamente', 'success');
            return result.logo_url;
        } else {
            throw new Error(result.error || 'Error al subir logo');
        }
    } catch (error) {
        console.error('Error uploading logo:', error);
        showNotification('Error al subir logo: ' + error.message, 'error');
        return null;
    } finally {
        // Quitar indicador de carga
        const logoPreview = document.querySelector('.logo-preview');
        logoPreview.classList.remove('logo-uploading');
    }
}

// Función para previsualizar logo seleccionado
function previewLogo(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        
        // Validar tamaño antes de mostrar
        if (file.size > 2 * 1024 * 1024) {
            showNotification('El archivo es demasiado grande. Máximo 2MB.', 'error');
            input.value = '';
            return;
        }
        
        // Validar tipo antes de mostrar
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
            showNotification('Tipo de archivo no permitido. Use JPG, PNG o GIF.', 'error');
            input.value = '';
            return;
        }
        
        const reader = new FileReader();
        
        reader.onload = function(e) {
            const logoPreview = document.getElementById('logoPreview');
            if (logoPreview) {
                logoPreview.src = e.target.result;
            }
        };
        
        reader.readAsDataURL(file);
    }
}

// Función para restablecer valores por defecto
function resetToDefaults() {
    if (confirm('¿Está seguro de que desea restablecer la configuración?')) {
        document.getElementById('configNombreEmpresa').value = 'Mi Empresa';
        document.getElementById('configLogoUrl').value = '';
        document.getElementById('logoFile').value = '';
        document.getElementById('logoPreview').src = 'static/img/logo-default.png';
        showNotification('Configuración restablecida. Presione "Guardar" para aplicar los cambios.', 'info');
    }
}

// Función mejorada para cargar configuración en el formulario
async function loadConfigurationIntoForm() {
    try {
        const config = await apiRequest('/configuracion');
        
        // Llenar campos del formulario
        const nombreEmpresaField = document.getElementById('configNombreEmpresa');
        const logoPreview = document.getElementById('logoPreview');
        
        if (nombreEmpresaField) {
            nombreEmpresaField.value = config.nombre_empresa || 'Mi Empresa';
        }
        
        if (logoPreview) {
            logoPreview.src = config.logo_url || 'static/img/logo-default.png';
        }
        
    } catch (error) {
        console.error('Error loading configuration into form:', error);
    }
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
    
    // Actualizar fecha y hora cada segundo
    updateDateTime();
    setInterval(updateDateTime, 1000);
    
    // Inicializar fecha del calendario
    currentCalendarDate = new Date();
});

// Legacy function for compatibility
function showTab(tabName) {
    showPage(tabName);
}
