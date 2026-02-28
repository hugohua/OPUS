#!/bin/bash

# Opus 数据库静态表同步脚本
# 用途：从本地 Docker DB 导出静态表数据，自动同步到 NAS 生产环境
# 用法: ./scripts/db-sync-to-nas.sh [选项]
# 示例:
#   ./scripts/db-sync-to-nas.sh                # 导出 + 部署
#   ./scripts/db-sync-to-nas.sh --export-only  # 仅导出 SQL 到本地
#   ./scripts/db-sync-to-nas.sh --dry-run      # 预览将要执行的操作

set -e

# ==================== 配置区 ====================

# 本地 DB 容器名
LOCAL_DB_CONTAINER="opus-db"
# 远程 DB 容器名 (NAS)
REMOTE_DB_CONTAINER="opus-db-prod"

# DB 连接参数
DB_USER="postgres"
DB_NAME="opus"

# 导出文件
EXPORT_DIR="backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
EXPORT_FILE="${EXPORT_DIR}/opus_static_${TIMESTAMP}.sql"

# 静态表列表 (来自 prisma/schema.prisma 中标记 [STATIC_DATA] 的表)
# ⚠️ 注意：PostgreSQL 表名大小写敏感，必须用双引号包裹
STATIC_TABLES=(
    '"Vocab"'
    '"SmartContent"'
    '"TTSCache"'
    '"Etymology"'
    '"Passage"'
    '"QuestionSeed"'
    '"GrammarNode"'
    '"InvitationCode"'
)

# 用户数据表 (仅用于显示，绝不会被操作)
USER_TABLES=(
    '"User"'
    '"UserProgress"'
    '"UserGrammarProficiency"'
    '"AttemptRecord"'
    '"Article"'
    '"ArticleVocab"'
    '"DrillCache"'
    '"DrillAudit"'
)

# ==================== 从 .env 加载 NAS 配置 ====================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

if [ -f "${PROJECT_ROOT}/.env" ]; then
    set -a
    while IFS= read -r line || [ -n "$line" ]; do
        if [[ "$line" =~ ^[[:space:]]*# ]] || [[ -z "$line" ]]; then
            continue
        fi
        line="${line%$'\r'}"
        eval "export $line"
    done < "${PROJECT_ROOT}/.env"
    set +a
fi

NAS_USER="${NAS_USER:-root}"
NAS_IP="${NAS_IP:-192.168.5.23}"
NAS_PORT="${NAS_PORT:-2002}"
NAS_PATH="${NAS_PATH:-/volume1/docker/opus}"
NAS_PASSWORD="${NAS_PASSWORD:-}"

# ==================== 工具函数 ====================

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

print_info()    { echo -e "${GREEN}[INFO]${NC} $1"; }
print_error()   { echo -e "${RED}[ERROR]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
print_step()    { echo -e "${CYAN}[STEP]${NC} $1"; }

# SSH/SCP 命令封装 (复用 build-and-export.sh 的模式)
remote_ssh() {
    if [ -n "$NAS_PASSWORD" ]; then
        sshpass -p "$NAS_PASSWORD" ssh -o StrictHostKeyChecking=no -p "${NAS_PORT}" "${NAS_USER}@${NAS_IP}" "$@"
    else
        ssh -p "${NAS_PORT}" "${NAS_USER}@${NAS_IP}" "$@"
    fi
}

remote_scp() {
    if [ -n "$NAS_PASSWORD" ]; then
        sshpass -p "$NAS_PASSWORD" scp -O -o StrictHostKeyChecking=no -P "${NAS_PORT}" "$@"
    else
        scp -O -P "${NAS_PORT}" "$@"
    fi
}

# ==================== 解析参数 ====================

EXPORT_ONLY=false
DRY_RUN=false
SKIP_RESTART=false
NO_CONFIRM=false

for arg in "$@"; do
    case $arg in
        --export-only)  EXPORT_ONLY=true ;;
        --dry-run)      DRY_RUN=true ;;
        --skip-restart) SKIP_RESTART=true ;;
        --yes|-y)       NO_CONFIRM=true ;;
        -h|--help)
            echo -e "${BLUE}Opus 数据库静态表同步工具${NC}"
            echo ""
            echo "用法: $0 [选项]"
            echo ""
            echo "选项:"
            echo "  --export-only   仅导出 SQL 到本地，不部署"
            echo "  --dry-run       预览操作，不实际执行"
            echo "  --skip-restart  导入后不重启业务服务"
            echo "  --yes, -y       跳过确认提示"
            echo "  -h, --help      显示帮助"
            echo ""
            echo "静态表 (会被同步):"
            for t in "${STATIC_TABLES[@]}"; do echo "  ✅ $t"; done
            echo ""
            echo "用户数据表 (不会被触碰):"
            for t in "${USER_TABLES[@]}"; do echo "  🔒 $t"; done
            exit 0
            ;;
    esac
