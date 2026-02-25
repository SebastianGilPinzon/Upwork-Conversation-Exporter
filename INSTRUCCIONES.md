# Upwork Conversation Exporter v2.0

Herramienta para exportar conversaciones completas de Upwork a texto plano, JSON, y descargar archivos adjuntos.

## Que hace

- Auto-scroll automatico para cargar TODOS los mensajes (no necesitas scrollear manualmente)
- Extrae la conversacion completa con nombres, timestamps y fechas
- Descarga todos los archivos adjuntos (imagenes, documentos) en un ZIP
- Excluye videos automaticamente (mp4, Loom, etc.)
- Muestra progreso visual en pantalla

## Como usar

### Paso 1: Abre la conversacion en Upwork
Ve a https://www.upwork.com/ab/messages/ y abre la conversacion que quieres exportar.

### Paso 2: Abre la consola del navegador
- Presiona **F12** (o Ctrl+Shift+J en Chrome)
- Ve a la pestana **Console**
- Si Chrome bloquea el pegado, escribe `allow pasting` y presiona Enter

### Paso 3: Pega el script
- Abre `export-chat-advanced.js` con un editor de texto
- Copia TODO el contenido (Ctrl+A, Ctrl+C)
- Pegalo en la consola y presiona **Enter**

### Paso 4: Espera
El script hara todo automaticamente:
1. Scrollea hacia arriba para cargar todos los mensajes historicos
2. Extrae todos los mensajes y archivos adjuntos
3. Descarga un archivo `.zip` que contiene:
   - `conversation-FECHA.txt` - conversacion formateada
   - `conversation-FECHA.json` - datos estructurados
   - `files/` - carpeta con todos los archivos adjuntos

Veras un indicador de progreso en la esquina inferior derecha.

## Archivos del proyecto

| Archivo | Descripcion |
|---------|------------|
| `export-chat-advanced.js` | Script principal v2.0 (auto-scroll + archivos) |
| `export-chat.js` | Version simple legacy (solo texto, sin auto-scroll) |

## Notas

- El archivo `view-source_*.html` NO sirve - es el "View Source" que solo tiene esqueletos de carga.
- El script debe ejecutarse **directamente en la pagina de Upwork**.
- La descarga de archivos usa las cookies de tu sesion, asi que debes estar logueado.
- Si hay muchos archivos, Chrome puede pedir permiso para descargas multiples - dale "Permitir".
