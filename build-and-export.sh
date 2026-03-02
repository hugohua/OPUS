#!/bin/bash

# Opus Docker 构建和导出脚本
# 用途：构建 Opus 所有服务镜像并导出到 dockers 目录
# 用法: ./build-and-export.sh [版本号]
# 示例: ./build-and-export.sh v1.0.0

set -e  # 遇到错误时退出

# ==================== 配置区 ====================

# 代理配置（国内网络构建时启用）
PROXY_HOST="http://127.0.0.1:1087"
NO_PROXY_VALUE="localhost,127.0.0.1,*.internal,192.168.0.0/16,10.*.*.*"

# 获取版本号参数
VERSION="${1:-latest}"

# 输出目录
OUTPUT_DIR="dockers"

# 镜像服务列表 (格式: "服务名:镜像名")
SERVICES="web:opus-web worker:opus-worker tts:opus-tts"

# 基础镜像列表 (格式: "名称:镜像名")
BASE_IMAGES="nginx:nginx:alpine pgvector:ankane/pgvector:latest redis:redis:7-alpine"

# ==================== 部署配置 ====================
# 尝试从 .env 文件加载环境变量
if [ -f .env ]; then
    set -a
    while IFS= read -r line || [ -n "$line" ]; do
        # 忽略注释和空行
        if [[ "$line" =~ ^[[:space:]]*# ]] || [[ -z "$line" ]]; then
            continue
        fi
        # 移除可能存在的 \r
        line="${line%$'\r'}"
        eval "export $line"
    done < .env
    set +a
fi

NAS_USER="${NAS_USER:-root}"
NAS_IP="${NAS_IP:-192.168.5.23}"
NAS_PORT="${NAS_PORT:-2002}"
NAS_PATH="${NAS_PATH:-/volume1/docker/opus}"
# 密码从环境变量中读取，切勿硬编码！
NAS_PASSWORD="${NAS_PASSWORD:-}"
DEPLOY_TO_NAS=false

# SSH/SCP 命令封装 (自动使用 sshpass)
remote_ssh() {
    if [ -n "$NAS_PASSWORD" ]; then
        sshpass -p "$NAS_PASSWORD" ssh -o StrictHostKeyChecking=no -p "${NAS_PORT}" "${NAS_USER}@${NAS_IP}" "$@"
    else
        ssh -p "${NAS_PORT}" "${NAS_USER}@${NAS_IP}" "$@"
    fi
}

remote_scp() {
    # -O: 使用传统 SCP 协议，避免 SFTP subsystem 报错
    if [ -n "$NAS_PASSWORD" ]; then
        sshpass -p "$NAS_PASSWORD" scp -O -o StrictHostKeyChecking=no -P "${NAS_PORT}" "$@"
    else
        scp -O -P "${NAS_PORT}" "$@"
    fi
}

# ==================== 代理管理 ====================

OLD_HTTP_PROXY="${http_proxy:-}"
OLD_HTTPS_PROXY="${https_proxy:-}"
OLD_NO_PROXY="${no_proxy:-}"

restore_proxy() {
    if [ -n "$OLD_HTTP_PROXY" ]; then
        export http_proxy="$OLD_HTTP_PROXY"
    else
        unset http_proxy
    fi
    
    if [ -n "$OLD_HTTPS_PROXY" ]; then
        export https_proxy="$OLD_HTTPS_PROXY"
    else
        unset https_proxy
    fi
    
    if [ -n "$OLD_NO_PROXY" ]; then
        export no_proxy="$OLD_NO_PROXY"
    else
        unset no_proxy
    fi
}

setup_proxy() {
    export http_proxy="$PROXY_HOST"
    export https_proxy="$PROXY_HOST"
    export no_proxy="$NO_PROXY_VALUE"
}

trap restore_proxy EXIT

# ==================== 部署函数 ====================

deploy_to_nas() {
    print_info "====== 开始部署到 NAS ======"
    
    # 交互式获取 NAS 信息（如果未设置）
    if [ -z "$NAS_USER" ]; then
        read -p "请输入 NAS 用户名 (默认: root): " input_user
        NAS_USER="${input_user:-root}"
    fi
    
    if [ -z "$NAS_IP" ]; then
        read -p "请输入 NAS IP 地址: " input_ip
        if [ -z "$input_ip" ]; then
            print_error "必须要输入 NAS IP 地址！"
            exit 1
        fi
        NAS_IP="$input_ip"
    fi

    if [ -z "$NAS_PORT" ]; then
        read -p "请输入 NAS SSH 端口 (默认: 22): " input_port
        NAS_PORT="${input_port:-22}"
    fi

    if [ -z "$NAS_PATH" ]; then
        read -p "请输入 NAS 部署路径 (默认: /volume1/docker/opus): " input_path
        NAS_PATH="${input_path:-/volume1/docker/opus}"
    fi

    print_info "连接目标: ${NAS_USER}@${NAS_IP}:${NAS_PORT} -> ${NAS_PATH}"
    
    # 检查 sshpass 是否安装 (如果使用密码)
    if [ -n "$NAS_PASSWORD" ]; then
        if ! command -v sshpass &> /dev/null; then
            print_error "使用密码登录需要安装 sshpass"
            print_info "请运行: brew install sshpass 或 brew install hudochenkov/sshpass/sshpass"
            exit 1
        fi
        print_info "使用密码模式连接..."
    fi
    
    # 检查 SSH 连接
    if ! remote_ssh "echo 'SSH Connection Success'" >/dev/null 2>&1; then
        print_error "SSH 连接失败！请检查 IP、端口、用户名或密码。"
        exit 1
    fi

    # 1. 创建远程目录 (含数据持久化目录)
    print_info "创建远程目录..."
    remote_ssh "mkdir -p ${NAS_PATH}/{data/postgres,data/redis,data/audio,data/logs,nginx}"

    print_info "修复目标目录权限..."
    if [ -n "$NAS_PASSWORD" ]; then
        remote_ssh "echo '$NAS_PASSWORD' | sudo -S chown -R ${NAS_USER} ${NAS_PATH}" || true
    else
        remote_ssh "sudo chown -R ${NAS_USER} ${NAS_PATH}" || true
    fi

    # 2. 传输配置文件
    print_info "传输配置文件..."
    # 使用 NAS 专用的 compose 文件 (预构建镜像，无需 build context)
    remote_scp docker-compose.nas.yml "${NAS_USER}@${NAS_IP}:${NAS_PATH}/docker-compose.yml"
    if [ -f .env ]; then
        remote_scp .env "${NAS_USER}@${NAS_IP}:${NAS_PATH}/"
    fi
    if [ -f nginx/nginx.conf ]; then
        remote_ssh "mkdir -p ${NAS_PATH}/nginx"
        remote_scp nginx/nginx.conf "${NAS_USER}@${NAS_IP}:${NAS_PATH}/nginx/"
    fi

    # 3. 传输并加载镜像 (先传文件，再加载)
    print_info "开始传输并加载镜像 (这可能需要几分钟)..."
    
    for item in $SERVICES; do
        service="${item%%:*}"
        tagged_name="opus/${service}:${VERSION}"
        tar_file="${OUTPUT_DIR}/opus-${service}-${VERSION}.tar"
        remote_tar="/tmp/opus-${service}-${VERSION}.tar"
        
        print_info "  正在部署 ${service}..."
        
        # 步骤 1: 传输 tar 文件到 NAS
        print_info "    传输文件..."
        remote_scp "$tar_file" "${NAS_USER}@${NAS_IP}:${remote_tar}"
        
        # 步骤 2: 在 NAS 上加载镜像
        print_info "    加载镜像..."
        if [ -n "$NAS_PASSWORD" ]; then
            if remote_ssh "echo '$NAS_PASSWORD' | sudo -S /usr/local/bin/docker load -i ${remote_tar} && rm -f ${remote_tar}"; then
                print_info "  ✓ ${service} 部署成功"
            else
                print_error "  ✗ ${service} 部署失败"
                exit 1
            fi
        else
            if remote_ssh "sudo /usr/local/bin/docker load -i ${remote_tar} && rm -f ${remote_tar}"; then
                print_info "  ✓ ${service} 部署成功"
            else
                print_error "  ✗ ${service} 部署失败"
                exit 1
            fi
        fi
    done

    # 4. 重启服务 (群晖使用 docker-compose v1)
    print_info "重启远程服务..."
    if [ -n "$NAS_PASSWORD" ]; then
        remote_ssh "cd ${NAS_PATH} && echo '$NAS_PASSWORD' | sudo -S /usr/local/bin/docker-compose up -d" 2>/dev/null || \
        remote_ssh "cd ${NAS_PATH} && echo '$NAS_PASSWORD' | sudo -S /usr/local/bin/docker compose up -d"
    else
        remote_ssh "cd ${NAS_PATH} && sudo /usr/local/bin/docker-compose up -d" 2>/dev/null || \
        remote_ssh "cd ${NAS_PATH} && sudo /usr/local/bin/docker compose up -d"
    fi

    print_info "✅ 部署完成！"
    print_info "服务地址: http://${NAS_IP}"
}

# ==================== 工具函数 ====================

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_usage() {
    echo -e "${BLUE}用法:${NC} $0 [版本号] [选项]"
    echo -e "${BLUE}示例:${NC}"
    echo -e "  $0 v1.0.0             # 构建并导出镜像"
    echo -e "  $0 v1.0.0 --deploy      # 构建后自动部署到 NAS"
    echo -e "  $0 v1.0.0 --deploy-only # 跳过构建，直接部署已构建的镜像"
    echo -e "  $0 latest --with-base   # 包含基础镜像（nginx/redis/pgvector）"
}

# ==================== 主流程 ====================

if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    print_usage
    exit 0
fi

# 解析参数
for arg in "$@"; do
    case $arg in
        --deploy)
            DEPLOY_TO_NAS=true
            ;;
        --deploy-only)
            DEPLOY_TO_NAS=true
            DEPLOY_ONLY=true
            ;;
        --with-base)
            EXPORT_BASE=true
            ;;
        -*)
            # Handle other flags if necessary
            ;;
        *)
            # Assume it's version if not a flag and version not set (simple logic)
            if [ -z "$VERSION_ARG" ]; then
               VERSION_ARG="$arg"
            fi
            ;;
    esac
