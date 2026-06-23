const express = require('express');
const path = require('path');
const { Student, Log, getNextLogId } = require('./database');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper para obtener el dia actual en formato YYYY-MM-DD (Zona Horaria Ecuador: America/Guayaquil)
function getEcuadorDay() {
  try {
    const ecuadorDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Guayaquil' }));
    const yyyy = ecuadorDate.getFullYear();
    const mm = String(ecuadorDate.getMonth() + 1).padStart(2, '0');
    const dd = String(ecuadorDate.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  } catch (e) {
    // Fallback en caso de error de zona horaria
    return new Date().toISOString().split('T')[0];
  }
}

// 1. Obtener lista de todos los estudiantes
app.get('/api/students', async (req, res) => {
  try {
    const students = await Student.find().sort({ id: 1 });
    res.json(students);
  } catch (error) {
    console.error('Error al obtener estudiantes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// 2. Agregar puntos (participacion o extra) a un estudiante
app.post('/api/students/:id/point', async (req, res) => {
  const studentId = parseInt(req.params.id);
  const { type, clientDay } = req.body; // 'participation' o 'extra'

  if (!['participation', 'extra'].includes(type)) {
    return res.status(400).json({ error: 'Tipo de punto no válido' });
  }

  try {
    const student = await Student.findOne({ id: studentId });
    if (!student) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }

    // Actualizar puntos
    if (type === 'participation') {
      student.participations += 1;
    } else {
      student.extra_points += 1;
    }
    await student.save();

    // Registrar en logs
    const logId = await getNextLogId();
    const day = clientDay || getEcuadorDay();
    const newLog = new Log({
      id: logId,
      student_id: studentId,
      type: type,
      action: 'add',
      timestamp: new Date(),
      day: day
    });
    await newLog.save();

    res.json({ student, log: newLog });
  } catch (error) {
    console.error('Error al agregar punto:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// 3. Deshacer el último cambio registrado (Undo)
app.post('/api/undo', async (req, res) => {
  try {
    // Encontrar el último log agregado
    const lastLog = await Log.findOne({ action: 'add' }).sort({ id: -1 });
    if (!lastLog) {
      return res.status(400).json({ message: 'No hay acciones recientes para deshacer' });
    }

    const student = await Student.findOne({ id: lastLog.student_id });
    if (!student) {
      // Si el estudiante no existe, simplemente borramos el log huerfano
      await Log.deleteOne({ id: lastLog.id });
      return res.status(400).json({ message: 'El estudiante asociado a la acción ya no existe' });
    }

    // Revertir el punto en el estudiante
    if (lastLog.type === 'participation') {
      student.participations = Math.max(0, student.participations - 1);
    } else {
      student.extra_points = Math.max(0, student.extra_points - 1);
    }
    await student.save();

    // Eliminar el log para sacarlo del historial (de modo que el siguiente Undo afecte al anterior)
    await Log.deleteOne({ id: lastLog.id });

    res.json({
      message: `Deshecho: Se restó 1 punto de ${lastLog.type} a ${student.lastname}`,
      student
    });
  } catch (error) {
    console.error('Error al deshacer acción:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// 4. Edicion manual de participaciones o extras desde la tabla de visualizacion
app.post('/api/students/:id/manual', async (req, res) => {
  const studentId = parseInt(req.params.id);
  const { participations, extra_points } = req.body;

  if (typeof participations !== 'number' || typeof extra_points !== 'number') {
    return res.status(400).json({ error: 'Los puntos deben ser numéricos' });
  }

  try {
    const student = await Student.findOne({ id: studentId });
    if (!student) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }

    // Registrar cambios si hay diferencias (para mantener historial si es necesario)
    // Para simplificar, guardamos los nuevos valores directamente
    student.participations = Math.max(0, participations);
    student.extra_points = Math.max(0, extra_points);
    await student.save();

    res.json(student);
  } catch (error) {
    console.error('Error en edición manual:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// 5. Reiniciar todos los contadores de puntos e historial a cero
app.post('/api/students/reset', async (req, res) => {
  try {
    // Poner contadores a 0
    await Student.updateMany({}, { participations: 0, extra_points: 0 });
    // Limpiar logs
    await Log.deleteMany({});
    
    res.json({ message: 'Todos los puntos y el historial se han reiniciado.' });
  } catch (error) {
    console.error('Error al reiniciar base de datos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// 6. Obtener historial de acciones recientes (para mostrar en el dashboard)
app.get('/api/logs', async (req, res) => {
  try {
    // Traer los ultimos 10 logs con informacion unida del estudiante (o manual)
    const logs = await Log.find().sort({ id: -1 }).limit(10);
    
    const logsWithStudents = await Promise.all(logs.map(async (log) => {
      const student = await Student.findOne({ id: log.student_id });
      return {
        id: log.id,
        student_id: log.student_id,
        lastname: student ? student.lastname : 'Desconocido',
        type: log.type,
        action: log.action,
        timestamp: log.timestamp,
        day: log.day
      };
    }));

    res.json(logsWithStudents);
  } catch (error) {
    console.error('Error al obtener logs:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Servir la aplicacion frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
