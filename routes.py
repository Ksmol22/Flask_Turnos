from flask import request, jsonify, send_file
from app import app
from models import db, Turno, Servicio, Configuracion, Cola, EstadoTurno, TipoRegistro
from datetime import datetime, timedelta, date
from werkzeug.utils import secure_filename
import qrcode
import io
import base64
import os
import json
import uuid

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

@app.route('/api/configuracion', methods=['PUT', 'POST'])
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
        if 'voz_habilitada' in data:
            config.voz_habilitada = data['voz_habilitada']
        if 'volumen_voz' in data:
            config.volumen_voz = data['volumen_voz']
        if 'tiempo_espera_cancelacion' in data:
            config.tiempo_espera_cancelacion = data['tiempo_espera_cancelacion']
        if 'reinicio_diario' in data:
            config.reinicio_diario = data['reinicio_diario']
            
        db.session.add(config)
        db.session.commit()
        
        return jsonify({'success': True, 'config': config.to_dict()})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/upload-logo', methods=['POST'])
def upload_logo():
    try:
        if 'logo' not in request.files:
            return jsonify({'error': 'No se encontró archivo'}), 400
        
        file = request.files['logo']
        if file.filename == '':
            return jsonify({'error': 'No se seleccionó archivo'}), 400
        
        # Validar tipo de archivo
        allowed_extensions = {'png', 'jpg', 'jpeg', 'gif'}
        if not ('.' in file.filename and 
                file.filename.rsplit('.', 1)[1].lower() in allowed_extensions):
            return jsonify({'error': 'Tipo de archivo no permitido'}), 400
        
        # Generar nombre único
        filename = secure_filename(file.filename)
        name, ext = os.path.splitext(filename)
        filename = f'logo_{uuid.uuid4().hex}{ext}'
        
        # Crear directorio si no existe
        upload_folder = os.path.join('static', 'img', 'uploads')
        os.makedirs(upload_folder, exist_ok=True)
        
        # Guardar archivo
        filepath = os.path.join(upload_folder, filename)
        file.save(filepath)
        
        # URL relativa para el frontend
        logo_url = f'static/img/uploads/{filename}'
        
        return jsonify({
            'success': True,
            'logo_url': logo_url,
            'message': 'Logo subido correctamente'
        })
        
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
def generar_numero_turno():
    """Genera un número de turno único para el día actual"""
    hoy = date.today()
    prefijo = hoy.strftime('%d%m')
    
    # Buscar el último número de turno del día actual por prefijo
    ultimo_turno = Turno.query.filter(
        Turno.numero_turno.like(f"{prefijo}-%")
    ).order_by(Turno.numero_turno.desc()).first()
    
    if ultimo_turno:
        try:
            ultimo_numero = int(ultimo_turno.numero_turno.split('-')[1])
            nuevo_numero = ultimo_numero + 1
        except (ValueError, IndexError):
            nuevo_numero = 1
    else:
        nuevo_numero = 1
    
    return f"{prefijo}-{nuevo_numero:03d}"

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
        
        # Procesar fecha_cita - manejar diferentes formatos
        fecha_cita_str = data['fecha_cita']
        try:
            # Intentar parsing directo primero
            if 'T' in fecha_cita_str:
                # Formato ISO con tiempo
                fecha_cita = datetime.fromisoformat(fecha_cita_str.replace('Z', ''))
            else:
                # Solo fecha, agregar hora por defecto
                fecha_date = datetime.strptime(fecha_cita_str, '%Y-%m-%d')
                # Agregar hora por defecto (9:00 AM)
                fecha_cita = fecha_date.replace(hour=9, minute=0)
        except:
            return jsonify({'error': 'Formato de fecha inválido'}), 400
        
        # Crear turno
        turno = Turno(
            numero_turno=numero_turno,
            nombre_cliente=data['nombre_cliente'],
            telefono=data.get('telefono', ''),
            servicio=data['servicio'],
            fecha_cita=fecha_cita,
            tipo_registro=TipoRegistro(data['tipo_registro']),
            observaciones=data.get('observaciones', '')
        )
        
        # Generar QR si es necesario
        if turno.tipo_registro == TipoRegistro.QR:
            qr_data = {
                'numero_turno': numero_turno,
                'nombre': data['nombre_cliente'],
                'servicio': data['servicio'],
                'fecha_cita': fecha_cita.isoformat()
            }
            turno.qr_code = generar_qr_code(json.dumps(qr_data))
        
        db.session.add(turno)
        db.session.commit()
        
        # Agregar a la cola solo si es para hoy
        if fecha_cita.date() == date.today():
            posicion = Cola.query.filter_by(fecha=date.today()).count() + 1
            cola_item = Cola(turno_id=turno.id, posicion=posicion, fecha=date.today())
            db.session.add(cola_item)
            db.session.commit()
        
        return jsonify(turno.to_dict()), 201
    except Exception as e:
        print(f"Error creating turno: {str(e)}")  # Para debug
        return jsonify({'error': str(e)}), 500

