# web-player — 网页音乐播放器 架构文档

## 1. 项目简介与技术栈

duyi 前端视频课衍生的网页播放器项目：一个纯静态的“多功能音乐播放器”，
支持播放本地 mp3、同步滚动显示 LRC 歌词、点击歌词行定位音频播放位置；
PC 端为双栏布局，移动端为「正在播放 / 歌曲列表」两个视图 + 底部 Tab 导航。

- 技术栈：原生 HTML + CSS + JavaScript，无框架、无构建、无依赖
- 文件结构：

```
web-player/
    index.html            页面结构（播放器视图 + 列表视图 + tab 导航）
    css/index.css         样式（移动端优先，CSS 变量，--app-height 适配）
    js/index.js           全部逻辑（DOMContentLoaded 内闭包）
    assets/music/*.mp3    两首歌曲（周传雄-关不上的窗 / 陈奕迅-浮夸）
    assets/lyric/*.lrc    20+ 个 LRC 歌词文件
    assets/demo/*.png     PC/移动端展示截图
```

- 运行方式：需通过静态服务器打开（歌词用 `fetch` 加载，受同源策略限制，
  file:// 协议无法工作），例如 `npx serve`、`python -m http.server`，
  或 VS Code Live Server

## 2. 系统架构图

```
+-------------------+     +----------------------+     +-------------------+
| index.html        |     | js/index.js          |     | css/index.css     |
| #player-view      |<--->| (唯一逻辑文件)        |<--->| .view.active 切换  |
| #playlist-view    | DOM | 模块:                | class| 移动端 tab 布局    |
| .tab-nav (2 按钮) | 操作|  switchView          | 切换 | --app-height 变量  |
| <audio #audio>    |     |  renderPlaylist      |     +-------------------+
| #lyrics-container |     |  loadSong            |
+-------------------+     |  loadLyrics/parseLrc |
                          |  renderLyrics        |
        ^ fetch           |  updateLyrics        |
        |                 |  addEventListeners   |
        v                 |  setAppHeight        |
+-------------------+     +----------+-----------+
| assets/lyric/*.lrc|                ^
| (LRC 文本文件)     |                | timeupdate / seeked 事件
+-------------------+                |
                                     |
+-------------------+    src         +-----------+
| assets/music/*.mp3| <--------------| <audio>   |
+-------------------+                +-----------+
```

视图切换：`switchView(viewId)` 通过 toggle `.active` class 实现
（CSS 透明度/可见性过渡），不销毁 DOM。

## 3. 数据流图

**歌曲加载与歌词解析**

```
用户点击播放列表 <li>  (playlistElement click, dataset.index)
  |
  v
loadSong(index)
  |--- currentSongInfo 更新 (title / artist)
  |--- audio.src = './assets/music/' + song.file
  |--- lrcPath = './assets/lyric/' + song.file 去掉 .mp3 后缀、去空格 + '.lrc'
  |
  v
loadLyrics(lrcPath) --fetch--> LRC 文本 (string)
  |
  v
parseLrc(lrcText):
  split('\n') 逐行匹配 /[(\d{2}):(\d{2})\.(\d{2,3})]/
  time = 分*60 + 秒 + 毫秒(padEnd(3,'0') 统一 3 位)/1000
  text = 行内容去时间戳、trim（空行丢弃）
  |--- 输出: lrcData = [{ time: number, text: string }, ...] 按 time 升序
  v
renderLyrics(): 每行生成 <p data-index=i>，追加进 #lyrics-container
```

**播放同步高亮**

```
<audio> timeupdate / seeked 事件
  |
  v
updateLyrics():
  currentTime = audio.currentTime
  newIndex = lrcData.findIndex( currentTime >= line.time
                                && (!next || currentTime < next.time) )
  |
  |--- newIndex === currentIndex --> 无操作
  |--- 变更: 旧 <p> 移除 .active
  |          新 <p> 加 .active
  |          lyricsContainer.scrollTop =
  |              lineTop - containerHeight/2 + lineHeight/2   (居中滚动)
  v
输出: 歌词面板高亮行滚动居中
```

**点击歌词回跳**

