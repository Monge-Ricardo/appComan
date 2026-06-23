const mongoose = require('mongoose');

// Cargar variables de entorno si no se ha hecho
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/appComan';

// Conectar a MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Conectado con éxito a MongoDB Atlas');
    seedStudents();
  })
  .catch((err) => {
    console.error('Error al conectar a MongoDB:', err.message);
  });

// Esquema de Estudiantes (students)
const StudentSchema = new mongoose.Schema({
  id: {
    type: Number,
    required: true,
    unique: true
  },
  lastname: {
    type: String,
    required: true
  },
  participations: {
    type: Number,
    default: 0
  },
  extra_points: {
    type: Number,
    default: 0
  }
});

// Esquema de Logs (logs)
const LogSchema = new mongoose.Schema({
  id: {
    type: Number,
    required: true,
    unique: true
  },
  student_id: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['participation', 'extra']
  },
  action: {
    type: String,
    required: true,
    enum: ['add', 'subtract']
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  day: {
    type: String,
    required: true
  }
});

const Student = mongoose.model('Student', StudentSchema, 'students');
const Log = mongoose.model('Log', LogSchema, 'logs');

// Listado de los 17 estudiantes iniciales
const initialStudents = [
  { id: 1, lastname: "ALVARADO" },
  { id: 2, lastname: "ANDINO" },
  { id: 3, lastname: "CALDERON" },
  { id: 4, lastname: "CARDENAS" },
  { id: 5, lastname: "CHUQUI" },
  { id: 6, lastname: "DIAZ" },
  { id: 7, lastname: "ERAZO" },
  { id: 8, lastname: "GALARZA" },
  { id: 9, lastname: "GUALOTUÑA" },
  { id: 10, lastname: "MOLINA" },
  { id: 11, lastname: "MONGE" },
  { id: 12, lastname: "OBANDO" },
  { id: 13, lastname: "QUIROGA" },
  { id: 14, lastname: "RODRIGUEZ" },
  { id: 15, lastname: "SABANDO" },
  { id: 16, lastname: "TORRES" },
  { id: 17, lastname: "VILLARREAL" }
];

// Funcion de semillado (seeding)
async function seedStudents() {
  try {
    const count = await Student.countDocuments();
    if (count === 0) {
      console.log('Sembrando listado inicial de 17 estudiantes...');
      const seeded = initialStudents.map(student => ({
        id: student.id,
        lastname: student.lastname,
        participations: 0,
        extra_points: 0
      }));
      await Student.insertMany(seeded);
      console.log('Semillado completado con éxito.');
    } else {
      console.log('La colección de estudiantes ya contiene datos. Omitiendo semillado.');
    }
  } catch (error) {
    console.error('Error al realizar el semillado de estudiantes:', error);
  }
}

// Exportar los modelos y helper para obtener el siguiente ID de log
module.exports = {
  Student,
  Log,
  getNextLogId: async () => {
    try {
      const lastLog = await Log.findOne().sort({ id: -1 });
      return lastLog ? lastLog.id + 1 : 1;
    } catch (error) {
      console.error('Error al obtener el siguiente ID de log:', error);
      return Date.now(); // Fallback seguro
    }
  }
};
