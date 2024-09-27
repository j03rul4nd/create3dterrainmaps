import * as THREE from "three";
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { ViewHelper } from 'three/examples/jsm/helpers/ViewHelper.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';


class Manager3d {

    scene = null; // Escena 3D
    camera = null; // Cámara 3D
    renderer = null; // Renderizador 3D
    controls = null; // controls scene threejs
    stats = null;
    viewHelper = null;
    clock = null;
    axesHelper = null;

    params = {
        wireframe: false,
        displacementScale: 3.0,
        lowColor: "#ff3333", // Color rojo para baja elevación
        midColor: "#80b3ff", // Color azul para elevación media
        highColor: "#80ff80", // Color verde para alta elevación
        rotationAnimation: false,
        showViewHelper: true,
        applyColors: true, 
        transformControlsVisible: false,
        boxHelperVisible: true,
    };
    
    

    constructor() {

    };

    // Función para renderizar el terreno en 3D a partir de la imagen
    async  renderTerrain3D(imageUrl) {
        const textureLoader = new THREE.TextureLoader();

        const displacementTexture = await new Promise((resolve, reject) => {
            textureLoader.load(
                imageUrl,
                texture => resolve(texture),
                undefined,
                err => reject(err)
            );
        });

        const colorTexture = await new Promise((resolve, reject) => {
            textureLoader.load(
                imageUrl,
                texture => resolve(texture),
                undefined,
                err => reject(err)
            );
        });
        // Crear la geometría del plano
        const planeGeometry = new THREE.PlaneGeometry(10, 10, 256, 256);
    
        // Crear el material con el desplazamiento y la textura de color
        const material = new THREE.ShaderMaterial({
            vertexShader: `
                varying vec2 vUv;
                varying float vDisplacement;
        
                uniform sampler2D uDisplacementTexture;
                uniform float uDisplacementScale;
        
                void main() {
                    vUv = uv;
        
                    vec4 displacement = texture2D(uDisplacementTexture, uv);
                    vDisplacement = displacement.r;
        
                    vec3 newPosition = position + normal * vDisplacement * uDisplacementScale;
        
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
                }
            `,
        
            fragmentShader: `
                varying vec2 vUv;
                varying float vDisplacement;
        
                uniform sampler2D uColorTexture;
                uniform vec3 uLowColor;
                uniform vec3 uMidColor;
                uniform vec3 uHighColor;
                uniform float uColorIntensity;
                uniform bool uApplyColors; // Nuevo uniform para controlar la aplicación de colores
        
                void main() {
                    vec4 textureColor = texture2D(uColorTexture, vUv);
        
                    vec3 lowColor = uLowColor;
                    vec3 midColor = uMidColor;
                    vec3 highColor = uHighColor;
        
                    vec3 gradientColor;
                    if (vDisplacement < 0.5) {
                        gradientColor = mix(lowColor, midColor, smoothstep(0.0, 0.5, vDisplacement));
                    } else {
                        gradientColor = mix(midColor, highColor, smoothstep(0.5, 1.0, vDisplacement));
                    }
        
                    vec3 finalColor;
                    if (uApplyColors) {
                        finalColor = mix(textureColor.rgb, gradientColor, uColorIntensity); // Aplicar los colores
                    } else {
                        finalColor = textureColor.rgb; // No aplicar los colores, usar la textura original
                    }
        
                    gl_FragColor = vec4(finalColor, 1.0);
                }
            `,
        
            uniforms: {
                uDisplacementTexture: { value: displacementTexture },
                uColorTexture: { value: colorTexture },
                uDisplacementScale: { value: this.params.displacementScale },
                uLowColor: { value: new THREE.Color(this.params.lowColor) },
                uMidColor: { value: new THREE.Color(this.params.midColor) },
                uHighColor: { value: new THREE.Color(this.params.highColor) },
                uColorIntensity: { value: 0.4 },
                uApplyColors: { value: this.params.applyColors }, // Añadir el uniform que controla la aplicación de colores
            },
        
            side: THREE.DoubleSide,
            wireframe: this.params.wireframe,
        });
        
    
        // Eliminar la malla previa si existe
        const existingMesh = this.scene.getObjectByName('terrainMesh');
        if (existingMesh) {
            this.scene.remove(existingMesh);
        }
    
        // Crear la malla del terreno
        const plane = new THREE.Mesh(planeGeometry, material);
        plane.rotation.x = -Math.PI / 2;
        plane.position.y = 2;
        plane.receiveShadow = true;
        plane.castShadow = true;
        plane.name = 'terrainMesh';
    
        
        
        
        this.scene.add(plane);
        
        this.transformControls.attach(plane);
        
        // Añadir un BoxHelper para visualizar el límite del objeto
        this.initBoxHelper(plane);

    }
    initBoxHelper(plane){
        // Añadir un BoxHelper para visualizar el límite del objeto
        if (this.boxHelper) {
            this.scene.remove(this.boxHelper);  // Eliminar el BoxHelper anterior si existe
        }
        this.boxHelper = new THREE.BoxHelper(plane, 0xffff00);  // Guardar la referencia
        this.boxHelper.visible = this.params.boxHelperVisible;  // Establecer la visibilidad según el parámetro
        this.scene.add(this.boxHelper);
    }
    initTransformControls() {
        // Añadir TransformControls
        this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
        this.transformControls.addEventListener('change', () => this.renderer.render(this.scene, this.camera)); // Actualizar el render cuando los controles cambian
        
        // Establecer visibilidad por defecto como false
        this.transformControls.visible = false;
    
        this.scene.add(this.transformControls);
    
        // Asegúrate de que OrbitControls no interfieran con TransformControls
        this.transformControls.addEventListener('dragging-changed', (event) => {
            this.controls.enabled = !event.value;
        });
    }
    

