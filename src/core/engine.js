import * as THREE from "three";
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { ViewHelper } from 'three/examples/jsm/helpers/ViewHelper.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';


class Manager3d {

    scene = null; // Escena 3D
    camera = null; // Cámara 3D
    renderer = null; // Renderizador 3D
    controls = null; // controls scene threejs
    stats = null;
    viewHelper = null;
    clock = null;
    axesHelper = null;
    gridHelper = null;

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
        transformControlsMode: 'translate', 
        boxHelperVisible: true,
        gridVisible: false,
    };

    constructor() {

    };

    // Función para renderizar el terreno en 3D a partir de la imagen
    async  renderTerrain3D(imageUrl, textureImage = false) {

        const existingTerrainPreview = this.scene.getObjectByName('terrainMeshPreview');
        if(existingTerrainPreview){
            this.scene.remove(existingTerrainPreview);
        }

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
            const textureUrl = textureImage ? textureImage : imageUrl;
            textureLoader.load(
                textureUrl,
                texture => resolve(texture),
                undefined,
                err => reject(err)
            );
        });

        // Obtener las dimensiones de la textura
        const imageWidth = displacementTexture.image.width;
        const imageHeight = displacementTexture.image.height;

        // Calcular la relación de aspecto de la imagen
        const aspectRatio = imageWidth / imageHeight;

        // Ajustar las dimensiones de la geometría del plano según la relación de aspecto
        const planeWidth = 10 * aspectRatio; // El ancho de la geometría se escala según el aspecto
        const planeHeight = 10; // Mantener la altura fija, o también ajustar si es necesario

        // Crear la geometría del plano con el tamaño ajustado
        // const planeGeometry = new THREE.PlaneGeometry(planeWidth, planeHeight, 256, 256);


        // Crear la geometría del plano
        const planeGeometry = new THREE.PlaneGeometry(planeWidth, planeHeight, 256, 256);
    
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
    initGridHelper() {
        this.gridHelper = new THREE.GridHelper(50, 50); // Crear la cuadrícula
        this.gridHelper.visible = this.params.gridVisible; // Inicialmente no visible
        this.scene.add(this.gridHelper); // Agregar a la escena
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
    
        // Evento que se activa cuando hay un cambio en el objeto (movimiento, escala, rotación)
        this.transformControls.addEventListener('objectChange', () => {
            if (this.boxHelper) {
                this.boxHelper.update();  // Actualizar el BoxHelper
            }
            this.renderer.render(this.scene, this.camera); // Renderizar la escena después del cambio
        });
    
        this.transformControls.addEventListener('change', () => this.renderer.render(this.scene, this.camera)); // Actualizar el render cuando los controles cambian
    
        // Establecer visibilidad y modo por defecto
        this.transformControls.visible = this.params.transformControlsVisible;
        this.transformControls.setMode(this.params.transformControlsMode);
    
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

        // add grid to scene
        this.initGridHelper();

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

        window.addEventListener('resize', () => this.onWindowResize());

        await this.transforImgageTo3D();
    }
    onWindowResize() {
        // Actualizar el aspecto de la cámara con las nuevas dimensiones
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
    
        // Ajustar el tamaño del renderer al nuevo tamaño de la ventana
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    updateParams(){
        if (this.params.rotationAnimation) {
            const terrainMesh = this.scene.getObjectByName('terrainMesh');
            if (terrainMesh) {
                terrainMesh.rotation.z += 0.01; // Velocidad de rotación
            }
            const existingTerrainPreview = this.scene.getObjectByName('terrainMeshPreview');
            if(existingTerrainPreview){
                existingTerrainPreview.rotation.z += 0.01; // Velocidad de rotación
            }
        }
        // Controlar la visibilidad y el modo de TransformControls
        if (this.params.transformControlsVisible) {
            this.transformControls.visible = true;
            this.transformControls.enabled = true;
            this.transformControls.setMode(this.params.transformControlsMode);  // Actualiza el modo (translate, rotate, scale)
        } else {
            this.transformControls.visible = false;
            this.transformControls.enabled = false;
        }
        // Controlar la visibilidad del grid
        if (this.gridHelper) {
            this.gridHelper.visible = this.params.gridVisible;
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
        const appearanceFolder = gui.addFolder('Appearance');
        const displacementFolder = gui.addFolder('Displacement');
        const animationFolder = gui.addFolder('Animations');
        const helpersFolder = gui.addFolder('Visual Helpers');
        const renderFolder = gui.addFolder('Render');    // Crear una nueva carpeta llamada 'Render'
    
        // Apariencia - Colores y Malla
        appearanceFolder.add(this.params, 'wireframe').name('Show Wireframe').onChange(value => {
            const terrainMesh = this.scene.getObjectByName('terrainMesh');
            if (terrainMesh) {
                terrainMesh.material.wireframe = value;
            }
            const existingTerrainPreview = this.scene.getObjectByName('terrainMeshPreview');
            if(existingTerrainPreview){
                existingTerrainPreview.material.wireframe = value;
            }
        });
    
        appearanceFolder.addColor(this.params, 'lowColor').name('Low Color').onChange(value => {
            // this.transforImgageTo3D();
            const existingMesh = this.scene.getObjectByName('terrainMesh');
            if (existingMesh) {
                if (existingMesh.material && existingMesh.material.uniforms) {
                    // Asegúrate de convertir el color a THREE.Color
                    existingMesh.material.uniforms.uLowColor.value = new THREE.Color(value);
                } else {
                    console.warn('El material no tiene uniforms definidos o no es de tipo ShaderMaterial');
                }
            }
        });
    
        appearanceFolder.addColor(this.params, 'midColor').name('Mid Color').onChange(value => {
            // this.transforImgageTo3D(); 
            const existingMesh = this.scene.getObjectByName('terrainMesh');
           if (existingMesh) {
               if (existingMesh.material && existingMesh.material.uniforms) {
                   // Asegúrate de convertir el color a THREE.Color
                   existingMesh.material.uniforms.uMidColor.value = new THREE.Color(value);
               } else {
                   console.warn('El material no tiene uniforms definidos o no es de tipo ShaderMaterial');
               }
           }
            
        });
    
        appearanceFolder.addColor(this.params, 'highColor').name('High Color').onChange(value => {
           const existingMesh = this.scene.getObjectByName('terrainMesh');
           if (existingMesh) {
               if (existingMesh.material && existingMesh.material.uniforms) {
                   // Asegúrate de convertir el color a THREE.Color
                   existingMesh.material.uniforms.uHighColor.value = new THREE.Color(value);
               } else {
                   console.warn('El material no tiene uniforms definidos o no es de tipo ShaderMaterial');
               }
           }
        });
    
        appearanceFolder.add(this.params, 'applyColors').name('Apply Colors').onChange(value => {
            const existingMesh = this.scene.getObjectByName('terrainMesh');
            if (existingMesh) {
                // Verifica que el material sea de tipo ShaderMaterial o tenga uniforms definidos
                if (existingMesh.material && existingMesh.material.uniforms) {
                    existingMesh.material.uniforms.uApplyColors.value = this.params.applyColors;
                } else {
                    console.warn('El material no tiene uniforms definidos o no es de tipo ShaderMaterial');
                }
            }

        });
    
        // Desplazamiento - Escala
        displacementFolder.add(this.params, 'displacementScale', 0.1, 10).name('Displacement Scale').onChange(value => {
            // this.transforImgageTo3D();
            const existingMesh = this.scene.getObjectByName('terrainMesh');
            if (existingMesh) {
                if (existingMesh.material && existingMesh.material.uniforms) {
                    // Asegúrate de convertir el color a THREE.Color
                    existingMesh.material.uniforms.uDisplacementScale.value = value;
                } else {
                    console.warn('El material no tiene uniforms definidos o no es de tipo ShaderMaterial');
                }
            }
        });

        // Si decides habilitar el viewHelper más adelante, puedes descomentar esto:
        // helpersFolder.add(this.params, 'showViewHelper').name('Mostrar ViewHelper').onChange(value => {
        //     this.viewHelper.visible = value; // Cambiar visibilidad del ViewHelper
        // });
        


    
        // Animaciones
        animationFolder.add(this.params, 'rotationAnimation').name('Animate Rotation');
    
        // Ayudas Visuales - Ejes y otros helpers
        helpersFolder.add(this.axesHelper, 'visible').name('Show Axes');
        // Añadir opción para mostrar u ocultar los TransformControls
        helpersFolder.add(this.params, 'transformControlsVisible').name('Show Transform Controls');

        helpersFolder.add(this.params, 'transformControlsMode', ['translate', 'rotate', 'scale']).name('Transform Mode').onChange(value => {
            this.params.transformControlsMode = value; 
        });

        // Ayudas Visuales - Controlar la visibilidad del BoxHelper
        helpersFolder.add(this.params, 'boxHelperVisible').name('Show Box Helper').onChange(value => {
            if (this.boxHelper) {
                this.boxHelper.visible = value;
                this.boxHelper.update();  // Actualiza el BoxHelper para reflejar los cambios

            }
        });

        helpersFolder.add(this.params, 'gridVisible').name('Show Grid').onChange(value => {
            if (this.gridHelper) {
                this.gridHelper.visible = value;
            }
        });

        renderFolder.add({ render: () => {
            const terrainMesh = this.scene.getObjectByName('terrainMesh');
            if (terrainMesh) {
                this.renderToModelGLTFPreview();  // Llamar a la función
            }else{
                console.log("Ya se ha renderizado la vista previa");
            }
           
        } }, 'render').name('Render Preview');
                
        renderFolder.open();  // Abrir la carpeta de forma predeterminada (opcional)

        // Abrir carpetas por defecto
        //appearanceFolder.open();
        //displacementFolder.open();
        //animationFolder.open();
        helpersFolder.open();
    }    

    async transforImgageTo3D() {
        // Obtener la imagen predeterminada para generar el terreno 3D
        const image = document.getElementById('terrain-image').src;
        const defaultImage = document.getElementById("default-Texture-image")
        defaultImage.src = image;
    
        // Obtener la entrada del archivo de textura
        const textureInput = document.getElementById('options-image-texture-file');
        
        // Verificar si se ha seleccionado un archivo de imagen
        if (textureInput.files && textureInput.files.length > 0) {
            const file = textureInput.files[0]; // Obtenemos el primer archivo
            const reader = new FileReader();
    
            reader.onload = async function(event) {
                const textureImage = event.target.result; // La imagen en formato base64
                // Llamamos a renderTerrain3D con la imagen y la textura
                await this.renderTerrain3D(image, textureImage);
            }.bind(this); // Enlazamos `this` para que puedas usar `this.renderTerrain3D` dentro de FileReader
    
            reader.readAsDataURL(file); // Leemos la imagen como URL base64
        } else {
            // Si no hay archivo de textura, llamamos solo con la imagen
            await this.renderTerrain3D(image);
        }
    }
    export3DModel() {
        return new Promise((resolve, reject) => {
            try {
                const exporter = new GLTFExporter();

                const existingTerrainPreview = this.scene.getObjectByName('terrainMeshPreview');
                if(existingTerrainPreview){
                    //ya esta renderizado el modleo solo debemos de exportarlo
                    // Ya existe un modelo renderizado, simplemente exportamos ese modelo sin transformaciones adicionales
                    exporter.parse(
                        existingTerrainPreview,
                        (result) => {
                            const output = JSON.stringify(result, null, 2);
                            const blob = new Blob([output], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);

                            const link = document.createElement('a');
                            link.href = url;
                            link.download = '3d-terrain-model-preview.gltf'; // Nombre de archivo para la vista previa
                            link.click();

                            // Liberar el objeto URL
                            URL.revokeObjectURL(url);
                            resolve();
                        },
                        (error) => {
                            console.error('Error al exportar el modelo 3D de vista previa:', error);
                            reject(error);
                        },
                        { binary: false }
                    );

                }else{
                    // no se ha rendrizado el modelo asi que deberemos de hacerlo nosotros

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

                }
    
                
            } catch (error) {
                console.error(error);
                reject(error);
            }
        });
    }
    exportModelSTL() {
        return new Promise((resolve, reject) => {
            try {
                const exporter = new STLExporter();

                const existingTerrainPreview = this.scene.getObjectByName('terrainMeshPreview');
                if(existingTerrainPreview){
                    //se ha renderizado el modelo preview

                    // Generar la geometría STL
                    const stlString = exporter.parse(existingTerrainPreview);
        
                    // Crear un blob a partir del contenido STL
                    const blob = new Blob([stlString], { type: 'application/vnd.ms-pki.stl' });
        
                    // Crear un enlace para la descarga
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = '3d-terrain-model.stl';
                    link.click();
        
                    // Liberar el objeto URL
                    URL.revokeObjectURL(url);
        
                    resolve();

                }else{
                    // no se ha renderizado el modelo preview
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
        
                    
        
                    // Generar la geometría STL
                    const stlString = exporter.parse(exportMesh);
        
                    // Crear un blob a partir del contenido STL
                    const blob = new Blob([stlString], { type: 'application/vnd.ms-pki.stl' });
        
                    // Crear un enlace para la descarga
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = '3d-terrain-model.stl';
                    link.click();
        
                    // Liberar el objeto URL
                    URL.revokeObjectURL(url);
        
                    resolve();
                }
    
                
            } catch (error) {
                console.error('Error al exportar el modelo STL:', error);
                reject(error);
            }
        });
    }
    // render to scene to 
    renderToModelGLTFPreview() {
        try {
            console.log('Render para previsualización de modelo GLTF clicked');
        
            // Obtener la malla del terreno actual
            const terrainMesh = this.scene.getObjectByName('terrainMesh');
            if (!terrainMesh) {
                console.error('No se encontró la malla del terreno para exportar.');
                return;
            }

            // Clonar la geometría y el material para no afectar los originales
            const geometry = terrainMesh.geometry.clone();
            const originalMaterial = terrainMesh.material;

            // Obtener los atributos necesarios para el desplazamiento
            const positionAttribute = geometry.attributes.position;
            const uvAttribute = geometry.attributes.uv;
            const displacementTexture = originalMaterial.uniforms.uDisplacementTexture.value;
            const displacementScale = originalMaterial.uniforms.uDisplacementScale.value;

            // Asegurarse de que la textura de desplazamiento esté cargada
            if (!displacementTexture.image) {
                console.error('La textura de desplazamiento aún no está cargada.');
                return;
            }

            // Crear un canvas para extraer los datos de la textura de desplazamiento
            const displacementCanvas = document.createElement('canvas');
            displacementCanvas.width = displacementTexture.image.width;
            displacementCanvas.height = displacementTexture.image.height;
            const displacementContext = displacementCanvas.getContext('2d');
            displacementContext.drawImage(displacementTexture.image, 0, 0);
            const displacementImageData = displacementContext.getImageData(0, 0, displacementCanvas.width, displacementCanvas.height).data;

            // Aplicar el desplazamiento a cada vértice
            for (let i = 0; i < positionAttribute.count; i++) {
                let x = positionAttribute.getX(i);
                let y = positionAttribute.getY(i);
                let z = positionAttribute.getZ(i);
                let u = uvAttribute.getX(i);
                let v = uvAttribute.getY(i);

                u = THREE.MathUtils.clamp(u, 0, 1);
                v = THREE.MathUtils.clamp(v, 0, 1);

                let px = Math.floor(u * (displacementCanvas.width - 1));
                let py = Math.floor(v * (displacementCanvas.height - 1));
                let flippedPy = displacementCanvas.height - py - 1;

                px = THREE.MathUtils.clamp(px, 0, displacementCanvas.width - 1);
                flippedPy = THREE.MathUtils.clamp(flippedPy, 0, displacementCanvas.height - 1);

                const index = (flippedPy * displacementCanvas.width + px) * 4;

                if (index < 0 || index >= displacementImageData.length) {
                    continue;
                }

                const r = displacementImageData[index] / 255;
                const displacement = r * displacementScale;

                z += displacement;
                positionAttribute.setXYZ(i, x, y, z);
            }

            positionAttribute.needsUpdate = true;
            geometry.computeVertexNormals();
            geometry.computeBoundingBox();

            // Crear un nuevo material estándar con la textura de color
            const previewMaterial = new THREE.MeshStandardMaterial({
                map: originalMaterial.uniforms.uColorTexture.value,
                side: THREE.DoubleSide,
            });

            // Crear una nueva malla para la previsualización en la escena
            const previewMesh = new THREE.Mesh(geometry, previewMaterial);
            previewMesh.name = 'terrainMeshPreview'; // Nombrar la malla para futuras referencias

            // Remover la malla actual de la escena
            const existingMesh = this.scene.getObjectByName('terrainMesh');
            if (existingMesh) {
                this.scene.remove(existingMesh);
            }

            const existingTerrainPreview = this.scene.getObjectByName('terrainMeshPreview');
            if(existingTerrainPreview){
                this.scene.remove(existingTerrainPreview);
            }

            // Agregar la nueva malla previsualizada a la escena
            this.scene.add(previewMesh);

            // Adjuntar controles de transformación a la nueva malla, si es necesario
            this.transformControls.attach(previewMesh);
            //this.transformControls.setMode('rotate');

            // Opcional: Añadir un BoxHelper para visualizar los límites del modelo
            this.initBoxHelper(previewMesh);

            // Renderizar la escena con la nueva malla
            this.renderer.render(this.scene, this.camera);

            console.log('Malla de previsualización renderizada.');
        } catch (error) {
            console.error(error);
        }   
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

class ManagerMap{
    constructor(){
        this.map = null;
        this.mapProviders = {};
        this.currentLayer = null;
        this.Operationsprovider = {}
        this.activeOperations = {};
    }

    initializeMap() {
        this.initOlMap(); // Inicializa el mapa de OpenLayers
        this.listenners(); // listeners ui doom
    }

    listenners(){
        let _me =this;
        
        // Añadir listener para cambiar el proveedor del mapa
        document.getElementById('mapProiderOptions').addEventListener('change', (event) => {
            _me.changeMapProvider(event.target.value);
        });
        // Listener para buscar coordenadas ingresadas
        const searchBtn = document.getElementById('btn-apply-coordinates-search');
        searchBtn.addEventListener('click', () => {
            const lat = parseFloat(document.getElementById('lat').value);
            const lng = parseFloat(document.getElementById('lng').value);
            const zoom = parseInt(document.getElementById('zoom').value); // Obtener el valor de zoom

            if (!isNaN(lat) && !isNaN(lng)) {
                this.map.getView().setCenter(ol.proj.fromLonLat([lng, lat]));
                
                // Si se proporciona un valor de zoom válido, ajusta el nivel de zoom
                if (!isNaN(zoom) && zoom >= 0 && zoom <= 20) { // Rango típico de zoom de mapas (puedes ajustarlo si es necesario)
                    this.map.getView().setZoom(zoom);
                } else {
                    alert('Please enter a valid zoom level between 0 and 20.');
                }
            } else {
                alert('Please enter valid latitude and longitude values.');
            }
        });

        // Captura el terreno al hacer clic
        document.getElementById('capture-terrain-btn').addEventListener('click', () => {
            console.log('Capturando terreno...');
            window.engine.getPreviewImage(); // Captura la imagen del mapa
        });

        // Actualizar las coordenadas actuales del mapa y el nivel de zoom en el span
        this.map.on('moveend', () => {
            const center = ol.proj.toLonLat(this.map.getView().getCenter());
            const lat = center[1].toFixed(6);
            const lng = center[0].toFixed(6);
            const zoom = this.map.getView().getZoom().toFixed(2); // Obtener el nivel de zoom actual

            // Actualizar el contenido del span con las coordenadas y el zoom
            // document.getElementById('current-coordinates').textContent = `Latitude: ${lat}, Longitude: ${lng}, Zoom: ${zoom}`;
            
            document.getElementById('current-coordinates-Latitude').textContent = lat;
            document.getElementById('current-coordinates-Longitude').textContent = lng;
            document.getElementById('current-coordinates-zoom').textContent = zoom;



        
        });
    }

    buildNasaRasterLayer(){
        // Crear la fuente WMTS para la capa ASTER_GDEM_Color_Index
        const asterColorIndexSource = new ol.source.WMTS({
            url: 'https://gibs-a.earthdata.nasa.gov/wmts/epsg4326/best/wmts.cgi',
            layer: 'ASTER_GDEM_Color_Index',
            matrixSet: '31.25m',
            format: 'image/png',
            projection: 'EPSG:4326',
            tileGrid: new ol.tilegrid.WMTS({
                origin: [-180, 90],
                resolutions: [
                    0.5625, 0.28125, 0.140625, 0.0703125,
                    0.03515625, 0.017578125, 0.0087890625,
                    0.00439453125, 0.002197265625
                ],
                matrixIds: ['0', '1', '2', '3', '4', '5', '6', '7', '8']
            }),
            style: 'default',
            maxZoom: 8,
            crossOrigin: 'anonymous'
        });

        
        const operation = ([pixel]) => {
            const [r, g, b] = pixel; // Desestructuramos los canales de color
    
            // Convertir el color a escala de grises usando la fórmula de luminancia estándar
            const grayscaleValue = 0.299 * r + 0.587 * g + 0.114 * b;
    
            // Ajustar el contraste
            const contrastFactor = 1.5; // Puedes modificar este valor para ajustar el contraste
            let adjustedValue = ((grayscaleValue - 128) * contrastFactor) + 128;
    
            // Aplicar corrección gamma
            const gammaExponent = 1.2; // Puedes modificar este valor para ajustar el gamma
            const gammaCorrection = Math.pow(Math.max(0, Math.min(255, adjustedValue)) / 255, gammaExponent) * 255;
    
            // Devolver el valor en escala de grises con un canal alfa fijo
            return [gammaCorrection, gammaCorrection, gammaCorrection, 255];
        }

        this.Operationsprovider["operationNasa"] = operation;
        
        // Crear la capa raster que aplica el filtro de escala de grises ajustado a la capa ASTER_GDEM_Color_Index
        this.NasaRasterLayer = new ol.source.Raster({
            sources: [asterColorIndexSource],
            operationType: 'pixel',
            operation: this.Operationsprovider["operationNasa"]
        });

    }

    buildSRTMRasterLayer(){
        // Crear la fuente WMTS para la capa SRTM
        const SRTM_Color_IndexSource = new ol.source.WMTS({
            url: 'https://gibs-a.earthdata.nasa.gov/wmts/epsg4326/best/wmts.cgi',
            layer: 'SRTM_Color_Index',
            matrixSet: '31.25m',
            format: 'image/png',
            projection: 'EPSG:4326',
            tileGrid: new ol.tilegrid.WMTS({
                origin: [-180, 90],
                resolutions: [
                    0.5625, 0.28125, 0.140625, 0.0703125,
                    0.03515625, 0.017578125, 0.0087890625,
                    0.00439453125, 0.002197265625
                ],
                matrixIds: ['0', '1', '2', '3', '4', '5', '6', '7', '8']
            }),
            style: 'default',
            maxZoom: 8,
            crossOrigin: 'anonymous'
        });

        
        const operation = ([pixel]) => {
            const [r, g, b] = pixel; // Desestructuramos los canales de color
    
            // Convertir el color a escala de grises usando la fórmula de luminancia estándar
            const grayscaleValue = 0.299 * r + 0.587 * g + 0.114 * b;
    
            // Ajustar el contraste
            const contrastFactor = 1.5; // Puedes modificar este valor para ajustar el contraste
            let adjustedValue = ((grayscaleValue - 128) * contrastFactor) + 128;
    
            // Aplicar corrección gamma
            const gammaExponent = 1.2; // Puedes modificar este valor para ajustar el gamma
            const gammaCorrection = Math.pow(Math.max(0, Math.min(255, adjustedValue)) / 255, gammaExponent) * 255;
    
            // Devolver el valor en escala de grises con un canal alfa fijo
            return [gammaCorrection, gammaCorrection, gammaCorrection, 255];
        }

        this.Operationsprovider["operationSRTM"] = operation;
        
        // Crear la capa raster que aplica el filtro de escala de grises ajustado a la capa SRTM
        this.SRTMRasterLayer = new ol.source.Raster({
            sources: [SRTM_Color_IndexSource],
            operationType: 'pixel',
            operation: this.Operationsprovider["operationSRTM"]
        });

    }

    buildTerrariumRasterLayer(){
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

        const operation = ([pixel]) => {
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

        this.Operationsprovider["OperationTerrarium"] = operation;


        this.TerrariumRasterLayer = new ol.source.Raster({
            sources: [terrarium], // Fuente de datos
            operationType: "pixel", // Operación a nivel de píxel
            operation:  this.Operationsprovider["OperationTerrarium"],
        });
    }

    buildMapProviders(){
        this.mapProviders = {
            terrarium: this.TerrariumRasterLayer,
            openStreetMap: new ol.source.OSM(),
            // googleMaps: new ol.source.XYZ({
            //     url: "https://mt1.google.com/vt/lyrs=r&x={x}&y={y}&z={z}"
            // }),
            ASTER_GDEM: this.NasaRasterLayer,
            SRTM: this.SRTMRasterLayer,
        };
    }

    initOlMap() {
        let _me =this;

        // init RasterLayer
        this.buildNasaRasterLayer();
        this.buildTerrariumRasterLayer();

        // create options map providers
        this.buildMapProviders();
        
        // default map provider
        this.currentLayer = new ol.layer.Image({
            source: this.mapProviders.terrarium,
            opacity: 1.0
        });

        this.activeOperations = this.Operationsprovider["OperationTerrarium"]

        /**
    
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
         * 
         */

        // Se crea el mapa de OpenLayers
        this.map = new ol.Map({
            target: "leaflet-map-container",
            layers: [this.currentLayer],
            view: new ol.View({
                center: ol.proj.fromLonLat([-95.867, 37.963]),
                zoom: 4
            })
        });


    }
    // Método para cambiar el proveedor de mapas
    changeMapProvider(providerName) {
        if (this.mapProviders[providerName]) {
            // Eliminar la capa actual del mapa
            this.map.removeLayer(this.currentLayer);
    
            // Verifica si el proveedor seleccionado es 'terrarium' para crear una capa de tipo ol.layer.Image
            switch (providerName) {
                case 'terrarium':
                    this.currentLayer = new ol.layer.Image({
                        source: this.mapProviders[providerName]
                    })
                    break;
                case 'ASTER_GDEM':
                    this.currentLayer = new ol.layer.Image({
                        source: this.mapProviders[providerName]
                    })
                    break;
                case 'SRTM':
                    this.currentLayer = new ol.layer.Image({
                        source: this.mapProviders[providerName]
                    })
                    break;
                default:
                    // Para los otros proveedores, utiliza ol.layer.Tile
                    this.currentLayer = new ol.layer.Tile({
                        source: this.mapProviders[providerName]
                    });
                    break;
            }
    
            // Agregar la nueva capa al mapa
            this.map.addLayer(this.currentLayer);
        }
    }
}



export class engine {
    originalImageData = "/mountain.png"; //"/aa-modified.PNG";//  Variable para almacenar la imagen original

    mapProviders = null;
    // Crea una capa base inicial con el proveedor Terrarium
    currentLayer = null;

    constructor(options) {
        this.manager3d = new Manager3d();
        // Aquí se pueden inicializar opciones si es necesario
        this.managerMap = new ManagerMap();
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
                export3DBtn.textContent = 'Export 3D Model GLTF';
                export3DBtn.disabled = false;
            }, 2000);
        });

        // Listener para exportar el modelo 3D
        const export3DBtnSTL = document.getElementById("export-3d-btn-STL");
        export3DBtnSTL.addEventListener("click", async () => {
            export3DBtnSTL.textContent = 'Loading...';
            export3DBtnSTL.disabled = true;

            try {
                await this.manager3d.exportModelSTL();
                export3DBtnSTL.textContent = 'Success!';
            } catch (error) {
                console.error(error);
                export3DBtnSTL.textContent = 'Error!';
            }

            setTimeout(() => {
                export3DBtnSTL.textContent = 'Export 3D Model STL';
                export3DBtnSTL.disabled = false;
            }, 2000);
        });


        const btnSelectYourTerrainImage = document.getElementById("choseYourImageTerrainSection");

        btnSelectYourTerrainImage.addEventListener("click", async () => {
            const fileInput = document.getElementById("FileChooseYourImageTerrain");
            fileInput.click();
           
        })

        this.initFileInputListener();


    }

    initFileInputListener() {
        const fileInput = document.getElementById("FileChooseYourImageTerrain");
        const contentTextDiv = document.getElementById("contnetTextChooseYourImageTerrain");
    
        fileInput.addEventListener("change", async (event) => {
            const file = event.target.files[0];
            if (file) {
                // Change the div content to indicate the image is loading
                contentTextDiv.textContent = "Loading image...";
                console.log("Loading..."); // Log message indicating the image is loading
    
                const reader = new FileReader();
                reader.onload = (e) => {
                    console.log("Image successfully loaded!"); // Log message when the image has finished loading
    
                    // Change the div content to show a success message for a few seconds
                    contentTextDiv.textContent = "Image successfully loaded!";
                    
                    // Wait 3 seconds before restoring the original content of the div
                    setTimeout(() => {
                        contentTextDiv.textContent = "Or Choose Your Image Terrain";
                    }, 5000); // 5000 milliseconds = 5 seconds
    
                    const imageDataUrl = e.target.result;
                    this.selectUserTerrainImage(imageDataUrl); // Call the function to process the selected image
                };
                reader.readAsDataURL(file); // Convert the file to a base64 data URL
            }
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
                        this.managerMap.initializeMap(); // Inicializa el mapa
                        observer.unobserve(entry.target); // Deja de observar una vez cargado
                    }
                });
            }, { threshold: [0.1] });

            observer.observe(mapSection); // Inicia la observación del mapa
        });
    }


    selectUserTerrainImage(imageDataUrl) {
        // Llamar a la función para cargar la nueva imagen sin un canvas (se usa cuando la imagen viene del archivo)
        this.loadNewImageTerrain(imageDataUrl);
    }
    
    loadNewImageTerrain(imageDataUrl, canvas = null) {
        let editImageCanvas = document.getElementById('edited-canvas');
        const ctx = editImageCanvas.getContext('2d');
    
        // Solo ajustar el tamaño del canvas si se proporciona un canvas
        if (canvas) {
            editImageCanvas.width = canvas.width;
            editImageCanvas.height = canvas.height;
        } else {
            // Ajusta el tamaño del canvas según la imagen cargada si no se proporciona un canvas
            const img = new Image();
            img.onload = () => {
                editImageCanvas.width = img.width;
                editImageCanvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                this.finalizeImageSetup(imageDataUrl);
            };
            img.src = imageDataUrl;
        }
    
        // Si el canvas es proporcionado (imagen desde el mapa), simplemente dibujamos la imagen
        if (canvas) {
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0);
                this.finalizeImageSetup(imageDataUrl);
            };
            img.src = imageDataUrl;
        }
    }
    
    finalizeImageSetup(imageDataUrl) {
        // Actualizar la vista previa de la imagen del terreno y otros valores por defecto
        document.getElementById('terrain-image').src = imageDataUrl;
        this.originalImageData = imageDataUrl; // Guarda la imagen original
    
        // Restablecer los valores de los inputs a sus valores por defecto
        document.getElementById('blackLevel').value = 0;
        document.getElementById('whiteLevel').value = 255;
        document.getElementById('gamma').value = 1;
    
        // Aplicar los ajustes de imagen con los valores por defecto
        this.applyImageAdjustments();
    
        // Actualizar la imagen de textura por defecto
        const defaultImage = document.getElementById("default-Texture-image");
        defaultImage.src = imageDataUrl;
    }

    getPreviewImage() {
        // Captura la imagen del mapa y la muestra en la vista previa
        const canvas = document.querySelector('#leaflet-map-container canvas');
        if (canvas) {
            const imageDataUrl = canvas.toDataURL('image/png'); // Convierte el canvas a imagen PNG


            this.loadNewImageTerrain(imageDataUrl, canvas);
        } else {
            console.error('Canvas not found for preview image.');
        }
    }
      
}

