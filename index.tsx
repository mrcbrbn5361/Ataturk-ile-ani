/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Modality } from '@google/genai';

// API anahtarını ortam değişkenlerinden güvenli bir şekilde alın.
// Lütfen `.env` dosyanızda API anahtarını ayarladığınızdan emin olun.
const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

const imageUpload = document.getElementById('image-upload') as HTMLInputElement;
const submitBtn = document.getElementById('submit-btn') as HTMLButtonElement;
const originalImagePreview = document.getElementById('original-image-preview');
const generatedImageContainer = document.getElementById('generated-image-container');
const loader = document.getElementById('loader');
const errorMessage = document.getElementById('error-message');

let selectedFile: File | null = null;

/**
 * Dosyayı base64 dizesine dönüştürür.
 * @param file Dönüştürülecek dosya.
 * @returns Base64 dizesi olarak bir Promise.
 */
function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

/**
 * Hata mesajını kullanıcı arayüzünde görüntüler.
 * @param message Görüntülenecek mesaj.
 */
function displayError(message: string) {
    if (errorMessage) {
        errorMessage.textContent = message;
    }
    console.error(message);
}

/**
 * Yükleme durumunu yönetir.
 * @param isLoading Yükleniyorsa true, aksi takdirde false.
 */
function setLoading(isLoading: boolean) {
    if (loader) loader.hidden = !isLoading;
    if (submitBtn) submitBtn.disabled = isLoading;
    if (imageUpload) imageUpload.disabled = isLoading;
}

imageUpload.addEventListener('change', () => {
    if (imageUpload.files && imageUpload.files[0]) {
        selectedFile = imageUpload.files[0];

        if (originalImagePreview) {
            originalImagePreview.innerHTML = ''; // Önceki içeriği temizle
            const img = document.createElement('img');
            img.src = URL.createObjectURL(selectedFile);
            img.onload = () => URL.revokeObjectURL(img.src); // Belleği serbest bırak
            originalImagePreview.appendChild(img);
        }
        if (submitBtn) {
            submitBtn.disabled = false;
        }
        if (generatedImageContainer) {
            // Yeni bir dosya seçildiğinde önceki oluşturulan resmi veya hatayı temizle,
            // ancak yükleyiciyi koru.
            const existingResult = generatedImageContainer.querySelector('img, p');
            if (existingResult) {
                existingResult.remove();
            }
        }
        displayError(''); // Hata mesajını temizle
    }
});

submitBtn.addEventListener('click', async () => {
    if (!selectedFile) {
        displayError('Lütfen önce bir resim dosyası seçin.');
        return;
    }
    
    // Göndermeden önce önceki sonuçları temizle
    if (generatedImageContainer) {
        const existingResult = generatedImageContainer.querySelector('img, p');
        if (existingResult) {
            existingResult.remove();
        }
    }

    setLoading(true);
    displayError('');

    try {
        const base64Image = await fileToBase64(selectedFile);
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: {
                parts: [
                    {
                        inlineData: {
                            data: base64Image,
                            mimeType: selectedFile.type,
                        },
                    },
                    {
                        text: "Bu fotoğraftaki kişiyi analiz et. Kişinin yüzünü ve kimliğini koruyarak, giyimini ve içinde bulunduğu ortamı Atatürk'ün yaşadığı döneme (1920'ler-1930'lar Türkiye'si) uygun şekilde tamamen değiştir. Ardından, Mustafa Kemal Atatürk'ü bu yeni ortama, fotoğraftaki kişiyle doğal bir şekilde yan yana duruyormuş gibi ekle. Son olarak, fotoğrafın tamamını o döneme ait otantik, sepya tonlu veya siyah-beyaz, grenli ve dönemin ışıklandırma özelliklerini taşıyan eski bir fotoğraf gibi stilize et. Nihai sonuç, o yıllarda çekilmiş gerçek bir tarihi anı gibi görünmeli.",
                    },
                ],
            },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });
        
        const parts = response.candidates?.[0]?.content?.parts || [];
        const imagePart = parts.find(part => part.inlineData);
        const textPart = parts.find(part => part.text);

        if (imagePart && imagePart.inlineData) {
            if (generatedImageContainer) {
                const img = new Image();
                img.src = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
                img.alt = "Yapay zeka tarafından oluşturulan tarihi anı";
                generatedImageContainer.appendChild(img);
            }
        } else {
            const defaultError = 'Yanıt bir resim içermiyor. Modelin güvenlik filtreleri tarafından engellenmiş olabilir.';
            // Model bir metin yanıtı verdiyse, bunu hata mesajı olarak kullan
            throw new Error(textPart?.text || defaultError);
        }

    } catch (error) {
        const specificError = (error as Error).message || 'Bilinmeyen bir hata oluştu.';
        // Hata mesajını doğrudan oluşturulan resim alanında göster
        if (generatedImageContainer) {
           const errorEl = document.createElement('p');
           errorEl.className = 'error-in-box';
           errorEl.textContent = specificError;
           generatedImageContainer.appendChild(errorEl);
        }
    } finally {
        setLoading(false);
    }
});