```
点击 <p data-index=i> --> audio.currentTime = lrcData[i].time
                        --> 若 audio.paused 则 audio.play()
```

## 4. 关键数据结构

**songList**（硬编码于 js/index.js，新增歌曲在此追加）

```js
[
  { title: "关不上的窗", artist: "周传雄", file: "周传雄 - 关不上的窗.mp3" },
  { title: " 浮夸",     artist: "陈奕迅", file: "陈奕迅 - 浮夸.mp3"     }
]
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `title` | string | 歌曲名，显示在 #current-song-info |
| `artist` | string | 歌手名 |
| `file` | string | mp3 文件名；同时约定同名（去空格）的 .lrc 歌词文件 |

**LRC 行对象**（`lrcData` 数组元素，由 parseLrc 产出）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `time` | number | 该行起始时间（秒，含毫秒小数，与 audio.currentTime 同基准） |
| `text` | string | 歌词文本 |

**模块内状态变量**（js/index.js 闭包内）

| 变量 | 类型 | 说明 |
| --- | --- | --- |
| `lrcData` | LrcLine[] | 当前歌曲解析后的歌词数组（按 time 升序） |
| `currentIndex` | number | 当前高亮的歌词行索引，初始 -1 |
| `currentSongIndex` | number | 当前歌曲在 songList 中的索引，初始 -1（用于避免重复加载） |

**DOM 约定**

- 播放列表项 `<li data-index>`、歌词行 `<p data-index>`：用 dataset 存索引，
  事件委托读取。
- CSS 变量 `--app-height`：由 `setAppHeight()` 写入 `window.innerHeight`，
  解决移动端动态视口高度问题。

## 5. 接口/主要函数清单

全部位于 `E:\past-toy-projects\web-player\js\index.js`（DOMContentLoaded 回调内）：

| 函数 | 签名 | 说明 |
| --- | --- | --- |
| `init()` | `() => void` | 启动入口：renderPlaylist + addEventListeners + 默认切到 player-view |
| `switchView(viewId)` | `(string) => void` | 对两个 `.view` 与 tab 按钮 toggle `.active`，实现视图切换 |
| `renderPlaylist()` | `() => void` | 清空 `<ul>` 后按 songList 生成 `<li data-index>` 列表 |
| `loadSong(index)` | `(number) => void` | 同索引防重载；更新歌曲信息、`audio.src`、重置歌词状态、`loadLyrics`、高亮列表项、`audio.play()`；移动端（<768px）延迟切回播放器视图 |
| `loadLyrics(lrcPath)` | `(string) => void` | `fetch` 拉取 LRC 文本；失败在歌词容器显示错误信息；成功则 parseLrc + renderLyrics |
| `parseLrc(lrcText)` | `(string) => LrcLine[]` | 正则 `/\[(\d{2}):(\d{2})\.(\d{2,3})\]/` 逐行解析时间戳，毫秒 `padEnd(3,'0')` 规范化（"45"->"450"），输出按 time 升序的 `{time, text}` 数组 |
| `renderLyrics()` | `() => void` | 将 lrcData 渲染为 `<p data-index>` 行 |
| `updateLyrics()` | `() => void` | 绑定在 `timeupdate`/`seeked` 上：findIndex 定位当前行，变更时切换 `.active` 并计算 scrollTop 使高亮行滚动居中 |
| `addEventListeners()` | `() => void` | 事件委托：tab 导航点击、播放列表点击(loadSong)、歌词点击(seek 定位)、audio 的 timeupdate/seeked |
| `setAppHeight()` | `() => void` | 将 `--app-height` 设为 `window.innerHeight`；resize 时重新执行 |

注意点（代码事实）：

- 歌词点击高亮依赖 `e.target.dataset.index` 为真值，因此第 0 行（data-index="0"）
  点击 seek 会因 `"0"` 判断方式（字符串 `"0"` 为真值，实际可用）仍正常工作，
  但 `if (e.target.dataset.index)` 在 index 为 0 的字符串 "0" 时为 truthy，不受影响。
- lrc 文件名规则为 mp3 文件名去 `.mp3`、去全部空格后拼 `.lrc`。
- README 描述为“视频播放器”，实际实现为音乐（音频）播放器。
