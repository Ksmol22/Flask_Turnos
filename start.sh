#!/bin/bash

# Script de inicio para el Sistema de Turnos

echo "🚀 Iniciando Sistema de Turnos..."

# Verificar si Python está instalado
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 no está instalado"
    exit 1
fi

# Verificar si pip está instalado
if ! command -v pip3 &> /dev/null; then
    echo "❌ pip3 no está instalado"
    exit 1
fi

# Instalar dependencias si no existen
if [ ! -f "requirements.txt" ]; then
    echo "❌ Archivo requirements.txt no encontrado"
    exit 1
fi

echo "📦 Instalando dependencias..."
pip3 install -r requirements.txt

# Inicializar base de datos
echo "🗄️ Inicializando base de datos..."
python3 init_db.py

# Iniciar la aplicación
echo "🌟 Iniciando aplicación en http://localhost:5000"
python3 app.py
