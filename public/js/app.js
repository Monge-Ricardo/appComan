/* ==========================================================================
   LOGICA DEL CLIENTE (FRONTEND SPA) - COMANDANTE DRUM PADS
   ========================================================================== */

let studentsList = [];
let logsHistory = [];
let isTouchDevice = false;

// Configuración de colores neón por grupos para simular Electro Drum Pads 24
const COLOR_CLASSES = [
  'pad-color-cyan',   // Alumnos 1-3
  'pad-color-purple', // Alumnos 4-6
  'pad-color-pink',   // Alumnos 7-9
  'pad-color-orange', // Alumnos 10-12
  'pad-color-green',  // Alumnos 13-15
  'pad-color-gold'    // Alumnos 16-17
];

function getPadColorClass(index) {
  const group = Math.floor(index / 3);
  return COLOR_CLASSES[Math.min(group, COLOR_CLASSES.length - 1)];
}

// Inicialización de la Aplicación
document.addEventListener('DOMContentLoaded', () => {
  // Detectar si el dispositivo es tactil
  window.addEventListener('touchstart', function detectTouch() {
    isTouchDevice = true;
    window.removeEventListener('touchstart', detectTouch);
  }, false);

  // Inicializar interfaz de sonido
  const volumeToggle = document.getElementById('volume-toggle');
  const volumeIcon = document.getElementById('volume-icon');
  
  if (DrumAudio.enabled) {
    volumeToggle.classList.remove('muted');
    volumeIcon.className = 'fa-solid fa-volume-high';
  } else {
    volumeToggle.classList.add('muted');
    volumeIcon.className = 'fa-solid fa-volume-xmark';
  }

  volumeToggle.addEventListener('click', () => {
    const isEnabled = DrumAudio.toggle();
    if (isEnabled) {
      volumeToggle.classList.remove('muted');
      volumeIcon.className = 'fa-solid fa-volume-high';
      showToast('Sonido activado', 'system');
      DrumAudio.playParticipation();
    } else {
      volumeToggle.classList.add('muted');
      volumeIcon.className = 'fa-solid fa-volume-xmark';
      showToast('Sonido desactivado', 'system');
    }
  });

  // Cargar datos del servidor
  fetchData();
});

// Obtener datos de estudiantes y logs desde la API
async function fetchData() {
  try {
    const studentsRes = await fetch('/api/students');
    studentsList = await studentsRes.json();

    const logsRes = await fetch('/api/logs');
    logsHistory = await logsRes.json();

    renderPads();
    renderDBTable();
    renderLogsList();
  } catch (error) {
    console.error('Error al cargar datos de la API:', error);
    showToast('Error de conexión con el servidor', 'undo');
  }
}

// ==========================================================================
// VISTA 1: CONTROL DE DRUM PADS
// ==========================================================================

function renderPads() {
  const container = document.getElementById('pads-container');
  if (!container) return;

  container.innerHTML = '';

  // Renderizar 17 pads de estudiantes
  studentsList.forEach((student, index) => {
    const pad = document.createElement('div');
    const colorClass = getPadColorClass(index);
    pad.className = `drum-pad ${colorClass}`;
    pad.id = `pad-${student.id}`;
    
    pad.innerHTML = `
      <div class="pad-num">${student.id}</div>
      <div class="pad-name">${student.lastname}</div>
      <div class="pad-stats">
        <span class="stat-p" id="p-count-${student.id}">P: ${student.participations}</span>
        <span class="stat-e" id="e-count-${student.id}">E: ${student.extra_points}</span>
      </div>
      <div class="pad-progress-ring"></div>
    `;

    // Vincular interacciones tactiles y raton
    setupPadEvents(pad, student);

    container.appendChild(pad);
  });

  // Renderizar Pad 18: DESHACER (Undo)
  const undoPad = document.createElement('div');
  undoPad.className = 'drum-pad pad-undo';
  undoPad.innerHTML = `
    <i class="fa-solid fa-rotate-left"></i>
    <span>DESHACER</span>
  `;
  
  // Eventos de click simple para el boton de Undo
  const triggerUndo = (e) => {
    e.preventDefault();
    undoPad.classList.add('active');
    setTimeout(() => undoPad.classList.remove('active'), 100);
    undoLastAction();
  };

  undoPad.addEventListener('touchstart', triggerUndo, { passive: false });
  undoPad.addEventListener('mousedown', (e) => {
    if (!isTouchDevice) triggerUndo(e);
  });

  container.appendChild(undoPad);
}

