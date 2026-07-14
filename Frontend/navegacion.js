/* navegacion.js — MediReminder */
let _alarmaGlobalInterval = null;
let _logsCache = [];
let _sonidoCache = true;
window._omitidosGlobal = new Set(
  JSON.parse(sessionStorage.getItem('mr_omitidos') || '[]')
);
let _omitidosGlobal = window._omitidosGlobal;

async function _cargarLogsGlobal() {
  try {
    const ajustes = await Ajustes.obtener();
    _sonidoCache = ajustes.soundEnabled ?? true;
    const logs = await Registros.obtenerTodos({ days: 1 });
    const hoy  = new Date().toISOString().split('T')[0];
    _logsCache = logs.filter(l => l.date === hoy);
  } catch { /* silencioso */ }
}

function _verificarAlarmaGlobal() {
  if (!_sonidoCache) return;
  const ahora = new Date();
  const hoy   = ahora.toISOString().split('T')[0];
  const hora  = ahora.toLocaleTimeString('es-ES', {
    hour: '2-digit', minute: '2-digit', hour12: false
  });
  const pendiente = _logsCache.find(l =>
    l.status === 'pending' &&
    l.date === hoy &&
    l.scheduledTime <= hora &&
    !_omitidosGlobal.has(l.id)
  );
  if (pendiente) reproducirAlarma();
}

async function iniciarAlarmaGlobal() {
  const token = Sesion.obtenerToken();
  if (!token) return;
  const perfil = Sesion.perfilCache();
  if (!perfil || perfil.role === 'caregiver') return;

  // Cargar logs inmediatamente
  await _cargarLogsGlobal();
  // Verificar inmediatamente
  _verificarAlarmaGlobal();

  // Verificar cada 20 segundos (sin llamada a API)
  if (_alarmaGlobalInterval) clearInterval(_alarmaGlobalInterval);
  _alarmaGlobalInterval = setInterval(_verificarAlarmaGlobal, 20000);

  // Recargar logs desde API cada 3 minutos
  setInterval(_cargarLogsGlobal, 180000);
}

async function inyectarNavegacion(paginaActual) {
  const perfil = await Sesion.refrescarPerfil();
  if (!perfil) return;

  const nombre     = perfil.full_name || perfil.name || '—';
  const esPaciente = perfil.role === 'patient';
  const subtitulo  = esPaciente && perfil.caregiverName
    ? `Cuidado por: ${perfil.caregiverName}`
    : nombre === perfil.full_name ? '' : '';

  const tieneSupervision = !perfil.independentMode;

  const enlacesPac = `
    <a href="/recordatorios.html" class="nav-link ${paginaActual==='recordatorios'?'ativo':''}" aria-label="Mis Medicinas">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
      <span class="nav-etiq">Mis Medicinas</span>
    </a>
    ${perfil.independentMode ? `
    <a href="/medicamentos.html" class="nav-link ${paginaActual==='medicamentos'?'ativo':''}" aria-label="Administrar">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
      <span class="nav-etiq">Administrar</span>
    </a>
    <a href="/monitoreo.html" class="nav-link ${paginaActual==='monitoreo'?'ativo':''}" aria-label="Reportes">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
      <span class="nav-etiq">Reportes</span>
    </a>` : `
    <a href="/monitoreo.html" class="nav-link ${paginaActual==='monitoreo'?'ativo':''}" aria-label="Reportes">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
      <span class="nav-etiq">Reportes</span>
    </a>`}`;

  const enlacesCui = `
    <a href="/monitoreo.html" class="nav-link ativo-morado ${paginaActual==='monitoreo'?'ativo-morado':''}" aria-label="Monitoreo">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      <span class="nav-etiq">Monitoreo</span>
    </a>
    <a href="/medicamentos.html" class="nav-link ${paginaActual==='medicamentos'?'ativo':''}" aria-label="Medicinas">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m10.5 20.5-7-7a5 5 0 1 1 7-7l7 7a5 5 0 0 1-7 7z"/><path d="m8.5 8.5 7 7"/></svg>
      <span class="nav-etiq">Medicinas</span>
    </a>`;

  document.getElementById('nav-contenedor').innerHTML = `
    <nav class="navbar" role="navigation" aria-label="Navegación principal">
      <div class="navbar-inner">
        <div class="navbar-brand">
          <div class="brand-icon" aria-hidden="true" style="background:linear-gradient(135deg,#7c3aed,#a78bfa)">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10.5 20H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v3"/>
              <circle cx="18" cy="18" r="4"/><path d="M18 16v2l1 1"/>
            </svg>
          </div>
          <div>
            <div class="brand-name">MediReminder</div>
           <div class="brand-user">${nombre}</div>
            ${esPaciente && perfil.caregiverName ? `<div style="font-size:.65rem;color:#7c3aed;font-weight:700">👨‍⚕️ ${perfil.caregiverName}</div>` : ''}
          </div>
        </div>
        <div class="navbar-links">
          ${esPaciente ? enlacesPac : enlacesCui}
          <a href="/configuracion.html" class="nav-link solo-icono ${paginaActual==='configuracion'?'ativo':''}" title="Configuración" aria-label="Configuración">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
          </a>
          <button class="nav-link solo-icono salir" onclick="cerrarSesion()" title="Cerrar Sesión" aria-label="Cerrar Sesión">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      </div>
    </nav>`;

  if (paginaActual !== 'recordatorios') {
    iniciarAlarmaGlobal();
  }
}

function cerrarSesion() {
  // Crear modal si no existe
  if (!document.getElementById('modal-logout')) {
    const div = document.createElement('div');
    div.id = 'modal-logout';
    div.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem">
        <div style="background:var(--blanco,#fff);border-radius:16px;padding:2rem;max-width:340px;width:100%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.3)">
          <div style="font-size:3rem;margin-bottom:1rem">👋</div>
          <p style="font-size:1.1rem;font-weight:900;margin-bottom:.5rem">¿Cerrar sesión?</p>
          <p style="color:var(--g500,#6b7280);font-size:.875rem;margin-bottom:1.5rem">
            Recuerda que puedes volver cuando quieras. ¡Tus datos están guardados! 💊
          </p>
          <div style="display:flex;gap:.75rem">
            <button onclick="document.getElementById('modal-logout').remove()"
              style="flex:1;padding:.75rem;border:2px solid var(--g200,#e5e7eb);border-radius:10px;font-weight:800;cursor:pointer;background:transparent">
              Cancelar
            </button>
            <button onclick="ejecutarCerrarSesion()"
              style="flex:1;padding:.75rem;background:var(--azul,#3b82f6);color:#fff;border:none;border-radius:10px;font-weight:800;cursor:pointer">
              Sí, salir
            </button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(div);
  }
}

function ejecutarCerrarSesion() {
  if (_alarmaGlobalInterval) clearInterval(_alarmaGlobalInterval);
  Sesion.cerrar();
}
