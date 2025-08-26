from flask import Flask, request, jsonify, render_template, send_file
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from datetime import datetime, timedelta, date, time
import os
import qrcode
import io
import base64
import json
from enum import Enum
from dotenv import load_dotenv

load_dotenv()

# Configuración de Flask
app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY')

db = SQLAlchemy(app)
cors = CORS(app)
jwt = JWTManager(app)

# Enums
class EstadoTurno(Enum):
    PENDIENTE = "pendiente"
    LLAMADO = "llamado"
    ATENDIDO = "atendido"
    CANCELADO = "cancelado"

class TipoRegistro(Enum):
    QR = "qr"
    MANUAL = "manual"

# Modelos de la base de datos
class Turno(db.Model):
    __tablename__ = 'turnos'
    
    id = db.Column(db.Integer, primary_key=True)
    numero_turno = db.Column(db.String(10), unique=True, nullable=False)
    nombre_cliente = db.Column(db.String(100), nullable=False)
    telefono = db.Column(db.String(20))
    servicio = db.Column(db.String(100), nullable=False)
    fecha_creacion = db.Column(db.DateTime, default=datetime.utcnow)
    fecha_cita = db.Column(db.DateTime, nullable=False)
    estado = db.Column(db.Enum(EstadoTurno), default=EstadoTurno.PENDIENTE)
    tipo_registro = db.Column(db.Enum(TipoRegistro), nullable=False)
    qr_code = db.Column(db.Text)
    observaciones = db.Column(db.Text)
    tiempo_llamado = db.Column(db.DateTime)
    tiempo_atencion = db.Column(db.DateTime)
    
    def to_dict(self):
        return {
            'id': self.id,
            'numero_turno': self.numero_turno,
            'nombre_cliente': self.nombre_cliente,
            'telefono': self.telefono,
            'servicio': self.servicio,
            'fecha_creacion': self.fecha_creacion.isoformat() if self.fecha_creacion else None,
            'fecha_cita': self.fecha_cita.isoformat() if self.fecha_cita else None,
            'estado': self.estado.value if self.estado else None,
            'tipo_registro': self.tipo_registro.value if self.tipo_registro else None,
            'qr_code': self.qr_code,
            'observaciones': self.observaciones,
            'tiempo_llamado': self.tiempo_llamado.isoformat() if self.tiempo_llamado else None,
            'tiempo_atencion': self.tiempo_atencion.isoformat() if self.tiempo_atencion else None
        }

class Servicio(db.Model):
    __tablename__ = 'servicios'
    
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False, unique=True)
    descripcion = db.Column(db.String(255))
    tiempo_estimado = db.Column(db.Integer, default=30)
    activo = db.Column(db.Boolean, default=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'nombre': self.nombre,
            'descripcion': self.descripcion,
            'tiempo_estimado': self.tiempo_estimado,
            'activo': self.activo
        }

class Configuracion(db.Model):
    __tablename__ = 'configuracion'
    
    id = db.Column(db.Integer, primary_key=True)
    nombre_empresa = db.Column(db.String(100), nullable=False)
    logo_url = db.Column(db.String(255))
    horario_inicio = db.Column(db.Time, default=time(8, 0))
    horario_fin = db.Column(db.Time, default=time(18, 0))
    intervalo_citas = db.Column(db.Integer, default=30)
    
    def to_dict(self):
        return {
            'id': self.id,
            'nombre_empresa': self.nombre_empresa,
            'logo_url': self.logo_url,
            'horario_inicio': self.horario_inicio.strftime('%H:%M') if self.horario_inicio else None,
            'horario_fin': self.horario_fin.strftime('%H:%M') if self.horario_fin else None,
            'intervalo_citas': self.intervalo_citas
        }

