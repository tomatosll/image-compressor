// 全局状态
const state = {
    files: [],
    quality: 'medium',
    customQuality: 50,
    format: 'original',
    results: []
};

// DOM 元素
const elements = {
    uploadArea: document.getElementById('uploadArea'),
    fileInput: document.getElementById('fileInput'),
    settingsSection: document.getElementById('settingsSection'),
    filesSection: document.getElementById('filesSection'),
    filesList: document.getElementById('filesList'),
    resultsSection: document.getElementById('resultsSection'),
    resultsList: document.getElementById('resultsList'),
    resultsSummary: document.getElementById('resultsSummary'),
    customQualityGroup: document.getElementById('customQualityGroup'),
    qualitySlider: document.getElementById('qualitySlider'),
    qualityValue: document.getElementById('qualityValue'),
    formatSelect: document.getElementById('formatSelect'),
    compressBtn: document.getElementById('compressBtn'),
    clearAllBtn: document.getElementById('clearAllBtn'),
    downloadAllBtn: document.getElementById('downloadAllBtn'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    loadingProgress: document.getElementById('loadingProgress')
};

// 工具函数
const utils = {
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    generateId() {
        return Math.random().toString(36).substring(2, 15);
    },

    createImagePreview(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsDataURL(file);
        });
    }
};

// 初始化事件监听
function initEventListeners() {
    // 上传区域点击
    elements.uploadArea.addEventListener('click', () => {
        elements.fileInput.click();
    });

    // 文件选择
    elements.fileInput.addEventListener('change', handleFileSelect);

    // 拖放事件
    elements.uploadArea.addEventListener('dragover', handleDragOver);
    elements.uploadArea.addEventListener('dragleave', handleDragLeave);
    elements.uploadArea.addEventListener('drop', handleDrop);

    // 质量按钮
    document.querySelectorAll('.quality-btn').forEach(btn => {
        btn.addEventListener('click', () => handleQualityChange(btn));
    });

    // 自定义质量滑块
    elements.qualitySlider.addEventListener('input', (e) => {
        state.customQuality = parseInt(e.target.value);
        elements.qualityValue.textContent = state.customQuality;
    });

    // 格式选择
    elements.formatSelect.addEventListener('change', (e) => {
        state.format = e.target.value;
    });

    // 压缩按钮
    elements.compressBtn.addEventListener('click', handleCompress);

    // 清空按钮
    elements.clearAllBtn.addEventListener('click', handleClearAll);

    // 下载全部按钮
    elements.downloadAllBtn.addEventListener('click', handleDownloadAll);
}

// 处理文件选择
function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    addFiles(files);
    e.target.value = ''; // 重置input
}

// 处理拖放
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    elements.uploadArea.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    elements.uploadArea.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    elements.uploadArea.classList.remove('drag-over');

    const files = Array.from(e.dataTransfer.files).filter(file =>
        file.type.startsWith('image/')
    );

    if (files.length > 0) {
        addFiles(files);
    }
}

// 添加文件
async function addFiles(files) {
    for (const file of files) {
        // 检查是否已存在
        if (state.files.some(f => f.name === file.name && f.size === file.size)) {
            continue;
        }

        const preview = await utils.createImagePreview(file);
        state.files.push({
            id: utils.generateId(),
            file,
            name: file.name,
            size: file.size,
            preview
        });
    }

    updateFilesUI();
}

// 更新文件列表UI
function updateFilesUI() {
    if (state.files.length === 0) {
        elements.filesSection.style.display = 'none';
        return;
    }

    elements.filesSection.style.display = 'block';
    elements.filesList.innerHTML = state.files.map(file => `
        <div class="file-item fade-in" data-id="${file.id}">
            <img src="${file.preview}" alt="${file.name}" class="file-preview">
            <div class="file-info">
                <div class="file-name">${file.name}</div>
                <div class="file-size">${utils.formatFileSize(file.size)}</div>
            </div>
            <button class="file-remove" onclick="removeFile('${file.id}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        </div>
    `).join('');
}

// 移除文件
window.removeFile = function(id) {
    state.files = state.files.filter(f => f.id !== id);
    updateFilesUI();
};