// Configurar los eventos de clic y pulsación larga (600ms)
function setupPadEvents(padElement, student) {
  let pressTimer = null;
  let didLongPress = false;
  const longPressDuration = 600; // Milisegundos para registrar punto extra

  const startPress = (e) => {
    e.preventDefault();
    didLongPress = false;
    padElement.classList.add('holding');
    padElement.classList.add('active');

    // Cambiar display del comandante
    document.getElementById('activity-display').innerText = `Presionando: ${student.lastname}...`;

    // Iniciar temporizador para punto extra (clic sostenido)
    pressTimer = setTimeout(() => {
      didLongPress = true;
      padElement.classList.remove('holding');
      registerPoint(student.id, 'extra');
    }, longPressDuration);
  };

  const endPress = (e) => {
    e.preventDefault();
    clearTimeout(pressTimer);
    padElement.classList.remove('holding');
    padElement.classList.remove('active');

    // Si se soltó antes del tiempo limite, registrar participacion (clic corto)
    if (!didLongPress) {
      registerPoint(student.id, 'participation');
    }
  };

  const cancelPress = (e) => {
    clearTimeout(pressTimer);
    padElement.classList.remove('holding');
    padElement.classList.remove('active');
    document.getElementById('activity-display').innerText = 'LISTO PARA GRABAR PUNTOS';
  };

  // Eventos Tactiles (Móviles)
  padElement.addEventListener('touchstart', startPress, { passive: false });
  padElement.addEventListener('touchend', endPress, { passive: false });
  padElement.addEventListener('touchcancel', cancelPress, { passive: false });

  // Eventos Mouse (Escritorio / Fallback)
  padElement.addEventListener('mousedown', (e) => {
    if (!isTouchDevice) startPress(e);
  });
  padElement.addEventListener('mouseup', (e) => {
    if (!isTouchDevice) endPress(e);
  });
  padElement.addEventListener('mouseleave', (e) => {
    if (!isTouchDevice) cancelPress(e);
  });
}

// Llamar API para registrar punto (participacion o extra)
async function registerPoint(studentId, type) {
  try {
    // Formatear dia actual en cliente para que coincida exactamente
    const clientDay = new Date().toISOString().split('T')[0];

    const res = await fetch(`/api/students/${studentId}/point`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, clientDay })
    });

    if (!res.ok) throw new Error('Error al registrar en la API');

    const data = await res.json();
    
    // Actualizar el estudiante en cache local
    const studentIdx = studentsList.findIndex(s => s.id === studentId);
    if (studentIdx !== -1) {
      studentsList[studentIdx] = data.student;
    }

    // Agregar el log al inicio de la lista
    logsHistory.unshift(data.log);

    // Audio y Vibración Haptica
    if (type === 'participation') {
      DrumAudio.playParticipation();
      if (navigator.vibrate) navigator.vibrate(40);
      showToast(`${data.student.lastname}: +1 Participación`, 'participation');
      document.getElementById('activity-display').innerText = `${data.student.lastname}: +1 PARTICIPACIÓN`;
    } else {
      DrumAudio.playExtraPoint();
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      showToast(`${data.student.lastname}: +1 PUNTO EXTRA`, 'extra');
      document.getElementById('activity-display').innerText = `${data.student.lastname}: +1 PUNTO EXTRA!`;
    }

    // Actualizar contadores del pad afectado inmediatamente sin repintar todo
    document.getElementById(`p-count-${studentId}`).innerText = `P: ${data.student.participations}`;
    document.getElementById(`e-count-${studentId}`).innerText = `E: ${data.student.extra_points}`;

    // Programar que el banner de actividad vuelva a "Listo" despues de 1.5s
    setTimeout(() => {
      const banner = document.getElementById('activity-display');
      if (banner && (banner.innerText.includes(data.student.lastname))) {
        banner.innerText = 'LISTO PARA GRABAR PUNTOS';
      }
    }, 1500);

    // Si la tabla de la base de datos es visible, actualizarla
    renderDBTable();
    renderLogsList();

  } catch (error) {
    console.error('Error al registrar puntos:', error);
    showToast('Error al guardar puntos', 'undo');
  }
}