class Cola(db.Model):
    __tablename__ = 'cola'
    
    id = db.Column(db.Integer, primary_key=True)
    turno_id = db.Column(db.Integer, db.ForeignKey('turnos.id'), nullable=False)
    posicion = db.Column(db.Integer, nullable=False)
    fecha = db.Column(db.Date, default=date.today)
    
    turno = db.relationship('Turno', backref='cola_info')
    
    def to_dict(self):
        return {
            'id': self.id,
            'turno': self.turno.to_dict() if self.turno else None,
            'posicion': self.posicion,
            'fecha': self.fecha.isoformat() if self.fecha else None
        }

# Funciones auxiliares
def generar_numero_turno():
    """Genera un número de turno único para el día actual"""
    hoy = date.today()
    ultimo_turno = Turno.query.filter(
        db.func.date(Turno.fecha_creacion) == hoy
    ).order_by(Turno.id.desc()).first()
    
    if ultimo_turno:
        ultimo_numero = int(ultimo_turno.numero_turno.split('-')[1])
        nuevo_numero = ultimo_numero + 1
    else:
        nuevo_numero = 1
    
    return f"{hoy.strftime('%d%m')}-{nuevo_numero:03d}"

def generar_qr_code(data):
    """Genera un código QR para el turno"""
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(data)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    img_io = io.BytesIO()
    img.save(img_io, 'PNG')
    img_io.seek(0)
    
    # Convertir a base64
    img_base64 = base64.b64encode(img_io.getvalue()).decode('utf-8')
    return img_base64

# Rutas del frontend
@app.route('/')
def index():
    return render_template('index.html')

# ============ RUTAS DE CONFIGURACIÓN ============
@app.route('/api/configuracion', methods=['GET'])
def get_configuracion():
    try:
        config = Configuracion.query.first()
        if not config:
            return jsonify({'error': 'Configuración no encontrada'}), 404
        return jsonify(config.to_dict())
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/configuracion', methods=['PUT'])
def update_configuracion():
    try:
        data = request.get_json()
        config = Configuracion.query.first()
        
        if not config:
            config = Configuracion()
            
        if 'nombre_empresa' in data:
            config.nombre_empresa = data['nombre_empresa']
        if 'logo_url' in data:
            config.logo_url = data['logo_url']
        if 'horario_inicio' in data:
            config.horario_inicio = datetime.strptime(data['horario_inicio'], '%H:%M').time()
        if 'horario_fin' in data:
            config.horario_fin = datetime.strptime(data['horario_fin'], '%H:%M').time()
        if 'intervalo_citas' in data:
            config.intervalo_citas = data['intervalo_citas']
            
        db.session.add(config)
        db.session.commit()
        
        return jsonify(config.to_dict())
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============ RUTAS DE SERVICIOS ============
@app.route('/api/servicios', methods=['GET'])
def get_servicios():
    try:
        servicios = Servicio.query.filter_by(activo=True).all()
        return jsonify([servicio.to_dict() for servicio in servicios])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/servicios', methods=['POST'])
def create_servicio():
    try:
        data = request.get_json()
        servicio = Servicio(
            nombre=data['nombre'],
            descripcion=data.get('descripcion', ''),
            tiempo_estimado=data.get('tiempo_estimado', 30)
        )
        db.session.add(servicio)
        db.session.commit()
        return jsonify(servicio.to_dict()), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============ RUTAS DE TURNOS ============
@app.route('/api/turnos', methods=['POST'])
def create_turno():
    try:
        data = request.get_json()
        
        # Validar datos requeridos
        required_fields = ['nombre_cliente', 'servicio', 'fecha_cita', 'tipo_registro']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Campo requerido: {field}'}), 400
        
        # Generar número de turno
        numero_turno = generar_numero_turno()
        
        # Crear turno
        turno = Turno(
            numero_turno=numero_turno,
            nombre_cliente=data['nombre_cliente'],
            telefono=data.get('telefono', ''),
            servicio=data['servicio'],
            fecha_cita=datetime.fromisoformat(data['fecha_cita'].replace('Z', '+00:00')),
            tipo_registro=TipoRegistro(data['tipo_registro']),
            observaciones=data.get('observaciones', '')
        )
        
        # Generar QR si es necesario
        if turno.tipo_registro == TipoRegistro.QR:
            qr_data = {
                'numero_turno': numero_turno,
                'nombre': data['nombre_cliente'],
                'servicio': data['servicio'],
                'fecha_cita': data['fecha_cita']
            }
            turno.qr_code = generar_qr_code(json.dumps(qr_data))
        
        db.session.add(turno)
        db.session.commit()
        
        # Agregar a la cola
        posicion = Cola.query.filter_by(fecha=date.today()).count() + 1
        cola_item = Cola(turno_id=turno.id, posicion=posicion)
        db.session.add(cola_item)
        db.session.commit()
        
        return jsonify(turno.to_dict()), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/turnos', methods=['GET'])
