import SwiftUI

struct TrainingDiagnosticRadarCard: View {
    @Bindable var viewModel: LearningDiagnosticRadarViewModel

    var body: some View {
        Group {
            switch viewModel.contentState {
            case .loading:
                loadingCard
            case .error:
                OpusStateView(
                    state: viewModel.contentState,
                    action: {
                        Task {
                            await viewModel.load(force: true)
                        }
                    }
                )
            case .empty:
                if let payload = viewModel.payload, !payload.radarData.isEmpty {
                    radarCard(payload)
                } else {
                    emptyCard
                }
            }
        }
        .task {
            await viewModel.load()
        }
    }

    private var loadingCard: some View {
        OpusCard(accent: .blue, style: .standard) {
            HStack(spacing: 12) {
                ProgressView()
                    .tint(OpusColorPalette.info)

                VStack(alignment: .leading, spacing: 4) {
                    Text("正在加载综合题型诊断")
                        .font(OpusTypography.cardTitle)
                        .foregroundStyle(OpusColorPalette.primaryText)
                    Text("训练入口会先保持可用。")
                        .font(OpusTypography.body)
                        .foregroundStyle(OpusColorPalette.secondaryText)
                }
            }
        }
    }

    private var emptyCard: some View {
        OpusCard(accent: .blue, style: .standard) {
            VStack(alignment: .leading, spacing: 14) {
                header(totalAttempts: 0)

                Text("完成 Arena 实战答题后，这里会显示你的全景题型分析。")
                    .font(OpusTypography.body)
                    .foregroundStyle(OpusColorPalette.secondaryText)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private func radarCard(_ payload: LearningDiagnosticRadarPayload) -> some View {
        OpusCard(accent: .blue, style: .standard) {
            VStack(alignment: .leading, spacing: 16) {
                header(totalAttempts: payload.totalAttempts)

                if let weakest = payload.weakest {
                    weakestSuggestion(weakest)
                }

                LearningDiagnosticRadarChart(points: payload.radarData)
                    .accessibilityLabel("综合题型诊断雷达图")

                VStack(alignment: .leading, spacing: 8) {
                    ForEach(payload.radarData) { point in
                        HStack(spacing: 10) {
                            Text(point.subject)
                                .font(OpusTypography.caption)
                                .foregroundStyle(OpusColorPalette.secondaryText)
                                .lineLimit(1)

                            OpusProgressMeter(
                                segments: [
                                    OpusProgressSegment(value: Double(point.score), accent: accent(for: point.score)),
                                    OpusProgressSegment(value: Double(max(0, point.fullMark - point.score)), color: OpusColorPalette.progressTrack),
                                ],
                                height: 7,
                                spacing: 0
                            )

                            Text("\(point.score)%")
                                .font(OpusTypography.mono)
                                .foregroundStyle(OpusColorPalette.primaryText)
                                .monospacedDigit()
                        }
                    }
                }
            }
        }
    }

    private func header(totalAttempts: Int) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text("综合题型诊断")
                    .font(OpusTypography.cardTitle)
                    .foregroundStyle(OpusColorPalette.primaryText)

                OpusBadge(title: "Beta", accent: .blue, variant: .soft, size: .mini)
            }

            Text(totalAttempts > 0
                ? "基于 The Arena 最近 \(totalAttempts) 题的全景分析。"
                : "基于 The Arena 实战记录生成。"
            )
            .font(OpusTypography.body)
            .foregroundStyle(OpusColorPalette.secondaryText)
            .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func weakestSuggestion(_ weakest: LearningDiagnosticWeaknessProfile) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "lightbulb")
                .foregroundStyle(OpusColorPalette.warning)
                .font(.body.weight(.semibold))

            Text("今日建议：你的 \(weakest.label) 环节失分较多。今天的实战训练会优先暴露这类题型。")
                .font(OpusTypography.body)
                .foregroundStyle(OpusColorPalette.secondaryText)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: OpusCornerRadius.card, style: .continuous)
                .fill(OpusAccent.amber.softColor.opacity(0.65))
        )
        .overlay(
            RoundedRectangle(cornerRadius: OpusCornerRadius.card, style: .continuous)
                .stroke(OpusAccent.amber.primaryColor.opacity(0.18), lineWidth: 1)
        )
    }

    private func accent(for score: Int) -> OpusAccent {
        if score < 40 { return .rose }
        if score < 70 { return .amber }
        return .emerald
    }
}