    async init3dScene() {

        this.scene = new THREE.Scene(); // Crea la escena 3D
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000); // Crea la cámara 3D
        this.camera.position.set(0, 7, 15); // Posiciona la cámara

        const canvas3D = document.getElementById('terrain-canvas'); // Obtiene el canvas para renderizado

        this.renderer = new THREE.WebGLRenderer({
            canvas: canvas3D,
            antialias: true,
            preserveDrawingBuffer: true,
        });

        this.renderer.setSize(window.innerWidth, window.innerHeight); // Establece el tamaño del renderizador
        this.renderer.shadowMap.enabled = true; // Habilita sombras
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.controls = new OrbitControls(this.camera, this.renderer.domElement); // Configura los controles
        this.controls.saveState();

        // Añadir TransformControls
        this.initTransformControls()


        // Añadir luces a la escena
        this.initlightsScene();

        // Add axes helper in to scene:
        this.initAxesHelper();

        this.clock = new THREE.Clock();

        // Inicializar el ViewHelper
        // this.initViewHelper(): // aun en desarrollo

        // Inicializar Stats
        this.initStats();

        // Configurar la GUI
        this.initGUI();

        // Animar la escena
        const animate = () => {
            requestAnimationFrame(animate);
        
            this.stats.begin(); 

            // Actualiza y renderiza el ViewHelper
            // this.updateViewHelper(); // aun en desarrollo 
        
            // Animación de rotación del terreno (si está habilitada)
            this.updateParams();
        
            this.controls.update();
            this.renderer.clear();
            this.renderer.render(this.scene, this.camera);
            this.stats.end(); 
        };
        

        animate(); // Inicia la animación