@app.route('/api/turnos', methods=['GET'])
def get_turnos():
    try:
        fecha = request.args.get('fecha')
        estado = request.args.get('estado')
        
        query = Turno.query
        
        if fecha:
            fecha_obj = datetime.strptime(fecha, '%Y-%m-%d').date()
            query = query.filter(db.func.date(Turno.fecha_cita) == fecha_obj)
        
        if estado:
            query = query.filter(Turno.estado == EstadoTurno(estado))
        
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

@app.route('/api/qr/historial', methods=['GET'])
def get_qr_historial():
    try:
        # Obtener turnos que tienen QR generado
        turnos_qr = Turno.query.filter(
            Turno.qr_code.isnot(None),
            Turno.tipo_registro == TipoRegistro.QR
        ).order_by(Turno.fecha_creacion.desc()).limit(20).all()
        
        historial = []
        for turno in turnos_qr:
            historial.append({
                'id': turno.id,
                'numero_turno': turno.numero_turno,
                'nombre_cliente': turno.nombre_cliente,
                'servicio': turno.servicio,
                'fecha_cita': turno.fecha_cita.isoformat() if turno.fecha_cita else None,
                'fecha_creacion': turno.fecha_creacion.isoformat() if turno.fecha_creacion else None,
                'estado': turno.estado.value if turno.estado else None,
                'qr_data': turno.qr_code
            })
        
        return jsonify(historial)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/qr/generate', methods=['POST'])
def generate_qr():
    try:
        data = request.get_json()
        
        # Crear nuevo turno con QR
        nuevo_turno = Turno(
            numero_turno=data.get('numero_turno'),
            nombre_cliente=data.get('nombre_cliente'),
            telefono=data.get('telefono', ''),
            servicio=data.get('servicio'),
            fecha_cita=datetime.fromisoformat(data['fecha_cita'].replace('Z', '+00:00')),
            tipo_registro=TipoRegistro.QR,
            observaciones=data.get('observaciones', '')
        )
        
        # Generar datos para el QR
        qr_data = {
            'numero_turno': nuevo_turno.numero_turno,
            'nombre_cliente': nuevo_turno.nombre_cliente,
            'servicio': nuevo_turno.servicio,
            'fecha_cita': nuevo_turno.fecha_cita.isoformat(),
        }
        
        nuevo_turno.qr_code = generar_qr_code(json.dumps(qr_data))
        
        db.session.add(nuevo_turno)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'turno': nuevo_turno.to_dict(),
            'qr_data': nuevo_turno.qr_code
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/qr/<qr_id>/download', methods=['GET'])
def download_qr(qr_id):
    try:
        turno = Turno.query.filter_by(id=qr_id).first()
        if not turno or not turno.qr_code:
            return jsonify({'error': 'QR no encontrado'}), 404
        
        # Generar imagen QR para descarga
        import io
        import base64
        from PIL import Image
        
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(turno.qr_code)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Convertir a base64
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)
        
        return send_file(
            buffer,
            as_attachment=True,
            download_name=f'qr_{turno.numero_turno}.png',
            mimetype='image/png'
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/turno/<int:turno_id>', methods=['GET'])
def get_turno(turno_id):
    try:
        turno = Turno.query.get_or_404(turno_id)
        return jsonify(turno.to_dict())
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

# ============ RUTAS DE CITAS ============
@app.route('/api/citas/<fecha>', methods=['GET'])
def get_citas_por_fecha(fecha):
    try:
        fecha_obj = datetime.strptime(fecha, '%Y-%m-%d').date()
        
        citas = Turno.query.filter(
            db.func.date(Turno.fecha_cita) == fecha_obj
        ).order_by(Turno.fecha_cita).all()
        
        return jsonify([{
            'id': cita.id,
            'numero': cita.numero_turno,
            'nombre_cliente': cita.nombre_cliente,
            'telefono': cita.telefono,
            'servicio_nombre': cita.servicio,
            'fecha_cita': cita.fecha_cita.isoformat(),
            'estado': cita.estado.value,
            'observaciones': cita.observaciones
        } for cita in citas])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/cita/<int:cita_id>/cancelar', methods=['POST'])
def cancelar_cita(cita_id):
    try:
        cita = Turno.query.get_or_404(cita_id)
        cita.estado = EstadoTurno.CANCELADO
        db.session.commit()
        
        return jsonify({'success': True, 'message': 'Cita cancelada correctamente'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
