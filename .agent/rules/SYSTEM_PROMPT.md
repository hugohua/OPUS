---
trigger: always_on
---

# Opus (Mobile) – System Prompt & Anti-Spec

You are an engineering copilot working on **Opus (Mobile)**.

This document is the **single source of truth**.  
You must not infer, optimize, or redesign beyond what is explicitly allowed here.

Any implementation outside these rules is **strictly prohibited**.

---

## 0. PRODUCT IDENTITY (NON-NEGOTIABLE)

Opus is **NOT** a vocabulary app.  
It is a **Pocket Workplace Simulator for cognitive rehabilitation**.

Primary success metric:
> The user comes back tomorrow.

NOT:
- speed
- efficiency
- coverage
- correctness rate

---

## 1. TARGET USER (REAL, NOT IDEAL)

- Frontend / software engineer
- Uses English daily in code (APIs, variables)
- Vocabulary ~1200–2000
- Grammar fragile
- Confidence system already damaged by past learning failure

Default assumptions:
- User is NOT lazy
- User is NOT zero-base
- User fails due to **cognitive overload + low psychological safety**

---

## 2. CORE PRINCIPLE

**Survive First. Then Upgrade.**

If a feature helps learning but increases quit probability,  
it is a BUG, not a feature.

---

## 3. UI & ARCHITECTURE LAW

Frontend is DUMB. Backend is SMART.

- Frontend NEVER decides difficulty
- Frontend NEVER simplifies content
- Frontend ONLY renders what backend sends

There is ONLY ONE UI. Difficulty differences come from:
- content structure
- information density
- prompt constraints

---

## 4. LEVEL SYSTEM

System has 3 levels. **ALL USERS START AT LEVEL 0.**

### Level 0 — Trainee (Cognitive Rehab)

- ONE sentence only  
- STRICT S–V–O, NO clauses, NO implicit logic  
- FULL Chinese translation  
- SESSION BATCH: 20 cards per batch (Unlimited Batches)  
- Syntax Highlighter: `<s>` subject, `<v>` verb, `<o>` object  

### Level 1 — Intern

- Short business emails  
- Keywords highlighted  
- Only difficult words hinted  
- No full translation

### Level 2 — Executive

- Memo / Report  
- No aids  
- No translation  
- Full business complexity

---

## 5. FIVE-DIMENSION TASK SYSTEM

| Dimension | Description | Level 0 Weight | Interaction |
|-----------|------------|----------------|------------|
| V – Visual Audit | Spelling / word_family | 80% | Binary swipe |
| C – Drafting | Fixed phrases | 20% | Bubble select |
| M – Decision | Synonyms / semantics | Disabled | N/A |
| X – Logic | Sentence insertion / connectors | Disabled | Slot machine |
| A – Audio | TTS scaffolding | 100% | Auto-play |

---

## 6. BACKEND CONTENT ENGINE

1. Fetch target word  
2. Route by level:
   - Level 0 → Drill Prompt (single S–V–O sentence)  
   - Level 1+ → Scenario Prompt  
3. Generate via LLM  
4. Return structured JSON ONLY

### Standard Output (Immutable)

```ts
interface BriefingPayload {
  meta: {
    format: "chat" | "email" | "memo";
    sender: string;
    level: 0 | 1 | 2;
  };
  segments: [
    {
      type: "text";
      content_markdown: string;
      audio_text?: string;
    },
    {
      type: "interaction";
      dimension: "V" | "C" | "M" | "X";
      task: {
        style: "swipe_card" | "bubble_select";
        question_markdown: string;
        options: string[];
        answer_key: string;
        explanation_markdown: string;
      };
    }
  ];
}

### 6.1 HYBRID FETCH ENGINE (V3.0 RULES)

The backend MUST construct the Session Batch (20 slots) using the **"30/50/20" Protocol**:

1.  **Rescue Queue (30% / 6 slots)**:
    - Target: `dim_v_score < 30` (Syntax Weakness).
    - Logic: Fix broken syntax before learning new words.

2.  **Review Queue (50% / 10 slots)**:
    - Target: SRS Due (`next_review_at <= NOW`).
    - Logic: Prevent memory decay.

3.  **New Acquisition (20% / 4 slots)**:
    - Target: High-Value New Words.
    - **Survival Sort (Strict Order)**:
        1. **Verb First**: Action words drive sentences (S-V-O).
        2. **Hotness**: High `frequency_score` (Market value).
        3. **Low Cognitive Load**: Short words first.
        
⸻

7. ENGINEERING RULES
	•	Mobile-first (max-w-md)
	•	Strict typing (Zod validation)
	•	Level 0 uses Session Batch (20) instead of Hard Daily Cap
	•	LLM timeout → fallback to DB example
	•	Any “smart optimization” reducing psychological safety is INVALID

⸻

8. FINAL ABSOLUTE RULE

Opus is successful when:

The user feels safe enough to return.

If implementation makes the app:
	•	smarter
	•	faster
	•	more impressive

but also:
	•	intimidating
	•	exhausting
	•	judgmental

Then it is WRONG.

⸻

9. OPUS ANTI-SPEC (PROHIBITED FEATURES)

To protect the user’s cognitive safety, the following are STRICTLY BANNED:

🚫 1. The “Streak” Trap
	•	BANNED: “You have studied 10 days in a row!”
	•	ALLOWED: “Total days survived: 12” (cumulative only)

🚫 2. The “Leaderboard”
	•	BANNED: Comparing user to others
	•	REASON: Causes shame and demotivation

🚫 3. The “Speed Run”
	•	BANNED: Timers, countdowns, words per minute
	•	REASON: Causes anxiety, panic, cognitive overload

🚫 4. The “Review Hell”
	•	BANNED: “You have 50 words to review today”
	•	ALLOWED: Algorithm handles review internally, user only sees today’s Briefing

🚫 5. The “Gamification Clutter”
	•	BANNED: Avatars, skins, coins, gems, loot boxes
	•	REASON: Distraction. Simulate WORKPLACE, not CASINO