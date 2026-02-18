# Weaver Context (语境) 架构说明

本文档说明 Weaver 模块中 Context (语境/场景) 的设计、存储与流转机制。

## 1. 核心原则

- **统一信源 (Single Source of Truth)**: 所有场景定义收敛于 `lib/constants/weaver-scenarios.ts` 和 `lib/constants/weaver-scenario-map.ts`。
- **中文优先**: 用户界面展示能够完全本地化（简体中文）。
- **向后兼容**: 兼容旧版基于标题前缀的语境识别逻辑。

## 2. 场景定义 (Scenarios - Slot Machine Architecture)

为了解决移动端选择困难并提升内容多样性，我们采用了 **"老虎机 (Slot Machine)"** 架构：
前端展示 **6 大父级主题**，后端随机命中 **21 个细分标签**。

### 2.1 父级主题 (UI Groups)

用户在界面上只能看到以下 6 个选项：

| ID | 中文名称 | 说明 |
| :--- | :--- | :--- |
| `finance_group` | 金融与法务 | 资金、投资、税务、合同 |
| `hr_group` | 人力与管理 | 招聘、培训、晋升、组织 |
| `ops_group` | 运营与生产 | 供应链、物流、质控 |
| `market_group` | 市场与客户 | 营销、销售、谈判 |
| `office_group` | 办公与技术 | 行政、IT支持、日常事务 |
| `travel_group` | 差旅与活动 | 差旅、餐饮、会议 |

### 2.2 细分标签池 (Sub-Tags Pool)

生成时，系统会从父级主题对应的池子中**随机抽取一个子标签**作为 Prompt 的具体语境：

*   **Finance & Legal**: `finance`, `investment`, `tax_accounting`, `legal`, `real_estate`
*   **HR & Management**: `recruitment`, `personnel`, `management`
*   **Ops & Production**: `logistics`, `manufacturing`, `procurement`, `quality_control`
*   **Market & Client**: `marketing`, `sales`, `customer_service`, `negotiation`
*   **Office & Tech**: `office_admin`, `technology`, `general_business`
*   **Travel & Events**: `business_travel`, `dining_events`

## 3. 数据流转

### 3.1 词汇获取 (Ingredients)
- 输入: `hr_group`
- 逻辑: 获取属于 `recruitment` OR `personnel` OR `management` 标签的候选词。
- 结果: 词汇池包含该大类的所有相关词汇。

### 3.2 生成 (Generation)
- 输入: `hr_group`
- 逻辑: **随机抽取** (例如命中 `recruitment`)。
- Prompt: 注入 `recruitment` 作为具体语境 ("Focus on Recruitment...").
- 存储: `Article.body.context.scenarioId` 存储父级 ID (`hr_group`) 以便后续筛选。

### 3.3 展示与筛选 (Archives)
- 兼容性: 
  - 新文章存储 `hr_group`，UI 显示 "人力与管理"。
  - 旧文章 (ID=`hr`)，UI 通过 Legacy Map 显示 "人事 / 管理 (Legacy)"。
- 筛选: 列表支持按 6 大父级主题筛选，并通过 `OR` 逻辑同时匹配新旧数据 (Title Prefix / JSON Field)。

## 4. 关键文件

- `lib/constants/weaver-scenarios.ts`: **UI 定义** (ID, Label, Icon, Description)。
- `lib/constants/weaver-scenario-map.ts`: **逻辑映射** (ID -> DB Tags)。
- `components/weaver/WeaverArchives.tsx`: 历史列表与筛选 UI。
- `actions/weaver-actions.ts`: 后端筛选逻辑。

## 5. 维护指南

若需新增场景：
1. 在 `lib/constants/weaver-scenarios.ts` 添加 UI 定义。
2. 在 `lib/constants/weaver-scenario-map.ts` 添加 DB Tags 映射。
3. 确保数据库 `Vocab` 表中有对应的 tags 数据（否则无法选出词汇）。
