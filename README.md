# Seguimiento de Prospectos · Multiusuario

Versión independiente para un equipo de orientadores. Cada persona inicia sesión con un código temporal enviado a su correo y solamente puede consultar o modificar sus propios prospectos. El administrador configurado es `abraham.quintero@unid.mx`.

## Qué incluye

- Registro libre con correos de Outlook, Gmail u otros dominios.
- Código de acceso de seis dígitos con vigencia de 10 minutos.
- Sesión de ocho horas; cerrar o perder la sesión no elimina prospectos.
- Propiedad de cada lead asignada exclusivamente por Apps Script.
- Los orientadores solamente reciben y modifican sus propios registros.
- El administrador puede ver, editar y eliminar todos los prospectos.
- Correos de seguimiento y recordatorios enviados al propietario correspondiente.
- Sin eliminación automática: los leads permanecen indefinidamente.
- Domingos excluidos del contador y de los envíos.
- Edición de prospectos, búsqueda, filtros y citas vencidas en estado urgente.

## 1. Crear una base separada

Para no afectar el sistema actual, crea una hoja de cálculo nueva.

1. Abre Google Sheets y crea una hoja vacía.
2. Ponle un nombre identificable, por ejemplo `Seguimientos multiusuario`.
3. Abre **Extensiones → Apps Script**.
4. Borra el contenido inicial y pega todo `apps-script/Code.gs`.
5. En las primeras líneas cambia `PAGE_URL` cuando conozcas la dirección del nuevo repositorio:

```js
const ADMIN_EMAIL = 'abraham.quintero@unid.mx';
const PAGE_URL = 'https://TU-USUARIO.github.io/TU-REPOSITORIO/';
```

6. En **Configuración del proyecto**, establece la zona horaria `America/Monterrey`.
7. Guarda el proyecto.

Las pestañas `Prospectos`, `Orientadores` y `Sesiones` se crean automáticamente. `Sesiones` queda oculta para evitar modificaciones accidentales.

## 2. Publicar Apps Script

1. Pulsa **Implementar → Nueva implementación**.
2. Selecciona **Aplicación web**.
3. Configura **Ejecutar como: Yo**.
4. Configura **Quién tiene acceso: Cualquier persona**.
5. Pulsa **Implementar** y acepta los permisos.
6. Copia la URL terminada en `/exec`.

La aplicación web es pública para permitir el envío del código, pero las operaciones de prospectos exigen una sesión válida y Apps Script comprueba al propietario en cada consulta, modificación o eliminación.

## 3. Configurar correos automáticos

Dentro de Apps Script:

1. Selecciona `sendTestNotification` y pulsa **Ejecutar**.
2. Confirma que la prueba llegó a `abraham.quintero@unid.mx`.
3. Selecciona `installDailyNotification` y ejecútala una vez.
4. En **Activadores** deben aparecer `sendDailyFollowUpNotification` y `sendScheduledContactReminders`.

Los correos de acceso y recordatorios salen desde la cuenta de Google propietaria del Apps Script. La dirección de Outlook únicamente necesita poder recibirlos.

## 4. Conectar y publicar el nuevo repositorio

1. Pega la nueva URL `/exec` en `config.js`:

```js
window.APP_CONFIG = {
  API_URL: "https://script.google.com/macros/s/TU_IMPLEMENTACION/exec"
};
```

2. Crea un repositorio nuevo en GitHub.
3. Sube todos los archivos de esta carpeta a la raíz.
4. En GitHub abre **Settings → Pages**.
5. Elige **Deploy from a branch**, rama `main`, carpeta `/ (root)`.
6. Cuando GitHub entregue la URL, colócala en `PAGE_URL` de Apps Script.
7. Guarda y actualiza la implementación: **Implementar → Administrar implementaciones → Editar → Nueva versión → Implementar**.

## Administración desde Sheets

La pestaña `Orientadores` contiene:

| Columna | Uso |
|---|---|
| `id` | Identidad interna que vincula los prospectos |
| `name` | Nombre del orientador |
| `email` | Correo utilizado para el acceso y las alertas |
| `role` | Administrador u Orientador |
| `active` | `Sí` permite acceso; `No` lo bloquea |
| `lastLoginAt` | Último acceso confirmado |

### Bloquear a una persona

Cambia `active` a `No`. La siguiente operación invalida su sesión y deja de recibir alertas. Sus leads permanecen guardados.

### Eliminar a una persona

Elimina su fila de `Orientadores`. Su sesión deja de funcionar y sus leads quedan sin una cuenta activa. Como el registro es libre, ese mismo correo podrá crear una cuenta nueva, pero recibirá un ID nuevo y no recuperará automáticamente los leads anteriores.

Para bloquear el correo de forma permanente, conserva la fila y utiliza `active = No`.

### Reasignar leads manualmente

Como administrador puedes copiar en `Prospectos` el `id`, nombre y correo del nuevo orientador en las columnas `ownerId`, `ownerName` y `ownerEmail`. El acceso de la aplicación siempre se decide con `ownerId`.

## Reglas de privacidad

- El navegador nunca decide quién es propietario de un prospecto.
- Apps Script obtiene el propietario desde la sesión.
- Un orientador no puede listar, editar, contactar ni eliminar leads ajenos.
- El administrador es reconocido exclusivamente por el correo configurado en `ADMIN_EMAIL`.
- Las sesiones se almacenan como hashes, no como tokens legibles.
- Los códigos temporales no se guardan en Sheets.

## Límites de códigos

Para reducir abusos y proteger la cuota de Gmail:

- Un código por minuto por correo.
- Cinco solicitudes diarias por correo.
- Cien solicitudes diarias en total.
- Cinco intentos por código.

Estos valores pueden cambiarse al inicio de `Code.gs`.

## Actualizaciones posteriores

Después de modificar `Code.gs`, guarda y crea una **Nueva versión** de la implementación. La URL `/exec` seguirá siendo la misma. Los cambios de `index.html`, `app.js` o `styles.css` deben subirse al repositorio nuevo de GitHub.
