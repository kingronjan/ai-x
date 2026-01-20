document.addEventListener('DOMContentLoaded', () => {
    const imageLoader = document.getElementById('imageLoader');
    const originalCanvas = document.getElementById('originalCanvas');
    const resultCanvas = document.getElementById('resultCanvas');
    const downloadBtn = document.getElementById('downloadBtn');
    const uploadArea = document.querySelector('.upload-area');

    const colorResolutionSlider = document.getElementById('colorResolution');
    const colorValueSpan = document.getElementById('colorValue');
    const pixelSizeSlider = document.getElementById('pixelSize');
    const pixelValueSpan = document.getElementById('pixelValue');

    let originalImage = null;

    // --- Drag and Drop functionality ---
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('drag-over');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            imageLoader.files = files;
            handleImageUpload({ target: imageLoader });
        }
    });

    // --- Core functionality ---
    imageLoader.addEventListener('change', handleImageUpload);
    colorResolutionSlider.addEventListener('input', () => {
        colorValueSpan.textContent = colorResolutionSlider.value;
        updateEffect();
    });
    pixelSizeSlider.addEventListener('input', () => {
        pixelValueSpan.textContent = pixelSizeSlider.value;
        updateEffect();
    });
    downloadBtn.addEventListener('click', downloadImage);

    function handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file || !file.type.startsWith('image/')) {
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                originalImage = img;
                drawToCanvas(originalCanvas, img);
                updateEffect();
                downloadBtn.style.display = 'inline-block';
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
    
    function updateEffect() {
        if (!originalImage) return;
        const colorResolution = colorResolutionSlider.value;
        const pixelSize = pixelSizeSlider.value;
        applyPixelArtEffect(originalImage, colorResolution, pixelSize);
    }

    function drawToCanvas(canvas, img) {
        const ctx = canvas.getContext('2d');
        const maxWidth = 400; // Max width for the display canvas
        const scale = Math.min(maxWidth / img.width, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }

    function applyPixelArtEffect(img, colorResolution, pixelSize) {
        // 1. Create a small canvas for pixelation
        const pixelatedWidth = originalCanvas.width / pixelSize;
        const pixelatedHeight = originalCanvas.height / pixelSize;
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = pixelatedWidth;
        tempCanvas.height = pixelatedHeight;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Draw the image onto the small canvas (this does the pixelation)
        tempCtx.drawImage(img, 0, 0, pixelatedWidth, pixelatedHeight);

        // 2. Apply color quantization on the small canvas
        const imageData = tempCtx.getImageData(0, 0, pixelatedWidth, pixelatedHeight);
        const data = imageData.data;
        const factor = 256 / colorResolution;

        for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.round(data[i] / factor) * factor;     // Red
            data[i + 1] = Math.round(data[i + 1] / factor) * factor; // Green
            data[i + 2] = Math.round(data[i + 2] / factor) * factor; // Blue
        }
        tempCtx.putImageData(imageData, 0, 0);

        // 3. Draw the pixelated image back onto the main canvas
        const resultCtx = resultCanvas.getContext('2d');
        resultCanvas.width = originalCanvas.width;
        resultCanvas.height = originalCanvas.height;

        // Disable smoothing to get crisp pixels
        resultCtx.imageSmoothingEnabled = false;
        resultCtx.webkitImageSmoothingEnabled = false;
        resultCtx.mozImageSmoothingEnabled = false;
        resultCtx.msImageSmoothingEnabled = false;
        
        resultCtx.drawImage(tempCanvas, 0, 0, resultCanvas.width, resultCanvas.height);
    }

    function downloadImage() {
        const dataURL = resultCanvas.toDataURL('image/png');
        downloadBtn.href = dataURL;
        downloadBtn.download = 'pixel-art-image.png';
    }
});
