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
        </div>
    `;
}

function displayDashboardSummary(stats) {
    const efectividad = stats.total_turnos > 0 ? 
        ((stats.atendidos / stats.total_turnos) * 100).toFixed(1) : 0;
    
    const tiempoPromedio = stats.atendidos > 0 ? 
        Math.round((8 * 60) / stats.atendidos) : 0; // Estimación simple
    
    document.getElementById('dashboardSummary').innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
            <div style="text-align: center; padding: 20px; background: #f8f9fa; border-radius: 6px;">
                <div style="font-size: 24px; font-weight: 600; color: #27ae60; margin-bottom: 5px;">${efectividad}%</div>
                <div style="font-size: 14px; color: #6c757d;">Efectividad</div>
            </div>
            <div style="text-align: center; padding: 20px; background: #f8f9fa; border-radius: 6px;">
                <div style="font-size: 24px; font-weight: 600; color: #3498db; margin-bottom: 5px;">${tiempoPromedio} min</div>
                <div style="font-size: 14px; color: #6c757d;">Tiempo Promedio</div>
            </div>
            <div style="text-align: center; padding: 20px; background: #f8f9fa; border-radius: 6px;">
                <div style="font-size: 24px; font-weight: 600; color: #f39c12; margin-bottom: 5px;">${stats.pendientes}</div>
                <div style="font-size: 14px; color: #6c757d;">En Cola</div>
            </div>
        </div>
        
        ${stats.pendientes > 0 ? `
            <div style="margin-top: 20px; padding: 15px; background: #fff3cd; border-radius: 6px; border-left: 4px solid #f39c12;">
                <strong>⚠️ Atención:</strong> Hay ${stats.pendientes} turno${stats.pendientes > 1 ? 's' : ''} pendiente${stats.pendientes > 1 ? 's' : ''} de atención.
                <a href="#" onclick="showPage('llamado-turno')" style="color: #3498db; text-decoration: none; margin-left: 10px;">Ir a llamado de turnos →</a>
            </div>
        ` : `
            <div style="margin-top: 20px; padding: 15px; background: #d4edda; border-radius: 6px; border-left: 4px solid #27ae60;">
                <strong>✅ Perfecto:</strong> No hay turnos pendientes en este momento.
            </div>
        `}
    `;
}

// Configuration Page Functions
async function loadConfiguration() {
    try {
        const config = await apiRequest('/configuracion');
        
        document.getElementById('configNombreEmpresa').value = config.nombre_empresa || '';
        document.getElementById('configLogoUrl').value = config.logo_url || '';
        document.getElementById('configHorarioInicio').value = config.horario_inicio || '';
        document.getElementById('configHorarioFin').value = config.horario_fin || '';
        document.getElementById('configIntervalo').value = config.intervalo_citas || '';
    } catch (error) {
        console.error('Error loading configuration:', error);
    }
}

async function updateConfiguration(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const configData = {
        nombre_empresa: document.getElementById('configNombreEmpresa').value,
        logo_url: document.getElementById('configLogoUrl').value,
        horario_inicio: document.getElementById('configHorarioInicio').value,
        horario_fin: document.getElementById('configHorarioFin').value,
        intervalo_citas: parseInt(document.getElementById('configIntervalo').value)
    };
    
    try {
        await apiRequest('/configuracion', {
            method: 'PUT',
            body: JSON.stringify(configData)
        });
        
        showNotification('Configuración actualizada correctamente', 'success');
        await loadConfigurationData(); // Reload config data
    } catch (error) {
        console.error('Error updating configuration:', error);
        showNotification('Error al actualizar la configuración', 'error');
    }
}

// Queue Management
async function loadQueue() {
    try {
        const queue = await apiRequest('/cola');
        displayQueue(queue);
    } catch (error) {
        console.error('Error loading queue:', error);
    }
}

