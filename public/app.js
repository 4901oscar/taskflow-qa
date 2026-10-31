/**
 * TaskFlow - cliente del tablero de tareas.
 *
 * Todo el texto que proviene del servidor se inserta con textContent, nunca con
 * innerHTML: es el control de salida que evita XSS en el navegador.
 */

const ESTADOS = ['pendiente', 'en_progreso', 'completada'];
const CLAVE_TOKEN = 'taskflow.token';

const estado = {
  token: localStorage.getItem(CLAVE_TOKEN),
  usuario: null,
  tareas: [],
  filtros: { busqueda: '', prioridad: '' },
};

// ------------------------------- Referencias DOM -------------------------------

const $ = (selector) => document.querySelector(selector);

const pantallaAuth = $('#pantalla-auth');
const pantallaApp = $('#pantalla-app');
const formLogin = $('#form-login');
const formRegistro = $('#form-registro');
const formTarea = $('#form-tarea');
const formEditar = $('#form-editar');
const dialogoEditar = $('#dialogo-editar');
const plantillaTarea = $('#plantilla-tarea');

// --------------------------------- Utilidades ---------------------------------

/** Muestra u oculta un mensaje de error. */
function mostrarError(selector, mensaje) {
  const elemento = $(selector);
  if (!elemento) return;
  if (mensaje) {
    elemento.textContent = mensaje;
    elemento.hidden = false;
  } else {
    elemento.textContent = '';
    elemento.hidden = true;
  }
}

/** Convierte la respuesta de error de la API en un texto legible. */
function textoDeError(cuerpo, respaldo) {
  if (!cuerpo) return respaldo;
  if (Array.isArray(cuerpo.errores) && cuerpo.errores.length > 0) {
    return cuerpo.errores.map((e) => e.mensaje).join('. ');
  }
  return cuerpo.mensaje || respaldo;
}

/**
 * Llama a la API adjuntando el token de sesion.
 * @throws {Error} con el mensaje listo para mostrar al usuario
 */
async function api(ruta, { metodo = 'GET', cuerpo = null } = {}) {
  const cabeceras = {};
  if (cuerpo) cabeceras['content-type'] = 'application/json';
  if (estado.token) cabeceras.authorization = 'Bearer ' + estado.token;

  const respuesta = await fetch('/api' + ruta, {
    method: metodo,
    headers: cabeceras,
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });

  if (respuesta.status === 204) return null;

  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    if (respuesta.status === 401 && estado.token) cerrarSesionLocal();
    throw new Error(textoDeError(datos, 'Ocurrio un error inesperado'));
  }
  return datos;
}

function formatearFecha(iso) {
  if (!iso) return '';
  const [anio, mes, dia] = iso.split('-');
  return dia + '/' + mes + '/' + anio;
}

function estaVencida(iso, estadoTarea) {
  if (!iso || estadoTarea === 'completada') return false;
  return iso < new Date().toISOString().slice(0, 10);
}

// ------------------------------- Renderizado -------------------------------

/** Aplica los filtros del cliente sobre la lista de tareas. */
function tareasVisibles() {
  const texto = estado.filtros.busqueda.trim().toLowerCase();
  return estado.tareas.filter((tarea) => {
    if (estado.filtros.prioridad && tarea.prioridad !== estado.filtros.prioridad) return false;
    if (!texto) return true;
    return (
      tarea.titulo.toLowerCase().includes(texto) ||
      (tarea.descripcion || '').toLowerCase().includes(texto)
    );
  });
}

/** Construye la tarjeta de una tarea a partir de la plantilla. */
function construirTarjeta(tarea) {
  const nodo = plantillaTarea.content.firstElementChild.cloneNode(true);
  nodo.dataset.id = String(tarea.id);
  nodo.dataset.estado = tarea.estado;

  const prioridad = nodo.querySelector('.tarea__prioridad');
  prioridad.textContent = tarea.prioridad;
  prioridad.classList.add('tarea__prioridad--' + tarea.prioridad);

  nodo.querySelector('.tarea__titulo').textContent = tarea.titulo;

  const descripcion = nodo.querySelector('.tarea__descripcion');
  if (tarea.descripcion) {
    descripcion.textContent = tarea.descripcion;
  } else {
    descripcion.hidden = true;
  }

  const fecha = nodo.querySelector('.tarea__fecha');
  if (tarea.fechaVencimiento) {
    fecha.textContent = 'Vence ' + formatearFecha(tarea.fechaVencimiento);
    if (estaVencida(tarea.fechaVencimiento, tarea.estado)) {
      fecha.classList.add('tarea__fecha--vencida');
    }
  } else {
    fecha.textContent = '';
  }

  nodo.querySelector('.tarea__mover').value = tarea.estado;
  return nodo;
}

