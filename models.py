from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from enum import Enum

# db será configurado después por app.py
db = SQLAlchemy()

class EstadoTurno(Enum):
    PENDIENTE = "pendiente"
    LLAMADO = "llamado"
    ATENDIDO = "atendido"
    CANCELADO = "cancelado"

class TipoRegistro(Enum):
    QR = "qr"
    MANUAL = "manual"

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
    qr_code = db.Column(db.String(255))
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
    tiempo_estimado = db.Column(db.Integer)  # en minutos
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
    horario_inicio = db.Column(db.Time, default=datetime.strptime('08:00', '%H:%M').time())
    horario_fin = db.Column(db.Time, default=datetime.strptime('18:00', '%H:%M').time())
    intervalo_citas = db.Column(db.Integer, default=30)  # minutos
    voz_habilitada = db.Column(db.Boolean, default=True)
    volumen_voz = db.Column(db.Float, default=0.8)
    tiempo_espera_cancelacion = db.Column(db.Integer, default=30)  # minutos
    reinicio_diario = db.Column(db.Boolean, default=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'nombre_empresa': self.nombre_empresa,
            'logo_url': self.logo_url,
            'horario_inicio': self.horario_inicio.strftime('%H:%M') if self.horario_inicio else None,
            'horario_fin': self.horario_fin.strftime('%H:%M') if self.horario_fin else None,
            'intervalo_citas': self.intervalo_citas,
            'voz_habilitada': self.voz_habilitada,
            'volumen_voz': self.volumen_voz,
            'tiempo_espera_cancelacion': self.tiempo_espera_cancelacion,
            'reinicio_diario': self.reinicio_diario
        }

class Cola(db.Model):
    __tablename__ = 'cola'
    
    id = db.Column(db.Integer, primary_key=True)
    turno_id = db.Column(db.Integer, db.ForeignKey('turnos.id'), nullable=False)
    posicion = db.Column(db.Integer, nullable=False)
    fecha = db.Column(db.Date, default=lambda: datetime.utcnow().date())
    
    turno = db.relationship('Turno', backref='cola_info')
    
    def to_dict(self):
        return {
            'id': self.id,
            'turno': self.turno.to_dict() if self.turno else None,
            'posicion': self.posicion,
            'fecha': self.fecha.isoformat() if self.fecha else None
        }