function displayQueue(queue) {
    const container = document.getElementById('queueContainer');
    
    if (queue.length === 0) {
        container.innerHTML = `
            <div class="card">
                <div class="card-header">🔕 No hay turnos pendientes</div>
                <p>No hay turnos en cola para el día de hoy.</p>
            </div>
        `;
        return;
    }
    
    const nextTurn = queue.find(item => item.turno.estado === 'pendiente');
    
    if (nextTurn) {
        container.innerHTML = `
            <div class="current-turn">
                <div class="turn-number">${nextTurn.turno.numero_turno}</div>
                <div class="turn-name">${nextTurn.turno.nombre_cliente}</div>
                <div class="turn-service">${nextTurn.turno.servicio}</div>
            </div>
            
            <div class="voice-controls">
                <button class="voice-btn" onclick="callTurn(${nextTurn.turno.id})">
                    📢 Llamar Turno
                </button>
            </div>
            
            <div class="queue-list">
                <h3>Cola de Turnos</h3>
                ${queue.map(item => `
                    <div class="card ${item.turno.estado === 'llamado' ? 'called' : ''}">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>${item.turno.numero_turno}</strong> - ${item.turno.nombre_cliente}<br>
                                <small>${item.turno.servicio} | ${formatDateTime(item.turno.fecha_cita)}</small>
                            </div>
                            <div>
                                <span class="status-badge ${item.turno.estado}">${item.turno.estado.toUpperCase()}</span>
                                ${item.turno.estado === 'llamado' ? `
                                    <button class="btn btn-success btn-sm" onclick="markAttended(${item.turno.id})">
                                        ✓ Atendido
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
}

async function callTurn(turnId) {
    try {
        const response = await apiRequest(`/cola/llamar/${turnId}`, {
            method: 'POST'
        });
        
        // Síntesis de voz
        if (speechSynthesis) {
            const utterance = new SpeechSynthesisUtterance(response.mensaje_voz);
            utterance.lang = 'es-ES';
            utterance.rate = 0.8;
            utterance.pitch = 1;
            
            const voiceBtn = document.querySelector('.voice-btn');
            voiceBtn.classList.add('speaking');
            
            utterance.onend = () => {
                voiceBtn.classList.remove('speaking');
            };
            
            speechSynthesis.speak(utterance);
        }
        
        showNotification('Turno llamado correctamente', 'success');
        loadQueue();
    } catch (error) {
        console.error('Error calling turn:', error);
        showNotification('Error al llamar el turno', 'error');
    }
}

async function markAttended(turnId) {
    try {
        await apiRequest(`/turnos/${turnId}`, {
            method: 'PUT',
            body: JSON.stringify({ estado: 'atendido' })
        });
        
        showNotification('Turno marcado como atendido', 'success');
        loadQueue();
        loadStatistics();
    } catch (error) {
        console.error('Error marking turn as attended:', error);
        showNotification('Error al marcar turno como atendido', 'error');
    }
}

// Statistics
async function loadStatistics() {
    try {
        const stats = await apiRequest('/estadisticas');
        displayStatistics(stats);
    } catch (error) {
        console.error('Error loading statistics:', error);
    }
}

function displayStatistics(stats) {
    document.getElementById('statsContainer').innerHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <span class="stat-number">${stats.total_turnos}</span>
                <span class="stat-label">Total Turnos</span>
            </div>
            <div class="stat-card">
                <span class="stat-number">${stats.pendientes}</span>
                <span class="stat-label">Pendientes</span>
            </div>
            <div class="stat-card">
                <span class="stat-number">${stats.llamados}</span>
                <span class="stat-label">Llamados</span>
            </div>
            <div class="stat-card">
                <span class="stat-number">${stats.atendidos}</span>
                <span class="stat-label">Atendidos</span>
            </div>
        </div>
    `;
}

// Appointment Assignment
async function loadServices() {
    try {
        const services = await apiRequest('/servicios');
        const select = document.getElementById('serviceSelect');
        
        select.innerHTML = '<option value="">Seleccionar servicio...</option>';
        services.forEach(service => {
            select.innerHTML += `<option value="${service.nombre}">${service.nombre}</option>`;
        });
    } catch (error) {
        console.error('Error loading services:', error);
    }
}

async function assignAppointment(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const appointmentData = {
        nombre_cliente: formData.get('nombre'),
        telefono: formData.get('telefono'),
        servicio: formData.get('servicio'),
        fecha_cita: `${formData.get('fecha')}T${formData.get('hora')}:00`,
        tipo_registro: 'manual',
        observaciones: formData.get('observaciones')
    };
    
    try {
        const turno = await apiRequest('/turnos', {
            method: 'POST',
            body: JSON.stringify(appointmentData)
        });
        
        showNotification('Cita asignada correctamente', 'success');
        event.target.reset();
        
        // Show appointment details
        document.getElementById('appointmentResult').innerHTML = `
            <div class="card">
                <div class="card-header">✅ Cita Asignada</div>
                <p><strong>Número de Turno:</strong> ${turno.numero_turno}</p>
                <p><strong>Cliente:</strong> ${turno.nombre_cliente}</p>
                <p><strong>Servicio:</strong> ${turno.servicio}</p>
                <p><strong>Fecha y Hora:</strong> ${formatDateTime(turno.fecha_cita)}</p>
                ${turno.qr_code ? `
                    <div class="qr-code-display">
                        <img src="data:image/png;base64,${turno.qr_code}" class="qr-code-image" alt="QR Code">
                        <p><small>Código QR para el cliente</small></p>
                    </div>
                ` : ''}
            </div>
        `;
    } catch (error) {
        console.error('Error assigning appointment:', error);
        showNotification('Error al asignar la cita', 'error');
    }
}

// Calendar Management
async function loadCalendar() {
    try {
        const today = new Date();
        const dateStr = formatDate(today);
        document.getElementById('calendarDate').value = dateStr;
        await loadCalendarForDate(dateStr);
    } catch (error) {
        console.error('Error loading calendar:', error);
    }
}

async function loadCalendarForDate(dateStr) {
    try {
        const availability = await apiRequest(`/calendario/disponibilidad?fecha=${dateStr}`);
        displayCalendar(availability);
        
        // Load stats for the date
        const stats = await apiRequest(`/estadisticas?fecha=${dateStr}`);
        displayCalendarStats(stats, dateStr);
    } catch (error) {
        console.error('Error loading calendar for date:', error);
    }
}

function displayCalendar(availability) {
    const container = document.getElementById('calendarContainer');
    
    container.innerHTML = `
        <div class="calendar-container">
            <div class="calendar-header">
                Disponibilidad para ${new Date(availability.fecha).toLocaleDateString('es-ES', {
                    weekday: 'long',
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric'
                })}
            </div>
            <div class="availability-grid">
                ${availability.horarios.map(horario => `
                    <div class="availability-slot ${horario.disponible ? 'available' : 'busy'}" 
                         onclick="selectTimeSlot('${availability.fecha}', '${horario.hora}', ${horario.disponible})">
                        <span class="time">${horario.hora}</span>
                        <span class="status">${horario.disponible ? 'Disponible' : 'Ocupado'}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function displayCalendarStats(stats, fecha) {
    const container = document.getElementById('calendarStats');
    const fechaObj = new Date(fecha);
    const esHoy = fechaObj.toDateString() === new Date().toDateString();
    
    container.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <span class="stat-number">${stats.total_turnos}</span>
                <span class="stat-label">Total ${esHoy ? 'Hoy' : 'Día'}</span>
            </div>
            <div class="stat-card">
                <span class="stat-number">${stats.pendientes}</span>
                <span class="stat-label">Pendientes</span>
            </div>
            <div class="stat-card">
                <span class="stat-number">${stats.atendidos}</span>
                <span class="stat-label">Atendidos</span>
            </div>
            <div class="stat-card">
                <span class="stat-number">${((stats.atendidos / Math.max(stats.total_turnos, 1)) * 100).toFixed(1)}%</span>
                <span class="stat-label">Efectividad</span>
            </div>
        </div>
        
        ${esHoy && stats.pendientes > 0 ? `
            <div class="calendar-alert">
                ⚠️ Tienes ${stats.pendientes} turno${stats.pendientes > 1 ? 's' : ''} pendiente${stats.pendientes > 1 ? 's' : ''} para hoy
            </div>
        ` : ''}
    `;
}

function selectTimeSlot(fecha, hora, disponible) {
    if (!disponible) {
        showNotification('Este horario no está disponible', 'warning');
        return;
    }
    
    // Offer to create appointment for this slot
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>📅 Crear Cita para ${fecha} a las ${hora}</h3>
            <form onsubmit="createAppointmentFromCalendar(event, '${fecha}', '${hora}')">
                <div class="form-group">
                    <label class="form-label">Nombre del Cliente *</label>
                    <input type="text" name="nombre" class="form-input" required>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Teléfono</label>
                    <input type="tel" name="telefono" class="form-input">
                </div>
                
                <div class="form-group">
                    <label class="form-label">Servicio *</label>
                    <select name="servicio" class="form-select" required id="modalServiceSelect">
                        <option value="">Seleccionar...</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Observaciones</label>
                    <textarea name="observaciones" class="form-textarea" rows="3"></textarea>
                </div>
                
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">Crear Cita</button>
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Load services for the modal
    loadServicesForModal();
}

async function loadServicesForModal() {
    try {
        const services = await apiRequest('/servicios');
        const select = document.getElementById('modalServiceSelect');
        
        if (select) {
            select.innerHTML = '<option value="">Seleccionar servicio...</option>';
            services.forEach(service => {
                select.innerHTML += `<option value="${service.nombre}">${service.nombre}</option>`;
            });
        }
    } catch (error) {
        console.error('Error loading services for modal:', error);
    }
}

async function createAppointmentFromCalendar(event, fecha, hora) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const appointmentData = {
        nombre_cliente: formData.get('nombre'),
        telefono: formData.get('telefono'),
        servicio: formData.get('servicio'),
        fecha_cita: `${fecha}T${hora}:00`,
        tipo_registro: 'manual',
        observaciones: formData.get('observaciones')
    };
    
    try {
        const turno = await apiRequest('/turnos', {
            method: 'POST',
            body: JSON.stringify(appointmentData)
        });
        
        showNotification('Cita creada correctamente', 'success');
        closeModal();
        
        // Refresh calendar
        await loadCalendarForDate(fecha);
        
    } catch (error) {
        console.error('Error creating appointment from calendar:', error);
        showNotification('Error al crear la cita', 'error');
    }
}

// QR Management
function generateQRAppointment() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>Generar Cita por QR</h3>
            <form id="qrAppointmentForm">
                <div class="form-group">
                    <label class="form-label">Nombre del Cliente</label>
                    <input type="text" class="form-input" name="nombre" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Teléfono</label>
                    <input type="tel" class="form-input" name="telefono">
                </div>
                <div class="form-group">
                    <label class="form-label">Servicio</label>
                    <select class="form-select" name="servicio" required>
                        <option value="">Seleccionar...</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Fecha</label>
                    <input type="date" class="form-input" name="fecha" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Hora</label>
                    <input type="time" class="form-input" name="hora" required>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">Generar QR</button>
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    loadServices(); // Load services for the select
    
    document.getElementById('qrAppointmentForm').onsubmit = async (e) => {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const appointmentData = {
            nombre_cliente: formData.get('nombre'),
            telefono: formData.get('telefono'),
            servicio: formData.get('servicio'),
            fecha_cita: `${formData.get('fecha')}T${formData.get('hora')}:00`,
            tipo_registro: 'qr',
            observaciones: 'Generado por QR'
        };
        
        try {
            const turno = await apiRequest('/turnos', {
                method: 'POST',
                body: JSON.stringify(appointmentData)
            });
            
            // Show QR result
            modal.innerHTML = `
                <div class="modal-content">
                    <h3>✅ QR Generado</h3>
                    <div class="qr-result">
                        <p><strong>Turno:</strong> ${turno.numero_turno}</p>
                        <p><strong>Cliente:</strong> ${turno.nombre_cliente}</p>
                        <div class="qr-code-display">
                            <img src="data:image/png;base64,${turno.qr_code}" class="qr-code-image" alt="QR Code">
                        </div>
                        <button class="btn btn-primary" onclick="closeModal()">Cerrar</button>
                    </div>
                </div>
            `;
            
            showNotification('QR generado correctamente', 'success');
        } catch (error) {
            showNotification('Error al generar QR', 'error');
        }
    };
}

async function loadQRHistory() {
    try {
        const turnos = await apiRequest('/turnos?tipo_registro=qr');
        displayQRHistory(turnos);
    } catch (error) {
        console.error('Error loading QR history:', error);
    }
}

function displayQRHistory(turnos) {
    const container = document.getElementById('qrHistoryContainer');
    
    if (turnos.length === 0) {
        container.innerHTML = `
            <div class="card">
                <div class="card-header">📱 Historial de QR</div>
                <p>No hay citas generadas por QR.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div class="card">
            <div class="card-header">📱 Historial de Citas QR</div>
            <div class="qr-history-list">
                ${turnos.map(turno => `
                    <div class="qr-history-item">
                        <div class="qr-info">
                            <strong>${turno.numero_turno}</strong> - ${turno.nombre_cliente}<br>
                            <small>${turno.servicio} | ${formatDateTime(turno.fecha_cita)}</small><br>
                            <span class="status-badge ${turno.estado}">${turno.estado.toUpperCase()}</span>
                        </div>
                        ${turno.qr_code ? `
                            <div class="qr-mini">
                                <img src="data:image/png;base64,${turno.qr_code}" width="60" height="60" alt="QR">
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// Utility Functions
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function closeModal() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => modal.remove());
}

function updateDateTime() {
    const now = new Date();
    document.getElementById('currentDateTime').textContent = 
        now.toLocaleDateString('es-ES') + ' ' + formatTime(now);
}

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
    await loadConfigurationData();
    showPage('dashboard');
    updateDateTime();
    setInterval(updateDateTime, 1000);

    // Auto-refresh queue every 30 seconds
    setInterval(() => {
        if (document.getElementById('llamado-turno').classList.contains('active')) {
            loadQueue();
            loadStatistics();
        }
    }, 30000);
});

// Legacy function for compatibility
function showTab(tabName) {
    showPage(tabName);
}

// Modal styles
const modalStyle = document.createElement('style');
modalStyle.textContent = `
    .modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    }
    
    .modal-content {
        background: white;
        padding: 30px;
        border-radius: 15px;
        width: 90%;
        max-width: 500px;
        max-height: 80vh;
        overflow-y: auto;
    }
    
    .form-actions {
        display: flex;
        gap: 15px;
        justify-content: flex-end;
        margin-top: 20px;
    }
    
    .status-badge {
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
    }
    
    .status-badge.pendiente {
        background: #fff3cd;
        color: #856404;
    }
    
    .status-badge.llamado {
        background: #cce5ff;
        color: #004085;
    }
    
    .status-badge.atendido {
        background: #d4edda;
        color: #155724;
    }
    
    .status-badge.cancelado {
        background: #f8d7da;
        color: #721c24;
    }
    
    .availability-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 10px;
        padding: 20px;
    }
    
    .availability-slot {
        padding: 15px;
        text-align: center;
        border-radius: 8px;
        border: 2px solid;
    }
    
    .availability-slot.available {
        background: #d4edda;
        border-color: #c3e6cb;
        color: #155724;
    }
    
    .availability-slot.busy {
        background: #f8d7da;
        border-color: #f5c6cb;
        color: #721c24;
    }
    
    .qr-history-list {
        display: flex;
        flex-direction: column;
        gap: 15px;
    }
    