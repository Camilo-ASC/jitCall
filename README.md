# jitCall - Aplicación de Comunicación Móvil

jitCall es una aplicación móvil desarrollada con Ionic Angular, enfocada en la comunicación entre usuarios a través de chat con funcionalidades multimedia. Aun se encuentra en proceso de mejora y trabajo.

## ✨ Funcionalidades Implementadas

* **Autenticación de Usuarios:**
    * Registro (Nombre, Apellido, Teléfono, Email, Contraseña) y Login.
    * Protección de rutas con `AuthGuard`.
* **Gestión de Contactos:**
    * Agregar contactos (buscando usuarios existentes por teléfono).
    * Listado de contactos en `HomePage` con búsqueda y filtrado dinámico.
    * Edición del nombre de visualización de contactos.
    * Eliminación de contactos de la lista personal.
* **Chat en Tiempo Real:**
    * **Lista de Chats (`ChatListPage`):** Muestra conversaciones activas, actualizadas en tiempo real.
    * **Página de Conversación (`ConversationPage`):**
        * Mensajería de texto bidireccional.
        * Envío de **Imágenes** (usando `@capacitor/camera` y almacenamiento en Supabase).
        * Envío de **Mensajes de Voz** (usando `capacitor-voice-recorder` y Supabase).
        * Reproductor de audio personalizado con controles de Play/Pausa y visualización de duración.
        * **Compartir Ubicación** (usando `@capacitor/geolocation` y mostrando un enlace a Google Maps).
        * Burbujas de chat estilizadas para emisor/receptor.
* **Notificaciones Push (Base):**
    * Generación y almacenamiento de tokens FCM para usuarios en Android.
    * Lógica para enviar payloads a una API externa (Railway) para iniciar llamadas.
* **Inicio de Videollamada (Parcial):**
    * Botón para iniciar llamada que envía notificación y navega a la pantalla de llamada (integración Jitsi pendiente).

## 🛠️ Tecnologías Principales

* **Framework:** Ionic Angular (Angular 19+)
* **Backend y Servicios:**
    * Firebase: Authentication, Cloud Firestore
    * Supabase: Storage (para archivos multimedia)
    * API Externa (en Railway): Para manejo de notificaciones push.
* **Plugins de Capacitor:**
    * `@capacitor/core`, `@capacitor/push-notifications`, `@capacitor/camera`, `capacitor-voice-recorder`, `@capacitor/geolocation`
* **Librerías Clave:**
    * `uuid`
    * `@supabase/supabase-js`