done

# 如果第一个参数不是 flag，则作为版本号 (覆盖默认 latest)
if [[ "$1" != -* ]] && [ -n "$1" ]; then
    VERSION="$1"
fi


print_info "====== Opus 镜像构建与导出 ======"
print_info "版本号: ${VERSION}"
echo ""

# 创建输出目录
mkdir -p "$OUTPUT_DIR"

# 设置代理
print_info "设置代理: ${PROXY_HOST}"
setup_proxy

# ==================== 步骤 1: 构建镜像 ====================

if [ "$DEPLOY_ONLY" = true ]; then
    print_warning "跳过构建步骤 (--deploy-only)"
else
    print_info "开始构建 Opus 服务镜像 (平台: linux/amd64)..."

    # 自动转换代理地址 (127.0.0.1 -> host.docker.internal)
    BUILD_ARGS=""
    if [ -n "$PROXY_HOST" ]; then
        DOCKER_PROXY_HOST=$(echo "$PROXY_HOST" | sed 's/127.0.0.1/host.docker.internal/g' | sed 's/localhost/host.docker.internal/g')
        BUILD_ARGS="--build-arg http_proxy=$DOCKER_PROXY_HOST --build-arg https_proxy=$DOCKER_PROXY_HOST"
        print_info "注入构建代理: $DOCKER_PROXY_HOST"
    fi

    # 使用 DOCKER_DEFAULT_PLATFORM 构建适用于 NAS (x86_64) 的镜像
    if DOCKER_BUILDKIT=1 DOCKER_DEFAULT_PLATFORM=linux/amd64 docker compose -f docker-compose.prod.yml build $BUILD_ARGS; then
        print_info "所有镜像构建成功！"
    else
        print_error "镜像构建失败！"
        exit 1
    fi
