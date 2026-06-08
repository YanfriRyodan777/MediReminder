/* navegacion.js — MediReminder */

async function inyectarNavegacion(paginaActual) {
  const perfil = Sesion.perfilCache();
  if (!perfil) return;

  const esPaciente = perfil.role === 'patient';

  const enlacesPac = `
    <a href="/recordatorios.html" class="nav-link ${paginaActual==='recordatorios'?'ativo':''}" aria-label="Mis Medicinas">
      🔔 <span class="nav-etiq">Mis Medicinas</span>
    </a>
    <a href="/medicamentos.html" class="nav-link ${paginaActual==='medicamentos'?'ativo':''}" aria-label="Administrar">
      ⏰ <span class="nav-etiq">Administrar</span>
    </a>
    ${!perfil.independent_mode ? `
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
            <div class="brand-user">${perfil.full_name}</div>
          </div>
        </div>
        <div class="navbar-links">
          ${esPaciente ? enlacesPac : enlacesCui}
          <a href="/configuracion.html" class="nav-link solo-icono ${paginaActual==='configuracion'?'ativo':''}" title="Configuración" aria-label="Configuración">⚙️</a>
          <button class="nav-link solo-icono salir" onclick="cerrarSesion()" title="Cerrar Sesión" aria-label="Cerrar Sesión">🚪</button>
        </div>
      </div>
    </nav>`;
}

function cerrarSesion() {
  if (confirm('¿Estás seguro que deseas cerrar sesión?')) {
    Sesion.cerrar();
  }
}
