import { db } from '@/lib/db';
import { redis } from '@/lib/queue/connection';
import { createLogger } from '@/lib/logger';
import { State, Rating, Card, fsrs } from 'ts-fsrs';

const log = createLogger('lib:session-manager');
const scheduler = fsrs();

/**
 * 结算用户 Session (聚合计算 + FSRS 更新)
 */
export async function flushUserSession(userId: string) {
    log.info({ userId }, 'Flushing session...');

    // 1. 扫描所有活跃窗口 Key
    // pattern: window:userId:*
    const pattern = `window:${userId}:*`;
    let cursor = '0';
    const keys: string[] = [];

    do {
        const reply = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = reply[0];
        keys.push(...reply[1]);
    } while (cursor !== '0');

    if (keys.length === 0) {
        // 清理 ZSet (防止有残留)
        await redis.zrem('active_sessions', userId);
        return;
    }

    // 2. 处理每个 Key
    for (const key of keys) {
        const vocabId = parseInt(key.split(':').pop()!);
        const data = await redis.hgetall(key);

        if (!data || !data.lastGrade) continue;

        await processItem(userId, vocabId, data);

        // 3. 删除 Key
        await redis.del(key);
    }

    // 4. 从 active_sessions 移除
    await redis.zrem('active_sessions', userId);

    log.info({ userId, count: keys.length }, 'Session flushed');
}

/**
 * 处理单个单词的结算
 */
async function processItem(userId: string, vocabId: number, data: Record<string, string>) {
    const { lastGrade, attempts, hasAgain } = data;

    // === 聚合规则 ===
    // 1. 如果有任意一次 Again，最终结果 = Again (1)
    // 2. 否则，最终结果 = lastGrade
    let finalGrade = hasAgain === 'true' ? 1 : parseInt(lastGrade);

    // 获取当前进度
    const progress = await db.userProgress.findUnique({
        where: { userId_vocabId: { userId, vocabId } }
    });

    // 构建 FSRS Card
    const now = new Date();
    let card: Card = createEmptyCard(now);

    if (progress) {
        card = {
            ...card,
            stability: progress.stability,
            difficulty: progress.difficulty,
            reps: progress.reps,
            lapses: progress.lapses,
            state: progress.state as State,
            last_review: progress.last_review_at || undefined,
            due: progress.next_review_at || now,
        };
        // Recalculate elapsed days
        if (progress.last_review_at) {
            card.elapsed_days = (now.getTime() - progress.last_review_at.getTime()) / (86400 * 1000);
        }
    }

    // 调度计算
    const scheduling_cards = scheduler.repeat(card, now);
    const rating = finalGrade as Rating;
    const result = (scheduling_cards as any)[rating];

    if (!result) return;

    const newCard = result.card;

    // 更新 DB
    await db.userProgress.upsert({
        where: { userId_vocabId: { userId, vocabId } },
        update: {
            stability: newCard.stability,
            difficulty: newCard.difficulty,
            reps: newCard.reps,
            lapses: newCard.lapses,
            state: newCard.state,
            next_review_at: newCard.due,
            last_review_at: now,
            status: mapStateToStatus(newCard.state)
        },
        create: {
            userId,
            vocabId,
            stability: newCard.stability,
            difficulty: newCard.difficulty,
            reps: newCard.reps,
            lapses: newCard.lapses,
            state: newCard.state,
            next_review_at: newCard.due,
            last_review_at: now,
            status: mapStateToStatus(newCard.state),
            dueDate: newCard.due
        }
    });
}

function createEmptyCard(now: Date): Card {
    return {
        due: now,
        stability: 0,
        difficulty: 0,
        elapsed_days: 0,
        scheduled_days: 0,
        reps: 0,
        lapses: 0,
        state: State.New,
        last_review: undefined,
        learning_steps: 0,
    };
}

function mapStateToStatus(state: State) {
    switch (state) {
        case State.New: return 'NEW';
        case State.Learning: return 'LEARNING';
        case State.Review: return 'REVIEW';
        case State.Relearning: return 'LEARNING';
        default: return 'LEARNING';
    }
}
