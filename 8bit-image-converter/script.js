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
    const ditheringCheckbox = document.getElementById('dithering');

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
    ditheringCheckbox.addEventListener('change', updateEffect);
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
        const colorResolution = parseInt(colorResolutionSlider.value);
        const pixelSize = parseInt(pixelSizeSlider.value);
        const dithering = ditheringCheckbox.checked;
        applyPixelArtEffect(originalImage, colorResolution, pixelSize, dithering);
    }

    function drawToCanvas(canvas, img) {
        const ctx = canvas.getContext('2d');
        const maxWidth = 400; // Max width for the display canvas
        const scale = Math.min(maxWidth / img.width, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }
    
    // --- K-Means Color Quantization ---
    function getDominantColors(imageData, k) {
        const pixels = [];
        for (let i = 0; i < imageData.data.length; i += 4) {
             // Ignore transparent pixels
            if (imageData.data[i+3] > 128) {
                pixels.push([imageData.data[i], imageData.data[i + 1], imageData.data[i + 2]]);
            }
        }
        
        if (pixels.length === 0) return [];

        // Initialize centroids randomly from the pixels
        let centroids = pixels.slice(0, k);

        for (let iter = 0; iter < 10; iter++) { // 10 iterations are usually enough
            // Assign each pixel to the closest centroid
            const clusters = new Array(k).fill(0).map(() => []);
            for (const pixel of pixels) {
                let minDistance = Infinity;
                let clusterIndex = 0;
                for (let i = 0; i < k; i++) {
                    const distance = colorDistance(pixel, centroids[i]);
                    if (distance < minDistance) {
                        minDistance = distance;
                        clusterIndex = i;
                    }
                }
                clusters[clusterIndex].push(pixel);
            }

            // Recalculate centroids
            const newCentroids = [];
            for (let i = 0; i < k; i++) {
                if (clusters[i].length > 0) {
                    const avg = clusters[i].reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]], [0, 0, 0]);
                    newCentroids[i] = [avg[0] / clusters[i].length, avg[1] / clusters[i].length, avg[2] / clusters[i].length];
                } else {
                    // If a cluster is empty, re-initialize it with a random pixel
                    newCentroids[i] = pixels[Math.floor(Math.random() * pixels.length)];
                }
            }
            centroids = newCentroids;
        }
        return centroids.map(c => c.map(Math.round));
    }

    function colorDistance(c1, c2) {
        return Math.sqrt(Math.pow(c1[0] - c2[0], 2) + Math.pow(c1[1] - c2[1], 2) + Math.pow(c1[2] - c2[2], 2));
    }

    function findClosestColor(pixel, palette) {
        let closestColor = palette[0];
        let minDistance = Infinity;
        for (const color of palette) {
            const distance = colorDistance(pixel, color);
            if (distance < minDistance) {
                minDistance = distance;
                closestColor = color;
            }
        }
        return closestColor;
    }
    
    // --- Main Effect Function ---
    function applyPixelArtEffect(img, colorResolution, pixelSize, useDithering) {
        const pixelatedWidth = Math.max(1, Math.floor(originalCanvas.width / pixelSize));
        const pixelatedHeight = Math.max(1, Math.floor(originalCanvas.height / pixelSize));

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = pixelatedWidth;
        tempCanvas.height = pixelatedHeight;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.imageSmoothingEnabled = false;
        
        // Draw the image onto the small canvas for initial pixelation
        tempCtx.drawImage(img, 0, 0, pixelatedWidth, pixelatedHeight);
        
        const imageData = tempCtx.getImageData(0, 0, pixelatedWidth, pixelatedHeight);
        const data = imageData.data;

        // --- Color Palette Generation (K-Means) ---
        const colorPalette = getDominantColors(imageData, colorResolution);
        
        if (colorPalette.length === 0) { // Handle fully transparent images
             resultCanvas.width = originalCanvas.width;
             resultCanvas.height = originalCanvas.height;
             resultCanvas.getContext('2d').clearRect(0, 0, resultCanvas.width, resultCanvas.height);
             return;
        }

        const data32 = new Uint32Array(data.buffer);
        const error = new Float32Array(pixelatedWidth * pixelatedHeight * 3).fill(0);

        for (let y = 0; y < pixelatedHeight; y++) {
            for (let x = 0; x < pixelatedWidth; x++) {
                const i = y * pixelatedWidth + x;
                const oldR = data[i * 4];
                const oldG = data[i * 4 + 1];
                const oldB = data[i * 4 + 2];
                
                const newR = oldR + (useDithering ? error[i * 3] : 0);
                const newG = oldG + (useDithering ? error[i * 3 + 1] : 0);
                const newB = oldB + (useDithering ? error[i * 3 + 2] : 0);

                const newColor = findClosestColor([newR, newG, newB], colorPalette);
                
                data[i * 4] = newColor[0];
                data[i * 4 + 1] = newColor[1];
                data[i * 4 + 2] = newColor[2];

                if (useDithering) {
                    const errR = newR - newColor[0];
                    const errG = newG - newColor[1];
                    const errB = newB - newColor[2];
                    
                    // Floyd-Steinberg dithering error distribution
                    // Right
                    if (x + 1 < pixelatedWidth) {
                        const idx = i + 1;
                        error[idx * 3] += errR * 7 / 16;
                        error[idx * 3 + 1] += errG * 7 / 16;
                        error[idx * 3 + 2] += errB * 7 / 16;
                    }
                    // Down-Left
                    if (y + 1 < pixelatedHeight && x - 1 >= 0) {
                        const idx = i + pixelatedWidth - 1;
                        error[idx * 3] += errR * 3 / 16;
                        error[idx * 3 + 1] += errG * 3 / 16;
                        error[idx * 3 + 2] += errB * 3 / 16;
                    }
                    // Down
                    if (y + 1 < pixelatedHeight) {
                        const idx = i + pixelatedWidth;
                        error[idx * 3] += errR * 5 / 16;
                        error[idx * 3 + 1] += errG * 5 / 16;
                        error[idx * 3 + 2] += errB * 5 / 16;
                    }
                    // Down-Right
                    if (y + 1 < pixelatedHeight && x + 1 < pixelatedWidth) {
                        const idx = i + pixelatedWidth + 1;
                        error[idx * 3] += errR * 1 / 16;
                        error[idx * 3 + 1] += errG * 1 / 16;
                        error[idx * 3 + 2] += errB * 1 / 16;
                    }
                }
            }
        }
        
        tempCtx.putImageData(imageData, 0, 0);

        // --- Draw final image to result canvas ---
        const resultCtx = resultCanvas.getContext('2d');
        resultCanvas.width = originalCanvas.width;
        resultCanvas.height = originalCanvas.height;
        resultCtx.imageSmoothingEnabled = false;
        
        resultCtx.drawImage(tempCanvas, 0, 0, resultCanvas.width, resultCanvas.height);
    }

    function downloadImage() {
        const dataURL = resultCanvas.toDataURL('image/png');
        downloadBtn.href = dataURL;
        downloadBtn.download = 'pixel-art-image.png';
    }
});