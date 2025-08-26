#!/usr/bin/env python3
"""
Script para probar la funcionalidad de configuración
"""
import requests
import json

BASE_URL = "http://localhost:8082/api"

def test_configuration():
    print("=== Probando funcionalidad de configuración ===")
    
    # 1. Obtener configuración actual
    print("\n1. Obteniendo configuración actual...")
    try:
        response = requests.get(f"{BASE_URL}/configuracion")
        if response.status_code == 200:
            config = response.json()
            print(f"✅ Configuración actual: {json.dumps(config, indent=2)}")
        else:
            print(f"❌ Error al obtener configuración: {response.status_code}")
    except Exception as e:
        print(f"❌ Error de conexión: {e}")
    
    # 2. Actualizar nombre de empresa
    print("\n2. Actualizando nombre de empresa...")
    try:
        new_config = {
            "nombre_empresa": "Mi Empresa Actualizada",
            "logo_url": "static/img/logo-default.png"
        }
        
        response = requests.post(
            f"{BASE_URL}/configuracion",
            json=new_config,
            headers={'Content-Type': 'application/json'}
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Configuración actualizada: {json.dumps(result, indent=2)}")
        else:
            print(f"❌ Error al actualizar: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ Error de conexión: {e}")
    
    # 3. Verificar que se aplicó el cambio
    print("\n3. Verificando cambios...")
    try:
        response = requests.get(f"{BASE_URL}/configuracion")
        if response.status_code == 200:
            config = response.json()
            if config.get('nombre_empresa') == "Mi Empresa Actualizada":
                print("✅ El nombre de la empresa se actualizó correctamente")
            else:
                print("❌ El nombre no se actualizó")
            print(f"Configuración final: {json.dumps(config, indent=2)}")
        else:
            print(f"❌ Error al verificar: {response.status_code}")
    except Exception as e:
        print(f"❌ Error de conexión: {e}")

if __name__ == "__main__":
    test_configuration()
