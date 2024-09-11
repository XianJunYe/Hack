// script.js

let audioContext;
let mediaStreamSource;
let audioProcessor;
let socket;
let startButton = document.getElementById('startButton');
let stopButton = document.getElementById('stopButton');
let statusDiv = document.getElementById('status');

startButton.addEventListener('click', async () => {
    // 请求麦克风权限并获取音频流
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        statusDiv.textContent = '麦克风权限获取成功，正在连接服务器...';

        // 初始化 WebSocket 连接
        socket = new WebSocket('ws://localhost:8080');

        socket.addEventListener('open', () => {
            statusDiv.textContent = '服务器连接成功，开始录音...';

            // 创建 AudioContext
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            mediaStreamSource = audioContext.createMediaStreamSource(stream);

            // 创建 ScriptProcessorNode 处理音频数据
            audioProcessor = audioContext.createScriptProcessor(4096, 1, 1);
            audioProcessor.onaudioprocess = function (event) {
                const audioData = event.inputBuffer.getChannelData(0);
                const wavBuffer = convertToWAV(audioData);

                if (socket.readyState === WebSocket.OPEN) {
                    socket.send(wavBuffer);
                }
            };

            mediaStreamSource.connect(audioProcessor);
            audioProcessor.connect(audioContext.destination);

            startButton.disabled = true;
            stopButton.disabled = false;
        });

        socket.onmessage = (event) => {
            // 播放接收到的音频数据
            const audioBlob = new Blob([event.data], { type: 'audio/wav' });
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            audio.play();
            statusDiv.textContent = '音频播放完毕';
        };

        socket.addEventListener('error', error => {
            console.error('WebSocket 错误:', error);
            statusDiv.textContent = '服务器连接错误，请检查服务器是否运行。';
        });

    } catch (err) {
        console.error('获取麦克风权限失败:', err);
        statusDiv.textContent = '无法获取麦克风权限。';
    }
});

stopButton.addEventListener('click', () => {
    // 停止录音
    audioProcessor.disconnect();
    mediaStreamSource.disconnect();
    socket.close();
    statusDiv.textContent = '录音已停止。';

    startButton.disabled = false;
    stopButton.disabled = true;
});

// 将 PCM 数据转换为 WAV 格式
function convertToWAV(audioData) {
    const buffer = new ArrayBuffer(44 + audioData.length * 2); // 44字节的WAV文件头
    const view = new DataView(buffer);

    // 写入 WAV 文件头
    writeWAVHeader(view, audioData.length);

    // 写入 PCM 数据
    let offset = 44;
    for (let i = 0; i < audioData.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, audioData[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }

    return new Blob([view], { type: 'audio/wav' });
}

function writeWAVHeader(view, dataLength) {
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength * 2, true); // 文件大小
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, 1, true);  // PCM format
    view.setUint16(22, 1, true);  // 单声道
    view.setUint32(24, 44100, true); // 采样率
    view.setUint32(28, 44100 * 2, true); // 字节率
    view.setUint16(32, 2, true); // block align
    view.setUint16(34, 16, true); // 每个样本的位深度
    writeString(view, 36, 'data');
    view.setUint32(40, dataLength * 2, true); // 数据 chunk 大小
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}
