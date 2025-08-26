// QR Scanner functionality
class QRScanner {
    constructor() {
        this.stream = null;
        this.video = null;
        this.canvas = null;
        this.context = null;
        this.scanning = false;
    }

    async startScanning(videoElement, onResult) {
        try {
            this.video = videoElement;
            this.canvas = document.createElement('canvas');
            this.context = this.canvas.getContext('2d');

            // Request camera access
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });

            this.video.srcObject = this.stream;
            this.video.play();
            this.scanning = true;

            // Start scanning loop
            this.scanLoop(onResult);
            
            return true;
        } catch (error) {
            console.error('Error starting QR scanner:', error);
            showNotification('Error al acceder a la cámara', 'error');
            return false;
        }
    }

    scanLoop(onResult) {
        if (!this.scanning) return;

        // Set canvas size to match video
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;

        // Draw video frame to canvas
        this.context.drawImage(this.video, 0, 0);

        // Get image data
        const imageData = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);

        // Try to decode QR code (you would use a QR library here like jsQR)
        try {
            // For now, we'll simulate QR detection
            // In a real implementation, you would use a library like jsQR
            this.checkForQRCode(imageData, onResult);
        } catch (error) {
            console.error('Error scanning QR:', error);
        }

        // Continue scanning
        requestAnimationFrame(() => this.scanLoop(onResult));
    }

    checkForQRCode(imageData, onResult) {
        // This is a placeholder - in a real implementation,
        // you would use a QR code detection library like jsQR
        // For demonstration, we'll just simulate detection
    }

    stopScanning() {
        this.scanning = false;
        
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        if (this.video) {
            this.video.srcObject = null;
        }
    }
}

// QR Scanner UI functions
function scanQRCode() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content qr-scanner-modal">
            <div class="qr-scanner-header">
                <h3>📷 Escanear Código QR</h3>
                <button class="close-btn" onclick="closeQRScanner()">&times;</button>
            </div>
            
            <div class="qr-scanner-container">
                <video id="qrVideo" autoplay playsinline></video>
                <div class="qr-scanner-overlay">
                    <div class="qr-target"></div>
                </div>
            </div>
            
            <div class="qr-scanner-controls">
                <button class="btn btn-secondary" onclick="closeQRScanner()">
                    ❌ Cancelar
                </button>
                <div id="qrScannerStatus">
                    <span class="scanning-indicator">🔍 Buscando código QR...</span>
                </div>
            </div>
            
            <div id="qrScanResult"></div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Start scanner
    const videoElement = document.getElementById('qrVideo');
    const scanner = new QRScanner();
    
    scanner.startScanning(videoElement, (result) => {
        if (result) {
            handleQRResult(result);
            closeQRScanner();
        }
    });
    
    // Store scanner reference for cleanup
    window.currentQRScanner = scanner;
}

function closeQRScanner() {
    if (window.currentQRScanner) {
        window.currentQRScanner.stopScanning();
        window.currentQRScanner = null;
    }
    
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => modal.remove());
}

