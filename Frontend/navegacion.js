/* navegacion.js — MediReminder */

let _alarmaGlobalInterval = null;

async function iniciarAlarmaGlobal() {
  const token = Sesion.obtenerToken();
  if (!token) return;
  const perfil = Sesion.perfilCache();
  if (!perfil || perfil.role === 'caregiver') return;

  async function verificar() {
    try {
      const ajustes = await Ajustes.obtener();
      if (!ajustes.soundEnabled) return;
      const logs = await Registros.obtenerTodos({ days: 1 });
      const ahora = new Date();
      const hoy   = ahora.toISOString().split('T')[0];
      const hora  = ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false });
      const pendiente = logs.find(l =>
        l.status === 'pending' && l.date === hoy && l.scheduledTime <= hora
      );
      if (pendiente) reproducirAlarma();
    } catch { /* silencioso */ }
  }

  verificar();
  _alarmaGlobalInterval = setInterval(verificar, 60000);
}

async function inyectarNavegacion(paginaActual) {
  const perfil = await Sesion.refrescarPerfil();
  if (!perfil) return;

  const nombre   = perfil.full_name || perfil.name || '—';
  const esPaciente = perfil.role === 'patient';

  const tieneSupervision = !perfil.independentMode;

  const enlacesPac = `
    <a href="/recordatorios.html" class="nav-link ${paginaActual==='recordatorios'?'ativo':''}" aria-label="Mis Medicinas">
      🔔 <span class="nav-etiq">Mis Medicinas</span>
    </a>
    ${perfil.independentMode ? `
    <a href="/medicamentos.html" class="nav-link ${paginaActual==='medicamentos'?'ativo':''}" aria-label="Administrar">
      ⏰ <span class="nav-etiq">Administrar</span>
    </a>
    <a href="/monitoreo.html" class="nav-link ${paginaActual==='monitoreo'?'ativo':''}" aria-label="Reportes">
      📊 <span class="nav-etiq">Reportes</span>
    </a>` : ''}`;

  const enlacesCui = `
    <a href="/monitoreo.html" class="nav-link ativo-morado ${paginaActual==='monitoreo'?'ativo-morado':''}" aria-label="Monitoreo">
      👁️ <span class="nav-etiq">Monitoreo</span>
    </a>
    <a href="/medicamentos.html" class="nav-link ${paginaActual==='medicamentos'?'ativo':''}" aria-label="Medicinas">
      💊 <span class="nav-etiq">Medicinas</span>
    </a>`;

  document.getElementById('nav-contenedor').innerHTML = `
    <nav class="navbar" role="navigation" aria-label="Navegación principal">
      <div class="navbar-inner">
        <div class="navbar-brand">
          <div class="brand-icon" aria-hidden="true">💊</div>
          <div>
            <div class="brand-name">MediReminder</div>
            <div class="brand-user">${nombre}</div>
          </div>
        </div>
        <div class="navbar-links">
          ${esPaciente ? enlacesPac : enlacesCui}
          <a href="/configuracion.html" class="nav-link solo-icono ${paginaActual==='configuracion'?'ativo':''}" title="Configuración" aria-label="Configuración">⚙️</a>
          <button class="nav-link solo-icono salir" onclick="cerrarSesion()" title="Cerrar Sesión" aria-label="Cerrar Sesión">🚪</button>
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