private struct LearningDiagnosticRadarChart: View {
    let points: [LearningDiagnosticRadarPoint]

    var body: some View {
        let visiblePoints = Array(points.prefix(6))
        GeometryReader { proxy in
            let size = min(proxy.size.width, proxy.size.height)
            let center = CGPoint(x: proxy.size.width / 2, y: proxy.size.height / 2)
            let radius = size * 0.3
            let labelRadius = size * 0.43
            let sides = max(visiblePoints.count, 3)

            ZStack {
                polygonPath(
                    in: proxy.size,
                    scores: Array(repeating: 100, count: sides),
                    center: center,
                    radius: radius,
                    sides: sides
                )
                .stroke(OpusColorPalette.border, lineWidth: 1)

                polygonPath(
                    in: proxy.size,
                    scores: Array(repeating: 50, count: sides),
                    center: center,
                    radius: radius,
                    sides: sides
                )
                .stroke(OpusColorPalette.border.opacity(0.55), lineWidth: 1)

                ForEach(0..<sides, id: \.self) { index in
                    let end = coordinate(
                        center: center,
                        radius: radius,
                        angle: angle(index: index, count: sides)
                    )
                    Path { path in
                        path.move(to: center)
                        path.addLine(to: end)
                    }
                    .stroke(OpusColorPalette.border.opacity(0.55), style: StrokeStyle(lineWidth: 1, dash: [3, 3]))
                }

                polygonPath(
                    in: proxy.size,
                    scores: visiblePoints.map(\.score),
                    center: center,
                    radius: radius,
                    sides: sides
                )
                .fill(OpusColorPalette.info.opacity(0.16))

                polygonPath(
                    in: proxy.size,
                    scores: visiblePoints.map(\.score),
                    center: center,
                    radius: radius,
                    sides: sides
                )
                .stroke(OpusColorPalette.info, lineWidth: 2)

                ForEach(Array(visiblePoints.enumerated()), id: \.offset) { index, point in
                    let dot = coordinate(
                        center: center,
                        radius: radius * CGFloat(max(0, min(point.score, point.fullMark))) / CGFloat(max(point.fullMark, 1)),
                        angle: angle(index: index, count: sides)
                    )
                    Circle()
                        .fill(point.score < 40 ? OpusColorPalette.rose : OpusColorPalette.info)
                        .frame(width: 8, height: 8)
                        .position(dot)
                        .accessibilityHidden(true)

                    let label = coordinate(
                        center: center,
                        radius: labelRadius,
                        angle: angle(index: index, count: sides)
                    )
                    VStack(spacing: 2) {
                        Text(point.subject)
                            .lineLimit(1)
                        Text("\(point.score)%")
                            .monospacedDigit()
                    }
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(point.score < 40 ? OpusColorPalette.rose : OpusColorPalette.secondaryText)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 4)
                    .background(
                        Capsule(style: .continuous)
                            .fill(OpusColorPalette.surface.opacity(0.92))
                    )
                    .overlay(
                        Capsule(style: .continuous)
                            .stroke(OpusColorPalette.border, lineWidth: 1)
                    )
                    .position(label)
                    .accessibilityLabel("\(point.subject)，正确率 \(point.score)%")
                }
            }
        }
        .frame(minHeight: 230)
    }

    private func polygonPath(
        in size: CGSize,
        scores: [Int],
        center: CGPoint,
        radius: CGFloat,
        sides: Int
    ) -> Path {
        var path = Path()
        for index in 0..<sides {
            let score = index < scores.count ? scores[index] : 0
            let point = coordinate(
                center: center,
                radius: radius * CGFloat(max(0, min(score, 100))) / 100,
                angle: angle(index: index, count: sides)
            )
            if index == 0 {
                path.move(to: point)
            } else {
                path.addLine(to: point)
            }
        }
        path.closeSubpath()
        return path
    }

    private func angle(index: Int, count: Int) -> Double {
        -Double.pi / 2 + Double(index) * 2 * Double.pi / Double(count)
    }

    private func coordinate(center: CGPoint, radius: CGFloat, angle: Double) -> CGPoint {
        CGPoint(
            x: center.x + radius * CGFloat(cos(angle)),
            y: center.y + radius * CGFloat(sin(angle))
        )
    }
}
