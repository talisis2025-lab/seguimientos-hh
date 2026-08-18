# Seguimiento de Prospectos

Página estática para registrar y dar seguimiento a prospectos. Funciona en GitHub Pages y utiliza Google Sheets como base de datos mediante Google Apps Script.

## Funciones

- Programas: Presencial, Virtual y Licenciamiento.
- Fecha de contacto predeterminada al día actual.
- Próximo contacto opcional con fecha, hora y medio: llamada o WhatsApp.
- Semáforo automático: verde (0–2 días), azul (contacto programado para hoy), amarillo (3 días) y rojo (4 días o más). El domingo no aumenta el contador.
- Resumen por correo de lunes a sábado y recordatorio individual cerca de la hora programada.
- Botón **Contacté hoy** para reiniciar el seguimiento.
- Edición completa de los datos del prospecto desde la página.
- Una cita programada que no se confirma pasa automáticamente a **Urgente** al día siguiente; el domingo no cuenta.
- Eliminación automática 30 días después de la actividad más reciente entre registro, último contacto y próximo contacto programado.
- Búsqueda, filtros y diseño adaptable a celular.

## 1. Preparar Google Sheets

1. Crea una hoja nueva en [Google Sheets](https://sheets.google.com) y ponle el nombre que prefieras.
2. En la hoja abre **Extensiones → Apps Script**.
3. Borra el contenido inicial del editor y pega todo el contenido de `apps-script/Code.gs`.
4. En Apps Script abre **Configuración del proyecto** y establece la zona horaria de tu operación (por ejemplo, `America/Monterrey`).
5. Guarda el proyecto.
6. Pulsa **Implementar → Nueva implementación**.
7. En tipo selecciona **Aplicación web**.
8. Configura **Ejecutar como: Yo** y **Quién tiene acceso: Cualquier persona**.
9. Pulsa **Implementar**, autoriza el acceso y copia la URL terminada en `/exec`.

La pestaña `Prospectos` y sus encabezados se crean automáticamente al registrar o consultar por primera vez.

## 2. Conectar la página

Hay dos opciones:

### Sin editar código

Abre la página, pulsa el engrane, pega la URL `/exec` y guarda. La dirección queda almacenada en ese navegador.

### Conexión predeterminada para todos

Abre `config.js` y pega la URL:

```js
window.APP_CONFIG = {
  API_URL: "https://script.google.com/macros/s/TU_IMPLEMENTACION/exec"
};
```

Esta URL no es una contraseña, pero cualquier persona que la tenga podrá usar el formulario. Para uso público con datos sensibles conviene agregar autenticación antes de compartirlo ampliamente.

## 3. Publicar en GitHub Pages

1. Crea un repositorio nuevo en GitHub.
2. Sube el contenido de esta carpeta a la raíz del repositorio.
3. En GitHub abre **Settings → Pages**.
4. En **Build and deployment** elige **Deploy from a branch**.
5. Selecciona la rama `main`, carpeta `/ (root)` y guarda.
6. GitHub mostrará la URL pública cuando termine la publicación.

## Regla de eliminación mensual

`RETENTION_DAYS = 30` en `apps-script/Code.gs` controla la retención. La limpieza se ejecuta cada vez que la página consulta o modifica datos y toma como referencia la fecha más reciente entre el registro, el último contacto y el próximo contacto programado. Por ejemplo, si una cita está programada para dentro de 20 días, el prospecto se conservará hasta 30 días después de esa cita. Al pulsar **Contacté hoy**, la retención vuelve a comenzar desde hoy. Para conservar 60 días, cambia el valor a `60` y crea una nueva versión de la implementación en Apps Script.

## Actualizar Apps Script

Después de cambiar `Code.gs`, abre **Implementar → Administrar implementaciones → Editar**, elige **Nueva versión** y pulsa **Implementar**. La URL `/exec` seguirá siendo la misma.

## Nota sobre GitHub Pages y Apps Script

La página usa JSONP para consultar, registrar y actualizar los datos. Esto evita el bloqueo `Failed to fetch` que producen las redirecciones de Apps Script cuando se consumen directamente desde un dominio de GitHub Pages.

## Notificaciones por correo de Outlook

Apps Script puede enviar el resumen a cualquier correo, incluyendo Outlook empresarial. El remitente será la cuenta de Google que ejecuta Apps Script y el destinatario se configura en `NOTIFICATION_EMAIL`, al inicio de `Code.gs`.

1. Cambia `TU_CORREO_LABORAL@EMPRESA.COM` por tu correo real.
2. Guarda `Code.gs`.
3. Ejecuta manualmente `sendDiagnosticNotification` y autoriza el acceso a Gmail.
4. Confirma que el mensaje llegó a Outlook; revisa también Correo no deseado.
5. Ejecuta una vez `installDailyNotification`. Recibirás un correo de confirmación.

El resumen se envía de lunes a sábado cerca de las 8:30 a. m., incluso cuando no hay vencidos. Los domingos no se envía y tampoco aumentan el contador de días. Un segundo activador revisa cada 5 minutos los contactos con fecha y hora; al llegar la hora, envía una sola alerta indicando si corresponde llamada o WhatsApp.

Después de actualizar `Code.gs`, vuelve a ejecutar `installDailyNotification` para reemplazar el activador anterior. En el panel **Activadores** deben aparecer `sendDailyFollowUpNotification` y `sendScheduledContactReminders`.

La función `sendDiagnosticNotification` genera un correo de texto simple y lo deja visible en Enviados de Gmail. Si aparece en Enviados pero Outlook no lo recibe, el administrador de Microsoft 365 debe revisar la cuarentena o el rastreo del mensaje usando el asunto y el remitente visibles.
