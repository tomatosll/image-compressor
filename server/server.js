const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件配置
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/compressed', express.static(path.join(__dirname, 'compressed')));

// 确保目录存在
const uploadsDir = path.join(__dirname, 'uploads');
const compressedDir = path.join(__dirname, 'compressed');
[uploadsDir, compressedDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Multer 配置
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('不支持的文件格式。请上传 JPG、PNG、WebP 或 GIF 格式的图片。'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// 质量预设映射
const qualityPresets = {
    high: 80,
    medium: 60,
    low: 40
};

// 图片压缩接口
app.post('/api/compress', upload.array('images', 20), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: '请上传至少一张图片' });
        }

        const quality = req.body.quality || 'medium';
        const customQuality = parseInt(req.body.customQuality);
        const outputFormat = req.body.format || 'original';

        // 确定压缩质量
        let compressionQuality;
        if (customQuality && customQuality >= 1 && customQuality <= 100) {
            compressionQuality = customQuality;
        } else {
            compressionQuality = qualityPresets[quality] || 60;
        }

        const results = [];

        for (const file of req.files) {
            const inputPath = file.path;
            const originalSize = file.size;

            // 获取原始图片信息
            const metadata = await sharp(inputPath).metadata();

            // 确定输出格式
            let outputExt = path.extname(file.originalname).toLowerCase();
            let outputMime = file.mimetype;

            if (outputFormat !== 'original') {
                outputExt = `.${outputFormat}`;
                outputMime = `image/${outputFormat}`;
            }

            const outputFilename = `compressed_${uuidv4()}${outputExt}`;
            const outputPath = path.join(compressedDir, outputFilename);

            // 创建 Sharp 实例
            let sharpInstance = sharp(inputPath);

            // 根据输出格式进行压缩
            switch (outputExt) {
                case '.jpg':
                case '.jpeg':
                    sharpInstance = sharpInstance.jpeg({
                        quality: compressionQuality,
                        mozjpeg: true
                    });
                    break;
                case '.png':
                    sharpInstance = sharpInstance.png({
                        quality: compressionQuality,
                        compressionLevel: Math.floor((100 - compressionQuality) / 10)
                    });
                    break;
                case '.webp':
                    sharpInstance = sharpInstance.webp({
                        quality: compressionQuality
                    });
                    break;
                case '.gif':
                    sharpInstance = sharpInstance.gif();
                    break;
                default:
                    sharpInstance = sharpInstance.jpeg({
                        quality: compressionQuality,
                        mozjpeg: true
                    });
            }

            // 保存压缩后的图片
            await sharpInstance.toFile(outputPath);

            // 获取压缩后的文件大小
            const compressedStats = fs.statSync(outputPath);
            const compressedSize = compressedStats.size;

            // 计算压缩率
            const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);

            results.push({
                id: uuidv4(),
                originalName: file.originalname,
                originalSize,
                compressedSize,
                compressionRatio: parseFloat(compressionRatio),
                width: metadata.width,
                height: metadata.height,
                format: metadata.format,
                originalUrl: `/uploads/${file.filename}`,
                compressedUrl: `/compressed/${outputFilename}`,
                downloadFilename: `compressed_${file.originalname}`
            });
        }

        res.json({
            success: true,
            message: `成功压缩 ${results.length} 张图片`,
            results
        });

    } catch (error) {
        console.error('压缩错误:', error);
        res.status(500).json({
            error: '图片压缩失败',
            message: error.message
        });
    }
});

// 下载接口
app.get('/api/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filepath = path.join(compressedDir, filename);

    if (fs.existsSync(filepath)) {
        res.download(filepath);
    } else {
        res.status(404).json({ error: '文件不存在' });
    }
});

// 批量下载接口（返回压缩包需要额外依赖，这里简化处理）
app.post('/api/download-all', express.json(), async (req, res) => {
    const { files } = req.body;

    if (!files || files.length === 0) {
        return res.status(400).json({ error: '没有可下载的文件' });
    }

    // 单个文件直接下载
    if (files.length === 1) {
        const filename = path.basename(files[0]);
        const filepath = path.join(compressedDir, filename);
        if (fs.existsSync(filepath)) {
            return res.download(filepath);
        }
    }

    // 返回文件列表供前端逐个下载
    res.json({
        success: true,
        files: files.map(f => ({
            url: f,
            filename: path.basename(f)
        }))
    });
});

// 清理旧文件（每小时清理一次超过1小时的文件）
const cleanupOldFiles = () => {
    const maxAge = 60 * 60 * 1000; // 1小时
    const now = Date.now();

    [uploadsDir, compressedDir].forEach(dir => {
        if (fs.existsSync(dir)) {
            fs.readdirSync(dir).forEach(file => {
                const filepath = path.join(dir, file);
                const stats = fs.statSync(filepath);
                if (now - stats.mtimeMs > maxAge) {
                    fs.unlinkSync(filepath);
                }
            });
        }
    });
};

setInterval(cleanupOldFiles, 60 * 60 * 1000);

// 首页路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`🚀 图片压缩服务器已启动`);
    console.log(`📍 访问地址: http://localhost:${PORT}`);
});
