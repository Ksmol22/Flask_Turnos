#!/usr/bin/env python3
"""
Script para limpiar la base de datos del sistema de turnos
"""

from app import app, db
from models import Turno, Servicio, Configuracion, Cola
import os
import sys

def limpiar_solo_turnos():
    """Limpia solo los turnos, manteniendo servicios y configuración"""
    with app.app_context():
        try:
            # Eliminar todos los turnos de la cola
            Cola.query.delete()
            
            # Eliminar todos los turnos
            turnos_eliminados = Turno.query.count()
            Turno.query.delete()
            
            # Confirmar cambios
            db.session.commit()
            
            print(f"✅ Base de datos limpiada exitosamente!")
            print(f"   - {turnos_eliminados} turnos eliminados")
            print(f"   - Cola de turnos vaciada")
            print(f"   - Servicios y configuración mantenidos")
            
        except Exception as e:
            db.session.rollback()
            print(f"❌ Error al limpiar la base de datos: {e}")
            return False
    return True

def limpiar_todo_y_reinicializar():
    """Elimina toda la base de datos y la reinicializa con datos por defecto"""
    with app.app_context():
        try:
            # Eliminar todas las tablas
            db.drop_all()
            print("🗑️  Todas las tablas eliminadas")
            
            # Recrear todas las tablas
            db.create_all()
            print("🏗️  Tablas recreadas")
            
            # Reinicializar con datos por defecto
            from init_db import init_database
            init_database()
            print("✅ Base de datos reinicializada con datos por defecto")
            
        except Exception as e:
            print(f"❌ Error al reinicializar la base de datos: {e}")
            return False
    return True

def mostrar_estadisticas():
    """Muestra estadísticas actuales de la base de datos"""
    with app.app_context():
        try:
            turnos_count = Turno.query.count()
            servicios_count = Servicio.query.count()
            config_count = Configuracion.query.count()
            cola_count = Cola.query.count()
            
            print("📊 Estado actual de la base de datos:")
            print(f"   - Turnos: {turnos_count}")
            print(f"   - Servicios: {servicios_count}")
            print(f"   - Configuraciones: {config_count}")
            print(f"   - Items en cola: {cola_count}")
            
        except Exception as e:
            print(f"❌ Error al obtener estadísticas: {e}")

def main():
    print("🧹 LIMPIADOR DE BASE DE DATOS - Sistema de Turnos")
    print("=" * 50)
    
    # Mostrar estadísticas actuales
    mostrar_estadisticas()
    print()
    
    # Menú de opciones
    print("Opciones disponibles:")
    print("1. Limpiar solo turnos (mantener servicios y configuración)")
    print("2. Limpiar todo y reinicializar con datos por defecto")
    print("3. Solo mostrar estadísticas")
    print("4. Salir")
    print()
    
    while True:
        opcion = input("Selecciona una opción (1-4): ").strip()
        
        if opcion == "1":
            print("\n⚠️  ADVERTENCIA: Se eliminarán TODOS los turnos y la cola.")
            confirmar = input("¿Estás seguro? (s/N): ").strip().lower()
            if confirmar in ['s', 'si', 'sí', 'yes', 'y']:
                if limpiar_solo_turnos():
                    print("\n📊 Estado después de la limpieza:")
                    mostrar_estadisticas()
            break
            
        elif opcion == "2":
            print("\n⚠️  ADVERTENCIA: Se eliminará TODA la base de datos.")
            print("Esto incluye: turnos, servicios personalizados y configuración.")
            confirmar = input("¿Estás seguro? (s/N): ").strip().lower()
            if confirmar in ['s', 'si', 'sí', 'yes', 'y']:
                if limpiar_todo_y_reinicializar():
                    print("\n📊 Estado después de la reinicialización:")
                    mostrar_estadisticas()
            break
            
        elif opcion == "3":
            mostrar_estadisticas()
            break
            
        elif opcion == "4":
            print("👋 Saliendo...")
            break
            
        else:
            print("❌ Opción no válida. Por favor selecciona 1, 2, 3 o 4.")

if __name__ == "__main__":
    main()