// Deshacer la última acción (Undo)
async function undoLastAction() {
  try {
    const res = await fetch('/api/undo', { method: 'POST' });
    
    if (res.status === 400) {
      const data = await res.json();
      showToast(data.message, 'system');
      return;
    }
    
    if (!res.ok) throw new Error('Error al deshacer en backend');

    const data = await res.json();

    // Actualizar estudiante en cache local
    const studentIdx = studentsList.findIndex(s => s.id === data.student.id);
    if (studentIdx !== -1) {
      studentsList[studentIdx] = data.student;
    }

    // Remover el último log de la cache local
    logsHistory.shift();

    // Feedback auditivo y visual
    DrumAudio.playUndo();
    if (navigator.vibrate) navigator.vibrate(80);
    
    showToast(data.message, 'undo');
    document.getElementById('activity-display').innerText = `DESHECHO: ${data.student.lastname}`;

    // Actualizar interfaz
    document.getElementById(`p-count-${data.student.id}`).innerText = `P: ${data.student.participations}`;
    document.getElementById(`e-count-${data.student.id}`).innerText = `E: ${data.student.extra_points}`;

    setTimeout(() => {
      const banner = document.getElementById('activity-display');
      if (banner && banner.innerText.includes('DESHECHO')) {
        banner.innerText = 'LISTO PARA GRABAR PUNTOS';
      }
    }, 1500);

    renderDBTable();
    renderLogsList();

  } catch (error) {
    console.error('Error al deshacer acción:', error);
    showToast('No hay acciones para deshacer', 'system');
  }
}

// ==========================================================================
// VISTA 2: BASE DE DATOS Y REPORTES
// ==========================================================================

