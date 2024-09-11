const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = 8080;

// 创建 WebSocket 服务器
const wss = new WebSocket.Server({ port: PORT }, () => {
    console.log(`WebSocket 服务器已启动，监听端口：${PORT}`);
});

wss.on('connection', ws => {
    console.log('客户端已连接');

    // 创建一个唯一的文件名
    const fileName = `audio_${Date.now()}.wav`;
    const filePath = path.join(__dirname, 'audio', fileName);

    // 确保音频目录存在
    if (!fs.existsSync(path.join(__dirname, 'audio'))) {
        fs.mkdirSync(path.join(__dirname, 'audio'));
    }

    const fileStream = fs.createWriteStream(filePath);

    let audioData = Buffer.alloc(0); // 用于缓存音频数据

    // 写入WAV文件头信息
    const writeWAVHeader = (fileStream, bufferLength) => {
        const header = Buffer.alloc(44);

        // RIFF Chunk
        header.write('RIFF', 0);
        header.writeUInt32LE(36 + bufferLength, 4);  // ChunkSize (文件总大小 - 8)
        header.write('WAVE', 8);

        // fmt subchunk
        header.write('fmt ', 12);
        header.writeUInt32LE(16, 16); // Subchunk1Size (PCM格式，16字节)
        header.writeUInt16LE(1, 20);  // 音频格式 (1 = PCM)
        header.writeUInt16LE(1, 22);  // 声道数 (1 = 单声道)
        header.writeUInt32LE(44100, 24); // 采样率 (44.1kHz)
        header.writeUInt32LE(44100 * 2, 28); // ByteRate (采样率 * 声道数 * 每个样本的字节数)
        header.writeUInt16LE(2, 32);  // BlockAlign (声道数 * 每个样本的字节数)
        header.writeUInt16LE(16, 34); // 每个样本的位数

        // data subchunk
        header.write('data', 36);
        header.writeUInt32LE(bufferLength, 40);  // Subchunk2Size (数据大小)

        fileStream.write(header);
    };

    // 在连接开始时，立即写入WAV头
    writeWAVHeader(fileStream, 0);

    ws.on('message', message => {
        // 将数据追加到缓存中
        audioData = Buffer.concat([audioData, message]);
        // 实时写入音频数据到文件
        fileStream.write(message);
    });

    ws.on('close', () => {
        const bufferLength = audioData.length;

        // 关闭连接时更新WAV文件头中的数据大小
        const fd = fs.openSync(filePath, 'r+');
        const headerBuffer = Buffer.alloc(4);
        headerBuffer.writeUInt32LE(bufferLength, 0);
        fs.writeSync(fd, headerBuffer, 0, 4, 40);  // 更新文件头中的数据大小
        fs.closeSync(fd);

        fileStream.end(); // 结束写入文件
        console.log(`客户端已断开，音频保存为：${fileName}`);
    });

    ws.on('error', error => {
        console.error('WebSocket 错误:', error);
    });

    // 读取并发送本地 WAV 文件到前端
    setTimeout(() => {
        if (fs.existsSync("/Users/xiexianjun/Desktop/code/Hack/front_end/audio/audio_1726043570125.wav")) {
            // 读取文件并发送
            fs.readFile("/Users/xiexianjun/Desktop/code/Hack/front_end/audio/audio_1726043570125.wav", (err, data) => {
                if (err) {
                    console.error('读取音频文件失败:', err);
                    return;
                }
                // 将WAV文件通过WebSocket发送到客户端
                ws.send(data);
                console.log('本地音频文件已发送到前端');
            });
        } else {
            console.error('音频文件不存在');
        }
    }, 10000); // 10 秒后触发
});