        await this.transforImgageTo3D();
    }

    updateParams(){
        if (this.params.rotationAnimation) {
            const terrainMesh = this.scene.getObjectByName('terrainMesh');
            if (terrainMesh) {
                terrainMesh.rotation.z += 0.01; // Velocidad de rotación
            }
        }
        if(this.params.transformControlsVisible){
            this.transformControls.visible = true;
            this.transformControls.enabled = true; 
        }else{
            this.transformControls.visible = false;
            this.transformControls.enabled = false; 
        }
    }

    initStats(){
        this.stats = new Stats();
        this.stats.showPanel(0); // 0: FPS, 1: ms, 2: mb, 3+: personalizados

        // Estilizar el panel para posicionarlo en la esquina superior derecha
        this.stats.domElement.style.position = 'absolute';
        this.stats.domElement.style.top = '0';
        this.stats.domElement.style.right = '0';
        this.stats.domElement.style.left = 'auto';

        // Agregar el panel al contenedor
        const container = document.getElementById('canvas-container');
        container.appendChild(this.stats.domElement);
    }

    initAxesHelper(){
        this.axesHelper = new THREE.AxesHelper(20);
        this.axesHelper.visible = false;  // Inicialmente no visible
        this.scene.add(this.axesHelper);
    }

    initlightsScene(){
        // Añadir luces a la escena
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.3); // Luz ambiental
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0); // Luz direccional
        directionalLight.position.set(5, 10, 7);
        directionalLight.castShadow = true; // Permitir que la luz genere sombras
        directionalLight.shadow.mapSize.set(2048, 2048); // Tamaño de las sombras
        this.scene.add(directionalLight);

        const pointLight = new THREE.PointLight(0xffffff, 0.5); // Luz puntual
        pointLight.position.set(-5, 10, -5);
        pointLight.castShadow = true; // Permitir que la luz genere sombras
        this.scene.add(pointLight);
    }

    listeners(){

        // Listener para guardar la posición de la cámara
        const btnCameraSave = document.getElementById("btnCameraSave");
        btnCameraSave.addEventListener("click", () => {
            const span = btnCameraSave.querySelector("span");
            span.textContent = 'Saving...';
            btnCameraSave.disabled = true;

            try {
                this.controls.saveState(); // Guarda el estado de la cámara
                console.log("Posición de la cámara guardada.");
                span.textContent = 'Saved!';
            } catch (error) {
                console.error('Error al guardar la posición de la cámara:', error);
                span.textContent = 'Error!';
            }

            setTimeout(() => {
                span.textContent = 'Save';
                btnCameraSave.disabled = false;
            }, 2000);
        });

        // Listener para restablecer la posición de la cámara
        const btnCameraReset = document.getElementById("btnCameraReset");
        btnCameraReset.addEventListener("click", () => {
            const span = btnCameraReset.querySelector("span");
            span.textContent = 'Resetting...';
            btnCameraReset.disabled = true;

            try {
                this.controls.reset(); // Restablece la posición de la cámara
                console.log("Posición de la cámara restablecida.");
                span.textContent = 'Reset!';
            } catch (error) {
                console.error('Error al restablecer la posición de la cámara:', error);
                span.textContent = 'Error!';
            }

            setTimeout(() => {
                span.textContent = 'Reset';
                btnCameraReset.disabled = false;
            }, 2000);
        });

    }

    initGUI() {
        // Configurar la GUI
        const gui = new dat.GUI({ autoPlace: false });
        const guiContainer = document.getElementById('canvas-container');
        guiContainer.appendChild(gui.domElement);
    
        // Crear carpetas (folders) para organizar los parámetros
        const appearanceFolder = gui.addFolder('Apariencia');
        const displacementFolder = gui.addFolder('Desplazamiento');
        const animationFolder = gui.addFolder('Animaciones');
        const helpersFolder = gui.addFolder('Ayudas Visuales');
    
        // Apariencia - Colores y Malla
        appearanceFolder.add(this.params, 'wireframe').name('Mostrar Wireframe').onChange(value => {
            const terrainMesh = this.scene.getObjectByName('terrainMesh');
            if (terrainMesh) {
                terrainMesh.material.wireframe = value;
            }
        });
    
        appearanceFolder.addColor(this.params, 'lowColor').name('Color Bajo').onChange(value => {
            this.transforImgageTo3D();
        });
    
        appearanceFolder.addColor(this.params, 'midColor').name('Color Medio').onChange(value => {
            this.transforImgageTo3D();
        });
    
        appearanceFolder.addColor(this.params, 'highColor').name('Color Alto').onChange(value => {
            this.transforImgageTo3D();
        });
    
        appearanceFolder.add(this.params, 'applyColors').name('Aplicar Colores').onChange(value => {
            this.transforImgageTo3D();
        });
    
        // Desplazamiento - Escala
        displacementFolder.add(this.params, 'displacementScale', 0.1, 10).name('Escala de Desplazamiento').onChange(value => {
            this.transforImgageTo3D();
        });

        // Si decides habilitar el viewHelper más adelante, puedes descomentar esto:
        // helpersFolder.add(this.params, 'showViewHelper').name('Mostrar ViewHelper').onChange(value => {
        //     this.viewHelper.visible = value; // Cambiar visibilidad del ViewHelper
        // });
        


    
        // Animaciones
        animationFolder.add(this.params, 'rotationAnimation').name('Animar Rotación');
    
        // Ayudas Visuales - Ejes y otros helpers
        helpersFolder.add(this.axesHelper, 'visible').name('Mostrar Ejes');
        // Añadir opción para mostrar u ocultar los TransformControls
        helpersFolder.add(this.params, 'transformControlsVisible').name('Mostrar Transform Controls');

        // Ayudas Visuales - Controlar la visibilidad del BoxHelper
        helpersFolder.add(this.params, 'boxHelperVisible').name('Mostrar Box Helper').onChange(value => {
            if (this.boxHelper) {
                this.boxHelper.visible = value;
                this.boxHelper.update();  // Actualiza el BoxHelper para reflejar los cambios

            }
        });

        // Abrir carpetas por defecto
        appearanceFolder.open();
        displacementFolder.open();
        animationFolder.open();
        helpersFolder.open();
    }    

    async transforImgageTo3D() {
        const image = document.getElementById('terrain-image').src;
        await this.renderTerrain3D(image);
    }

    export3DModel() {
        return new Promise((resolve, reject) => {
            try {
                const exporter = new GLTFExporter();
    
                // Obtener la malla del terreno
                const terrainMesh = this.scene.getObjectByName('terrainMesh');
    
                if (!terrainMesh) {
                    console.error('No se encontró la malla del terreno para exportar.');
                    reject('No se encontró la malla del terreno para exportar.');
                    return;
                }
    
                // Clonar la geometría y el material para no afectar los originales
                const geometry = terrainMesh.geometry.clone();
                const originalMaterial = terrainMesh.material;
    
                // Obtener los atributos necesarios
                const positionAttribute = geometry.attributes.position;
                const uvAttribute = geometry.attributes.uv;
    
                // Obtener los uniformes del material original
                const displacementTexture = originalMaterial.uniforms.uDisplacementTexture.value;
                const displacementScale = originalMaterial.uniforms.uDisplacementScale.value;
    
                // Asegurarse de que la textura de desplazamiento esté cargada
                if (!displacementTexture.image) {
                    console.error('La textura de desplazamiento aún no está cargada.');
                    reject('La textura de desplazamiento aún no está cargada.');
                    return;
                }
    
                // Crear un canvas para extraer los datos de la textura de desplazamiento
                const displacementCanvas = document.createElement('canvas');
                displacementCanvas.width = displacementTexture.image.width;
                displacementCanvas.height = displacementTexture.image.height;
                const displacementContext = displacementCanvas.getContext('2d');
                displacementContext.drawImage(displacementTexture.image, 0, 0);
                const displacementImageData = displacementContext.getImageData(0, 0, displacementCanvas.width, displacementCanvas.height).data;
    
                // Aplicar el desplazamiento a cada vértice con validaciones
                for (let i = 0; i < positionAttribute.count; i++) {
                    // Obtener la posición y UV del vértice
                    let x = positionAttribute.getX(i);
                    let y = positionAttribute.getY(i);
                    let z = positionAttribute.getZ(i);
                    let u = uvAttribute.getX(i);
                    let v = uvAttribute.getY(i);
    
                    // Asegurarse de que u y v están en el rango [0,1]
                    u = THREE.MathUtils.clamp(u, 0, 1);
                    v = THREE.MathUtils.clamp(v, 0, 1);
    
                    // Calcular la posición en píxeles en la textura
                    let px = Math.floor(u * (displacementCanvas.width - 1));
                    let py = Math.floor(v * (displacementCanvas.height - 1));
    
                    // Invertir el eje Y de la textura si es necesario
                    let flippedPy = displacementCanvas.height - py - 1;
    
                    // Asegurarse de que px y flippedPy están dentro de los límites
                    px = THREE.MathUtils.clamp(px, 0, displacementCanvas.width - 1);
                    flippedPy = THREE.MathUtils.clamp(flippedPy, 0, displacementCanvas.height - 1);
    
                    // Obtener el índice en el array de datos
                    const index = (flippedPy * displacementCanvas.width + px) * 4;
    
                    // Verificar que el índice está dentro de los límites del array
                    if (index < 0 || index >= displacementImageData.length) {
                        console.warn(`Índice fuera de rango en la textura de desplazamiento: ${index}`);
                        continue; // Saltar este vértice si el índice es inválido
                    }
    
                    const r = displacementImageData[index] / 255; // Normalizar entre 0 y 1
    
                    // Verificar si r es un número válido
                    if (isNaN(r) || !isFinite(r)) {
                        console.warn(`Valor de desplazamiento inválido en el vértice ${i}.`);
                        continue; // Saltar este vértice si r es inválido
                    }
    
                    // Calcular el desplazamiento
                    const displacement = r * displacementScale;
    
                    // Aplicar el desplazamiento al vértice en el eje Z (debido a la rotación del plano)
                    z += displacement;
    
                    // Verificar que x, y, z son números válidos
                    if (isNaN(x) || isNaN(y) || isNaN(z)) {
                        console.warn(`Coordenadas inválidas en el vértice ${i}.`);
                        continue; // Saltar este vértice si alguna coordenada es inválida
                    }
    
                    // Actualizar la posición del vértice
                    positionAttribute.setXYZ(i, x, y, z);
                }
    
                // Marcar el atributo de posición para actualización
                positionAttribute.needsUpdate = true;
                geometry.computeVertexNormals(); // Recalcular las normales para iluminación correcta
                geometry.computeBoundingBox(); // Calcular la caja delimitadora
    
                // Establecer min y max para el accesor de posición
                const boundingBox = geometry.boundingBox;
                const min = boundingBox.min;
                const max = boundingBox.max;
    
                positionAttribute.min = [min.x, min.y, min.z];
                positionAttribute.max = [max.x, max.y, max.z];
    
                // Crear un material estándar con la textura de color
                const exportMaterial = new THREE.MeshStandardMaterial({
                    map: originalMaterial.uniforms.uColorTexture.value,
                    side: THREE.DoubleSide,
                });
    
                // Crear una nueva malla para la exportación
                const exportMesh = new THREE.Mesh(geometry, exportMaterial);
    
                // Exportar la malla
                exporter.parse(
                    exportMesh,
                    (result) => {
                        const output = JSON.stringify(result, null, 2);
                        const blob = new Blob([output], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
    
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = '3d-terrain-model.gltf';
                        link.click();
    
                        // Liberar el objeto URL
                        URL.revokeObjectURL(url);
                        resolve();
                    },
                    (error) => {
                        console.error('Error al exportar el modelo 3D:', error);
                        reject(error);
                    },
                    { binary: false }
                );
            } catch (error) {
                console.error(error);
                reject(error);
            }
        });
    }

    // aun en desarrollo:
    initViewHelper(){
        // Inicializar el ViewHelper
        this.viewHelper = new ViewHelper(this.camera, this.renderer.domElement );
        this.scene.add(this.viewHelper); // Asegúrate de agregarlo a la escena si es necesario.


        this.viewHelper.controls = this.controls;
        this.viewHelper.controls.center = this.controls.target;
        this.viewHelper.visible = this.params.showViewHelper;

        const viewHelperElement =  document.createElement('div');
        viewHelperElement.id = 'viewHelper';
        document.getElementById("canvas-container").appendChild( viewHelperElement );

        viewHelperElement.addEventListener('pointerup', (event) => this.viewHelper.handleClick(event));

    }
    updateViewHelper(){
        const delta = this.clock.getDelta();
        if (this.params.showViewHelper && this.viewHelper.animating) {
            this.viewHelper.update(delta); // Actualiza el ViewHelper
            this.viewHelper.render(this.renderer); // Renderiza el ViewHelper
        }
    }

}