done

# ==================== 主流程 ====================

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     Opus 静态表数据同步 (Local → NAS)       ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ---------- 步骤 0: 前置检查 ----------

print_step "0/5 前置检查"

# 检查本地 Docker 容器
if ! docker ps --format '{{.Names}}' | grep -q "^${LOCAL_DB_CONTAINER}$"; then
    print_error "本地容器 ${LOCAL_DB_CONTAINER} 未运行！请先 npm run infra:up"
    exit 1
fi
print_info "✓ 本地 DB 容器 ${LOCAL_DB_CONTAINER} 运行中"

# 检查 sshpass (如果用密码模式)
if [ "$EXPORT_ONLY" = false ] && [ -n "$NAS_PASSWORD" ]; then
    if ! command -v sshpass &> /dev/null; then
        print_error "使用密码登录需要 sshpass"
        print_info "安装: brew install hudochenkov/sshpass/sshpass"
        exit 1
    fi
fi

# 统计本地静态表数据量
print_info "本地静态表数据概览:"
echo ""
printf "  ${BLUE}%-25s %10s${NC}\n" "表名" "行数"
printf "  %-25s %10s\n" "-------------------------" "----------"
TOTAL_ROWS=0
for table in "${STATIC_TABLES[@]}"; do
    count=$(docker exec ${LOCAL_DB_CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -t -c "SELECT COUNT(*) FROM ${table};" 2>/dev/null | tr -d ' ')
    printf "  %-25s %10s\n" "$table" "$count"
    TOTAL_ROWS=$((TOTAL_ROWS + count))
done
printf "  %-25s %10s\n" "-------------------------" "----------"
printf "  ${GREEN}%-25s %10s${NC}\n" "合计" "$TOTAL_ROWS"
echo ""

# Dry Run 到此结束
if [ "$DRY_RUN" = true ]; then
    print_warning "Dry Run 模式，不执行实际操作"
    if [ "$EXPORT_ONLY" = false ]; then
        print_info "目标 NAS: ${NAS_USER}@${NAS_IP}:${NAS_PORT} → ${NAS_PATH}"
    fi
    exit 0
fi

# ---------- 步骤 1: 导出 SQL ----------

print_step "1/5 导出静态表 SQL"

mkdir -p "${PROJECT_ROOT}/${EXPORT_DIR}"

# 构建 pg_dump 的 -t 参数
TABLE_ARGS=""
for table in "${STATIC_TABLES[@]}"; do
    TABLE_ARGS="${TABLE_ARGS} -t ${table}"
done

# ⚠️ 不使用 -t (pseudo-TTY)，避免破坏多字节字符（日文 definition_jp 等）
FULL_EXPORT_PATH="${PROJECT_ROOT}/${EXPORT_FILE}"
docker exec ${LOCAL_DB_CONTAINER} pg_dump -U ${DB_USER} -d ${DB_NAME} \
    --clean --if-exists \
    ${TABLE_ARGS} \
    > "${FULL_EXPORT_PATH}"

EXPORT_SIZE=$(du -h "${FULL_EXPORT_PATH}" | cut -f1)
print_info "✓ 导出完成: ${EXPORT_FILE} (${EXPORT_SIZE})"

# 快速验证导出文件
LINE_COUNT=$(wc -l < "${FULL_EXPORT_PATH}" | tr -d ' ')
if [ "$LINE_COUNT" -lt 100 ]; then
    print_error "导出文件行数异常 (${LINE_COUNT} 行)，可能导出失败"
    exit 1
fi
print_info "✓ 文件验证通过 (${LINE_COUNT} 行)"

# 仅导出模式到此结束
if [ "$EXPORT_ONLY" = true ]; then
    echo ""
    print_info "====== 导出完成 ======"
    print_info "文件: ${FULL_EXPORT_PATH}"
    print_info "手动导入命令:"
    echo "  cat ${EXPORT_FILE} | docker exec -i ${REMOTE_DB_CONTAINER} psql -U ${DB_USER} -d ${DB_NAME}"
    exit 0
fi

# ---------- 步骤 2: 确认部署 ----------

print_step "2/5 确认部署目标"
print_info "目标: ${NAS_USER}@${NAS_IP}:${NAS_PORT}"
print_info "路径: ${NAS_PATH}"
echo ""

if [ "$NO_CONFIRM" = false ]; then
    print_warning "即将覆盖 NAS 上的静态表数据 (用户数据不受影响)"
    echo -n "确认继续？(y/N) "
    read -r answer
    if [[ "$answer" != "y" && "$answer" != "Y" ]]; then
        print_info "已取消"
        exit 0
    fi
fi

# ---------- 步骤 3: 检查远程连接 ----------

print_step "3/5 连接 NAS"

if ! remote_ssh "echo 'ok'" > /dev/null 2>&1; then
    print_error "SSH 连接失败！请检查 .env 中的 NAS_IP / NAS_PORT / NAS_PASSWORD"
    exit 1
fi
print_info "✓ SSH 连接成功"

# 检查远程 DB 容器
REMOTE_DB_RUNNING=$(remote_ssh "echo '${NAS_PASSWORD}' | sudo -S /usr/local/bin/docker ps --format '{{.Names}}' 2>/dev/null | grep -c '${REMOTE_DB_CONTAINER}'" 2>/dev/null || echo "0")
if [ "$REMOTE_DB_RUNNING" -eq 0 ]; then
    print_error "远程容器 ${REMOTE_DB_CONTAINER} 未运行！"
    exit 1
fi
print_info "✓ 远程 DB 容器 ${REMOTE_DB_CONTAINER} 运行中"

# ---------- 步骤 4: 传输 & 导入 ----------

print_step "4/5 传输并导入数据"

REMOTE_SQL_PATH="/tmp/opus_static_sync.sql"

# 传输 SQL 文件
print_info "传输 SQL 文件到 NAS..."
remote_scp "${FULL_EXPORT_PATH}" "${NAS_USER}@${NAS_IP}:${REMOTE_SQL_PATH}"
print_info "✓ 传输完成"

# 在远程执行导入
# ⚠️ 策略：docker cp 将 SQL 复制进容器 → 容器内 psql -f 执行
# 完全避免 SSH stdin 与 docker exec -i stdin 冲突问题
print_info "在 NAS 上导入数据 (这可能需要几秒钟)..."

CONTAINER_SQL_PATH="/tmp/opus_static_sync.sql"
SUDO_PREFIX=""
if [ -n "$NAS_PASSWORD" ]; then
    SUDO_PREFIX="echo '${NAS_PASSWORD}' | sudo -S"
fi

# Step 1: docker cp 将 SQL 复制进 DB 容器
print_info "  复制 SQL 到容器内部..."
remote_ssh "${SUDO_PREFIX} /usr/local/bin/docker cp ${REMOTE_SQL_PATH} ${REMOTE_DB_CONTAINER}:${CONTAINER_SQL_PATH}" 2>/dev/null
if [ $? -ne 0 ]; then
    print_error "docker cp 失败！"
    exit 1
fi

# Step 2: 在容器内部执行 psql -f (无 stdin 问题)
print_info "  执行 psql -f 导入..."
IMPORT_OUTPUT=$(remote_ssh "${SUDO_PREFIX} /usr/local/bin/docker exec ${REMOTE_DB_CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -f ${CONTAINER_SQL_PATH}" 2>&1)
IMPORT_EXIT=$?

# Step 3: 清理容器内临时文件
remote_ssh "${SUDO_PREFIX} /usr/local/bin/docker exec ${REMOTE_DB_CONTAINER} rm -f ${CONTAINER_SQL_PATH}" 2>/dev/null || true

# 检查导入结果
if [ $IMPORT_EXIT -ne 0 ] || echo "$IMPORT_OUTPUT" | grep -qi "^ERROR"; then
    print_error "导入过程中出现错误 (exit: ${IMPORT_EXIT}):"
    echo "$IMPORT_OUTPUT" | tail -20
    exit 1
fi
print_info "✓ 数据导入成功"

# 清理远程临时文件
remote_ssh "rm -f ${REMOTE_SQL_PATH}" 2>/dev/null || true

# ---------- 步骤 5: 重启服务 ----------

if [ "$SKIP_RESTART" = true ]; then
    print_warning "跳过重启 (--skip-restart)"
else
    print_step "5/5 重启业务服务"
    print_info "重启 opus-web, opus-worker, opus-redis, gateway..."

    if [ -n "$NAS_PASSWORD" ]; then
        remote_ssh "cd ${NAS_PATH} && echo '${NAS_PASSWORD}' | sudo -S /usr/local/bin/docker-compose restart opus-web opus-worker opus-redis gateway" 2>/dev/null || \
        remote_ssh "cd ${NAS_PATH} && echo '${NAS_PASSWORD}' | sudo -S /usr/local/bin/docker compose restart opus-web opus-worker opus-redis gateway" 2>/dev/null
    else
        remote_ssh "cd ${NAS_PATH} && sudo /usr/local/bin/docker-compose restart opus-web opus-worker opus-redis gateway" 2>/dev/null || \
        remote_ssh "cd ${NAS_PATH} && sudo /usr/local/bin/docker compose restart opus-web opus-worker opus-redis gateway" 2>/dev/null
    fi
    print_info "✓ 服务重启完成"
fi

# ==================== 完成 ====================

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          ✅ 静态表同步完成！                 ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
print_info "同步表: ${#STATIC_TABLES[@]} 张 | 总行数: ${TOTAL_ROWS}"
print_info "备份文件: ${EXPORT_FILE}"
print_info "服务地址: http://${NAS_IP}:30010"
echo ""
