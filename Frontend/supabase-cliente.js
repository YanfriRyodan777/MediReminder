/* ═══════════════════════════════════════════════════════════
   supabase-cliente.js — MediReminder
   Cliente unificado: Auth via Supabase JS SDK
   Datos (medicamentos, registros, contactos, ajustes) via API REST del Backend
   ═══════════════════════════════════════════════════════════ */

// ── Configuración ─────────────────────────────────────────────
// SUPABASE: Supabase → Project Settings → API
const SUPABASE_URL  = 'https://vcwvysziqiftbztfdzaa.supabase.co';
const SUPABASE_ANON = 'sb_publishable_IiBeEMSHP6ai3GD722WPoQ_0ynzRvH6';

// BACKEND: URL de tu servidor en Render (sin barra final)
// En desarrollo local: 'http://localhost:3001'
// En producción:       'https://medireminder-api.onrender.com'
// En desarrollo local usa: 'http://localhost:3000'
// En producción (Render):  'https://TU-SERVICIO.onrender.com'
const BACKEND_URL = 'https://medireminder-ywl9.onrender.com';

// ── Cliente Supabase (solo para Auth) ─────────────────────────
const { createClient } = supabase;
const sbClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: { persistSession: true, autoRefreshToken: true },
});

// ══════════════════════════════════════════════════════════════
//  PETICIÓN AL BACKEND (API REST con JWT)
// ══════════════════════════════════════════════════════════════
async function api(metodo, ruta, cuerpo = null) {
  const token = Sesion.obtenerToken();
  const cabeceras = { 'Content-Type': 'application/json' };
  if (token) cabeceras['Authorization'] = `Bearer ${token}`;

  const opciones = { method: metodo, headers: cabeceras };
  if (cuerpo !== null) opciones.body = JSON.stringify(cuerpo);

  let res;
  try {
    res = await fetch(BACKEND_URL + ruta, opciones);
  } catch {
    throw new Error('No se pudo conectar con el servidor. Verifica tu conexión o que el backend esté activo.');
  }

  if (res.status === 401) { Sesion.cerrar(); return; }

  let datos;
  try { datos = await res.json(); } catch { datos = {}; }
  if (!res.ok) throw new Error(datos.error || `Error ${res.status}`);
  return datos;
}

// ══════════════════════════════════════════════════════════════
//  SESIÓN
// ══════════════════════════════════════════════════════════════
const Sesion = {
  guardar(token, perfil) {
    localStorage.setItem('mr_token',  token);
    localStorage.setItem('mr_perfil', JSON.stringify(perfil));
  },
  obtenerToken()  { return localStorage.getItem('mr_token'); },
  perfilCache()   {
    const p = localStorage.getItem('mr_perfil');
    return p ? JSON.parse(p) : null;
  },
  async refrescarPerfil() {
    try {
      const datos = await api('GET', '/api/auth/perfil');
      localStorage.setItem('mr_perfil', JSON.stringify(datos));
      return datos;
    } catch { return this.perfilCache(); }
  },
  cerrar() {
    localStorage.removeItem('mr_token');
    localStorage.removeItem('mr_perfil');
    sbClient.auth.signOut().finally(() => { window.location.href = '/inicio.html'; });
  },
  async requiereAuth() {
    if (!this.obtenerToken()) { window.location.href = '/inicio.html'; return false; }
    return true;
  },
  cambiarPassword: (passwordActual, nuevaPassword) =>
    api('PUT', '/api/auth/cambiar-password', { passwordActual, nuevaPassword }),
  cambiarModo: (independentMode) => api('PUT', '/api/auth/cambiar-modo', { independentMode }),
};




// ══════════════════════════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════════════════════════
const Auth = {
  async registro({ name, email, password, role, independentMode, patientEmail }) {
    const datos = await api('POST', '/api/auth/registro', { name, email, password, role, independentMode, patientEmail });
    Sesion.guardar(datos.token, datos.user);
    return datos.user;
  },
  async login({ email, password }) {
    const datos = await api('POST', '/api/auth/login', { email, password });
    Sesion.guardar(datos.token, datos.user);
    return datos.user;
  },
  async loginDemo(rol) {
    const email    = rol === 'patient' ? 'demo.paciente@medireminder.app' : 'demo.familiar@medireminder.app';
    const password = 'Demo1234!';
    try {
      return await this.login({ email, password });
    } catch {
      throw new Error('Usuarios demo no configurados. Regístrate con un correo cualquiera para probar.');
    }
  },
};

// ══════════════════════════════════════════════════════════════
//  MEDICAMENTOS
// ══════════════════════════════════════════════════════════════
const Medicamentos = {
  obtenerTodos: ()      => api('GET',    '/api/medicamentos'),
  crear:        (d)     => api('POST',   '/api/medicamentos', d),
  actualizar:   (id, d) => api('PUT',    `/api/medicamentos/${id}`, d),
  eliminar:     (id)    => api('DELETE', `/api/medicamentos/${id}`),
};

