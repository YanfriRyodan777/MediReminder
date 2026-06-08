/* ═══════════════════════════════════════════════════
   tutorial.js — MediReminder
   Tutorial de bienvenida para nuevos usuarios
   ═══════════════════════════════════════════════════ */

const PASOS_PACIENTE = [
  {
    icono: '💊',
    titulo: '¡Bienvenido a MediReminder!',
    desc: 'Tu asistente personal para nunca olvidar tus medicamentos.',
    html: `
      <p style="color:var(--g600);margin-bottom:.875rem">Con MediReminder podrás:</p>
      <ul style="display:flex;flex-direction:column;gap:.625rem;color:var(--g600);font-size:.95rem">
        <li>🔔 Recibir alertas visuales y sonoras en cada horario</li>
        <li>📋 Llevar un registro completo de tu adherencia</li>
        <li>👨‍👩‍👧 Compartir tu progreso con tu familia (opcional)</li>
        <li>📄 Exportar reportes para tu médico</li>
        <li>⏱ Posponer recordatorios 5, 10 o 15 minutos</li>
      </ul>`
  },
  {
    icono: '⏰',
    titulo: 'Paso 1: Agrega tus Medicamentos',
    desc: 'Primero configura qué medicinas tomas y a qué hora.',
    html: `
      <p style="color:var(--g600);margin-bottom:.875rem">Ve a <strong>Administrar</strong> y podrás:</p>
      <ul style="display:flex;flex-direction:column;gap:.625rem;color:var(--g600);font-size:.95rem">
        <li>💊 Escribir el nombre y dosis de cada medicina</li>
        <li>🕐 Configurar los horarios exactos (ej. 08:00 y 20:00)</li>
        <li>📷 Subir una <strong>foto</strong> para identificarla visualmente</li>
        <li>📝 Agregar instrucciones especiales</li>
      </ul>
      <div style="background:var(--verde-cl);border-radius:var(--r-sm);padding:.875rem;margin-top:.875rem">
        <p style="font-size:.875rem;color:#15803d;font-weight:700">💡 Las fotos son especialmente útiles para no confundir medicamentos.</p>
      </div>`
  },
  {
    icono: '🔔',
    titulo: 'Paso 2: Responde las Alertas',
    desc: 'Cuando llegue la hora recibirás una alerta grande e imposible de ignorar.',
    html: `
      <div style="background:var(--rojo-cl);border:2px solid #fca5a5;border-radius:var(--r);padding:1rem;margin-bottom:.875rem">
        <p style="font-weight:800;color:#b91c1c;margin-bottom:.5rem">Cuando sea la hora de tu medicina:</p>
        <ul style="font-size:.9rem;color:#dc2626;display:flex;flex-direction:column;gap:.375rem">
          <li>📺 La pantalla se vuelve roja con la alerta</li>
          <li>🔊 Suena una alarma audible (si está activada)</li>
          <li>✅ Presiona <strong>"Ya la tomé"</strong> para confirmar</li>
          <li>✗ O <strong>"Omitir"</strong> si no puedes tomarla ahora</li>
        </ul>
      </div>
      <p style="font-size:.9rem;color:var(--g600)"><strong>⏱ Puedes posponer</strong> 5, 10 o 15 minutos si estás ocupado en ese momento.</p>`
  },
  {
    icono: '📅',
    titulo: 'Paso 3: Revisa tu Seguimiento',
    desc: 'Consulta tu historial y comparte reportes con tu médico.',
    html: `
      <p style="color:var(--g600);margin-bottom:.875rem">En <strong>Reportes</strong> encontrarás:</p>
      <ul style="display:flex;flex-direction:column;gap:.625rem;color:var(--g600);font-size:.95rem">
        <li>📅 Calendario mensual con porcentaje de adherencia por día</li>
        <li>📊 Gráficas de tendencias de los últimos 30 días</li>
        <li>📄 Exportar reportes en <strong>PDF</strong>, TXT o CSV</li>
        <li>🩺 Perfectos para llevar a citas médicas</li>
      </ul>`
  },
  {
    icono: '⚙️',
    titulo: 'Paso 4: Personaliza la App',
    desc: 'Ajusta MediReminder a tus necesidades y preferencias.',
    html: `
      <p style="color:var(--g600);margin-bottom:.875rem">En <strong>Configuración</strong> puedes:</p>
      <ul style="display:flex;flex-direction:column;gap:.625rem;color:var(--g600);font-size:.95rem">
        <li>🔊 Activar o desactivar el sonido de alarma</li>
        <li>⏰ Configurar recordatorios anticipados</li>
        <li>📞 Agregar contactos de emergencia</li>
        <li>🎨 Cambiar el tema de color de la app</li>
      </ul>
      <div style="background:var(--azul-cl);border-radius:var(--r-sm);padding:.875rem;margin-top:.875rem">
        <p style="font-size:.875rem;color:#1e40af;font-weight:700">✅ ¡Ya estás listo para comenzar! Haz clic en "¡Comenzar!" para ir a tus medicinas.</p>
      </div>`
  },
];

