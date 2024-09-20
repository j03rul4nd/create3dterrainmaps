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
            const contentCard = document.querySelector('.sectionContentComponentCard');
            const isOpen = contentCard.getAttribute('data-is-open') === 'true';
            
            if (isOpen) {
                contentCard.setAttribute('data-is-open', 'false');
            } else {
                contentCard.setAttribute('data-is-open', 'true');
            }
        }
        toggleHeader.addEventListener('click', toggleContent);
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
