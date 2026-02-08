import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.join(__dirname, '..');
const ttsDir = path.join(rootDir, 'python_tts_service');

// 加载 .env 环境变量
dotenv.config({ path: path.join(rootDir, '.env') });

const isWindows = process.platform === 'win32';

let cmd: string;
let args: string[];

if (isWindows) {
    cmd = 'powershell';
    args = ['-ExecutionPolicy', 'Bypass', '-File', 'start.ps1'];
} else {
    cmd = './start.sh';
    args = [];
}

console.log(`Starting TTS service in ${ttsDir} on ${process.platform}...`);

// 计算 CACHE_DIR 绝对路径，确保 Python 无论从哪里启动都写入正确位置
const cacheDir = path.join(rootDir, 'public', 'audio');

const child = spawn(cmd, args, {
    cwd: ttsDir,
    stdio: 'inherit',
    shell: true,
    env: {
        ...process.env,
        CACHE_DIR: cacheDir,  // 覆盖/注入 CACHE_DIR
    },
});

// 子进程退出时,父进程也退出
child.on('exit', (code) => {
    console.log(`\nTTS service exited with code ${code ?? 0}`);
    process.exit(code ?? 0);
});

// 处理父进程退出信号,确保子进程被正确关闭
const cleanup = (signal: string) => {
    console.log(`\n收到 ${signal} 信号,正在关闭 TTS 服务...`);

    if (!child.killed) {
        // 先尝试优雅关闭 (SIGTERM)
        child.kill('SIGTERM');

        // 如果 2 秒后还没退出,强制杀死
        const killTimeout = setTimeout(() => {
            if (!child.killed) {
                console.log('TTS 服务未响应,强制终止...');
                child.kill('SIGKILL');
            }
        }, 2000);

        child.on('exit', () => {
            clearTimeout(killTimeout);
            process.exit(0);
        });
    }
};

// 监听常见的退出信号
process.on('SIGINT', () => cleanup('SIGINT'));   // Ctrl+C
process.on('SIGTERM', () => cleanup('SIGTERM')); // kill 命令
process.on('exit', () => {
    // 最后的保险,确保子进程被杀死
    if (!child.killed) {
        child.kill('SIGKILL');
    }
});