/** Repinta el tablero completo. */
function renderizarTablero() {
  const visibles = tareasVisibles();

  for (const nombreEstado of ESTADOS) {
    const lista = document.querySelector('[data-lista="' + nombreEstado + '"]');
    lista.replaceChildren();

    const deEstaColumna = visibles
      .filter((tarea) => tarea.estado === nombreEstado)
      .sort((a, b) => a.posicion - b.posicion || a.id - b.id);

    for (const tarea of deEstaColumna) {
      lista.appendChild(construirTarjeta(tarea));
    }

    $('[data-testid="conteo-' + nombreEstado + '"]').textContent = String(deEstaColumna.length);
  }
}

function mostrarPantallaApp() {
  pantallaAuth.hidden = true;
  pantallaApp.hidden = false;
  $('[data-testid="usuario-actual"]').textContent = estado.usuario ? estado.usuario.nombre : '';
}

function mostrarPantallaAuth() {
  pantallaApp.hidden = true;
  pantallaAuth.hidden = false;
}

// --------------------------------- Acciones ---------------------------------

async function cargarTareas() {
  const datos = await api('/tareas');
  estado.tareas = datos.tareas;
  renderizarTablero();
}

function cerrarSesionLocal() {
  estado.token = null;
  estado.usuario = null;
  estado.tareas = [];
  localStorage.removeItem(CLAVE_TOKEN);
  mostrarPantallaAuth();
}

async function iniciarSesionCon(token, usuario) {
  estado.token = token;
  estado.usuario = usuario;
  localStorage.setItem(CLAVE_TOKEN, token);
  mostrarPantallaApp();
  await cargarTareas();
}

// ----------------------------- Eventos de sesion -----------------------------

$('#pestana-login').addEventListener('click', () => {
  $('#pestana-login').classList.add('pestanas__boton--activo');
  $('#pestana-registro').classList.remove('pestanas__boton--activo');
  formLogin.hidden = false;
  formRegistro.hidden = true;
  mostrarError('#error-login', '');
  mostrarError('#error-registro', '');
});

$('#pestana-registro').addEventListener('click', () => {
  $('#pestana-registro').classList.add('pestanas__boton--activo');
  $('#pestana-login').classList.remove('pestanas__boton--activo');
  formRegistro.hidden = false;
  formLogin.hidden = true;
  mostrarError('#error-login', '');
  mostrarError('#error-registro', '');
});

formLogin.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  mostrarError('#error-login', '');
  const datos = Object.fromEntries(new FormData(formLogin));
  try {
    const respuesta = await api('/auth/login', { metodo: 'POST', cuerpo: datos });
    formLogin.reset();
    await iniciarSesionCon(respuesta.token, respuesta.usuario);
  } catch (error) {
    mostrarError('#error-login', error.message);
  }
});

formRegistro.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  mostrarError('#error-registro', '');
  const datos = Object.fromEntries(new FormData(formRegistro));
  try {
    const respuesta = await api('/auth/registro', { metodo: 'POST', cuerpo: datos });
    formRegistro.reset();
    await iniciarSesionCon(respuesta.token, respuesta.usuario);
  } catch (error) {
    mostrarError('#error-registro', error.message);
  }
});

$('#boton-logout').addEventListener('click', async () => {
  // DEF-003: la sesion local se limpia ANTES de llamar al servidor. Si se
  // esperaba la respuesta, el token seguia en localStorage mientras la
  // peticion estaba en vuelo (y quedaba ahi para siempre si fallaba la red).
  const token = estado.token;
  cerrarSesionLocal();

  if (!token) return;
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + token },
    });
  } catch {
    // El token local ya se elimino; si la revocacion en el servidor falla,
    // la sesion caducara por si misma.
  }
});

// ----------------------------- Eventos de tareas -----------------------------

formTarea.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  mostrarError('#error-tarea', '');
  const datos = Object.fromEntries(new FormData(formTarea));
  try {
    await api('/tareas', { metodo: 'POST', cuerpo: datos });
    formTarea.reset();
    formTarea.elements.prioridad.value = 'media';
    await cargarTareas();
  } catch (error) {
    mostrarError('#error-tarea', error.message);
  }
});

$('#filtro-busqueda').addEventListener('input', (evento) => {
  estado.filtros.busqueda = evento.target.value;
  renderizarTablero();
});

$('#filtro-prioridad').addEventListener('change', (evento) => {
  estado.filtros.prioridad = evento.target.value;
  renderizarTablero();
});

