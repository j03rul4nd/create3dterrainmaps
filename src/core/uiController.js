export class uiController {
    constructor(options) {
        // Aquí puedes pasar opciones como configuraciones de umbral, root, etc.
        this.options = options || {};
    }

    // Método para inicializar el controlador de UI
    init() {
        this.initLazyLoading();
        this.initListenersSections();
        this.setJuicyEffect();
        this.initListenerFileOptionsImage();
        this.detectbrowser();
    }

    detectbrowser(){
        // Detectar si es Safari
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

        if (isSafari) {
            // Si es Safari, agregamos una clase al body
            document.body.classList.add('safari');
        } else {
            // Si no es Safari, podemos aplicar la clase para el blur
            document.body.classList.add('not-safari');
        }

    }

    // Método para configurar y aplicar lazy loading con Intersection Observer
    initLazyLoading() {
        // Selecciona todos los elementos que deseas observar (secciones y artículos)
        const sections = document.querySelectorAll('section, article');
        
        // Configura el IntersectionObserver
        const observer = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                // Si el elemento está visible en el viewport
                if (entry.isIntersecting) {
                    // Añade la clase 'visible' para mostrar el elemento
                    entry.target.classList.add('visible');
                    // Deja de observar el elemento una vez que se ha hecho visible
                    observer.unobserve(entry.target);
                }
            });
        });

        // Observa cada sección
        sections.forEach(section => {
            observer.observe(section);
        });
    }
    initListenersSections(){
       
        const toggleHeader =  document.getElementById('toggleHeaderImageOptions');
        function toggleContent() {
            const contentCard = document.querySelector('#image-section .sectionContentComponentCard');
            const isOpen = contentCard.getAttribute('data-is-open') === 'true';
            
            if (isOpen) {
                contentCard.setAttribute('data-is-open', 'false');
            } else {
                contentCard.setAttribute('data-is-open', 'true');
            }
            console.log("contentCard image clciked")

        }
        toggleHeader.addEventListener('click', toggleContent);

        // Selecciona el encabezado del nuevo componente
        const toggleHeaderMapOptions = document.getElementById('toggleHeaderMapOptions');

        function toggleMapContent() {
            const contentCard = toggleHeaderMapOptions.closest('.sectionContentComponentCard');
            const isOpen = contentCard.getAttribute('data-is-open') === 'true';

            if (isOpen) {
                contentCard.setAttribute('data-is-open', 'false');
            } else {
                contentCard.setAttribute('data-is-open', 'true');
            }
            console.log("contentCard Map clciked")
        }

        // Añade el evento de clic al nuevo encabezado
        toggleHeaderMapOptions.addEventListener('click', toggleMapContent);


    }

    initListenerFileOptionsImage(){
        // Seleccionar los elementos del DOM
        const fileInput = document.getElementById('options-image-texture-file');
        const fileNameDisplay = document.getElementById('custom-texture-file-name');
        const fileUploadButton = document.getElementById('custom-file-upload');
        const clearFileButton = document.getElementById('clear-file-upload');
        const imagePreviewContainer = document.getElementById('image-preview');
        const previewImage = document.getElementById('preview-img');

        // Añadir un listener al botón para que abra el selector de archivos
        fileUploadButton.addEventListener('click', function(event) {
            event.preventDefault(); // Evitar el comportamiento por defecto del botón
            fileInput.click(); // Disparar el click en el input de tipo file
        });

        // Cambiar el texto del span cuando el usuario seleccione un archivo y mostrar vista previa
        fileInput.addEventListener('change', function() {
            if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            fileNameDisplay.textContent = file.name; // Mostrar el nombre del archivo seleccionado
            clearFileButton.style.display = 'inline-block'; // Mostrar el botón de limpiar

            // Comprobar si el archivo es una imagen válida
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = function(e) {
                previewImage.src = e.target.result; // Mostrar la imagen cargada en la vista previa
                imagePreviewContainer.style.display = 'block'; // Mostrar el cuadro de vista previa
                }
                reader.readAsDataURL(file); // Leer el archivo como una URL
            }
            } else {
            fileNameDisplay.textContent = 'No file selected'; // Volver a mostrar el texto por defecto si no hay archivo
            clearFileButton.style.display = 'none'; // Ocultar el botón de limpiar
            imagePreviewContainer.style.display = 'none'; // Ocultar el cuadro de vista previa
            }
        });

        // Añadir un listener al botón de limpiar para borrar el archivo seleccionado y ocultar vista previa
        clearFileButton.addEventListener('click', function(event) {
            event.preventDefault(); // Evitar el comportamiento por defecto del botón
            fileInput.value = ''; // Limpiar el valor del input file
            fileNameDisplay.textContent = 'No file selected'; // Restablecer el texto del nombre del archivo
            clearFileButton.style.display = 'none'; // Ocultar el botón de limpiar nuevamente
            imagePreviewContainer.style.display = 'none'; // Ocultar el cuadro de vista previa
            previewImage.src = ''; // Limpiar la imagen de vista previa
        });
    }

    setJuicyEffect(){

        let selectors = [
            ".btn-stnd",
            // "#btnCloseAddSettings",
        ];
        
        selectors.forEach(function(selector) {
            var elementsToModify = document.querySelectorAll(selector);
        
            elementsToModify.forEach(function(element) {
                element.addEventListener("touchstart", function() {
                    this.classList.add("contractedItem");
                });
                
                element.addEventListener("mousedown", function() {
                    this.classList.add("contractedItem");
                });
        
                element.addEventListener("touchend", function() {
                    this.classList.remove("contractedItem");
                });
                
                element.addEventListener("mouseup", function() {
                    this.classList.remove("contractedItem");
                });
            });
        });        

    }
}
