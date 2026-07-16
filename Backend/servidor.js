require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const cron       = require('node-cron');
const { Pool }   = require('pg');
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

// ══════════════════════════════════════════════════════════
//  POOL DE CONEXIÓN — Supabase Session Pooler (puerto 5432)
// ══════════════════════════════════════════════════════════
const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NOMBRE,
  user:     process.env.DB_USUARIO,
  password: process.env.DB_PASSWORD,
  ssl:      { rejectUnauthorized: false },
  max:      10,
  idleTimeoutMillis:    30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('❌ Error inesperado en el pool:', err.message);
});

function hoyLima() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
}
function haceDiasLima(dias) {
  const [y, m, d] = hoyLima().split('-').map(Number);
  const base = new Date(y, m - 1, d);
  base.setDate(base.getDate() - dias);
  const yy = base.getFullYear();
  const mm = String(base.getMonth() + 1).padStart(2, '0');
  const dd = String(base.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

// Verificar conexión al arrancar
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ No se pudo conectar a Supabase:', err.message);
  } else {
    console.log('✅ Conectado a Supabase:', res.rows[0].now);
  }
});

// ══════════════════════════════════════════════════════════
//  APP EXPRESS
// ══════════════════════════════════════════════════════════
const app   = express();
const PORT  = process.env.PORT || 3001;

// ── Seguridad ──────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));