async function handleQRResult(qrData) {
    try {
        // Validate QR code with server
        const response = await apiRequest('/qr/validate', {
            method: 'POST',
            body: JSON.stringify({ qr_data: qrData })
        });
        
        if (response.valid) {
            const turno = response.turno;
            
            // Show turn information
            const resultModal = document.createElement('div');
            resultModal.className = 'modal';
            resultModal.innerHTML = `
                <div class="modal-content">
                    <h3>✅ Código QR Válido</h3>
                    <div class="qr-result">
                        <div class="turn-info">
                            <p><strong>Número de Turno:</strong> ${turno.numero_turno}</p>
                            <p><strong>Cliente:</strong> ${turno.nombre_cliente}</p>
                            <p><strong>Servicio:</strong> ${turno.servicio}</p>
                            <p><strong>Fecha:</strong> ${formatDateTime(turno.fecha_cita)}</p>
                            <p><strong>Estado:</strong> <span class="status-badge ${turno.estado}">${turno.estado.toUpperCase()}</span></p>
                            ${turno.telefono ? `<p><strong>Teléfono:</strong> ${turno.telefono}</p>` : ''}
                            ${turno.observaciones ? `<p><strong>Observaciones:</strong> ${turno.observaciones}</p>` : ''}
                        </div>
                        
                        <div class="qr-actions">
                            ${turno.estado === 'pendiente' ? `
                                <button class="btn btn-primary" onclick="callTurnFromQR(${turno.id})">
                                    📢 Llamar Turno
                                </button>
                            ` : ''}
                            
                            ${turno.estado === 'llamado' ? `
                                <button class="btn btn-success" onclick="markAttendedFromQR(${turno.id})">
                                    ✅ Marcar Atendido
                                </button>
                            ` : ''}
                            
                            <button class="btn btn-secondary" onclick="closeModal()">
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(resultModal);
            showNotification('Código QR escaneado correctamente', 'success');
        }
    } catch (error) {
        console.error('Error validating QR:', error);
        showNotification('Código QR no válido', 'error');
    }
}

async function callTurnFromQR(turnId) {
    await callTurn(turnId);
    closeModal();
    showTab('llamado-turno');
}

async function markAttendedFromQR(turnId) {
    await markAttended(turnId);
    closeModal();
    showTab('llamado-turno');
}

// Manual QR input fallback
function manualQRInput() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>⌨️ Introducir Código QR Manualmente</h3>
            <form onsubmit="processManualQR(event)">
                <div class="form-group">
                    <label class="form-label">Código QR o Número de Turno</label>
                    <textarea class="form-textarea" name="qrData" required 
                              placeholder="Pega aquí el contenido del código QR o introduce el número de turno"></textarea>
                </div>
                
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">Validar</button>
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function processManualQR(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const qrData = formData.get('qrData');
    
    // Try to parse as JSON first, if not treat as turn number
    try {
        JSON.parse(qrData);
        handleQRResult(qrData);
    } catch {
        // Treat as turn number
        searchTurnByNumber(qrData);
    }
    
    closeModal();
}

async function searchTurnByNumber(turnNumber) {
    try {
        const turnos = await apiRequest(`/turnos?numero_turno=${turnNumber}`);
        
        if (turnos.length > 0) {
            handleQRResult(JSON.stringify({
                numero_turno: turnos[0].numero_turno,
                nombre: turnos[0].nombre_cliente,
                servicio: turnos[0].servicio,
                fecha_cita: turnos[0].fecha_cita
            }));
        } else {
            showNotification('Turno no encontrado', 'error');
        }
    } catch (error) {
        showNotification('Error buscando turno', 'error');
    }
}

// Add QR scanner styles
const qrScannerStyles = document.createElement('style');
qrScannerStyles.textContent = `
    .qr-scanner-modal {
        width: 90%;
        max-width: 500px;
    }
    
    .qr-scanner-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        padding-bottom: 15px;
        border-bottom: 2px solid #e1e8ed;
    }
    
    .close-btn {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #666;
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: all 0.3s ease;
    }
    
    .close-btn:hover {
        background: #f0f0f0;
        color: #333;
    }
    
    .qr-scanner-container {
        position: relative;
        background: #000;
        border-radius: 12px;
        overflow: hidden;
        margin-bottom: 20px;
    }
    
    #qrVideo {
        width: 100%;
        height: 300px;
        object-fit: cover;
    }
    
    .qr-scanner-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .qr-target {
        width: 200px;
        height: 200px;
        border: 3px solid #fff;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.1);
        box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
    }
    
    .qr-scanner-controls {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    .scanning-indicator {
        color: #667eea;
        font-weight: 600;
        animation: pulse 1.5s infinite;
    }
    
    .turn-info {
        background: #f8f9fa;
        padding: 20px;
        border-radius: 8px;
        margin-bottom: 20px;
    }
    
    .turn-info p {
        margin-bottom: 8px;
    }
    
    .qr-actions {
        display: flex;
        gap: 10px;
        justify-content: center;
        flex-wrap: wrap;
    }
`;

document.head.appendChild(qrScannerStyles);
