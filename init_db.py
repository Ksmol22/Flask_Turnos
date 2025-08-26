from app import app, db
from models import Servicio, Configuracion
from datetime import time

def init_database():
    """Inicializar la base de datos con datos de ejemplo"""
    with app.app_context():
        # Crear todas las tablas
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
                Servicio(
                    nombre="Consulta General",
                    descripcion="Consulta médica general",
                    tiempo_estimado=30
                ),
                Servicio(
                    nombre="Consulta Especializada",
                    descripcion="Consulta con médico especialista",
                    tiempo_estimado=45
                ),
                Servicio(
                    nombre="Exámenes de Laboratorio",
                    descripcion="Toma de muestras para exámenes",
                    tiempo_estimado=15
                ),
                Servicio(
                    nombre="Procedimientos Menores",
                    descripcion="Procedimientos ambulatorios menores",
                    tiempo_estimado=60
                ),
                Servicio(
                    nombre="Control y Seguimiento",
                    descripcion="Control médico de seguimiento",
                    tiempo_estimado=20
                )
            ]
            
            for servicio in servicios_default:
                db.session.add(servicio)
        
        db.session.commit()
        print("✅ Base de datos inicializada correctamente")
        print(f"📊 Servicios disponibles: {Servicio.query.count()}")
        print(f"⚙️ Configuración creada: {Configuracion.query.first().nombre_empresa}")

if __name__ == '__main__':
    init_database()
