document.addEventListener('DOMContentLoaded', () => {
    updateOfflineList();
    document.getElementById('search-btn').addEventListener('click', searchUrls);
    document.getElementById('keyword-input').addEventListener('keyup', (e) => {
        if (e.key === 'Enter') searchUrls();
    });
});

function showError(text) {
    const errDiv = document.getElementById('error-msg');
    errDiv.innerText = text;
    errDiv.style.display = 'block';
    setTimeout(() => {
        errDiv.style.display = 'none';
        errDiv.innerText = '';
    }, 5000);
}

async function searchUrls() {
    const keyword = document.getElementById('keyword-input').value.trim();
    const urlList = document.getElementById('url-list');
    urlList.innerHTML = '';
    if (!keyword) return;

    try {
        const response = await fetch('/api/urls', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keyword })
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Ошибка сервера');

        data.urls.forEach(url => {
            const li = document.createElement('li');
            li.textContent = url + ' ';
            
            const btn = document.createElement('button');
            btn.textContent = 'Скачать';
            btn.onclick = () => downloadContent(url);
            
            li.appendChild(btn);
            urlList.appendChild(li);
        });
    } catch (err) {
        showError(err.message);
    }
}
function downloadContent(url) {
    const progressContainer = document.getElementById('progress-container');
    const progressFill = document.getElementById('progress-fill');
    const statusText = document.getElementById('status-text');

    progressContainer.style.display = 'block';
    progressFill.style.width = '0%';
    progressFill.textContent = '0%';
    statusText.innerText = 'Установление соединения...';

    const eventSource = new EventSource(`/api/download?url=${encodeURIComponent(url)}`);

    eventSource.onmessage = function(event) {
        const data = JSON.parse(event.data);

        if (data.type === 'progress') {
            const currentKb = (data.current / 1024).toFixed(1);
            const totalKb = data.total ? `${(data.total / 1024).toFixed(1)} КБ` : 'неизвестно';
            statusText.innerText = `Скачано: ${currentKb} КБ из ${totalKb}`;
            progressFill.style.width = `${data.percent}%`;
            progressFill.textContent = `${data.percent}%`;
        }

        if (data.type === 'complete') {
            statusText.innerText = 'Загрузка завершена! Сохраняем...';
            try {
                localStorage.setItem(`offline_${url}`, JSON.stringify({
                    url: url,
                    date: new Date().toLocaleString(),
                    html: data.content
                }));
                updateOfflineList();
            } catch (e) {
                showError('Не удалось сохранить: превышен лимит LocalStorage.');
            }
            eventSource.close();
            setTimeout(() => { progressContainer.style.display = 'none'; statusText.innerText = ''; }, 2000);
        }

        if (data.type === 'error') {
            showError(data.message);
            eventSource.close();
            progressContainer.style.display = 'none';
            statusText.innerText = '';
        }
    };

    eventSource.onerror = function() {
        showError('Сбой соединения с сервером.');
        eventSource.close();
        progressContainer.style.display = 'none';
        statusText.innerText = '';
    };
}
function updateOfflineList() {
    const offlineList = document.getElementById('offline-list');
    offlineList.innerHTML = '';

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('offline_')) {
            const item = JSON.parse(localStorage.getItem(key));
            const li = document.createElement('li');
            
            const link = document.createElement('a');
            link.href = '#';
            link.textContent = item.url;
            link.onclick = (e) => {
                e.preventDefault();
                document.querySelectorAll('#offline-list a').forEach(a => a.classList.remove('active-view'));
                link.classList.add('active-view');
                viewContent(key);
            };

            const small = document.createElement('small');
            small.style.color = '#777';
            small.style.display = 'block';
            small.textContent = `Загружено: ${item.date}`;

            li.appendChild(link);
            li.appendChild(small);
            offlineList.appendChild(li);
        }
    }
}

function viewContent(storageKey) {
    const item = JSON.parse(localStorage.getItem(storageKey));
    document.getElementById('view-title').innerHTML = `Отображается: <strong>${item.url}</strong>`;
    document.getElementById('content-viewer').srcdoc = item.html;
}