export class engine {
    map = null; // Variable para almacenar el mapa
    originalImageData = "/mountain.png"; // Variable para almacenar la imagen original

    constructor(options) {

        this.manager3d = new Manager3d();
        // Aquí se pueden inicializar opciones si es necesario
    }

    init() {
        this.lazyLoading(); // Inicia el proceso de carga diferida
        this.manager3d.init3dScene(); // Inicializa la escena 3D
        this.manager3d.listeners(); // añade los listeners de la escena 3D

        this.listennersEditImage();

        // Se usa un arrow function para mantener el contexto de "this"
        const generateTerrainBtn = document.getElementById("generate-terrain-btn");
            generateTerrainBtn.addEventListener("click", async () => {
            generateTerrainBtn.textContent = 'Loading...';
            generateTerrainBtn.disabled = true;

            try {
                await this.manager3d.transforImgageTo3D();
                generateTerrainBtn.textContent = 'Success!';
            } catch (error) {
                console.error(error);
                generateTerrainBtn.textContent = 'Error!';
            }

            setTimeout(() => {
                generateTerrainBtn.textContent = 'Generate 3D Terrain';
                generateTerrainBtn.disabled = false;
            }, 2000);
        });


          // Listener para exportar la imagen
          const exportImageBtn = document.getElementById("export-image-btn");
          exportImageBtn.addEventListener("click", async () => {
              exportImageBtn.textContent = 'Loading...';
              exportImageBtn.disabled = true;
  
              try {
                  await this.exportImage();
                  exportImageBtn.textContent = 'Success!';
              } catch (error) {
                  console.error(error);
                  exportImageBtn.textContent = 'Error!';
              }
  
              setTimeout(() => {
                  exportImageBtn.textContent = 'Export Image';
                  exportImageBtn.disabled = false;
              }, 2000);
          });

        // Listener para exportar el modelo 3D
        const export3DBtn = document.getElementById("export-3d-btn");
        export3DBtn.addEventListener("click", async () => {
            export3DBtn.textContent = 'Loading...';
            export3DBtn.disabled = true;

            try {
                await this.manager3d.export3DModel();
                export3DBtn.textContent = 'Success!';
            } catch (error) {
                console.error(error);
                export3DBtn.textContent = 'Error!';
            }

            setTimeout(() => {
                export3DBtn.textContent = 'Export 3D Model';
                export3DBtn.disabled = false;
            }, 2000);
        });


    }

