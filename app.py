from flask import Flask, render_template
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# Configuración predeterminada si no existe .env
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'tu-clave-secreta-super-segura')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', f'sqlite:///{os.path.abspath("turnos.db")}')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'jwt-clave-secreta')

# Importar modelos y configurar db
from models import db, Turno, Servicio, Configuracion, Cola, EstadoTurno, TipoRegistro
db.init_app(app)

cors = CORS(app)
jwt = JWTManager(app)

# Ruta para el frontend
@app.route('/')
def index():
    return render_template('index.html')

# Importar modelos y rutas después de configurar la app
from routes import *

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        # Crear configuración por defecto si no existe
        config = Configuracion.query.first()
        if not config:
            config_default = Configuracion(
                nombre_empresa="Mi Empresa",
                logo_url="static/img/logo-default.png"
            )
            db.session.add(config_default)
            db.session.commit()
    
    app.run(debug=True, host='0.0.0.0', port=8080)
