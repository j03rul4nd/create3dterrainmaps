import { uiController } from "./src/core/uiController.js";
import { engine } from "./src/core/engine.js";

// Configuración de opciones generales, fácilmente escalable para futuras funcionalidades
const options = {
  modeUI: "development",  // "development" o "production"
  lang: "en",             // Idioma predeterminado
  author: "Joel Benitez",
  rss: {
    linkedin: "https://www.linkedin.com/in/joel-benitez-iiot-industry/",
    portfolio: "https://joelbenitez.onrender.com/"
  },
  version: "0.0.1",
  lastUpdated: "17/09/2024",
  description: "A simple web application that provides 3d terrain free"
};

// Encapsulamos la lógica de inicialización en una función de arranque para mejorar la organización y el control.
function initApp() {
  // Medición del rendimiento en consola
  console.time('UI Initialization');
  console.time('Engine Initialization');

  try {
    // Inicializar el controlador de UI
    const ui = new uiController(options);
    ui.init();
    window.uiController = ui; // Hacemos que esté accesible desde `window`
    console.timeEnd('UI Initialization');  // Fin de la medición de la UI
  } catch (error) {
    console.error('Error initializing UI:', error);
  }

  try {
    // Inicializar el motor 3D
    const engineInstance = new engine(options);
    engineInstance.init();
    window.engine = engineInstance;  // Hacemos que esté accesible desde `window`
    console.timeEnd('Engine Initialization');  // Fin de la medición del Engine
  } catch (error) {
    console.error('Error initializing Engine:', error);
  }
}

// Escuchar el evento `DOMContentLoaded` para asegurarse de que el DOM está completamente cargado antes de ejecutar
document.addEventListener('DOMContentLoaded', initApp);