// Renderizar la tabla de estudiantes según búsqueda y ordenamiento
function renderDBTable() {
  const tbody = document.getElementById('db-table-body');
  if (!tbody) return;

  tbody.innerHTML = '';

  const searchQuery = document.getElementById('db-search').value.toLowerCase().trim();
  const sortBy = document.getElementById('db-sort').value;

  // Filtrar estudiantes
  let filtered = studentsList.filter(s => 
    s.lastname.toLowerCase().includes(searchQuery)
  );

  // Ordenar estudiantes
  filtered.sort((a, b) => {
    if (sortBy === 'id') return a.id - b.id;
    if (sortBy === 'lastname') return a.lastname.localeCompare(b.lastname);
    if (sortBy === 'participations') return b.participations - a.participations;
    if (sortBy === 'extra_points') return b.extra_points - a.extra_points;
    if (sortBy === 'total') {
      const totalA = a.participations + a.extra_points;
      const totalB = b.participations + b.extra_points;
      return totalB - totalA;
    }
    return 0;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px;">No se encontraron estudiantes</td></tr>`;
    return;
  }

  // Insertar filas
  filtered.forEach(student => {
    const totalPts = student.participations + student.extra_points;
    const row = document.createElement('tr');
    
    row.innerHTML = `
      <td class="list-num">${student.id}</td>
      <td class="student-name">${student.lastname}</td>
      <td>
        <div class="pts-control">
          <button class="pts-btn" onclick="updatePointsManual(${student.id}, 'participations', -1)">-</button>
          <span class="pts-val p-val">${student.participations}</span>
          <button class="pts-btn" onclick="updatePointsManual(${student.id}, 'participations', 1)">+</button>
        </div>
      </td>
      <td>
        <div class="pts-control">
          <button class="pts-btn" onclick="updatePointsManual(${student.id}, 'extra_points', -1)">-</button>
          <span class="pts-val e-val">${student.extra_points}</span>
          <button class="pts-btn" onclick="updatePointsManual(${student.id}, 'extra_points', 1)">+</button>
        </div>
      </td>
      <td class="pts-total">${totalPts}</td>
    `;
    
    tbody.appendChild(row);
  });
}

// Filtrar estudiantes desde el buscador
function filterStudents() {
  renderDBTable();
}

// Modificar puntos manualmente desde la tabla
async function updatePointsManual(studentId, field, delta) {
  const student = studentsList.find(s => s.id === studentId);
  if (!student) return;

  const currentVal = student[field];
  const newVal = Math.max(0, currentVal + delta);

  if (currentVal === newVal) return; // No hay cambios si es menor a 0

  const updateBody = {
    participations: field === 'participations' ? newVal : student.participations,
    extra_points: field === 'extra_points' ? newVal : student.extra_points
  };

  try {
    const res = await fetch(`/api/students/${studentId}/manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateBody)
    });

    if (!res.ok) throw new Error('Error al actualizar puntos manualmente');

    const updatedStudent = await res.json();

    // Actualizar cache local
    const idx = studentsList.findIndex(s => s.id === studentId);
    if (idx !== -1) {
      studentsList[idx] = updatedStudent;
    }

    // Actualizar vistas
    renderDBTable();
    
    // Actualizar visualizaciones de los pads
    const pCountEl = document.getElementById(`p-count-${studentId}`);
    const eCountEl = document.getElementById(`e-count-${studentId}`);
    if (pCountEl) pCountEl.innerText = `P: ${updatedStudent.participations}`;
    if (eCountEl) eCountEl.innerText = `E: ${updatedStudent.extra_points}`;

    showToast(`Puntos de ${student.lastname} ajustados`, 'system');

  } catch (error) {
    console.error('Error al editar puntos de forma manual:', error);
    showToast('Error al modificar puntos', 'undo');
  }
}

// Renderizar el historial de los logs recientes
function renderLogsList() {
  const listEl = document.getElementById('history-log-list');
  if (!listEl) return;

  listEl.innerHTML = '';
  const recentLogs = logsHistory.slice(0, 5); // Mostrar ultimas 5

  if (recentLogs.length === 0) {
    listEl.innerHTML = `<li class="empty-history">No hay acciones recientes.</li>`;
    return;
  }

  recentLogs.forEach(log => {
    const time = new Date(log.timestamp).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const li = document.createElement('li');
    
    const typeText = log.type === 'participation' ? 'Participación' : 'Punto Extra';
    const actionText = log.action === 'add' ? 'agregado' : 'retirado';
    const sign = log.action === 'add' ? '+' : '-';
    
    li.className = `history-item type-${log.type} action-${log.action}`;
    li.innerHTML = `
      <div>
        <strong>${log.lastname}</strong>: ${sign}1 ${typeText}
      </div>
      <div class="history-time">${time} (${log.day})</div>
    `;
    listEl.appendChild(li);
  });
}

// Exportar base de datos a archivo CSV (Excel Friendly con UTF-8 BOM)
function exportCSV() {
  if (studentsList.length === 0) {
    showToast('No hay datos para exportar', 'system');
    return;
  }

  // Estructura CSV usando punto y coma (;) que Excel español abre por defecto
  let csvContent = '\uFEFF'; // UTF-8 BOM para soporte de tildes/eñes
  csvContent += 'N° Lista;Estudiante;Participaciones;Puntos Extra;Puntaje Total\n';

  studentsList.forEach(s => {
    const total = s.participations + s.extra_points;
    csvContent += `${s.id};${s.lastname};${s.participations};${s.extra_points};${total}\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  // Generar link de descarga
  const dateStr = new Date().toISOString().split('T')[0];
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `puntos_web_design_${dateStr}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast('CSV Descargado con éxito', 'participation');
}

// ==========================================================================
// MODAL & TABS & TOASTS UTILITIES
// ==========================================================================

// Alternar entre Pestañas (Pads vs Base de datos)
function switchTab(tabId) {
  const padsTab = document.getElementById('tab-pads-btn');
  const dbTab = document.getElementById('tab-db-btn');
  const padsView = document.getElementById('view-pads');
  const dbView = document.getElementById('view-db');

  if (tabId === 'pads') {
    padsTab.classList.add('active');
    dbTab.classList.remove('active');
    padsView.classList.add('active');
    dbView.classList.remove('active');
  } else {
    padsTab.classList.remove('active');
    dbTab.classList.add('active');
    padsView.classList.remove('active');
    dbView.classList.add('active');
    // Refrescar los datos por si hubo cambios y reiniciar filtros
    fetchData();
  }
}

// Modal de confirmación de reinicio de base de datos
function openResetModal() {
  document.getElementById('reset-modal').classList.add('active');
}

function closeResetModal() {
  document.getElementById('reset-modal').classList.remove('active');
}

async function confirmResetDB() {
  try {
    const res = await fetch('/api/students/reset', { method: 'POST' });
    if (!res.ok) throw new Error('Error al reiniciar en servidor');

    const data = await res.json();
    closeResetModal();

    // Actualizar cache local
    studentsList.forEach(s => {
      s.participations = 0;
      s.extra_points = 0;
    });
    logsHistory = [];

    // Actualizar UI
    renderPads();
    renderDBTable();
    renderLogsList();

    DrumAudio.playUndo();
    showToast(data.message, 'undo');

  } catch (error) {
    console.error('Error al reiniciar base de datos:', error);
    showToast('Error al reiniciar datos', 'undo');
  }
}

// Visualizador de Toasts en la parte inferior
function showToast(message, type) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let iconClass = 'fa-solid fa-circle-info';
  if (type === 'participation') iconClass = 'fa-solid fa-circle-check';
  if (type === 'extra') iconClass = 'fa-solid fa-star';
  if (type === 'undo') iconClass = 'fa-solid fa-rotate-left';

  toast.innerHTML = `
    <span><i class="${iconClass}"></i> ${message}</span>
  `;

  container.appendChild(toast);

  // Auto-eliminar despues de que termine la animacion (2.3s)
  setTimeout(() => {
    toast.remove();
  }, 2300);
}