const origenesPermitidos = [
  process.env.FRONTEND_URL,
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || origenesPermitidos.includes(origin)) return cb(null, true);
    cb(new Error('CORS: origen no permitido — ' + origin));
  },
  credentials: true,
}));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes, intenta en 15 minutos' },
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// ══════════════════════════════════════════════════════════
//  MIDDLEWARE — Autenticación JWT
// ══════════════════════════════════════════════════════════
async function autenticar(req, res, next) {
  const cabecera = req.headers.authorization;
  if (!cabecera || !cabecera.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }
  const token = cabecera.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await pool.query(
      'SELECT id, full_name, email, role, independent_mode FROM profiles WHERE id = $1',
      [payload.userId]
    );
    if (!rows.length) return res.status(401).json({ error: 'Usuario no encontrado' });
    req.usuario = rows[0];
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

function generarToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function fmtUsuario(u) {
  return {
    id:              u.id,
    name:            u.full_name,
    full_name:       u.full_name,
    email:           u.email,
    role:            u.role,
    independentMode: u.independent_mode,
  };
}

// ══════════════════════════════════════════════════════════
//  RUTAS — AUTH (públicas)
// ══════════════════════════════════════════════════════════

// POST /api/auth/registro
app.post('/api/auth/registro', async (req, res) => {
 const { name, email, password, role = 'patient', independentMode = false, patientEmail } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios' });
  if (password.length < 6)
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  if (!['patient','caregiver'].includes(role))
    return res.status(400).json({ error: 'Rol inválido' });
  try {
    const existe = await pool.query('SELECT id FROM profiles WHERE email = $1', [email]);
    if (existe.rows.length) return res.status(409).json({ error: 'El correo ya está registrado' });

    const hash = await bcrypt.hash(password, 10);
    const id   = uuidv4();

    await pool.query(
      `INSERT INTO profiles (id, full_name, email, password_hash, role, independent_mode)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, name, email, hash, role, independentMode]
    );
   await pool.query(
      'INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING',
      [id]
    );

    // Si es cuidador y trae email del paciente, vincular automáticamente
    if (role === 'caregiver' && patientEmail) {
      const pac = await pool.query(
        'SELECT id FROM profiles WHERE email=$1 AND role=$2',
        [patientEmail.toLowerCase(), 'patient']
      );
      if (pac.rows.length) {
        await pool.query(
          `INSERT INTO patient_caregiver_relationships (patient_id, caregiver_id, status)
           VALUES ($1,$2,'active') ON CONFLICT (patient_id, caregiver_id) DO NOTHING`,
          [pac.rows[0].id, id]
        );
      }
    }

    const { rows } = await pool.query(
      'SELECT id, full_name, email, role, independent_mode FROM profiles WHERE id = $1', [id]
    );
    // Enviar correo de bienvenida
    try {
      await resend.emails.send({
        from:    'MediReminder <onboarding@resend.dev>',
        to:      'alonso.dioses02@gmail.com',
        subject: `💊 Bienvenido/a ${name} — MediReminder`,
        html:    `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:2rem">
            <h2 style="color:#3b82f6">💊 MediReminder</h2>
            <p>Hola <strong>${name}</strong>, ¡bienvenido/a!</p>
            <p>Tu cuenta ha sido creada exitosamente como <strong>${role === 'patient' ? '🏥 Paciente' : '👨‍⚕️ Cuidador'}</strong>.</p>
            <div style="background:#eff6ff;border-radius:12px;padding:1.25rem;margin:1.5rem 0">
              <p style="font-weight:800;color:#1e40af;margin-bottom:.5rem">¿Qué puedes hacer ahora?</p>
              <ul style="color:#3730a3;font-size:.9rem;line-height:1.8">
                ${role === 'patient' ? `
                <li>💊 Agregar tus medicamentos y horarios</li>
                <li>🔔 Recibir alertas cuando sea hora de tomarlos</li>
                <li>📊 Ver tu historial de adherencia</li>
                ` : `
                <li>🔗 Vincular al paciente que vas a monitorear</li>
                <li>👁️ Ver su historial y adherencia en tiempo real</li>
                <li>💊 Agregarle medicamentos desde tu cuenta</li>
                `}
              </ul>
            </div>
            <a href="https://medi-reminder-eight.vercel.app" style="display:inline-block;background:#3b82f6;color:#fff;font-weight:800;padding:.75rem 2rem;border-radius:8px;text-decoration:none">
              Ir a MediReminder →
            </a>
            <p style="color:#9ca3af;font-size:.78rem;margin-top:2rem">
              Si no creaste esta cuenta, ignora este correo.
            </p>
          </div>`
      });
    } catch { /* No bloquear registro si falla el correo */ }

    res.status(201).json({ token: generarToken(id), user: fmtUsuario(rows[0]) });
  } catch (err) {
    console.error('Error registro:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/auth/demo-logout — limpia datos del demo al salir
app.post('/api/auth/demo-logout', autenticar, async (req, res) => {
  const demosEmails = ['demo.paciente@medireminder.app', 'demo.familiar@medireminder.app'];
  if (!demosEmails.includes(req.usuario.email)) {
    return res.status(403).json({ error: 'Solo para usuarios demo' });
  }
  try {
    // Limpiar medicines y logs del paciente demo
    const pacDemo = await pool.query(
      `SELECT id FROM profiles WHERE email='demo.paciente@medireminder.app'`
    );
    if (pacDemo.rows.length) {
      const pid = pacDemo.rows[0].id;
      await pool.query(`DELETE FROM medicine_logs WHERE user_id=$1`, [pid]);
      await pool.query(`DELETE FROM medicines WHERE user_id=$1`, [pid]);
      await pool.query(
        `UPDATE user_settings SET sound_enabled=true, color_scheme='blue', 
         notification_minutes_before=5 WHERE user_id=$1`, [pid]
      );
      // Restaurar medicina demo base
      await pool.query(
        `INSERT INTO medicines (user_id, name, dosage, schedule_times, status, instructions)
         VALUES ($1,'Paracetamol Demo','500mg',ARRAY['08:00','20:00'],'active','Medicina de ejemplo')`,
        [pid]
      );
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/auth/login

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email y contraseña son obligatorios' });
  try {
    const { rows } = await pool.query(
      'SELECT id, full_name, email, password_hash, role, independent_mode FROM profiles WHERE email = $1',
      [email]
    );
    if (!rows.length) return res.status(401).json({ error: 'Credenciales inválidas' });
    const u = rows[0];
    const ok = await bcrypt.compare(password, u.password_hash || '');
    if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });
    res.json({ token: generarToken(u.id), user: fmtUsuario(u) });
  } catch (err) {
    console.error('Error login:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});
// POST /api/auth/recuperar — enviar email con código
app.post('/api/auth/recuperar', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requerido' });
  try {
    const { rows } = await pool.query(
      'SELECT id, full_name FROM profiles WHERE email=$1', [email.toLowerCase()]
    );
    if (!rows.length) return res.json({ ok: true }); // No revelar si existe

    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const expira = new Date(Date.now() + 15 * 60000); // 15 minutos

    await pool.query(
      `UPDATE profiles SET reset_code=$1, reset_code_expires=$2 WHERE email=$3`,
      [codigo, expira, email.toLowerCase()]
    );

    await resend.emails.send({
      from:    'MediReminder <onboarding@resend.dev>',
      to:      ['alonso.dioses02@gmail.com', email].filter((v,i,a)=>a.indexOf(v)===i),
      subject: `🔑 Código para ${email} — MediReminder`,
      html:    `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:2rem">
          <h2 style="color:#3b82f6">💊 MediReminder</h2>
          <p>Hola <strong>${rows[0].full_name}</strong>,</p>
          <p>Tu código de recuperación es:</p>
          <div style="font-size:2.5rem;font-weight:900;letter-spacing:.5rem;color:#1e40af;background:#eff6ff;padding:1.5rem;border-radius:12px;text-align:center;margin:1.5rem 0">
            ${codigo}
          </div>
          <p style="color:#6b7280;font-size:.875rem">Este código expira en <strong>15 minutos</strong>.</p>
          <p style="color:#6b7280;font-size:.875rem">Si no solicitaste esto, ignora este correo.</p>
        </div>`
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('Error recuperar:', err.message);
    res.status(500).json({ error: 'Error al enviar el correo' });
  }
});

// POST /api/auth/reset — verificar código y cambiar contraseña
app.post('/api/auth/reset', async (req, res) => {
  const { email, codigo, nuevaPassword } = req.body;
  if (!email || !codigo || !nuevaPassword)
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  if (nuevaPassword.length < 6)
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  try {
    const { rows } = await pool.query(
      `SELECT id, reset_code, reset_code_expires FROM profiles WHERE email=$1`,
      [email.toLowerCase()]
    );
    if (!rows.length) return res.status(400).json({ error: 'Código inválido' });
    const u = rows[0];
    if (u.reset_code !== codigo) return res.status(400).json({ error: 'Código incorrecto' });
    if (new Date() > new Date(u.reset_code_expires)) return res.status(400).json({ error: 'Código expirado' });

    const hash = await bcrypt.hash(nuevaPassword, 10);
    await pool.query(
      `UPDATE profiles SET password_hash=$1, reset_code=NULL, reset_code_expires=NULL WHERE id=$2`,
      [hash, u.id]
    );
    res.json({ ok: true, mensaje: 'Contraseña actualizada correctamente' });
  } catch (err) {
    console.error('Error reset:', err.message);
    res.status(500).json({ error: 'Error al actualizar contraseña' });
  }
});

// PUT /api/auth/cambiar-password
app.put('/api/auth/cambiar-password', autenticar, async (req, res) => {
  const { passwordActual, nuevaPassword } = req.body;
  if (!passwordActual || !nuevaPassword)
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  if (nuevaPassword.length < 6)
    return res.status(400).json({ error: 'Mínimo 6 caracteres' });
  try {
    const { rows } = await pool.query(
      'SELECT password_hash FROM profiles WHERE id=$1', [req.usuario.id]
    );
    const ok = await bcrypt.compare(passwordActual, rows[0].password_hash || '');
    if (!ok) return res.status(400).json({ error: 'Contraseña actual incorrecta' });
    const hash = await bcrypt.hash(nuevaPassword, 10);
    await pool.query('UPDATE profiles SET password_hash=$1 WHERE id=$2', [hash, req.usuario.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }

});

// PUT /api/auth/cambiar-modo
app.put('/api/auth/cambiar-modo', autenticar, async (req, res) => {
  const { independentMode } = req.body;
  try {
    await pool.query(
      'UPDATE profiles SET independent_mode=$1 WHERE id=$2',
      [independentMode, req.usuario.id]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// GET /api/paciente/datos — cuidador obtiene datos de su paciente vinculado
app.get('/api/paciente/datos', autenticar, async (req, res) => {
  try {
    const rel = await pool.query(
      `SELECT patient_id FROM patient_caregiver_relationships
       WHERE caregiver_id=$1 AND status='active' LIMIT 1`,
      [req.usuario.id]
    );
    if (!rel.rows.length) return res.status(404).json({ error: 'Sin paciente vinculado' });
    const patientId = rel.rows[0].patient_id;

    const [perfil, meds, logs] = await Promise.all([
      pool.query('SELECT id, full_name, email, independent_mode FROM profiles WHERE id=$1', [patientId]),
      pool.query(`SELECT id, name, dosage, schedule_times AS times, instructions, image_url AS "imageUrl", (status='active') AS active FROM medicines WHERE user_id=$1 AND status='active'`, [patientId]),
      pool.query(`SELECT ml.id, ml.medicine_id AS "medicineId", m.name AS "medicineName",
                  ml.scheduled_date::text AS date, LEFT(ml.scheduled_time::text,5) AS "scheduledTime",
                  to_char(ml.taken_at AT TIME ZONE 'America/Lima','HH24:MI') AS "takenTime", ml.status
                  FROM medicine_logs ml JOIN medicines m ON m.id=ml.medicine_id
                  WHERE ml.user_id=$1 AND ml.scheduled_date >= CURRENT_DATE - INTERVAL '30 days'
                  ORDER BY ml.scheduled_date DESC, ml.scheduled_time ASC`, [patientId])
    ]);

    res.json({
      patient: perfil.rows[0],
      medicines: meds.rows,
      logs: logs.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});




// GET /api/auth/perfil

app.get('/api/auth/perfil', autenticar, async (req, res) => {
  try {
    const u = fmtUsuario(req.usuario);
    if (req.usuario.role === 'patient') {
      const { rows: cuidadores } = await pool.query(
        `SELECT p.full_name FROM patient_caregiver_relationships r
         JOIN profiles p ON p.id = r.caregiver_id
         WHERE r.patient_id=$1 AND r.status='active' LIMIT 1`,
        [req.usuario.id]
      );
      u.caregiverName = cuidadores[0]?.full_name || null;
    }
    if (req.usuario.role === 'caregiver') {
      const { rows } = await pool.query(
        `SELECT p.id, p.full_name, p.email
         FROM patient_caregiver_relationships r
         JOIN profiles p ON p.id = r.patient_id
         WHERE r.caregiver_id=$1 AND r.status='active'
         LIMIT 1`,
        [req.usuario.id]
      );
      u.patientLinked = rows[0] || null;
    }
    res.json(u);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════
//  RUTAS — MEDICAMENTOS (protegidas)
// ══════════════════════════════════════════════════════════

// GET /api/medicamentos
app.get('/api/medicamentos', autenticar, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, dosage,
              schedule_times  AS times,
              instructions,
              image_url       AS "imageUrl",
              (status = 'active') AS active
       FROM medicines WHERE user_id = $1 ORDER BY created_at ASC`,
      [req.usuario.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error al obtener medicamentos' });
  }
});

// POST /api/medicamentos
app.post('/api/medicamentos', autenticar, async (req, res) => {
  const { name, dosage, times = [], instructions, imageUrl, active = true, startDate } = req.body;
  if (!name || !dosage)  return res.status(400).json({ error: 'Nombre y dosis son obligatorios' });
  if (!times.length)     return res.status(400).json({ error: 'Se requiere al menos un horario' });

  // Si es cuidador, insertar la medicina para su paciente vinculado
  let targetUserId = req.usuario.id;
  if (req.usuario.role === 'caregiver') {
    const rel = await pool.query(
      `SELECT patient_id FROM patient_caregiver_relationships WHERE caregiver_id=$1 AND status='active' LIMIT 1`,
      [req.usuario.id]
    );
    if (rel.rows.length) targetUserId = rel.rows[0].patient_id;
  }
// cron
  try {
    const { rows } = await pool.query(
      `INSERT INTO medicines (user_id, name, dosage, schedule_times, instructions, image_url, status, start_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, name, dosage,
                 schedule_times AS times, instructions,
                 image_url AS "imageUrl",
                 (status='active') AS active`,
      [targetUserId, name, dosage, times, instructions || null,
       imageUrl || null, active ? 'active' : 'inactive', startDate || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error al crear medicamento' });
  }
});

// PUT /api/medicamentos/:id
app.put('/api/medicamentos/:id', autenticar, async (req, res) => {
  const { id } = req.params;
  const { name, dosage, times, instructions, imageUrl, active } = req.body;
  try {
    const chk = await pool.query(
      'SELECT id FROM medicines WHERE id=$1 AND user_id=$2', [id, req.usuario.id]
    );
    if (!chk.rows.length) return res.status(404).json({ error: 'Medicamento no encontrado' });

    const { rows } = await pool.query(
      `UPDATE medicines SET
         name         = COALESCE($1, name),
         dosage       = COALESCE($2, dosage),
         schedule_times = COALESCE($3, schedule_times),
         instructions = COALESCE($4, instructions),
         image_url    = COALESCE($5, image_url),
         status       = COALESCE($6, status),
         updated_at   = NOW()
       WHERE id=$7
       RETURNING id, name, dosage,
                 schedule_times AS times, instructions,
                 image_url AS "imageUrl",
                 (status='active') AS active`,
      [name||null, dosage||null, times||null, instructions||null, imageUrl||null,
       active !== undefined ? (active ? 'active' : 'inactive') : null, id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error al actualizar medicamento' });
  }
});

// DELETE /api/medicamentos/:id
app.delete('/api/medicamentos/:id', autenticar, async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM medicines WHERE id=$1 AND user_id=$2', [req.params.id, req.usuario.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Medicamento no encontrado' });
    res.json({ mensaje: 'Medicamento eliminado' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error al eliminar medicamento' });
  }
});

// ══════════════════════════════════════════════════════════
//  RUTAS — REGISTROS DE TOMA (protegidas)
// ══════════════════════════════════════════════════════════

// GET /api/registros?days=30&date=YYYY-MM-DD
app.get('/api/registros', autenticar, async (req, res) => {
  const { days, date } = req.query;
  try {
    let q, p;
    if (date) {
      q = `SELECT ml.id,
                  ml.medicine_id    AS "medicineId",
                  m.name            AS "medicineName",
                  ml.scheduled_date::text AS date,
                  LEFT(ml.scheduled_time::text, 5) AS "scheduledTime",
                  to_char(ml.taken_at AT TIME ZONE 'America/Lima','HH24:MI') AS "takenTime",
                  ml.status
           FROM medicine_logs ml
           JOIN medicines m ON m.id = ml.medicine_id
           WHERE ml.user_id=$1 AND ml.scheduled_date=$2
           ORDER BY ml.scheduled_time ASC`;
      p = [req.usuario.id, date];
    } else {
      const d = parseInt(days || '30');
      q = `SELECT ml.id,
                  ml.medicine_id    AS "medicineId",
                  m.name            AS "medicineName",
                  ml.scheduled_date::text AS date,
                  LEFT(ml.scheduled_time::text, 5) AS "scheduledTime",
                  to_char(ml.taken_at AT TIME ZONE 'America/Lima','HH24:MI') AS "takenTime",
                  ml.status
           FROM medicine_logs ml
           JOIN medicines m ON m.id = ml.medicine_id
           WHERE ml.user_id=$1
             AND ml.scheduled_date >= CURRENT_DATE - INTERVAL '1 day' * $2
           ORDER BY ml.scheduled_date DESC, ml.scheduled_time ASC`;
      p = [req.usuario.id, d];
    }
    const { rows } = await pool.query(q, p);
    res.json(rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error al obtener registros' });
  }
});

// POST /api/registros/generar-hoy
app.post('/api/registros/generar-hoy', autenticar, async (req, res) => {
  try {
    await generarRegistrosHoy(req.usuario.id);
    res.json({ mensaje: 'Registros del día generados correctamente' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error al generar registros' });
  }
});

// PATCH /api/registros/:id/tomado
app.patch('/api/registros/:id/tomado', autenticar, async (req, res) => {
  try {
    const { rows, rowCount } = await pool.query(
      `UPDATE medicine_logs
       SET status='taken', taken_at=NOW(), updated_at=NOW()
       WHERE id=$1 AND user_id=$2
       RETURNING id, status,
                 to_char(taken_at AT TIME ZONE 'America/Lima','HH24:MI') AS "takenTime"`,
      [req.params.id, req.usuario.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Registro no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error al actualizar registro' });
  }
});

// PATCH /api/registros/:id/omitido
app.patch('/api/registros/:id/omitido', autenticar, async (req, res) => {
  try {
    const { rows, rowCount } = await pool.query(
      `UPDATE medicine_logs SET status='missed', updated_at=NOW()
       WHERE id=$1 AND user_id=$2 RETURNING id, status`,
      [req.params.id, req.usuario.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Registro no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error al actualizar registro' });
  }
});

// ══════════════════════════════════════════════════════════
//  RUTAS — CONTACTOS DE EMERGENCIA (protegidas)
// ══════════════════════════════════════════════════════════

// GET /api/contactos
app.get('/api/contactos', autenticar, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, relationship, phone, is_primary AS "isPrimary"
       FROM emergency_contacts WHERE user_id=$1
       ORDER BY is_primary DESC, name ASC`,
      [req.usuario.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error al obtener contactos' });
  }
});

// POST /api/contactos
app.post('/api/contactos', autenticar, async (req, res) => {
  const { name, relationship, phone, isPrimary = false } = req.body;
  if (!name || !phone) return res.status(400).json({ error: 'Nombre y teléfono son obligatorios' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO emergency_contacts (user_id, name, relationship, phone, is_primary)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, name, relationship, phone, is_primary AS "isPrimary"`,
      [req.usuario.id, name, relationship || '', phone, isPrimary]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error al crear contacto' });
  }
});

// PUT /api/contactos/:id
app.put('/api/contactos/:id', autenticar, async (req, res) => {
  const { name, relationship, phone, isPrimary } = req.body;
  try {
    const { rows, rowCount } = await pool.query(
      `UPDATE emergency_contacts SET
         name         = COALESCE($1, name),
         relationship = COALESCE($2, relationship),
         phone        = COALESCE($3, phone),
         is_primary   = COALESCE($4, is_primary),
         updated_at   = NOW()
       WHERE id=$5 AND user_id=$6
       RETURNING id, name, relationship, phone, is_primary AS "isPrimary"`,
      [name||null, relationship||null, phone||null,
       isPrimary !== undefined ? isPrimary : null,
       req.params.id, req.usuario.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Contacto no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error al actualizar contacto' });
  }
});

// DELETE /api/contactos/:id
app.delete('/api/contactos/:id', autenticar, async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM emergency_contacts WHERE id=$1 AND user_id=$2',
      [req.params.id, req.usuario.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Contacto no encontrado' });
    res.json({ mensaje: 'Contacto eliminado' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error al eliminar contacto' });
  }
}); 
// ── Vincular paciente (cuidador busca por email) ────────────
app.get('/api/pacientes/buscar', autenticar, async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'Email requerido' });
  try {
    const r = await pool.query(
      'SELECT id, full_name, email FROM profiles WHERE email=$1 AND role=$2',
      [email.toLowerCase(), 'patient']
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Paciente no encontrado' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});


app.post('/api/pacientes/vincular', autenticar, async (req, res) => {
  const { patientId } = req.body;
  if (!patientId) return res.status(400).json({ error: 'patientId requerido' });
  try {
    await pool.query(
      `INSERT INTO patient_caregiver_relationships (patient_id, caregiver_id, status)
       VALUES ($1, $2, 'active') ON CONFLICT (patient_id, caregiver_id) DO NOTHING`,
      [patientId, req.usuario.id]
    );
    const p = await pool.query('SELECT id, full_name, email FROM profiles WHERE id=$1', [patientId]);
    res.json({ ok: true, patient: p.rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// DELETE /api/pacientes/desvincular — cuidador desvincula y limpia historial
app.delete('/api/pacientes/desvincular', autenticar, async (req, res) => {
  try {
    const rel = await pool.query(
      `SELECT patient_id FROM patient_caregiver_relationships WHERE caregiver_id=$1 AND status='active' LIMIT 1`,
      [req.usuario.id]
    );
    if (!rel.rows.length) return res.status(404).json({ error: 'Sin paciente vinculado' });
    const patientId = rel.rows[0].patient_id;

    // Eliminar historial del paciente
    await pool.query(`DELETE FROM medicine_logs WHERE user_id=$1`, [patientId]);
    await pool.query(`DELETE FROM medicines WHERE user_id=$1`, [patientId]);
    await pool.query(`DELETE FROM emergency_contacts WHERE user_id=$1`, [patientId]);
    await pool.query(`DELETE FROM user_settings WHERE user_id=$1`, [patientId]);
    await pool.query(`INSERT INTO user_settings (user_id) VALUES ($1)`, [patientId]);
    // Desvincular relación
    await pool.query(
      `DELETE FROM patient_caregiver_relationships WHERE caregiver_id=$1` ,
      [req.usuario.id]
    );
    res.json({ ok: true, mensaje: 'Paciente desvinculado y cuenta reseteada' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════
//  RUTAS — AJUSTES (protegidas)
// ══════════════════════════════════════════════════════════

// GET /api/ajustes
app.get('/api/ajustes', autenticar, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT sound_enabled               AS "soundEnabled",
              notification_minutes_before AS "notificationMinutesBefore",
              color_scheme                AS theme
       FROM user_settings WHERE user_id=$1`,
      [req.usuario.id]
    );
    res.json(rows[0] || { soundEnabled: true, notificationMinutesBefore: 5, theme: 'blue' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error al obtener ajustes' });
  }
});

// PUT /api/ajustes
app.put('/api/ajustes', autenticar, async (req, res) => {
  const { soundEnabled, notificationMinutesBefore, theme } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO user_settings (user_id, sound_enabled, notification_minutes_before, color_scheme, updated_at)
       VALUES ($1,$2,$3,$4,NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         sound_enabled               = COALESCE($2, user_settings.sound_enabled),
         notification_minutes_before = COALESCE($3, user_settings.notification_minutes_before),
         color_scheme                = COALESCE($4, user_settings.color_scheme),
         updated_at                  = NOW()
       RETURNING sound_enabled               AS "soundEnabled",
                 notification_minutes_before AS "notificationMinutesBefore",
                 color_scheme                AS theme`,
      [req.usuario.id,
       soundEnabled !== undefined ? soundEnabled : null,
       notificationMinutesBefore !== undefined ? notificationMinutesBefore : null,
       theme || null]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error al guardar ajustes' });
  }
});

// ══════════════════════════════════════════════════════════
//  FUNCIÓN AUXILIAR — Generar registros del día
// ══════════════════════════════════════════════════════════
async function generarRegistrosHoy(userId) {
  const hoy = hoyLima();
  const { rows: meds } = await pool.query(
    `SELECT id, schedule_times FROM medicines
     WHERE user_id=$1 AND status='active'
       AND (start_date IS NULL OR start_date <= $2)`,
    [userId, hoy]
  );
  for (const med of meds) {
    for (const hora of med.schedule_times) {
      await pool.query(
        `INSERT INTO medicine_logs
           (medicine_id, user_id, scheduled_date, scheduled_time, status)
         VALUES ($1,$2,$3,$4::time,'pending')
         ON CONFLICT (medicine_id, scheduled_date, scheduled_time) DO NOTHING`,
        [med.id, userId, hoy, hora]
      );
    }
  }
}

// ══════════════════════════════════════════════════════════
//  CRON — Genera registros automáticos cada día a medianoche
// ══════════════════════════════════════════════════════════
cron.schedule('0 0 * * *', async () => {
  console.log('[Cron] Generando registros del día para todos los usuarios...');
  try {
    const { rows: users } = await pool.query(
      `SELECT DISTINCT user_id FROM medicines WHERE status='active'`
    );
    for (const u of users) {
      await generarRegistrosHoy(u.user_id);
    }
    console.log(`[Cron] ✅ Registros generados para ${users.length} usuario(s)`);
  } catch (err) {
    console.error('[Cron] ❌ Error:', err.message);
  }
}, { timezone: 'America/Lima' });
// ── Resumen semanal — todos los lunes a las 8am hora Lima ──
cron.schedule('0 8 * * 1', async () => {
  console.log('[Cron] Enviando resúmenes semanales...');
  try {
    const { rows: users } = await pool.query(
      `SELECT p.id, p.full_name, p.email
       FROM profiles p
       WHERE p.role = 'patient'`
    );
    for (const u of users) {
      try {
        const fechaInicio = haceDiasLima(7);
        const { rows: logs } = await pool.query(
          `SELECT ml.status FROM medicine_logs ml
           WHERE ml.user_id=$1
             AND ml.scheduled_date >= $2
             AND ml.status != 'pending'`,
          [u.id, fechaInicio]
        );

        if (!logs.length) continue;

        const tomadas  = logs.filter(l => l.status === 'taken').length;
        const omitidas = logs.filter(l => l.status === 'missed').length;
        const total    = logs.length;
        const adh      = Math.round((tomadas / total) * 100);
        const emoji    = adh >= 80 ? '🟢' : adh >= 50 ? '🟡' : '🔴';

        await resend.emails.send({
          from:    'MediReminder <onboarding@resend.dev>',
          to:      u.email,
          subject: `📊 Tu resumen semanal — MediReminder`,
          html:    `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:2rem">
              <h2 style="color:#3b82f6">💊 MediReminder</h2>
              <p>Hola <strong>${u.full_name}</strong>, aquí está tu resumen de la semana:</p>
              <div style="background:#eff6ff;border-radius:12px;padding:1.5rem;margin:1.5rem 0;text-align:center">
                <p style="font-size:3rem;margin:0">${emoji}</p>
                <p style="font-size:2.5rem;font-weight:900;color:#1e40af;margin:.5rem 0">${adh}%</p>
                <p style="color:#3b82f6;font-weight:700">Adherencia semanal</p>
              </div>
              <table style="width:100%;border-collapse:collapse;font-size:.9rem">
                <tr style="background:#f1f5f9">
                  <td style="padding:.625rem 1rem;border-radius:6px">✅ Tomadas</td>
                  <td style="padding:.625rem 1rem;font-weight:800;text-align:right">${tomadas}</td>
                </tr>
                <tr>
                  <td style="padding:.625rem 1rem">❌ Omitidas</td>
                  <td style="padding:.625rem 1rem;font-weight:800;text-align:right">${omitidas}</td>
                </tr>
                <tr style="background:#f1f5f9">
                  <td style="padding:.625rem 1rem;border-radius:6px">📋 Total programadas</td>
                  <td style="padding:.625rem 1rem;font-weight:800;text-align:right">${total}</td>
                </tr>
              </table>
              <div style="margin-top:1.5rem;text-align:center">
                <a href="https://medi-reminder-eight.vercel.app/monitoreo.html"
                   style="background:#3b82f6;color:#fff;font-weight:800;padding:.75rem 2rem;border-radius:8px;text-decoration:none">
                  Ver historial completo →
                </a>
              </div>
              <p style="color:#9ca3af;font-size:.75rem;margin-top:2rem;text-align:center">
                MediReminder — Mejorando la adherencia a tratamientos médicos
              </p>
            </div>`
        });
      } catch { /* silencioso por usuario */ }
    }
    console.log(`[Cron] ✅ Resúmenes enviados a ${users.length} usuario(s)`);
  } catch (err) {
    console.error('[Cron] ❌ Error resumen semanal:', err.message);
  }
}, { timezone: 'America/Lima' });

// ══════════════════════════════════════════════════════════
//  HEALTH CHECK Y RUTAS GENÉRICAS
// ══════════════════════════════════════════════════════════
app.get('/health', (_req, res) => {
  res.json({ estado: 'activo', hora: new Date().toISOString(), entorno: process.env.NODE_ENV });
});

app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

app.use((err, _req, res, _next) => {
  console.error('Error no controlado:', err.message);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ══════════════════════════════════════════════════════════
//  ARRANCAR SERVIDOR
// ══════════════════════════════════════════════════════════
app.listen(PORT, () => {
  console.log(`\n💊  MediReminder Backend → http://localhost:${PORT}`);
  console.log(`🗄️   DB Host : ${process.env.DB_HOST}:${process.env.DB_PORT}`);
  console.log(`🔌  API     → http://localhost:${PORT}/api`);
  console.log(`❤️   Health  → http://localhost:${PORT}/health`);
  console.log(`🌍  Entorno : ${process.env.NODE_ENV}\n`);
});

module.exports = app;


