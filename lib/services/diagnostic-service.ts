/**
 * 诊断服务兼容出口
 * 功能：
 *   保留旧 import 路径，实际业务规则统一转发到 backend-core。
 */

export {
    buildWeightedTypePicker,
    getRadarDataRaw,
    getUserWeaknessesRaw,
    getWeakestGrammarNodesRaw,
    type DiagnosticRadarPayload,
    type RadarDataPoint,
    type WeaknessProfile,
} from "@/lib/backend-core/diagnostics/radar";