const PASOS_CUIDADOR = [
  {
    icono: '👨‍⚕️',
    titulo: '¡Bienvenido, Familiar/Cuidador!',
    desc: 'Ayuda a tus seres queridos con su tratamiento médico.',
    html: `
      <p style="color:var(--g600);margin-bottom:.875rem">Como cuidador puedes:</p>
      <ul style="display:flex;flex-direction:column;gap:.625rem;color:var(--g600);font-size:.95rem">
        <li>👁️ Monitorear la adherencia del paciente en tiempo real</li>
        <li>🚨 Recibir alertas cuando se omiten medicinas</li>
        <li>⚙️ Configurar medicamentos y horarios</li>
        <li>📊 Ver calendarios y gráficas de progreso</li>
        <li>📄 Exportar reportes para citas médicas</li>
      </ul>`
  },
  {
    icono: '💊',
    titulo: 'Configura los Medicamentos',
    desc: 'Ayuda al paciente a registrar sus medicinas correctamente.',
    html: `
      <p style="color:var(--g600);margin-bottom:.875rem">En <strong>Medicinas</strong> puedes:</p>
      <ul style="display:flex;flex-direction:column;gap:.625rem;color:var(--g600);font-size:.95rem">
        <li>💊 Agregar medicamentos con nombre y dosis exacta</li>
        <li>🕐 Configurar múltiples horarios por medicina</li>
        <li>📷 Subir fotos para ayudar al paciente a identificarlas</li>
        <li>📝 Añadir instrucciones claras de toma</li>
      </ul>
      <div style="background:var(--amarillo-cl);border:1px solid #fde047;border-radius:var(--r-sm);padding:.875rem;margin-top:.875rem">
        <p style="font-size:.875rem;color:#92400e;font-weight:700">⚠️ Las fotos son especialmente importantes para adultos mayores con múltiples medicamentos.</p>
      </div>`
  },
  {
    icono: '📊',
    titulo: 'Panel de Monitoreo en Tiempo Real',
    desc: 'Supervisa la adherencia con datos actualizados al instante.',
    html: `
      <p style="color:var(--g600);margin-bottom:.875rem">El <strong>Panel de Monitoreo</strong> incluye:</p>
      <ul style="display:flex;flex-direction:column;gap:.625rem;color:var(--g600);font-size:.95rem">
        <li>📈 Porcentaje de adherencia del día, semana y mes</li>
        <li>✅❌ Lista detallada de tomadas y omitidas</li>
        <li>📅 Calendario visual con colores por nivel de adherencia</li>
        <li>📊 Gráficas de barras y líneas de tendencia</li>
      </ul>`
  },
  {
    icono: '📄',
    titulo: 'Exporta Reportes Médicos',
    desc: 'Genera documentos profesionales para compartir con el médico.',
    html: `
      <p style="color:var(--g600);margin-bottom:.875rem">Formatos disponibles:</p>
      <ul style="display:flex;flex-direction:column;gap:.625rem;color:var(--g600);font-size:.95rem">
        <li>📕 <strong>PDF</strong> — Reporte profesional con resumen y detalle diario</li>
        <li>📄 <strong>TXT</strong> — Texto plano para cualquier dispositivo</li>
        <li>📊 <strong>CSV</strong> — Compatible con Excel para análisis avanzado</li>
      </ul>
      <div style="background:var(--verde-cl);border-radius:var(--r-sm);padding:.875rem;margin-top:.875rem">
        <p style="font-size:.875rem;color:#15803d;font-weight:700">✅ ¡Ya estás listo! Haz clic en "¡Comenzar!" para ir al Panel de Monitoreo.</p>
      </div>`
  },
];

