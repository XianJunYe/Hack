// script.js

let mediaRecorder;
let socket;
let socket2;
let audioContext;
let startButton = document.getElementById('startButton');
let stopButton = document.getElementById('stopButton');
let statusDiv = document.getElementById('status');

pauseButton.addEventListener('click', () => {
    socket2.send('pause');
});

startButton.addEventListener('click', async () => {
    // 请求麦克风权限并获取音频流
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        statusDiv.textContent = '麦克风权限获取成功，正在连接服务器...';

        // 初始化 WebSocket 连接
        socket = new WebSocket('ws://localhost:8080');
        socket2 = new WebSocket('ws://localhost:8080/pause');



        socket.addEventListener('open', () => {
            statusDiv.textContent = '服务器连接成功，开始录音...';

            // 创建 MediaRecorder 实例
            mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

            // 当有音频数据可用时发送到服务器
            mediaRecorder.addEventListener('dataavailable', event => {
                console.log('音频数据可用:', event.data.size)
                if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
                    socket.send(event.data);
                }
            });

            // 开始录音，设置数据可用事件触发间隔为250毫秒
            mediaRecorder.start(250);

            startButton.disabled = true;
            stopButton.disabled = false;
        });

        socket.onmessage = (event) => {
            // 播放接收到的音频数据
            const audioBlob = new Blob([event.data], { type: 'audio/webm' });
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
    mediaRecorder.stop();
    socket.close();
    socket2.close();
    statusDiv.textContent = '录音已停止。';

    startButton.disabled = false;
    stopButton.disabled = true;
});
