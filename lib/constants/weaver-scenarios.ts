export const WEAVER_SCENARIOS = [
    {
        id: "finance_group",
        label: "金融与法务",
        icon: "Briefcase",
        description: "Budgeting, Tax, Contracts, Investment"
    },
    {
        id: "hr_group",
        label: "人力与管理",
        icon: "Users",
        description: "Recruitment, Training, Promotion"
    },
    {
        id: "ops_group",
        label: "运营与生产",
        icon: "Factory",
        description: "Supply Chain, Logistics, Quality Control"
    },
    {
        id: "market_group",
        label: "市场与客户",
        icon: "Megaphone",
        description: "Marketing, Sales, Negotiation"
    },
    {
        id: "office_group",
        label: "办公与技术",
        icon: "Monitor",
        description: "Admin, IT Support, General Business"
    },
    {
        id: "travel_group",
        label: "差旅与活动",
        icon: "Plane",
        description: "Business Travel, Dining, Conferences"
    }
] as const;

export type WeaverScenarioId = typeof WEAVER_SCENARIOS[number]['id'];