fi

# ==================== 步骤 2: 标记版本 ====================

print_info "为镜像打版本标签: ${VERSION}"

for item in $SERVICES; do
    service="${item%%:*}"
    image_name="${item#*:}"
    tagged_name="opus/${service}:${VERSION}"
    
    # 查找实际镜像名（docker-compose 可能添加后缀）
    actual_image=$(docker images --format "{{.Repository}}:{{.Tag}}" | grep "opus.*${service}" | head -n1)
    
    if [ -n "$actual_image" ]; then
        docker tag "$actual_image" "$tagged_name"
        print_info "  ✓ ${service}: ${tagged_name}"
    else
        print_warning "  ✗ 未找到 ${service} 镜像"
    fi
done

# ==================== 步骤 3: 导出镜像 ====================

print_info "开始导出镜像..."
mkdir -p "$OUTPUT_DIR"

# 导出 Opus 自定义镜像
for item in $SERVICES; do
    service="${item%%:*}"
    tagged_name="opus/${service}:${VERSION}"
    output_file="${OUTPUT_DIR}/opus-${service}-${VERSION}.tar"
    
    if docker save "$tagged_name" -o "$output_file" 2>/dev/null; then
        size=$(du -h "$output_file" | cut -f1)
        print_info "  ✓ ${service}: ${output_file} (${size})"
    else
        print_warning "  ✗ ${service}: 导出失败（可能镜像不存在）"
    fi
