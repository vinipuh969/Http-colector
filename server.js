const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const keywordDatabase = {
    "news": ["https://yandex.ru", "https://bbc.com"],
    "code": ["https://github.com", "https://stackoverflow.com"],
    "search": ["https://google.com", "https://wikipedia.org"]
};

app.post('/api/urls', (req, res) => {
    const { keyword } = req.body;
    if (!keyword) {
        return res.status(400).json({ error: 'Ключевое слово не указано' });
    }
    const urls = keywordDatabase[keyword.toLowerCase().trim()];
    if (!urls) {
        return res.status(404).json({ error: 'Ничего не найдено по этому слову' });
    }
    res.json({ urls });
});

app.get('/api/download', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'URL не указан' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
        const response = await axios({
            method: 'get',
            url: url,
            responseType: 'stream'
        });

        const totalBytes = parseInt(response.headers['content-length'], 10) || 0;
        let downloadedBytes = 0;
        let base64Buffer = [];

        response.data.on('data', (chunk) => {
            downloadedBytes += chunk.length;
            base64Buffer.push(chunk);

            const progress = totalBytes ? Math.round((downloadedBytes / totalBytes) * 100) : 0;
            res.write(`data: ${JSON.stringify({ type: 'progress', total: totalBytes, current: downloadedBytes, percent: progress })}\n\n`);
        });

        response.data.on('end', () => {
            const finalBuffer = Buffer.concat(base64Buffer);
            const content = finalBuffer.toString('utf-8'); 
            
            res.write(`data: ${JSON.stringify({ type: 'complete', content: content })}\n\n`);
            res.end();
        });

    } catch (error) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: `Ошибка скачивания: ${error.message}` })}\n\n`);
        res.end();
    }
});

app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));