// 处理质量变更
function handleQualityChange(btn) {
    document.querySelectorAll('.quality-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    state.quality = btn.dataset.quality;

    if (state.quality === 'custom') {
        elements.customQualityGroup.style.display = 'flex';
    } else {
        elements.customQualityGroup.style.display = 'none';
    }
}

// 处理压缩
async function handleCompress() {
    if (state.files.length === 0) {
        alert('请先选择要压缩的图片');
        return;
    }

    // 显示加载
    elements.loadingOverlay.classList.add('active');
    elements.loadingProgress.textContent = '0%';

    try {
        const formData = new FormData();

        state.files.forEach(f => {
            formData.append('images', f.file);
        });

        formData.append('quality', state.quality);
        formData.append('customQuality', state.customQuality.toString());
        formData.append('format', state.format);

        // 模拟进度
        let progress = 0;
        const progressInterval = setInterval(() => {
            if (progress < 90) {
                progress += Math.random() * 10;
                elements.loadingProgress.textContent = Math.min(90, Math.round(progress)) + '%';
            }
        }, 200);

        const response = await fetch('/api/compress', {
            method: 'POST',
            body: formData
        });

        clearInterval(progressInterval);
        elements.loadingProgress.textContent = '100%';

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || '压缩失败');
        }

        const data = await response.json();
        state.results = data.results;

        // 短暂延迟后隐藏加载
        setTimeout(() => {
            elements.loadingOverlay.classList.remove('active');
            updateResultsUI();
        }, 500);

    } catch (error) {
        elements.loadingOverlay.classList.remove('active');
        alert('压缩失败: ' + error.message);
        console.error('压缩错误:', error);
    }
}

// 更新结果UI
function updateResultsUI() {
    if (state.results.length === 0) {
        elements.resultsSection.style.display = 'none';
        return;
    }

    elements.resultsSection.style.display = 'block';

    // 计算总结
    const totalOriginal = state.results.reduce((sum, r) => sum + r.originalSize, 0);
    const totalCompressed = state.results.reduce((sum, r) => sum + r.compressedSize, 0);
    const totalSaved = ((totalOriginal - totalCompressed) / totalOriginal * 100).toFixed(1);

    elements.resultsSummary.innerHTML = `
        共节省 ${utils.formatFileSize(totalOriginal - totalCompressed)} (${totalSaved}%)
    `;

    elements.resultsList.innerHTML = state.results.map(result => `
        <div class="result-item fade-in">
            <div class="result-header">
                <span class="result-title">${result.originalName}</span>
                <span class="result-savings">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
                        <polyline points="17 6 23 6 23 12"/>
                    </svg>
                    节省 ${result.compressionRatio}%
                </span>
            </div>
            <div class="result-content">
                <div class="result-column">
                    <span class="result-label">原始图片</span>
                    <div class="result-image-wrapper">
                        <img src="${result.originalUrl}" alt="原始图片" class="result-image">
                    </div>
                    <div class="result-stats">
                        <span class="result-stat">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="3" width="18" height="18" rx="2"/>
                            </svg>
                            ${result.width} x ${result.height}
                        </span>
                        <span class="result-stat">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                            </svg>
                            ${utils.formatFileSize(result.originalSize)}
                        </span>
                    </div>
                </div>
                <div class="result-column">
                    <span class="result-label">压缩后</span>
                    <div class="result-image-wrapper">
                        <img src="${result.compressedUrl}" alt="压缩后图片" class="result-image">
                    </div>
                    <div class="result-stats">
                        <span class="result-stat">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="3" width="18" height="18" rx="2"/>
                            </svg>
                            ${result.width} x ${result.height}
                        </span>
                        <span class="result-stat">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                            </svg>
                            ${utils.formatFileSize(result.compressedSize)}
                        </span>
                    </div>
                </div>
            </div>
            <div class="result-actions">
                <button class="btn btn-primary" onclick="downloadFile('${result.compressedUrl}', '${result.downloadFilename}')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    下载
                </button>
            </div>
        </div>
    `).join('');

    // 滚动到结果区域
    elements.resultsSection.scrollIntoView({ behavior: 'smooth' });
}

// 下载单个文件
window.downloadFile = function(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
};

// 下载全部
function handleDownloadAll() {
    if (state.results.length === 0) return;

    state.results.forEach((result, index) => {
        setTimeout(() => {
            downloadFile(result.compressedUrl, result.downloadFilename);
        }, index * 300); // 间隔下载避免浏览器阻止
    });
}

// 清空全部
function handleClearAll() {
    state.files = [];
    state.results = [];
    updateFilesUI();
    elements.resultsSection.style.display = 'none';
}

// 初始化
document.addEventListener('DOMContentLoaded', initEventListeners);