def get_turnos():
    try:
        fecha = request.args.get('fecha')
        estado = request.args.get('estado')
        tipo_registro = request.args.get('tipo_registro')
        
        query = Turno.query
        
        if fecha:
            fecha_obj = datetime.strptime(fecha, '%Y-%m-%d').date()
            query = query.filter(db.func.date(Turno.fecha_cita) == fecha_obj)
        
        if estado:
            query = query.filter(Turno.estado == EstadoTurno(estado))
            
        if tipo_registro:
            query = query.filter(Turno.tipo_registro == TipoRegistro(tipo_registro))
        
        turnos = query.order_by(Turno.fecha_creacion).all()
        return jsonify([turno.to_dict() for turno in turnos])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/turnos/<int:turno_id>', methods=['PUT'])
def update_turno(turno_id):
    try:
        data = request.get_json()
        turno = Turno.query.get_or_404(turno_id)
        
        if 'estado' in data:
            nuevo_estado = EstadoTurno(data['estado'])
            turno.estado = nuevo_estado
            
            if nuevo_estado == EstadoTurno.LLAMADO:
                turno.tiempo_llamado = datetime.utcnow()
            elif nuevo_estado == EstadoTurno.ATENDIDO:
                turno.tiempo_atencion = datetime.utcnow()
        
        if 'observaciones' in data:
            turno.observaciones = data['observaciones']
        
        db.session.commit()
        return jsonify(turno.to_dict())
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============ RUTAS DE COLA ============
@app.route('/api/cola', methods=['GET'])
def get_cola():
    try:
        fecha = request.args.get('fecha', date.today().isoformat())
        fecha_obj = datetime.strptime(fecha, '%Y-%m-%d').date()
        
        cola_items = Cola.query.filter_by(fecha=fecha_obj).order_by(Cola.posicion).all()
        return jsonify([item.to_dict() for item in cola_items])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/cola/siguiente', methods=['GET'])