/** Delegacion de eventos para editar, eliminar y mover por menu. */
$('[data-testid="tablero"]').addEventListener('click', async (evento) => {
  const boton = evento.target.closest('[data-accion]');
  if (!boton || boton.tagName === 'SELECT') return;
  const tarjeta = boton.closest('.tarea');
  const id = Number(tarjeta.dataset.id);
  const tarea = estado.tareas.find((t) => t.id === id);
  if (!tarea) return;

  if (boton.dataset.accion === 'editar') {
    formEditar.elements.id.value = String(tarea.id);
    formEditar.elements.titulo.value = tarea.titulo;
    formEditar.elements.descripcion.value = tarea.descripcion || '';
    formEditar.elements.estado.value = tarea.estado;
    formEditar.elements.prioridad.value = tarea.prioridad;
    formEditar.elements.fechaVencimiento.value = tarea.fechaVencimiento || '';
    mostrarError('#error-editar', '');
    dialogoEditar.showModal();
  }

  if (boton.dataset.accion === 'eliminar') {
    mostrarError('#error-tarea', '');
    try {
      await api('/tareas/' + id, { metodo: 'DELETE' });
      await cargarTareas();
    } catch (error) {
      mostrarError('#error-tarea', error.message);
    }
  }
});

/** Mover una tarea con el menu desplegable (alternativa accesible al arrastre). */
$('[data-testid="tablero"]').addEventListener('change', async (evento) => {
  const select = evento.target.closest('[data-accion="mover"]');
  if (!select) return;
  const id = Number(select.closest('.tarea').dataset.id);
  mostrarError('#error-tarea', '');
  try {
    await api('/tareas/' + id, { metodo: 'PUT', cuerpo: { estado: select.value } });
    await cargarTareas();
  } catch (error) {
    mostrarError('#error-tarea', error.message);
    await cargarTareas();
  }
});

$('#boton-cancelar').addEventListener('click', () => dialogoEditar.close());

formEditar.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  mostrarError('#error-editar', '');
  const datos = Object.fromEntries(new FormData(formEditar));
  const id = Number(datos.id);
  delete datos.id;
  try {
    await api('/tareas/' + id, { metodo: 'PUT', cuerpo: datos });
    dialogoEditar.close();
    await cargarTareas();
  } catch (error) {
    mostrarError('#error-editar', error.message);
  }
});

// ------------------------------ Arrastrar y soltar ------------------------------

let idArrastrado = null;

document.addEventListener('dragstart', (evento) => {
  const tarjeta = evento.target.closest('.tarea');
  if (!tarjeta) return;
  idArrastrado = Number(tarjeta.dataset.id);
  tarjeta.classList.add('tarea--arrastrando');
  evento.dataTransfer.effectAllowed = 'move';
  evento.dataTransfer.setData('text/plain', tarjeta.dataset.id);
});

document.addEventListener('dragend', (evento) => {
  const tarjeta = evento.target.closest('.tarea');
  if (tarjeta) tarjeta.classList.remove('tarea--arrastrando');
  idArrastrado = null;
  document
    .querySelectorAll('.columna__lista--destino')
    .forEach((lista) => lista.classList.remove('columna__lista--destino'));
});

for (const lista of document.querySelectorAll('.columna__lista')) {
  lista.addEventListener('dragover', (evento) => {
    evento.preventDefault();
    evento.dataTransfer.dropEffect = 'move';
    lista.classList.add('columna__lista--destino');
  });

  lista.addEventListener('dragleave', (evento) => {
    // Solo se limpia al salir de la lista, no al pasar entre sus hijos.
    if (!lista.contains(evento.relatedTarget)) {
      lista.classList.remove('columna__lista--destino');
    }
  });

  lista.addEventListener('drop', async (evento) => {
    evento.preventDefault();
    lista.classList.remove('columna__lista--destino');

    const id = idArrastrado ?? Number(evento.dataTransfer.getData('text/plain'));
    if (!id) return;

    const estadoDestino = lista.dataset.lista;
    const posicion = calcularPosicionDeSoltado(lista, evento.clientY, id);

    mostrarError('#error-tarea', '');
    try {
      const datos = await api('/tareas/' + id + '/mover', {
        metodo: 'PATCH',
        cuerpo: { estado: estadoDestino, posicion },
      });
      estado.tareas = datos.tareas;
      renderizarTablero();
    } catch (error) {
      mostrarError('#error-tarea', error.message);
      await cargarTareas();
    }
  });
}

/**
 * Calcula el indice donde debe insertarse la tarea segun la posicion vertical
 * del cursor dentro de la columna de destino.
 */
function calcularPosicionDeSoltado(lista, clientY, idArrastrada) {
  const tarjetas = [...lista.querySelectorAll('.tarea')].filter(
    (nodo) => Number(nodo.dataset.id) !== idArrastrada
  );
  let indice = tarjetas.length;
  for (let i = 0; i < tarjetas.length; i += 1) {
    const caja = tarjetas[i].getBoundingClientRect();
    if (clientY < caja.top + caja.height / 2) {
      indice = i;
      break;
    }
  }
  return indice;
}

// --------------------------------- Arranque ---------------------------------

(async function iniciar() {
  if (!estado.token) {
    mostrarPantallaAuth();
    return;
  }
  try {
    const datos = await api('/auth/yo');
    estado.usuario = datos.usuario;
    mostrarPantallaApp();
    await cargarTareas();
  } catch {
    cerrarSesionLocal();
  }
})();
