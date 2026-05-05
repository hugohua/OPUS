#!/bin/bash

# Opus 数据库同步脚本 (V2: 包含 Schema Sync & 安全的数据 Sync)
# 用途：将本地开发环境的表结构和内容同步部署到 NAS
# 默认行为: 进行结构同步 (db push) + 安全的数据追加 (append)
#
# 用法: ./scripts/db-sync-to-nas.sh [选项]
# 示例:
#   ./scripts/db-sync-to-nas.sh --dry-run            # 仅校验本地 schema 与静态数据导出，不连接 NAS
#   ./scripts/db-sync-to-nas.sh                      # 默认: 结构升级 + 追加新题 (无感安全)
#   ./scripts/db-sync-to-nas.sh --skip-schema        # 仅同步数据
#   ./scripts/db-sync-to-nas.sh --overwrite-danger   # ⚠️ 危险: 清空所有相关表然后导入 (会清空用户的相关进度)

set -e

# ==================== 配置区 ====================
LOCAL_DB_CONTAINER="opus-db"
DB_USER="postgres"
DB_NAME="opus"

EXPORT_DIR="backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
EXPORT_FILE="${EXPORT_DIR}/opus_static_${TIMESTAMP}.sql"

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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 加载环境变量
if [ -f "${PROJECT_ROOT}/.env" ]; then
    set -a
    while IFS= read -r line || [ -n "$line" ]; do
        if [[ "$line" =~ ^[[:space:]]*# ]] || [[ -z "$line" ]]; then continue; fi
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
CYAN='\033[0;36m'
NC='\033[0m'

print_info()    { echo -e "${GREEN}[INFO]${NC} $1"; }
print_error()   { echo -e "${RED}[ERROR]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
print_step()    { echo -e "${CYAN}[STEP]${NC} $1"; }

remote_scp() {
    if [ -n "$NAS_PASSWORD" ]; then
        sshpass -p "$NAS_PASSWORD" scp -O -P "${NAS_PORT}" -o StrictHostKeyChecking=no "$@"
    else
        scp -O -P "${NAS_PORT}" "$@"
    fi
}

remote_ssh_script() {
    local script_path=$1
    if [ -n "$NAS_PASSWORD" ]; then
        sshpass -p "$NAS_PASSWORD" ssh -p "${NAS_PORT}" -o StrictHostKeyChecking=no "${NAS_USER}@${NAS_IP}" "bash ${script_path} '${NAS_PASSWORD}'"
    else
        ssh -p "${NAS_PORT}" "${NAS_USER}@${NAS_IP}" "bash ${script_path} ''"
    fi
}

# ==================== 解析参数 ====================
SKIP_SCHEMA=false
OVERWRITE=false
DRY_RUN=false

for arg in "$@"; do
    case $arg in
        --dry-run)          DRY_RUN=true ;;
        --skip-schema)      SKIP_SCHEMA=true ;;
        --overwrite-danger) OVERWRITE=true ;;
        -h|--help)
            echo -e "${CYAN}Opus 数据库同步工具 V2${NC}"
            echo "用法: $0 [选项]"
            echo "  --dry-run           仅校验本地 Prisma Schema 与静态数据导出，不连接 NAS、不写生产库"
            echo "  --skip-schema       跳过表结构推送到生产环境 (db push)"
            echo "  --overwrite-danger  ⚠️ 警告: 使用 TRUNCATE 清空现存静态数据然后写入。这可能会导致级联删除无辜用户的进度！"
            echo "  -h, --help          显示帮助"
            exit 0
            ;;
        *)
            print_error "未知参数: $arg"
            echo "使用 $0 --help 查看支持的选项"
            exit 1
            ;;
    esac
done

echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     Opus 数据库同步 (Local → NAS) V2        ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"

if [ "$DRY_RUN" = true ]; then
    print_warning "Dry Run 模式：不会连接 NAS，不会写入生产数据库，不会重启生产容器"
fi

# 验证本地容器
if ! docker ps --format '{{.Names}}' | grep -q "^${LOCAL_DB_CONTAINER}$"; then
    print_error "本地容器 ${LOCAL_DB_CONTAINER} 未运行！"
    exit 1
fi

# ---------- Phase 1: Schema Sync ----------
if [ "$SKIP_SCHEMA" = false ]; then
    if [ "$DRY_RUN" = true ]; then
        print_step "阶段 1/3: Dry Run - 校验本地 Prisma Schema"
        (cd "${PROJECT_ROOT}" && npx prisma validate)
        print_info "Dry Run: 正式同步时将在 NAS 上执行 npx prisma db push（不带 --accept-data-loss）"
    else
        print_step "阶段 1/3: 自动化远程 Schema Sync (npx prisma db push)"
    
        cat << 'EOF' > /tmp/nas_schema_sync.sh
#!/bin/bash
PASSWORD=$1
echo "$PASSWORD" | sudo -S /usr/local/bin/docker exec opus-worker-prod npx --yes prisma db push
EOF
    
        print_info "传输临时执行脚本..."
        remote_scp /tmp/nas_schema_sync.sh "${NAS_USER}@${NAS_IP}:/tmp/nas_schema_sync.sh"
    
        print_info "在 NAS 上执行 Prisma db push..."
        if ! remote_ssh_script /tmp/nas_schema_sync.sh; then
            print_error "Schema Sync 失败！"
            exit 1
        fi
        print_info "✓ Schema Sync 完成"
    fi