def get_siguiente_turno():
    try:
        siguiente = Cola.query.join(Turno).filter(
            Cola.fecha == date.today(),
            Turno.estado == EstadoTurno.PENDIENTE
        ).order_by(Cola.posicion).first()
        
        if not siguiente:
            return jsonify({'message': 'No hay turnos pendientes'}), 404
        
        return jsonify(siguiente.to_dict())
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/cola/llamar/<int:turno_id>', methods=['POST'])
def llamar_turno(turno_id):
    try:
        turno = Turno.query.get_or_404(turno_id)
        turno.estado = EstadoTurno.LLAMADO
        turno.tiempo_llamado = datetime.utcnow()
        db.session.commit()
        
        # Retornar datos para síntesis de voz
        return jsonify({
            'turno': turno.to_dict(),
            'mensaje_voz': f"Turno {turno.numero_turno}, {turno.nombre_cliente}, acérquese por favor"
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============ RUTAS DE QR ============
@app.route('/api/qr/validate', methods=['POST'])
def validate_qr():
    try:
        data = request.get_json()
        qr_data = json.loads(data['qr_data'])
        
        turno = Turno.query.filter_by(numero_turno=qr_data['numero_turno']).first()
        
        if not turno:
            return jsonify({'error': 'Turno no encontrado'}), 404
        
        return jsonify({
            'valid': True,
            'turno': turno.to_dict()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============ RUTAS DE CALENDARIO ============
@app.route('/api/calendario/disponibilidad', methods=['GET'])
def get_disponibilidad():
    try:
        fecha = request.args.get('fecha')
        if not fecha:
            return jsonify({'error': 'Fecha requerida'}), 400
        
        fecha_obj = datetime.strptime(fecha, '%Y-%m-%d')
        config = Configuracion.query.first()
        
        if not config:
            return jsonify({'error': 'Configuración no encontrada'}), 500
        
        # Obtener turnos existentes para la fecha
        turnos_existentes = Turno.query.filter(
            db.func.date(Turno.fecha_cita) == fecha_obj.date(),
            Turno.estado != EstadoTurno.CANCELADO
        ).all()
        
        # Generar horarios disponibles
        horarios = []
        hora_inicio = datetime.combine(fecha_obj.date(), config.horario_inicio)
        hora_fin = datetime.combine(fecha_obj.date(), config.horario_fin)
        
        current = hora_inicio
        while current < hora_fin:
            # Verificar si el horario está ocupado
            ocupado = any(
                turno.fecha_cita.replace(second=0, microsecond=0) == current
                for turno in turnos_existentes
            )
            
            horarios.append({
                'hora': current.strftime('%H:%M'),
                'disponible': not ocupado
            })
            
            current += timedelta(minutes=config.intervalo_citas)
        
        return jsonify({
            'fecha': fecha,
            'horarios': horarios
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============ RUTAS DE ESTADÍSTICAS ============
@app.route('/api/estadisticas', methods=['GET'])
def get_estadisticas():
    try:
        fecha = request.args.get('fecha', date.today().isoformat())
        fecha_obj = datetime.strptime(fecha, '%Y-%m-%d').date()
        
        turnos_dia = Turno.query.filter(
            db.func.date(Turno.fecha_cita) == fecha_obj
        )
        
        stats = {
            'total_turnos': turnos_dia.count(),
            'pendientes': turnos_dia.filter(Turno.estado == EstadoTurno.PENDIENTE).count(),
            'llamados': turnos_dia.filter(Turno.estado == EstadoTurno.LLAMADO).count(),
            'atendidos': turnos_dia.filter(Turno.estado == EstadoTurno.ATENDIDO).count(),
            'cancelados': turnos_dia.filter(Turno.estado == EstadoTurno.CANCELADO).count()
        }
        
        return jsonify(stats)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Inicialización
def init_database():
    """Inicializar la base de datos con datos de ejemplo"""
    db.create_all()
    
    # Verificar si ya existen datos
    if Configuracion.query.first() is None:
        # Configuración por defecto
        config = Configuracion(
            nombre_empresa="Mi Empresa",
            logo_url="static/img/logo-default.png",
            horario_inicio=time(8, 0),
            horario_fin=time(18, 0),
            intervalo_citas=30
        )
        db.session.add(config)
    
    # Servicios por defecto
    if Servicio.query.count() == 0:
        servicios_default = [
            Servicio(nombre="Consulta General", descripcion="Consulta médica general", tiempo_estimado=30),
            Servicio(nombre="Consulta Especializada", descripcion="Consulta con médico especialista", tiempo_estimado=45),
            Servicio(nombre="Exámenes de Laboratorio", descripcion="Toma de muestras para exámenes", tiempo_estimado=15),
            Servicio(nombre="Procedimientos Menores", descripcion="Procedimientos ambulatorios menores", tiempo_estimado=60),
            Servicio(nombre="Control y Seguimiento", descripcion="Control médico de seguimiento", tiempo_estimado=20)
        ]
        
        for servicio in servicios_default:
            db.session.add(servicio)
    
    db.session.commit()

if __name__ == '__main__':
    with app.app_context():
        init_database()
        print("✅ Base de datos inicializada correctamente")
        print(f"📊 Servicios disponibles: {Servicio.query.count()}")
        if Configuracion.query.first():
            print(f"⚙️ Configuración creada: {Configuracion.query.first().nombre_empresa}")
    
    app.run(debug=True, host='0.0.0.0', port=5000)
