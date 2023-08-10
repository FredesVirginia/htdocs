const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const path = require('path');
const bcrypt = require('bcrypt');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const multer = require('multer');


const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage: storage });



// ...


// Sirve archivos est�ticos desde el directorio public
app.use(express.static(path.join(__dirname, 'public')));

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'carrera'
});

const sessionStore = new MySQLStore({}, pool);

app.use(session({
    key: 'session_cookie_name',
    secret: 'session_cookie_secret',
    store: sessionStore,
    resave: false,
    saveUninitialized: false
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.post('/api/register', (req, res) => {
  const nombre = req.body.username;
  const password = req.body.password;
  const email = req.body.email;
  const role = req.body.role;

  bcrypt.hash(password, 10, function(err, hash) {
    pool.query('INSERT INTO usuarios (nombre, password, email, role) VALUES (?, ?, ?, ?)', [nombre, hash, email, role], function(error, results) {
      if (error) throw error;
      res.redirect('/');
    });
  });
});

app.post('/api/login', (req, res) => {
  const nombre = req.body.username;
  const password = req.body.password;

  pool.query('SELECT * FROM usuarios WHERE nombre = ?', [nombre], function(error, results) {
    if (error) throw error;

    if (results.length > 0) {
      bcrypt.compare(password, results[0].password, function(err, result) {
        if(result == true) {
          // Guardar la sesi�n del usuario
          req.session.usuario = results[0];
          if(req.session.usuario.role === 'docente') {
            res.render('Docentes', { docente: req.session.usuario, estudiantes: results });
          } else {
            res.render('Estudiantes', { estudiante: req.session.usuario });
          }
        } else {
          res.redirect('/');
        }
      });
    } else {
      res.send('Usuario no encontrado!');
    }
  });
});

app.get('/api/logout', function(req, res){
   req.session.destroy(function(err){
      if(err){
         console.log(err);
      } else {
         res.redirect('/');
      }
   });
});

app.get('/api/Docentes/CuentasEstudiantes', function(req, res) {
  if (req.session.usuario && req.session.usuario.role === 'docente') {
    pool.query('SELECT * FROM usuarios WHERE role = ? ORDER BY nombre DESC, email DESC', ['estudiante'], function(error, results) {
      if (error) throw error;
      res.render('CuentasEstudiantes', { estudiantes: results });
    });
  } else {
    res.redirect('/');
  }
});

app.get('/api/Docentes/Temas/:id', function(req, res) {
   const unidadId = req.params.id;
   console.log("la unidad es " , unidadId);
  if (req.session.usuario && req.session.usuario.role === 'docente') {
    pool.query('SELECT * FROM temas ', function(error, temas) {
      if (error) throw error;
      if (temas.length) { // Comprueba si la consulta devolvi� resultados
        res.render('Temas', { temas: temas , unidad_id: unidadId });
      } else {
        res.render('Temas', { temas: [] , unidad_id: unidadId }); // Si no, pasa una lista vac�a a la vista Temas
      }
    });
  } else {
    res.redirect('/');
  }
});

app.get('/api/Docentes/Temas/ObtenerTodosTemas', function(req, res){

});

app.get('/api/Docentes/Unidades', function(req, res) {
  console.log("Por aqui");
  
  if (req.session.usuario && req.session.usuario.role === 'docente') {
    console.log("Por aqui");
    
    pool.query('SELECT * FROM unidad', function(error, unidades) {
      if (error || !unidades) { // Manejo de errores y verificación de 'unidades'
        console.error("Error en la consulta a la base de datos:", error);
        return res.status(500).send("Error en la consulta a la base de datos");
      }
      
      if (unidades.length) {
        console.log("UNIDADES");
        res.render('UnidadDocente', { unidades: unidades });
      } else {
        console.log("Sin UNIDADES");
        res.render('UnidadDocente', { unidades: [] });
      }
    });
  } else {
    res.redirect('/');
  }
});








app.get('/api/Docentes/Temas/crear/:id', function(req, res) {
  if (req.session.usuario && req.session.usuario.role === 'docente') {
    const unidadId = req.params.id;
    res.render('CrearTema' , {  unidad_id: unidadId});
  } else {
    res.redirect('/');
  }
});

app.get('/api/Docentes/Examenes/crear/:id', function(req, res) {
  if (req.session.usuario && req.session.usuario.role === 'docente') {
    const unidadId = req.params.id;
    pool.query('SELECT * FROM temas', function(error, temas) {
      if (error) throw error;
      
      const nombresTemas = temas.map(tema => tema.nombre);

      if (temas.length) {
        res.render('CrearExamen', { temas: temas, nombres_temas: nombresTemas, unidad_id: unidadId });
      } else {
        res.render('CrearExamen', { temas: [], nombres_temas: [], unidad_id: unidadId });
      }
    });
    
  } else {
    res.redirect('/');
  }
});


app.get('/api/Docentes/Unidad/crear', function(req, res) {
  if (req.session.usuario && req.session.usuario.role === 'docente') {
    res.render('CrearUnidad');
  } else {
    res.redirect('/');
  }
});




app.post('/api/Docentes/Temas/crear/:id', upload.single('pdf'), function(req, res) {
  if (req.session.usuario && req.session.usuario.role === 'docente') {
    const nombre = req.body.nombre;
    const descripcion = req.body.descripcion;
     const link = req.body.link;    

    const unidad_id = req.params.id    ;
    console.log("El Id de UNIDAD ES  es:", unidad_id);

    const sql = 'INSERT INTO temas (nombre, descripcion,link, unidad_id) VALUES ( ?, ? ,?, ?)';
    const values = [nombre, descripcion , link, unidad_id];

    pool.query(sql, values, function(error, results) {
      if (error) {
        console.error(error);
      } else {
        console.log('Tema creada correctamente.');
      }
      res.redirect('/api/Docentes/Temas');
    });
  } else {
    res.redirect('/');
  }

  
});


app.post('/api/Docentes/Unidad/crear', upload.single('pdf'), function(req, res) {
  if (req.session.usuario && req.session.usuario.role === 'docente') {
    const nombre = req.body.nombre; 
    const descripcion = req.body.descripcion;
    const docente_id = req.session.usuario.id;
    console.log("El nombre es Unidad es :", req.body.nombre);

    

    const sql = 'INSERT INTO unidad (nombre, descripcion, docente_id) VALUES ( ?, ? ,?)';
    const values = [nombre, descripcion , docente_id];

    pool.query(sql, values, function(error, results) {
      if (error) {
        console.error(error);
      } else {
        console.log('Unidad creada correctamente.');
      }
      res.redirect('/api/Docentes/Temas');
    });
  } else {
    res.redirect('/');
  }
});



app.post('/api/Docentes/Examen/crear', function(req, res) {
 


    if (req.session.usuario && req.session.usuario.role === 'docente') {
      const nombre = req.body.nombre;
      const link = req.body.link;
      const descripcion = req.body.descripcion;
  
      // Parsea el campo "temasSeleccionados" como un arreglo de IDs
      const temasSeleccionados = JSON.parse(req.body.temasSeleccionados || '[]');
  
      console.log("El nombre del Examen es:", req.body.nombre);
      console.log("Temas seleccionados:", temasSeleccionados);
    const sql = 'INSERT INTO tests (nombre,  descripcion , link) VALUES (?, ?, ?)';
    const values = [nombre,  descripcion , link];

    pool.query(sql, values, function(error, results) {
      if (error) {
        console.error(error);
        res.json({mesaague : "error"});
      } else {
        const examenId = results.insertId; // Obtiene el ID del examen recién insertado

        // Itera sobre los temas seleccionados y agrega las relaciones en la tabla de relación examen_temas
        temasSeleccionados.forEach(function(temaId) {
          const sqlAsociacion = 'INSERT INTO tests_tema (tema_id , test_id) VALUES (?, ?)';
          const valuesAsociacion = [examenId, temaId];
          pool.query(sqlAsociacion, valuesAsociacion, function(errorAsociacion, resultsAsociacion) {
            if (errorAsociacion) {
              console.error(errorAsociacion);
            } else {
              console.log('Relación examen-tema creada correctamente.');
            }
          });
        });

        console.log('Examen creado correctamente.');
        res.json({mesaague : "siiiiii"});
      }
    });
  } else {
    res.json({mesaague : "error"});
  }
});











app.get('/api/Docentes/Examenes/:id', async function(req, res) {
  const unidadId = req.params.id;
  const nombreUnidad =  await obtenerNombreUnidad(unidadId);
  console.log("la unidad es " , unidadId);
 if (req.session.usuario && req.session.usuario.role === 'docente') {
   pool.query('SELECT * FROM tests INNER JOIN preguntas ON tests.id = preguntas.test_id', function(error, examenes) {
     if (error) throw error;
     if (examenes.length) { // Comprueba si la consulta devolvi� resultados
       res.render('Examenes', { examenes: examenes , unidad_id: unidadId  , unidad_nombre :nombreUnidad});
     } else {
       res.render('Examenes', { examenes: [] , unidad_id: unidadId , unidad_nombre :nombreUnidad}); // Si no, pasa una lista vac�a a la vista Temas
     }
   });
 } else {
   res.redirect('/');
 }
});

app.get('/api/Docentes/RendimientoEstudiantes', function(req, res) {
  if (req.session.usuario && req.session.usuario.role === 'docente') {
    pool.query('SELECT * FROM resultados_tests INNER JOIN usuarios ON resultados_tests.usuario_id = usuarios.id', function(error, resultados) {
      if (error) throw error;
      res.render('RendimientoEstudiantes', { resultados: resultados });
    });
  } else {
    res.redirect('/');
  }
});

app.get('/api/Docentes/CuentasEstudiantes/editar/:id', function(req, res) {
  if (req.session.usuario && req.session.usuario.role === 'docente') {
    const estudianteId = req.params.id;
    obtenerEstudiantePorId(estudianteId, function(err, estudiante) {
      if (err) {
        console.error(err);
        res.redirect('/api/Docentes/CuentasEstudiantes');
      } else {
        res.render('EditarEstudiante', { estudiante: estudiante });
      }
    });
  } else {
    res.redirect('/');
  }
});

app.get('/api/Docentes/Tema/editar/:id', function(req, res) {
  if (req.session.usuario && req.session.usuario.role === 'docente') {
    const temaId = req.params.id;
    obtenerTemaPorId(temaId, function(err, tema) {
      if (err) {
        console.error(err);
        res.redirect('/api/Docentes/Temas');
      } else {
        res.render('EditarTema', { tema: tema });
      }
    });
  } else {
    res.redirect('/');
  }
});

app.get('/api/Docentes/Unidad/:id', async function(req, res) {
  if (req.session.usuario && req.session.usuario.role === 'docente') {
    const unidadId = req.params.id;
    const nombreUnidad = await obtenerNombreUnidad(unidadId);
    console.log("NOMBRE DE UNIDAD ", nombreUnidad);
    obtenerUnidadPorId(unidadId, function(err, unidad) {
      if (err) {
        console.error(err);
        res.redirect('/api/Docentes/Unidades');
      } else {
        res.render('Unidad', { unidad: unidad , unidad_id: unidadId});
      }
    });
  } else {
    res.redirect('/');
  }
});

app.post('/api/Docentes/CuentasEstudiantes/editar/:id', function(req, res) {
  if (req.session.usuario && req.session.usuario.role === 'docente') {
    const estudianteId = req.params.id;
    const nombre = req.body.nombre;
    const email = req.body.email;
    const password = req.body.password;

    const sql = 'UPDATE usuarios SET nombre = ?, email = ?, password = ? WHERE id = ?';
    const values = [nombre, email, password, estudianteId];

    pool.query(sql, values, function(error, results) {
      if (error) {
        console.error(error);
      } else {
        console.log('Estudiante actualizado correctamente.');
      }
      res.redirect('/api/Docentes/CuentasEstudiantes');
    });
  } else {
    res.redirect('/');
  }
});

app.post('/api/Docentes/Temas/editar/:id', function(req, res) {
  if (req.session.usuario && req.session.usuario.role === 'docente') {
    const temaId = req.params.id;
    const nombre = req.body.nombre;
    const link = req.body.link;
    const descripcion = req.body.descripcion;

    const sql = 'UPDATE temas SET nombre = ?, link = ?, descripcion = ? WHERE id = ?';
    const values = [nombre, link, descripcion, temaId];

    pool.query(sql, values, function(error, results) {
      if (error) {
        console.error(error);
      } else {
        console.log('Tema actualizado correctamente.');
      }
      res.redirect('/api/Docentes/Temas');
    });
  } else {
    res.redirect('/');
  }
});




app.get('/api/Docentes/CuentasEstudiantes/borrar/:id', function(req, res) {
  if (req.session.usuario && req.session.usuario.role === 'docente') {
    const estudianteId = req.params.id;

    const sql = 'SELECT * FROM usuarios WHERE id = ?';

    pool.query(sql, [estudianteId], function(error, results) {
      if (error) {
        console.error(error);
        res.redirect('/api/Docentes/CuentasEstudiantes');
      } else {
        if (results.length > 0) {
          res.render('ConfirmarBorrado', { estudiante: results[0] });
        } else {
          console.log('Estudiante no encontrado.');
          res.redirect('/api/Docentes/CuentasEstudiantes');
        }
      }
    });
  } else {
    res.redirect('/');
  }
});

app.get('/api/Docentes/Tema/borrar/:id', function(req, res) {
  if (req.session.usuario && req.session.usuario.role === 'docente') {
    const temaId = req.params.id;

    const sql = 'SELECT * FROM temas WHERE id = ?';

    pool.query(sql, [temaId], function(error, results) {
      if (error) {
        console.error(error);
        res.redirect('/api/Docentes/Temas');
      } else {
        if (results.length > 0) {
          res.render('ConfirmarBorradoTema', { tema: results[0] });
        } else {
          console.log('Tema no encontrado.');
          res.redirect('/api/Docentes/Temas');
        }
      }
    });
  } else {
    res.redirect('/');
  }
});

app.post('/api/Docentes/CuentasEstudiantes/borrar/:id', function(req, res) {
  if (req.session.usuario && req.session.usuario.role === 'docente') {
    const estudianteId = req.params.id;

    const deleteSql = 'DELETE FROM usuarios WHERE id = ?';
    pool.query(deleteSql, [estudianteId], function(error, deleteResult) {
      if (error) {
        console.error(error);
      } else {
        console.log('Estudiante eliminado correctamente.');
      }
      res.redirect('/api/Docentes/CuentasEstudiantes');
    });
  } else {
    res.redirect('/');
  }
});


app.post('/api/Docentes/Temas/borrar/:id', function(req, res) {
  if (req.session.usuario && req.session.usuario.role === 'docente') {
    const temaId = req.params.id;

    const deleteSql = 'DELETE FROM temas WHERE id = ?';
    pool.query(deleteSql, [temaId], function(error, deleteResult) {
      if (error) {
        console.error(error);
      } else {
        console.log('Tema eliminado correctamente.');
      }
      res.redirect('/api/Docentes/Temas');
    });
  } else {
    res.redirect('/');
  }
});
function obtenerEstudiantePorId(estudianteId, callback) {
  const sql = 'SELECT * FROM usuarios WHERE id = ?';
  pool.query(sql, [estudianteId], function(error, results) {
    if (error) {
      console.error(error);
      callback(error);
    } else {
      if (results.length > 0) {
        const estudiante = results[0];
        callback(null, estudiante);
      } else {
        const err = new Error('Estudiante no encontrado');
        callback(err);
      }
    }
  });
}

function obtenerTemaPorId(temaId, callback){
  const sql = 'SELECT * FROM temas WHERE id = ?';
  pool.query(sql, [temaId], function(error, results) {
    if (error) {
      console.error(error);
      callback(error);
    } else {
      if (results.length > 0) {
        const tema = results[0];
        callback(null, tema);
      } else {
        const err = new Error('Tema no encontrado');
        callback(err);
      }
    }
  });
}

function obtenerUnidadPorId(unidadId , callback){
  const sql = 'SELECT * FROM unidad WHERE id = ?';
  pool.query(sql, [unidadId], function(error, results) {
    if (error) {
      console.error(error);
      callback(error);
    } else {
      if (results.length > 0) {
        const unidad = results[0];
        callback(null, unidad);
      } else {
        const err = new Error('Unidad no encontrado');
        callback(err);
      }
    }
  });
}

function obtenerNombreUnidad(unidadId) {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT * FROM unidad WHERE id = ?';

    pool.query(sql, [unidadId], function (error, resultados) {
      if (error) {
        reject(error);
      } else {
        if (resultados.length) {
          const nombreDeLaUnidad = resultados[0].nombre;
          console.log("Nombre de la unidad: ", nombreDeLaUnidad);
          resolve(nombreDeLaUnidad);
        } else {
          console.log("No se encontró ninguna unidad con el ID proporcionado.");
          resolve(null);
        }
      }
    });
  });
}


app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
