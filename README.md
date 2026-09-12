# MediReminder + MediWiki

Proyecto universitario que combina dos soluciones en una misma plataforma:

- **MediReminder**: sistema de recordatorio de medicamentos con seguimiento entre paciente y cuidador/familiar.
- **MediWiki**: portal público de información de salud (guía de medicamentos, buscador con datos oficiales y localizador de farmacias cercanas), que funciona como puerta de entrada informativa hacia MediReminder.

## Tabla de contenidos

- [Descripción general](#descripción-general)
- [Tecnologías usadas](#tecnologías-usadas)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Cómo correrlo localmente](#cómo-correrlo-localmente)
- [Variables de entorno](#variables-de-entorno)
- [APIs externas utilizadas](#apis-externas-utilizadas)
- [Despliegue](#despliegue)
- [Flujo de trabajo con Git](#flujo-de-trabajo-con-git)
- [Equipo](#equipo)

## Descripción general

**MediReminder** permite a un paciente registrar sus medicamentos y horarios, recibir alertas cuando toca tomarlos, y llevar un historial de cumplimiento. Un cuidador/familiar puede vincularse a la cuenta del paciente para monitorear el tratamiento en tiempo real, con modo independiente u modo supervisado.

**MediWiki** es la landing page pública del proyecto: no requiere cuenta y ofrece una guía de medicamentos comunes (con filtros por síntoma), un buscador conectado a la base de datos oficial de medicamentos de la AEMPS (CIMA, España), y un localizador de farmacias cercanas basado en OpenStreetMap. Al final de la página se invita al usuario a crear una cuenta en MediReminder para un seguimiento más completo.

## Tecnologías usadas

**Frontend**
- HTML, CSS y JavaScript sin frameworks (vanilla)
- [Leaflet.js](https://leafletjs.com/) para el mapa de farmacias cercanas
- [Supabase JS Client](https://supabase.com/docs/reference/javascript/introduction) para autenticación de datos
- PWA (Progressive Web App): `manifest.json` y `sw.js` (Service Worker) para instalación en el dispositivo

**Backend**
- Node.js con Express
- PostgreSQL (a través de Supabase) usando `pg` (node-postgres)
- JWT para autenticación
- `bcrypt` para el hash de contraseñas
- `node-cron` para tareas programadas (generación diaria de recordatorios, resumen semanal por correo)
- `express-rate-limit` para limitar peticiones por IP

**Base de datos**
- PostgreSQL gestionado por Supabase
- Row Level Security (RLS) habilitado, con política de acceso total para el rol usado por el backend

## Estructura del proyecto

```
MediReminder/
├── Backend/
│   └── servidor.js          # API REST (Express) — auth, medicamentos, registros, contactos, portal público
├── Frontend/
│   ├── landing.html         # Portal público MediWiki (guía, buscador, farmacias, CTA hacia la app)
│   ├── inicio.html          # Login / registro / recuperación de contraseña
│   ├── recordatorios.html   # Pantalla principal del paciente
│   ├── medicamentos.html    # Gestión de medicamentos del paciente
│   ├── monitoreo.html       # Panel del cuidador/familiar
│   ├── configuracion.html   # Ajustes de cuenta y accesibilidad
│   ├── estilos.css          # Estilos compartidos por la app (paleta MediReminder)
│   ├── supabase-cliente.js  # Cliente Supabase + utilidades compartidas (Auth, Toast, Fecha, escapeHtml, etc.)
│   ├── navegacion.js        # Navegación inferior y alarma global
│   ├── manifest.json        # Manifest PWA de MediReminder (la app)
│   ├── manifest-wiki.json   # Manifest PWA de MediWiki (el portal público)
│   └── sw.js                # Service Worker
└── README.md
```

## Cómo correrlo localmente

**Backend**
```bash
cd Backend
npm install
node servidor.js
```
El servidor arranca por defecto usando la configuración de `BACKEND_URL`/variables de entorno (ver siguiente sección).

**Frontend**
El frontend es HTML/CSS/JS estático — se puede abrir directamente con una extensión tipo "Live Server", o servirlo con cualquier servidor estático:
```bash
cd Frontend
npx serve .
```

## Variables de entorno

El backend necesita, como mínimo:

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Cadena de conexión a la base de datos de Supabase (PostgreSQL) |
| `JWT_SECRET` | Clave para firmar los tokens de autenticación |
| `RESEND_API_KEY` | Clave para el envío de correos (recuperación de contraseña, resumen semanal) |
| `FRONTEND_URL` | URL del frontend, usada para configurar CORS |

## APIs externas utilizadas

- **[CIMA (AEMPS)](https://cima.aemps.es/)** — base de datos oficial de medicamentos autorizados en España, en español, gratuita y sin necesidad de API key. Usada en el buscador de MediWiki.
- **[Overpass API](https://overpass-api.de/)** (OpenStreetMap) — usada para ubicar farmacias cercanas a partir de la geolocalización del usuario, gratuita y sin API key.

Ambas se consultan directamente desde el navegador o desde el backend (según el caso) sin costo alguno, adecuadas para un proyecto sin presupuesto de infraestructura.

## Despliegue

| Capa | Plataforma |
|---|---|
| Frontend | [Vercel](https://vercel.com/) |
| Backend | [Render](https://render.com/) |
| Base de datos | [Supabase](https://supabase.com/) |

## Flujo de trabajo con Git

Este proyecto usa ramas por funcionalidad (`feature/nombre-de-la-funcionalidad`), con Pull Requests hacia `main` para cada bloque de trabajo terminado. Antes de empezar una nueva funcionalidad:

```bash
git checkout main
git pull origin main
git checkout -b feature/nombre-descriptivo
```

Al terminar, se sube la rama y se abre un Pull Request en GitHub para revisión y fusión a `main`.

## Equipo

Proyecto desarrollado como trabajo grupal para el curso **Herramientas de Desarrollo** — Universidad Tecnológica del Perú (UTP).