done

# 导出基础镜像（可选）
if [ "$EXPORT_BASE" = true ]; then
    print_info "导出基础镜像..."
    
    for item in $BASE_IMAGES; do
        name="${item%%:*}"
        image="${item#*:}"
        output_file="${OUTPUT_DIR}/base-${name}-${VERSION}.tar"
        
        # 先拉取最新版本
        docker pull "$image" >/dev/null 2>&1 || true
        
        if docker save "$image" -o "$output_file"; then
            size=$(du -h "$output_file" | cut -f1)
            print_info "  ✓ ${name}: ${output_file} (${size})"
        else
            print_warning "  ✗ ${name}: 导出失败"
        fi
    done
fi

# ==================== 步骤 4: 自动部署（可选） ====================

if [ "$DEPLOY_TO_NAS" = true ]; then
    deploy_to_nas
    exit 0
fi

# ==================== 步骤 5: 打包（仅在非部署模式下询问） ====================

archive_file="${OUTPUT_DIR}/opus-all-${VERSION}.tar.gz"
print_info "是否打包所有镜像到 ${archive_file}？(y/N)"
read -r -t 10 answer || answer="n"

if [ "$answer" = "y" ] || [ "$answer" = "Y" ]; then
    tar -czf "$archive_file" -C "$OUTPUT_DIR" $(ls -1 "$OUTPUT_DIR"/*.tar | xargs -n1 basename)
    size=$(du -h "$archive_file" | cut -f1)
    print_info "  ✓ 打包完成: ${archive_file} (${size})"
fi

# ==================== 完成 ====================

echo ""
print_info "====== 导出完成 ======"
print_info "导出目录: ${OUTPUT_DIR}/"
print_info "下一步操作："
echo ""
echo "  1. 传输到 NAS:"
echo "     scp ${OUTPUT_DIR}/opus-*.tar nas-user@nas-ip:/volume1/docker/"
echo ""
echo "  2. 在 NAS 上导入:"
echo "     docker load -i opus-web-${VERSION}.tar"
echo "     docker load -i opus-worker-${VERSION}.tar"
echo "     docker load -i opus-tts-${VERSION}.tar"
echo ""
echo "  3. 部署:"
echo "     docker compose -f docker-compose.prod.yml up -d"
echo ""

echo "  3. 自动部署:"
echo "     ./build-and-export.sh ${VERSION} --deploy"
echo ""

# 代理自动恢复（trap EXIT）
