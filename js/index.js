window.addEventListener('DOMContentLoaded', () => {
    // DOM 元素
    const audio = document.getElementById('audio');
    const lyricsContainer = document.getElementById('lyrics-container');
    const playlistElement = document.getElementById('playlist');
    const currentSongInfo = document.getElementById('current-song-info');
    const tabNav = document.querySelector('.tab-nav');
    const views = document.querySelectorAll('.view');
    const tabButtons = document.querySelectorAll('.tab-nav button');

    // 数据和状态
    let lrcData = [];
    let currentIndex = -1;
    let currentSongIndex = -1;

    // 歌曲列表 (在这里添加你的歌曲)
    const songList = [
        {
            title: "关不上的窗",
            artist: "周传雄",
            file: "周传雄 - 关不上的窗.mp3"
        },
        {
            title: " 浮夸",
            artist: "陈奕迅",
            file: "陈奕迅 - 浮夸.mp3"
        }
        // ... 在这里添加更多歌曲
    ];
    // --- 视图切换逻辑 ---
    function switchView(viewId) {
        // 切换视图内容
        views.forEach(view => {
            view.classList.toggle('active', view.id === viewId);
        });
        // 切换标签按钮高亮
        tabButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.view === viewId);
        });
    }


    // --- 初始化 ---
    function init() {
        renderPlaylist();
        addEventListeners();

        // 初始显示播放器视图
        switchView('player-view');
    }

    // --- 渲染与UI更新 ---

    // 渲染歌曲列表
    function renderPlaylist() {
        playlistElement.innerHTML = '';
        songList.forEach((song, index) => {
            const li = document.createElement('li');
            li.textContent = `${song.title} - ${song.artist}`;
            li.dataset.index = index;
            playlistElement.appendChild(li);
        });
    }

    // 加载并播放选定的歌曲
    function loadSong(index) {
        if (index === currentSongIndex) return; // 如果是同一首歌，则不重新加载

        currentSongIndex = index;
        const song = songList[index];

        // 更新歌曲信息显示
        currentSongInfo.querySelector('h3').textContent = song.title;
        currentSongInfo.querySelector('p').textContent = song.artist;

        // 更新音频源
        audio.src = `./assets/music/${song.file}`;

        // 重置歌词和状态
        lrcData = [];
        currentIndex = -1;
        lyricsContainer.innerHTML = '<p>歌词加载中...</p>';
        lyricsContainer.scrollTop = 0;

        // 自动加载对应的歌词文件
        const lrcPath = `./assets/lyric/${song.file.replace('.mp3', '.lrc').replaceAll(' ', '')}`;
        // console.log(lrcPath);
        loadLyrics(lrcPath);

        // 更新播放列表中的高亮项
        const activeItem = playlistElement.querySelector('li.active');
        if (activeItem) activeItem.classList.remove('active');
        playlistElement.querySelector(`li[data-index='${index}']`).classList.add('active');

        audio.play();

        // **关键优化**: 在移动端选择歌曲后，自动切回播放器视图
        if (window.innerWidth < 768) {
            setTimeout(() => switchView('player-view'), 100); // 稍微延迟以获得更好的体验
        }
    }

    // 加载并解析LRC文件
    function loadLyrics(lrcPath) {
        fetch(lrcPath)
            .then(response => {
                if (!response.ok) throw new Error('未找到歌词文件');
                return response.text();
            })
            .then(text => {
                lrcData = parseLrc(text);
                renderLyrics();
            })
            .catch(error => {
                lyricsContainer.innerHTML = `<p>${error.message}</p>`;
            });
    }

    // 解析LRC文本, 规范化时间和播放器的时间接轨
    function parseLrc(lrcText) {
        const lines = lrcText.split('\n');
        const result = [];
        const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;
        for (const line of lines) {
            const match = line.match(timeRegex);
            if (match) {
                // 使用 padEnd 将其统一处理为3位数的毫秒字符串
                // 如果是 "45" (2位), padEnd(3, '0') -> "450"
                // 如果是 "450" (3位), padEnd(3, '0') -> "450" (不变)
                const time = parseInt(match[1]) * 60 + parseInt(match[2]) + parseInt(match[3].padEnd(3, '0'), 10) / 1000;
                const text = line.replace(timeRegex, '').trim();
                if (text) result.push({ time, text });
            }
        }
        // console.log(result);
        return result.sort((a, b) => a.time - b.time);
    }

    // 渲染歌词到DOM
    function renderLyrics() {
        lyricsContainer.innerHTML = '';
        lrcData.forEach((line, index) => {
            const p = document.createElement('p');
            p.textContent = line.text;
            p.dataset.index = index;
            lyricsContainer.appendChild(p);
        });
    }

    // 音频播放时更新歌词高亮和滚动
    function updateLyrics() {
        if (lrcData.length === 0) return;

        const currentTime = audio.currentTime;
        let newIndex = lrcData.findIndex((line, index) => {
            const nextLine = lrcData[index + 1];
            return currentTime >= line.time && (!nextLine || currentTime < nextLine.time);
        });

        if (newIndex === -1 && lrcData.length > 0 && currentTime > lrcData[0].time) {
            newIndex = 0; // 处理开头前奏后找不到的情况
        }

        if (newIndex !== currentIndex) {
            const prevActive = lyricsContainer.querySelector('p.active');
            if (prevActive) prevActive.classList.remove('active');

            const currentLine = lyricsContainer.querySelector(`p[data-index='${newIndex}']`);
            if (currentLine) {
                currentLine.classList.add('active');
                // 滚动到视图中央，这里的思维量比较大，简而言之就是滚动的高度为自身相对于顶部偏移量减去容器高度一半加上自身高度一半，
                // 滚动高度比偏移量小自身高度，就是滚不动的位置，如一开始为负值，末尾为超出滚动量的值
                const containerHeight = lyricsContainer.clientHeight;
                const lineTop = currentLine.offsetTop; // 相对于lyricsContainer的顶部
                const lineHeight = currentLine.clientHeight;

                lyricsContainer.scrollTop = lineTop - containerHeight / 2 + lineHeight / 2;
            }
            currentIndex = newIndex;
        }
    }

    // --- 事件监听 ---
    function addEventListeners() {
        // **新增**: 监听标签导航点击
        tabNav.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (button && button.dataset.view) {
                switchView(button.dataset.view);
            }
        });

        // 点击播放列表
        playlistElement.addEventListener('click', (e) => {
            if (e.target.tagName === 'LI') {
                const index = parseInt(e.target.dataset.index, 10);
                loadSong(index);
            }
        });

        // 点击歌词
        lyricsContainer.addEventListener('click', (e) => {
            if (e.target.tagName === 'P' && e.target.dataset.index) {
                const index = parseInt(e.target.dataset.index, 10);
                if (lrcData[index]) {
                    audio.currentTime = lrcData[index].time;
                    if (audio.paused) audio.play();
                }
            }
        });

        // 音频事件
        audio.addEventListener('timeupdate', updateLyrics);
        audio.addEventListener('seeked', updateLyrics);
    }

    // --- 屏幕高度适配逻辑 ---
    function setAppHeight() {
        const doc = document.documentElement;
        // 创建一个名为 --app-height 的 CSS 变量，值为窗口的内部高度
        doc.style.setProperty('--app-height', `${window.innerHeight}px`);
    }

    // 页面加载时和窗口大小改变时都执行这个函数
    window.addEventListener('resize', setAppHeight);
    setAppHeight(); // 初始加载时也要执行一次

    // 启动应用
    init();
});