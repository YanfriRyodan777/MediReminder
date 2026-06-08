# 💊 MediReminder — Guía Completa de Despliegue

Sistema web de recordatorio de medicamentos con **HTML + CSS + JS puro** en el Frontend
y **Node.js + Express + pg** en el Backend conectado a **Supabase**.

---

## 📁 Estructura del Proyecto

```
MediReminder/
├── Frontend/                    ← HTML + CSS + JS puro  →  Vercel
│   ├── inicio.html              → Login / Registro
│   ├── recordatorios.html       → Medicinas del día + alerta pantalla completa
│   ├── medicamentos.html        → CRUD de medicamentos con foto
│   ├── monitoreo.html           → Calendario, gráficas, exportar reportes
│   ├── configuracion.html       → Ajustes, contactos emergencia, temas
│   ├── pagina-404.html          → Página 404
│   ├── estilos.css              → Todos los estilos
│   ├── supabase-cliente.js      → Auth (Supabase SDK) + API REST (Backend)
│   ├── navegacion.js            → Barra de navegación dinámica
│   ├── tutorial.js              → Tutorial de bienvenida por rol
│   └── vercel.json              → Configuración de rutas Vercel
│
└── Backend/                     ← Node.js + Express + pg  →  Render
    ├── servidor.js              → Servidor completo (Auth, CRUD, Cron)
    ├── package.json             → Dependencias
    ├── .env                     → Variables de entorno (NO subir a GitHub)
    ├── .gitignore
    └── Procfile                 → Para Render
```

---

## 🗄️ PASO 1 — Supabase (ya tienes las tablas)

Obtén tus credenciales en: **Supabase → Project Settings → Database**

Para el `.env` del Backend necesitas la sección **Connection pooling**:
- Modo: **Transaction**
- Puerto: **6543**

---

## ⚙️ PASO 2 — Configurar el archivo .env del Backend

Abre `Backend/.env` y completa cada valor:

```env
# ── Base de Datos (Supabase – Transaction Pooler) ──────────
# Supabase → Project Settings → Database → Connection pooling → Transaction
DB_HOST=aws-0-us-east-1.pooler.supabase.com
DB_PORT=6543
DB_NOMBRE=postgres
DB_USUARIO=postgres.TU-PROJECT-REF
DB_PASSWORD=TU-PASSWORD-DE-SUPABASE

# ── Servidor ───────────────────────────────────────────────
PORT=3001

# ── JWT ────────────────────────────────────────────────────
# Genera una clave con:
# node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=TU_CLAVE_SECRETA_MUY_LARGA_Y_ALEATORIA

# ── Entorno ────────────────────────────────────────────────
NODE_ENV=development

# ── CORS ───────────────────────────────────────────────────
FRONTEND_URL=http://localhost:5500
```

> ⚠️ En producción cambia `NODE_ENV=production` y `FRONTEND_URL=https://tu-app.vercel.app`

---

## 🔧 PASO 3 — Configurar el Frontend

Abre `Frontend/supabase-cliente.js` y edita las líneas 10-11 y 15:

```js
// Supabase → Project Settings → API
const SUPABASE_URL  = 'https://TU-PROYECTO.supabase.co';
const SUPABASE_ANON = 'TU-ANON-PUBLIC-KEY';

// En producción: URL de tu servidor en Render
const BACKEND_URL = 'https://medireminder-api.onrender.com';
```

---

## 📤 PASO 4 — Subir a GitHub

```bash
git init
git add .
git commit -m "feat: MediReminder v1.0 - Sistema de recordatorio de medicamentos"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/medireminder.git
git push -u origin main
```

> ✅ El `.gitignore` ya está configurado para no subir `.env` ni `node_modules/`

---

## 🌐 PASO 5 — Deploy en Vercel (Frontend)

1. Ir a [vercel.com](https://vercel.com) → **Add New Project**
2. Importar tu repositorio de GitHub
3. Configurar:
   - **Framework Preset:** `Other`
   - **Root Directory:** `Frontend`
   - **Build Command:** *(dejar vacío)*
   - **Output Directory:** `.`
4. Clic en **Deploy**
5. Tu app queda en: `https://medireminder.vercel.app`

> No necesitas variables de entorno en Vercel (las credenciales están en `supabase-cliente.js`)

---

## ⚙️ PASO 6 — Deploy en Render (Backend)

1. Ir a [render.com](https://render.com) → **New Web Service**
2. Conectar tu repositorio de GitHub
3. Configurar:
   - **Name:** `medireminder-api`
   - **Root Directory:** `Backend`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node servidor.js`
4. En **Environment Variables** agregar exactamente estas:

| Variable | Valor |
|---|---|
| `DB_HOST` | `aws-0-us-east-1.pooler.supabase.com` |
| `DB_PORT` | `6543` |
| `DB_NOMBRE` | `postgres` |
| `DB_USUARIO` | `postgres.TU-PROJECT-REF` |
| `DB_PASSWORD` | Tu password de Supabase |
| `PORT` | `3001` |
| `JWT_SECRET` | Tu clave secreta generada |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | `https://medireminder.vercel.app` |

5. Clic en **Create Web Service**
6. Tu API queda en: `https://medireminder-api.onrender.com`

---

## 🖥️ Desarrollo Local

### Backend:
```bash
cd Backend
npm install
# Edita .env con tus credenciales
npm run dev
# Corre en http://localhost:3001
# Verifica en http://localhost:3001/health
```

### Frontend:
- Abre `Frontend/inicio.html` con la extensión **Live Server** de VS Code
- O haz doble clic en `inicio.html` directamente

---

## ✅ Verificación Final

| Componente | URL de prueba | Esperado |
|---|---|---|
| Backend health | `https://medireminder-api.onrender.com/health` | `{"estado":"activo"}` |
| Frontend | `https://medireminder.vercel.app/inicio.html` | Pantalla de login |

---

## 📋 Funcionalidades Incluidas

- ✅ **Auth con roles** (Paciente / Familiar-Cuidador) con JWT
- ✅ **Alerta de pantalla completa** parpadeante roja + sonido (Web Audio API)
- ✅ **Posponer dosis** 5, 10 o 15 minutos
- ✅ **Foto del medicamento** (base64 almacenada en Supabase)
- ✅ **Calendario de adherencia** con colores por nivel
- ✅ **Gráficas** de línea, barras y pastel (Chart.js CDN)
- ✅ **Exportar PDF** (jsPDF CDN), **TXT** y **CSV**
- ✅ **Contactos de emergencia** CRUD completo
- ✅ **5 temas de color** personalizables
- ✅ **Tutorial de bienvenida** diferenciado por rol
- ✅ **Cron automático** genera registros diarios a medianoche
- ✅ **Accesibilidad** ARIA labels, focus visible, reduced-motion
- ✅ **Diseño responsivo** mobile y desktop