let pasoActual = 0;
let pasosActuales = [];

function mostrarTutorial() {
  const perfil = Sesion.perfilCache();
  if (!perfil) return;
  const clave = `mr_tutorial_${perfil.id}`;
  if (localStorage.getItem(clave)) return;

  pasosActuales = perfil.role === 'caregiver' ? PASOS_CUIDADOR : PASOS_PACIENTE;
  pasoActual = 0;
  construirPanel();
  renderizarPaso();
  document.getElementById('tut-overlay').style.display = 'flex';
}

function construirPanel() {
  // Quitar si ya existe
  const viejo = document.getElementById('tut-overlay');
  if (viejo) viejo.remove();

  const overlay = document.createElement('div');
  overlay.id = 'tut-overlay';
  overlay.className = 'tut-fondo';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Tutorial de bienvenida');
  overlay.innerHTML = `
    <div class="tut-panel">
      <div class="tut-header">
        <button class="tut-close" onclick="cerrarTutorial()" aria-label="Cerrar tutorial">✕</button>
        <div class="tut-icon-row">
          <div class="tut-icon-box" id="tut-icono" aria-hidden="true"></div>
          <div>
            <p class="tut-step-title" id="tut-titulo"></p>
            <p class="tut-step-desc"  id="tut-desc"></p>
          </div>
        </div>
        <div class="tut-bars" id="tut-barras" role="progressbar" aria-label="Progreso del tutorial"></div>
      </div>
      <div class="tut-body" id="tut-cuerpo"></div>
      <div class="tut-foot">
        <span class="tut-count" id="tut-contador"></span>
        <div class="tut-btns">
          <button class="btn btn-borde btn-sm" id="tut-btn-ant" onclick="pasoAnterior()" style="display:none" aria-label="Paso anterior">◀ Anterior</button>
          <button class="btn btn-sm"           id="tut-btn-sig" onclick="pasoSiguiente()" aria-label="Siguiente paso">Siguiente ▶</button>
        </div>
      </div>
      <div class="tut-skip">
        <button onclick="cerrarTutorial()" aria-label="Saltar tutorial">Saltar tutorial</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

function renderizarPaso() {
  const paso = pasosActuales[pasoActual];
  document.getElementById('tut-icono').textContent   = paso.icono;
  document.getElementById('tut-titulo').textContent  = paso.titulo;
  document.getElementById('tut-desc').textContent    = paso.desc;
  document.getElementById('tut-cuerpo').innerHTML    = paso.html;
  document.getElementById('tut-contador').textContent= `Paso ${pasoActual + 1} de ${pasosActuales.length}`;

  // Barras de progreso
  document.getElementById('tut-barras').innerHTML = pasosActuales
    .map((_, i) => `<div class="tut-bar${i <= pasoActual ? ' done' : ''}"></div>`)
    .join('');

  // Botones
  const esUltimo = pasoActual === pasosActuales.length - 1;
  const btnAnt   = document.getElementById('tut-btn-ant');
  const btnSig   = document.getElementById('tut-btn-sig');
  btnAnt.style.display = pasoActual > 0 ? 'inline-flex' : 'none';
  btnSig.textContent   = esUltimo ? '✅ ¡Comenzar!' : 'Siguiente ▶';
  btnSig.className     = `btn btn-sm ${esUltimo ? 'btn-verde' : 'btn-azul'}`;
}

function pasoSiguiente() {
  if (pasoActual < pasosActuales.length - 1) { pasoActual++; renderizarPaso(); }
  else cerrarTutorial();
}

function pasoAnterior() {
  if (pasoActual > 0) { pasoActual--; renderizarPaso(); }
}

function cerrarTutorial() {
  const perfil = Sesion.perfilCache();
  if (perfil) localStorage.setItem(`mr_tutorial_${perfil.id}`, '1');
  const overlay = document.getElementById('tut-overlay');
  if (overlay) overlay.remove();
}