else
    print_step "阶段 1/3: Schema Sync 已跳过"
fi

# ---------- Phase 2: Data Sync ----------
print_step "阶段 2/3: 导出本地静态数据"
mkdir -p "${PROJECT_ROOT}/${EXPORT_DIR}"

TABLE_ARGS=""
for table in "${STATIC_TABLES[@]}"; do
    TABLE_ARGS="${TABLE_ARGS} -t ${table}"
done

FULL_EXPORT_PATH="${PROJECT_ROOT}/${EXPORT_FILE}"

if [ "$OVERWRITE" = true ]; then
    print_warning "⚠️ 选用: Overwrite 模式 (清空旧数据覆盖)"
    # 使用 clean 导出 (其实后面脚本里我们会强制 Truncate 以避免外键问题阻塞)
    docker exec ${LOCAL_DB_CONTAINER} pg_dump -U ${DB_USER} -d ${DB_NAME} \
        --data-only --inserts ${TABLE_ARGS} > "${FULL_EXPORT_PATH}"
else
    print_info "✓ 选用: Append 模式 (仅追加新数据，忽略冲突)"
    # 纯数据导出，附加冲突忽略
    docker exec ${LOCAL_DB_CONTAINER} pg_dump -U ${DB_USER} -d ${DB_NAME} \
        --data-only --inserts --on-conflict-do-nothing ${TABLE_ARGS} > "${FULL_EXPORT_PATH}"
fi

EXPORT_SIZE=$(du -h "${FULL_EXPORT_PATH}" | cut -f1)
print_info "✓ SQL 导出生成: ${EXPORT_FILE} (${EXPORT_SIZE})"

if [ "$DRY_RUN" = true ]; then
    print_step "阶段 3/3: Dry Run - 跳过 NAS 写入"
    print_info "Dry Run: 正式同步时将上传 ${EXPORT_FILE} 并导入 opus-db-prod"
    if [ "$OVERWRITE" = true ]; then
        print_warning "Dry Run: --overwrite-danger 正式执行会 TRUNCATE 静态表并 CASCADE 删除关联用户数据"
    else
        print_info "Dry Run: Append 模式只追加静态表新行，冲突行使用 ON CONFLICT DO NOTHING"
    fi
    print_info "Dry Run 完成：生产数据库未修改"
    exit 0
fi

print_step "阶段 3/3: 传输并部署数据"
print_info "正在将 SQL 发送至 NAS..."
REMOTE_SQL_PATH="/tmp/opus_static_sync.sql"
remote_scp "${FULL_EXPORT_PATH}" "${NAS_USER}@${NAS_IP}:${REMOTE_SQL_PATH}"

# 构建 NAS 执行脚本文本
cat << EOF > /tmp/nas_data_sync.sh
#!/bin/bash
PASSWORD=\$1
echo "在容器内部执行 psql 导入..."

echo "\$PASSWORD" | sudo -S /usr/local/bin/docker cp ${REMOTE_SQL_PATH} opus-db-prod:${REMOTE_SQL_PATH}
if [ "$OVERWRITE" = true ]; then
    echo "⚠️ 正在执行 TRUNCATE CASCADE + 导入（单事务）..."
    echo "\$PASSWORD" | sudo -S /usr/local/bin/docker exec opus-db-prod psql -v ON_ERROR_STOP=1 --single-transaction -U ${DB_USER} -d ${DB_NAME} -c "TRUNCATE TABLE \\"Vocab\\", \\"SmartContent\\", \\"TTSCache\\", \\"Etymology\\", \\"Passage\\", \\"QuestionSeed\\", \\"GrammarNode\\", \\"InvitationCode\\" CASCADE;" -f ${REMOTE_SQL_PATH}
else
    echo "\$PASSWORD" | sudo -S /usr/local/bin/docker exec opus-db-prod psql -v ON_ERROR_STOP=1 --single-transaction -U ${DB_USER} -d ${DB_NAME} -f ${REMOTE_SQL_PATH}
fi
echo "\$PASSWORD" | sudo -S /usr/local/bin/docker exec opus-db-prod rm -f ${REMOTE_SQL_PATH}
rm -f ${REMOTE_SQL_PATH}
EOF

# 发送并执行
remote_scp /tmp/nas_data_sync.sh "${NAS_USER}@${NAS_IP}:/tmp/nas_data_sync.sh"
print_info "正在写入数据到 NAS 数据库..."

if ! remote_ssh_script /tmp/nas_data_sync.sh; then
    print_error "导入任务失败！"
    exit 1
fi

print_info "✓ 数据批量灌入成功"

print_step "完成: 重启容器刷新缓存"
cat << 'EOF' > /tmp/nas_restart.sh
#!/bin/bash
PASSWORD=$1
echo "$PASSWORD" | sudo -S /usr/local/bin/docker restart opus-web-prod opus-worker-prod opus-redis-prod opus-gateway-prod
EOF
remote_scp /tmp/nas_restart.sh "${NAS_USER}@${NAS_IP}:/tmp/nas_restart.sh"
remote_ssh_script /tmp/nas_restart.sh >/dev/null

echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}   部署成功! 结构与数据已全面刷新    ${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""
