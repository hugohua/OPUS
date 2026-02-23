/**
 * 种子脚本：初始化语法知识树 (Grammar Skill Tree)
 *
 * 用法：npx tsx scripts/seeders/seed-grammar-nodes.ts
 *
 * 数据来源：PRD-GRAMMAR-SKILL-TREE 定义的 TOEIC 核心语法拓扑图
 * 统计：5 L1 + 15 L2 + 45 L3 = 65 个节点
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '@/lib/logger';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// TOEIC 语法拓扑图 (5 L1 × 15 L2 × 45 L3)
// ---------------------------------------------------------------------------

const taxonomy = [
    // ================================================================
    // L1: 动词体系
    // ================================================================
    {
        code: 'L1_VERBS', name: '动词体系', sortOrder: 10,
        description: '包含句子核心谓语动词及时态语态，以及非谓语动词与特殊动词搭配。',
        children: [
            {
                code: 'L2_FINITE_VERBS', name: '谓语动词', sortOrder: 10,
                description: '句子的核心动词，受主语人称、数和时态的严格约束。',
                children: [
                    { code: 'VERB_TENSE_SIMPLE', name: '一般时态', description: '涵盖一般现在时、过去时和将来时的基本用法及时间标志词。' },
                    { code: 'VERB_TENSE_CONTINUOUS', name: '进行时态', description: '涵盖过去进行、现在进行与将来进行时态的区别与运用。' },
                    { code: 'VERB_TENSE_PERFECT', name: '完成时态', description: '现在完成时（常与since/for连用）、过去完成时及将来完成时。' },
                    { code: 'VERB_AGREEMENT', name: '主谓一致', description: '动词单复数与主语（含介词短语干扰项、不定代词等）的一致性。' },
                    { code: 'VERB_VOICE_PASSIVE', name: '被动语态', description: '根据主语是动作发出者还是承受者选择被动结构（be+done）。' },
                ],
            },
            {
                code: 'L2_NON_FINITE_VERBS', name: '非谓语动词', sortOrder: 20,
                description: '动词的不定式、动名词及分词形式，在句中作主语/宾语/定语/状语。',
                children: [
                    { code: 'NON_FINITE_INFINITIVE', name: '动词不定式', description: '不定式表目的、作宾语或作为主语补足语（to do形式）。' },
                    { code: 'NON_FINITE_GERUND', name: '动名词', description: '动名词作主语或置于特定动词、介词之后的宾语位置（doing形式）。' },
                    { code: 'NON_FINITE_PARTICIPLE_ACTIVE', name: '现在分词修饰', description: '现在分词作前置定语、后置定语或状语，表主动与进行意义。' },
                    { code: 'NON_FINITE_PARTICIPLE_PASSIVE', name: '过去分词修饰', description: '过去分词作前置定语、后置定语或状语，表被动与完成意义。' },
                ],
            },
            {
                code: 'L2_VERB_PATTERNS', name: '常见动词搭配', sortOrder: 30,
                description: '特定动词后接固定结构（如使役动词后接原形、建议命令动词等）。',
                children: [
                    { code: 'VERB_PATTERN_CAUSATIVE', name: '使役动词搭配', description: 'make/have/let/get 等使役动词后的宾补形态规则辨析。' },
                    { code: 'VERB_PATTERN_SUGGEST', name: '建议命令动词', description: 'suggest/request 等动词后接that从句时的虚拟语气要求。' },
                    { code: 'VERB_PATTERN_PHRASAL', name: '短语动词辨析', description: '托业高频动词短语（如 set up, turn in, lay off）的语境词义辨析。' },
                ],
            },
        ],
    },

    // ================================================================
    // L1: 词汇与词性体系
    // ================================================================
    {
        code: 'L1_PARTS_OF_SPEECH', name: '词汇与词性体系', sortOrder: 20,
        description: '涵盖名词、代词、形容词、副词等高频词性形态及句法位置辨析。',
        children: [
            {
                code: 'L2_NOUNS', name: '名词', sortOrder: 10,
                description: '考查名词的可数性、复合名词搭配及各类别名词后缀的辨析。',
                children: [
                    { code: 'NOUN_SUFFIX', name: '名词后缀识别', description: '区分 -tion, -ment, -ance, -ity 等后缀以快速确定名词的句法位置。' },
                    { code: 'NOUN_COUNTABILITY', name: '可数与不可数', description: '辨析 equipment, information 等不可数名词及其对应的量词修饰语。' },
                    { code: 'NOUN_COMPOUND', name: '复合名词搭配', description: '商务高频词组（如 safety regulations, retirement plan）的结构搭配。' },
                ],
            },
            {
                code: 'L2_PRONOUNS', name: '代词', sortOrder: 20,
                description: '考查人称、物主、反身、指示及不定代词在句中的指代一致性。',
                children: [
                    { code: 'PRONOUN_PERSONAL_POSSESSIVE', name: '人称与物主代词', description: '主格、宾格、形容词性物主代词及名词性物主代词的句法位置判断。' },
                    { code: 'PRONOUN_REFLEXIVE', name: '反身代词', description: '反身代词作宾语或同位语加强语气（如 do it by oneself）。' },
                    { code: 'PRONOUN_DEMONSTRATIVE', name: '指示代词', description: 'this/that/these/those 及 that of/those of 在长句中的指代用法。' },
                    { code: 'PRONOUN_INDEFINITE', name: '不定代词', description: 'some/any, each/every, another/other 等的单复数限制与语境。' },
                ],
            },
            {
                code: 'L2_ADJ_ADV', name: '形容词与副词', sortOrder: 30,
                description: '考查修饰语的最佳位置、词缀转换及容易混淆的词义辨析。',
                children: [
                    { code: 'ADJ_ADV_SUFFIX', name: '形副词缀辨析', description: '区分 -tive, -able 等形容词后缀与 -ly 等常规副词后缀。' },
                    { code: 'ADJ_ADV_POSITION', name: '修饰语位置', description: '形容词修饰名词，副词修饰动词、形容词或全句的严格位置规则。' },
                    { code: 'ADJ_ADV_CONFUSING', name: '易混淆词汇', description: 'hard/hardly, late/lately, high/highly 等形近但在意义上截然不同的词义辨析。' },
                ],
            },
        ],
    },

    // ================================================================
    // L1: 从句体系
    // ================================================================
    {
        code: 'L1_CLAUSES', name: '从句体系', sortOrder: 30,
        description: '包含定语从句、名词性从句及状语从句的引导词与逻辑结构辨析。',
        children: [
            {
                code: 'L2_ADJECTIVE_CLAUSES', name: '定语从句', sortOrder: 10,
                description: '修饰先行名词或代词的从句，核心在于关系代词与关系副词的选择。',
                children: [
                    { code: 'CLAUSE_REL_PRONOUN_PERSON', name: '关系代词(人)', description: 'who/whom/whose 指代人时在从句中的格变化与句法功能。' },
                    { code: 'CLAUSE_REL_PRONOUN_THING', name: '关系代词(物)', description: 'which/that 指代物时的用法及 that 在限制性定语从句中的使用。' },
                    { code: 'CLAUSE_REL_ADVERB', name: '关系副词', description: 'when/where/why 引导定语从句及"介词+which"结构的等价转换。' },
                    { code: 'CLAUSE_REL_OMISSION', name: '关系词省略', description: '关系代词作宾语时的省略机制及分词短语替代定语从句的缩略形式。' },
                ],
            },
            {
                code: 'L2_NOUN_CLAUSES', name: '名词性从句', sortOrder: 20,
                description: '在复合句中起名词作用的从句（主语从句、宾语从句、表语从句等）。',
                children: [
                    { code: 'CLAUSE_NOUN_THAT', name: 'that宾语从句', description: 'that 引导的宾语从句、主语从句及同位语从句在句子中的功能。' },
                    { code: 'CLAUSE_NOUN_WH', name: 'wh-名词从句', description: 'what/who/which/how 等词引导名词性从句时的陈述语序与功能。' },
                    { code: 'CLAUSE_NOUN_IF_WHETHER', name: 'if/whether从句', description: '表达"是否"意义的名词性从句及 whether...or not 的专门搭配。' },
                ],
            },
            {
                code: 'L2_ADVERB_CLAUSES', name: '状语从句', sortOrder: 30,
                description: '修饰主句的从句，表示时间、原因、条件、让步等逻辑关系。',
                children: [
                    { code: 'CLAUSE_ADV_TIME', name: '时间状语从句', description: 'when, while, before, after, as soon as 等连词引导的时间逻辑从句。' },
                    { code: 'CLAUSE_ADV_REASON', name: '原因状语从句', description: 'because, since, as, now that 等连词引导的原因与结果推导逻辑。' },
                    { code: 'CLAUSE_ADV_CONDITION', name: '条件状语从句', description: 'if, unless, as long as, provided that 等表条件假设的连词用法。' },
                ],
            },
        ],
    },

    // ================================================================
    // L1: 虚词与逻辑连接
    // ================================================================
    {
        code: 'L1_CONNECTIVES', name: '虚词与逻辑连接', sortOrder: 40,
        description: '包含空间时间介词、固定介词搭配、并列连词及表示逻辑转换的副词。',
        children: [
            {
                code: 'L2_PREPOSITIONS', name: '介词', sortOrder: 10,
                description: '时间/空间介词及大量动宾、形宾固定介词强搭配的考查。',
                children: [
                    { code: 'PREP_TIME_PLACE', name: '时空介词', description: 'in/on/at/by 等用于时间与空间基本规则及在商务场景中的延伸。' },
                    { code: 'PREP_DEPENDENT', name: '固定介词搭配', description: '动宾（accuse of）、形宾（responsible for）等必须整体记忆的强搭配。' },
                    { code: 'PREP_VS_CONJUNCTION', name: '介词连词辨析', description: 'because of(介) 与 because(连), despite(介) 与 although(连) 的句法功能区分。' },
                ],
            },
            {
                code: 'L2_COORDINATING_CONJ', name: '并列连词', sortOrder: 20,
                description: '连接同等句法成分的连词及相关连词组合。',
                children: [
                    { code: 'CONJ_COORD_BASIC', name: '基本并列连词', description: 'and, but, or, so 引导的单句并列成分或复句中的前后连接作用。' },
                    { code: 'CONJ_CORRELATIVE', name: '相关并列连词', description: 'both...and, either...or, neither...nor, not only...but also 的结构对称性。' },
                ],
            },
            {
                code: 'L2_SUBORDINATING_LOGICAL', name: '逻辑连词与副词', sortOrder: 30,
                description: '衔接段落（Part 6重点）或复句内逻辑的高频转折/因果/递进词。',
                children: [
                    { code: 'ADV_LOGICAL_RESULT_CONTRAST', name: '结果与转折副词', description: 'therefore, however, nevertheless 在 Part 6 跨句语境中的逻辑衔接。' },
                    { code: 'ADV_LOGICAL_ADDITION', name: '递进与举例副词', description: 'furthermore, moreover, for example 在段落阅读中展开下文的应用。' },
                    { code: 'CONJ_SUBORDINATE_CONCESSION', name: '让步从属连词', description: 'although, even though, while 引导的让步状语从句及其语意转折。' },
                ],
            },
        ],
    },

    // ================================================================
    // L1: 特殊句法结构
    // ================================================================
    {
        code: 'L1_SPECIAL_SYNTAX', name: '特殊句法结构', sortOrder: 50,
        description: '包含倒装句、强调句、省略句、虚拟语气及各类比较句型等特殊语法规则。',
        children: [
            {
                code: 'L2_INVERSION', name: '倒装句', sortOrder: 10,
                description: '否定词前置或虚拟条件句省略 if 后引起的部分倒装结构。',
                children: [
                    { code: 'INVERSION_NEGATIVE', name: '否定前置倒装', description: 'hardly, never, rarely, seldom 置于句首时引起的助动词提前的部分倒装。' },
                    { code: 'INVERSION_CONDITIONAL', name: '虚拟条件倒装', description: '省略 if 后将 should, had, were 提至句首的条件句倒装结构。' },
                ],
            },
            {
                code: 'L2_SUBJUNCTIVE', name: '虚拟语气', sortOrder: 20,
                description: '表达非真实情况或用于建议/要求/命令的特殊动词退格或原形形式。',
                children: [
                    { code: 'SUBJUNCTIVE_MOOD_SHOULD', name: '建议要求虚拟', description: 'demand/recommend/essential 等主句词后，从句谓语必须使用 (should) do 形式。' },
                    { code: 'SUBJUNCTIVE_WISH', name: '意愿非真实虚拟', description: 'wish, if only, as if 引导的表达非真实语境时的时态退格处理。' },
                ],
            },
            {
                code: 'L2_COMPARISON', name: '比较句型', sortOrder: 30,
                description: '同级比较、差级比较、最高级及特殊比较结构的固定搭配。',
                children: [
                    { code: 'COMPARISON_EQUAL_UNEQUAL', name: '比较级固定结构', description: 'as...as 同级比较，比较级+than 的差级比较，以及 the+最高级+范围的表达。' },
                ],
            },
        ],
    },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    logger.info('[Seeder] Starting Grammar Tree population...');
    logger.info(`[Seeder] Taxonomy: ${taxonomy.length} L1 domains`);

    // 安全检查
    const existingCount = await prisma.grammarNode.count();
    if (existingCount > 0) {
        logger.warn(`[Seeder] Found ${existingCount} existing GrammarNodes. Attempting to clear...`);
        try {
            await prisma.userGrammarProficiency.deleteMany();
            // 必须先删子节点再删父节点 (FK 约束)
            await prisma.grammarNode.deleteMany({ where: { level: 3 } });
            await prisma.grammarNode.deleteMany({ where: { level: 2 } });
            await prisma.grammarNode.deleteMany({ where: { level: 1 } });
            logger.info('[Seeder] Cleared existing nodes.');
        } catch (e: any) {
            logger.error(`[Seeder] Could not clear: ${e.message}`);
            logger.error('[Seeder] If QuestionSeeds reference these nodes (onDelete: Restrict), detach them first.');
            process.exit(1);
        }
    }

    let l1Count = 0, l2Count = 0, l3Count = 0;

    for (const l1 of taxonomy) {
        const l1Node = await prisma.grammarNode.create({
            data: { code: l1.code, name: l1.name, level: 1, sortOrder: l1.sortOrder, description: l1.description },
        });
        l1Count++;
        logger.info(`  L1: ${l1Node.name}`);

        for (const l2 of l1.children) {
            const l2Node = await prisma.grammarNode.create({
                data: { code: l2.code, name: l2.name, level: 2, sortOrder: l2.sortOrder, description: l2.description, parentId: l1Node.id },
            });
            l2Count++;

            for (const l3 of l2.children) {
                await prisma.grammarNode.create({
                    data: { code: l3.code, name: l3.name, level: 3, description: l3.description, parentId: l2Node.id },
                });
                l3Count++;
            }
        }
    }

    logger.info(`[Seeder] ✅ Done. Inserted ${l1Count} L1, ${l2Count} L2, ${l3Count} L3 = ${l1Count + l2Count + l3Count} total nodes.`);
}

main()
    .catch((e) => { logger.error(e, '[Seeder] Unhandled error'); process.exit(1); })
    .finally(() => prisma.$disconnect());