    // Función para exportar la imagen como PNG
    exportImage() {
        return new Promise((resolve, reject) => {
            try {
                const link = document.createElement('a');
                const canvas = document.getElementById('edited-canvas');
                const imageData = canvas.toDataURL('image/png');

                link.href = imageData;
                link.download = 'terrain-image.png';
                link.click();
                resolve();
            } catch (error) {
                console.error(error);
                reject(error);
            }
        });
    }


    applyImageAdjustments() {
        const img = new Image();
        img.src = this.originalImageData;

        img.onload = () => {
            const canvas = document.getElementById('edited-canvas');
            const ctx = canvas.getContext('2d');

            // Establecer dimensiones del canvas
            canvas.width = img.width;
            canvas.height = img.height;

            // Limpiar el canvas y dibujar la imagen
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);

            // Obtener valores de ajuste
            const blackLevel = parseInt(document.getElementById('blackLevel').value);
            const whiteLevel = parseInt(document.getElementById('whiteLevel').value);
            const gamma = parseFloat(document.getElementById('gamma').value);

            // Obtener datos de la imagen
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            // Procesar cada píxel
            for (let i = 0; i < data.length; i += 4) {
                let pixelValue = data[i]; // Valor de gris

                // Ajustar niveles de negro y blanco
                let normalizedPixel = (pixelValue - blackLevel) / (whiteLevel - blackLevel);
                normalizedPixel = Math.max(0, Math.min(1, normalizedPixel));

                // Aplicar corrección gamma
                let gammaCorrected = Math.pow(normalizedPixel, 1 / gamma);

                // Mapear de vuelta a 0-255
                let newPixelValue = gammaCorrected * 255;
                newPixelValue = Math.max(0, Math.min(255, newPixelValue));

                // Asignar nuevo valor al píxel
                data[i] = data[i + 1] = data[i + 2] = newPixelValue;
                // data[i + 3] es el canal alfa, se deja igual
            }

            // Actualizar los datos de la imagen en el canvas
            ctx.putImageData(imageData, 0, 0);

            // Actualizar la imagen de vista previa
            document.getElementById('terrain-image').src = canvas.toDataURL('image/png');
        };
    }

    listennersEditImage() {
        const _me = this; 
        // Agregar eventos a los nuevos controles
        document.getElementById('blackLevel').addEventListener('input', () => {
            this.applyImageAdjustments();
        });
        document.getElementById('whiteLevel').addEventListener('input', () => {
            this.applyImageAdjustments();
        });
        document.getElementById('gamma').addEventListener('input', () => {
            this.applyImageAdjustments();
        });
    }

    lazyLoading() {
        // Usamos una función de flecha para mantener el contexto de "this"
        window.addEventListener('load', () => {
            console.log("Window load, map will be initialized");
            const mapSection = document.getElementById('leaflet-map-container');
            console.log("Map section:", mapSection);

            if (!mapSection) {
                console.error('Map container not found');
                return;
            }

            // Lazy loading con IntersectionObserver
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.intersectionRatio > 0.1) {
                        console.log("Map section visible, loading map");
                        this.initializeMap(); // Inicializa el mapa
                        observer.unobserve(entry.target); // Deja de observar una vez cargado
                    }
                });
            }, { threshold: [0.1] });

            observer.observe(mapSection); // Inicia la observación del mapa
        });
    }

    initializeMap() {
        this.initOlMap(); // Inicializa el mapa de OpenLayers

        // Captura el terreno al hacer clic
        document.getElementById('capture-terrain-btn').addEventListener('click', () => {
            console.log('Capturando terreno...');
            this.getPreviewImage(); // Captura la imagen del mapa
        });
    }

    initOlMap() {
        // Inicializa el mapa usando OpenLayers
        const normal = new ol.source.XYZ({
            // URL de las teselas en formato normal
            url: "https://s3.amazonaws.com/elevation-tiles-prod/normal/{z}/{x}/{y}.png"
        });

        const terrarium = new ol.source.XYZ({
            // URL de las teselas en formato terrarium
            url: "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
            crossOrigin: "anonymous" // Habilita el acceso a recursos externos
        });

        const elevation = new ol.source.Raster({
            sources: [terrarium], // Fuente de datos
            operationType: "pixel", // Operación a nivel de píxel
            operation: ([pixel]) => {
                const [r, g, b] = pixel; // Desestructura los canales de color
                const elevation = (r << 8) + g + (b / 256) - 32768; // Decodifica la elevación
                const minElevation = -11000, maxElevation = 8900; // Rango de elevación

                // Normaliza la elevación
                let normalizedValue = Math.max(0, Math.min(255, (elevation - minElevation) * 255 / (maxElevation - minElevation)));
                const contrastFactor = 1.5; // Factor de contraste ajustable
                normalizedValue = ((normalizedValue - 128) * contrastFactor) + 128; // Ajusta el contraste
                const gammaExponent = 1.5; // Exponente para corrección gamma
                const gammaCorrection = Math.pow(Math.max(0, Math.min(255, normalizedValue)) / 255, gammaExponent) * 255; // Aplica corrección gamma

                // Devuelve el píxel ajustado con un canal alfa fijo
                return [gammaCorrection, gammaCorrection, gammaCorrection, 255];
            }
        });

        // Se crea el mapa de OpenLayers
        this.map = new ol.Map({
            target: "leaflet-map-container", // Div donde se mostrará el mapa
            layers: [
                new ol.layer.Image({
                    source: elevation, // Fuente de datos de elevación
                    opacity: 1.0 // Opacidad completa
                })
            ],
            view: new ol.View({
                center: ol.proj.fromLonLat([-95.867, 37.963]), // Centro del mapa
                zoom: 4 // Nivel de zoom inicial
            })
        });
    }

    getPreviewImage() {
        // Captura la imagen del mapa y la muestra en la vista previa
        const canvas = document.querySelector('#leaflet-map-container canvas');
        if (canvas) {
            const imageDataUrl = canvas.toDataURL('image/png'); // Convierte el canvas a imagen PNG

            let editImageCanvas = document.getElementById('edited-canvas');
            const ctx = editImageCanvas.getContext('2d');

            editImageCanvas.width = canvas.width;
            editImageCanvas.height = canvas.height;

            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0);
                document.getElementById('terrain-image').src = imageDataUrl;
                this.originalImageData = imageDataUrl; // Guarda la imagen original

                // Restablecer los valores de los inputs a sus valores por defecto
                document.getElementById('blackLevel').value = 0;
                document.getElementById('whiteLevel').value = 255;
                document.getElementById('gamma').value = 1;

                // Aplicar los ajustes de imagen con los valores por defecto
                this.applyImageAdjustments();
            };
            img.src = imageDataUrl;
        } else {
            console.error('Canvas not found for preview image.');
        }
    }
      
    
}