// ══════════════════════════════════════════════════════════════
//  REGISTROS DE TOMA
// ══════════════════════════════════════════════════════════════
const Registros = {
  obtenerTodos(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return api('GET', `/api/registros${qs ? '?' + qs : ''}`);
  },
  generarHoy:    ()   => api('POST',  '/api/registros/generar-hoy'),
  marcarTomado:  (id) => api('PATCH', `/api/registros/${id}/tomado`),
  marcarOmitido: (id) => api('PATCH', `/api/registros/${id}/omitido`),
};

// ══════════════════════════════════════════════════════════════
//  CONTACTOS DE EMERGENCIA
// ══════════════════════════════════════════════════════════════
const Contactos = {
  obtenerTodos: ()      => api('GET',    '/api/contactos'),
  crear:        (d)     => api('POST',   '/api/contactos', d),
  actualizar:   (id, d) => api('PUT',    `/api/contactos/${id}`, d),
  eliminar:     (id)    => api('DELETE', `/api/contactos/${id}`),
};

// ══════════════════════════════════════════════════════════════
//  AJUSTES
// ══════════════════════════════════════════════════════════════
const Ajustes = {
  obtener: ()  => api('GET', '/api/ajustes'),
  guardar: (d) => api('PUT', '/api/ajustes', d),
};

// ══════════════════════════════════════════════════════════════
//  TOAST
// ══════════════════════════════════════════════════════════════
const Toast = {
  mostrar(msg, tipo = 'info') {
    const caja = document.getElementById('toast-caja');
    if (!caja) return;
    const el = document.createElement('div');
    el.className = `toast toast-${tipo}`;
    const iconos = { ok: '✅', err: '❌', warn: '⚠️', info: 'ℹ️' };
    el.innerHTML = `<span>${iconos[tipo] || '📢'}</span><span>${msg}</span>`;
    caja.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity .4s';
      setTimeout(() => el.remove(), 400);
    }, 3500);
  },
  ok:   (m) => Toast.mostrar(m, 'ok'),
  err:  (m) => Toast.mostrar(m, 'err'),
  warn: (m) => Toast.mostrar(m, 'warn'),
  info: (m) => Toast.mostrar(m, 'info'),
};

// ══════════════════════════════════════════════════════════════
//  FECHA / HORA
// ══════════════════════════════════════════════════════════════
const Fecha = {
  hoy:   () => new Date().toISOString().split('T')[0],
  hora:  () => new Date().toTimeString().slice(0, 5),
  larga: (s) => new Date(s + 'T00:00:00').toLocaleDateString('es-ES', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  }),
  corta: (s) => new Date(s + 'T00:00:00').toLocaleDateString('es-ES', {
    day: 'numeric', month: 'short',
  }),
};

// ══════════════════════════════════════════════════════════════
//  SONIDO DE ALARMA
// ══════════════════════════════════════════════════════════════
function reproducirAlarma(tipoSonido) {
  const tipo = tipoSonido || localStorage.getItem('mr_sonido') || 'clasico';
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (tipo === 'clasico') {
      [0, 700, 1400].forEach((delay) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = 880; osc.type = 'sine';
        const t = ctx.currentTime + delay / 1000;
        gain.gain.setValueAtTime(0.35, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        osc.start(t); osc.stop(t + 0.6);
      });
    } else if (tipo === 'urgente') {
      [0, 300, 600, 900].forEach((delay) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = delay % 600 === 0 ? 1100 : 800;
        osc.type = 'square';
        const t = ctx.currentTime + delay / 1000;
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        osc.start(t); osc.stop(t + 0.25);
      });
    } else if (tipo === 'suave') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 528; osc.type = 'sine';
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.5);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 2);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 2);
    }
  } catch { /* sin soporte audio */ }
}

// ══════════════════════════════════════════════════════════════
//  TEMA DE COLOR
// ══════════════════════════════════════════════════════════════
function aplicarTema(id) {
  const temas = {
    blue:   { pri: '#3b82f6', osc: '#2563eb', cl: '#eff6ff' },
    green:  { pri: '#22c55e', osc: '#16a34a', cl: '#f0fdf4' },
    purple: { pri: '#8b5cf6', osc: '#7c3aed', cl: '#f5f3ff' },
    orange: { pri: '#f97316', osc: '#ea580c', cl: '#fff7ed' },
    rose:   { pri: '#ec4899', osc: '#db2777', cl: '#fdf2f8' },
  };
  const t = temas[id] || temas.blue;
  document.documentElement.style.setProperty('--azul',     t.pri);
  document.documentElement.style.setProperty('--azul-osc', t.osc);
  document.documentElement.style.setProperty('--azul-cl',  t.cl);
}
(function() {
  const tema = localStorage.getItem('mr_tema') || 'blue';
  aplicarTema(tema);
  if (localStorage.getItem('mr_oscuro') === '1') {
    document.body.classList.add('oscuro');
  }
})();

// ══════════════════════════════════════════════════════════════
//  PACIENTES (para cuidadores)
// ══════════════════════════════════════════════════════════════
const Pacientes = {
  buscar:      (email)     => api('GET',    `/api/pacientes/buscar?email=${encodeURIComponent(email)}`),
  vincular:    (patientId) => api('POST',   '/api/pacientes/vincular', { patientId }),
  desvincular: ()          => api('DELETE', '/api/pacientes/desvincular'),
};
const PacienteDatos = {
  obtener: () => api('GET', '/api/paciente/datos'),
};