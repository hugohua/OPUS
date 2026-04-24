import SwiftUI

struct ArenaMissionView: View {
    @Bindable var viewModel: ArenaMissionViewModel

    var body: some View {
        ZStack {
            LinearGradient.opusBackground
                .ignoresSafeArea()

            switch viewModel.contentState {
            case .loading:
                OpusStateView(
                    state: .loading,
                    loadingTitle: "正在装填 Mission",
                    loadingMessage: "正在同步 Part 6 长文与空位任务。"
                )
                .padding(OpusSpacing.screenPadding)
            case .error:
                OpusStateView(
                    state: viewModel.contentState,
                    action: {
                        Task {
                            await viewModel.retryMission()
                        }
                    }
                )
                .padding(OpusSpacing.screenPadding)
            case .empty:
                missionContent
            }
        }
        .navigationTitle("Mission")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await viewModel.loadMission()
        }
        .safeAreaInset(edge: .bottom) {
            missionDock
        }
    }

    private var missionContent: some View {
        ScrollViewReader { proxy in
            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: 18) {
                    headerCard
                    passageCard

                    if let submissionErrorMessage = viewModel.submissionErrorMessage {
                        OpusCard(accent: .amber, style: .compact) {
                            Text(submissionErrorMessage)
                                .font(OpusTypography.body)
                                .foregroundStyle(OpusColorPalette.warning)
                        }
                    }
                }
                .padding(OpusSpacing.screenPadding)
                .padding(.bottom, 220)
            }
            .onChange(of: viewModel.activeBlankIndex) { _, newValue in
                guard let newValue else { return }
                withAnimation(.easeInOut(duration: 0.2)) {
                    proxy.scrollTo("blank-anchor-\(newValue)", anchor: .center)
                }
            }
        }
    }

    private var headerCard: some View {
        OpusCard(accent: .indigo, style: .standard) {
            VStack(alignment: .leading, spacing: 10) {
                Text("Part 6 长文狙击")
                    .font(OpusTypography.pageTitle)

                Text("在正文中切换空位，再通过底部 dock 完成选择。首期只保留 Arena telemetry，不接 Wand。")
                    .font(OpusTypography.body)
                    .foregroundStyle(OpusColorPalette.secondaryText)

                if let summary = viewModel.summary {
                    Text("已答 \(summary.answeredCount) / \(viewModel.questions.count) · 正确 \(summary.correctCount)")
                        .font(OpusTypography.caption)
                        .foregroundStyle(OpusColorPalette.tertiaryText)
                }
            }
        }
    }

    private var passageCard: some View {
        OpusCard(accent: .violet, style: .standard) {
            VStack(alignment: .leading, spacing: 12) {
                OpusSectionHeader(title: "正文", subtitle: "点击空位可切换当前答题位置。")

                if viewModel.passageFragments.isEmpty {
                    Text("Mission 正文暂不可用。")
                        .font(OpusTypography.body)
                        .foregroundStyle(OpusColorPalette.secondaryText)
                } else {
                    ForEach(viewModel.passageFragments) { fragment in
                        if let text = fragment.text {
                            Text(text)
                                .font(OpusTypography.body)
                                .foregroundStyle(OpusColorPalette.primaryText)
                                .fixedSize(horizontal: false, vertical: true)
                        } else if let blankIndex = fragment.blankIndex {
                            Button {
                                viewModel.selectBlank(blankIndex)
                            } label: {
                                HStack(spacing: 10) {
                                    Text("Blank \(130 + blankIndex)")
                                        .font(OpusTypography.mono)
                                    Text(viewModel.blankLabel(for: blankIndex))
                                        .font(OpusTypography.body)
                                        .lineLimit(1)
                                }
                                .foregroundStyle(blankForegroundColor(for: blankIndex))
                                .padding(.horizontal, 14)
                                .padding(.vertical, 10)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(
                                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                                        .fill(blankBackgroundColor(for: blankIndex))
                                )
                            }
                            .buttonStyle(.plain)
                            .id("blank-anchor-\(blankIndex)")
                        }
                    }
                }
            }
        }
    }

    private var missionDock: some View {
        VStack(spacing: 0) {
            Divider()

            Group {
                if viewModel.phase == .completed {
                    completionDock
                } else {
                    questionDock
                }
            }
            .padding(.horizontal, OpusSpacing.screenPadding)
            .padding(.top, 14)
            .padding(.bottom, 18)
            .background(.ultraThinMaterial)
        }
    }

    private var questionDock: some View {
        VStack(alignment: .leading, spacing: 14) {
            dockNavigator

            if let currentQuestion = viewModel.currentQuestion {
                Text("Question \(currentQuestion.displayNumber)")
                    .font(OpusTypography.mono)
                    .foregroundStyle(OpusColorPalette.info)

                Text(currentQuestion.prompt)
                    .font(OpusTypography.sectionTitle)
                    .foregroundStyle(OpusColorPalette.primaryText)

                VStack(spacing: 10) {
                    ForEach(currentQuestion.options) { option in
                        Button {
                            Task {
                                await viewModel.submitOption(option)
                            }
                        } label: {
                            HStack(spacing: 12) {
                                Text(option.id.uppercased())
                                    .font(OpusTypography.mono)
                                    .frame(width: 30, alignment: .leading)

                                Text(option.text)
                                    .font(OpusTypography.body)
                                    .multilineTextAlignment(.leading)

                                Spacer()
                            }
                            .padding(14)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(
                                RoundedRectangle(cornerRadius: 18, style: .continuous)
                                    .fill(optionBackground(for: option))
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: 18, style: .continuous)
                                    .stroke(optionBorder(for: option), lineWidth: 1)
                            )
                        }
                        .buttonStyle(.plain)
                        .disabled(viewModel.isCurrentBlankAnswered)
                    }
                }

                if viewModel.isCurrentBlankAnswered {
                    OpusPrimaryButton(
                        title: viewModel.remainingUnansweredCount == 0 ? "查看结果" : "继续下一空"
                    ) {
                        viewModel.continueFromCurrentBlank()
                    }
                }
            } else {
                Text("请选择一个空位开始作答。")
                    .font(OpusTypography.body)
                    .foregroundStyle(OpusColorPalette.secondaryText)
            }
        }
    }

    private var completionDock: some View {
        VStack(alignment: .leading, spacing: 14) {
            if let summary = viewModel.summary {
                OpusCard(accent: .emerald, style: .compact) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Mission 完成")
                            .font(OpusTypography.sectionTitle)
                        Text("共答 \(summary.answeredCount) 题，正确 \(summary.correctCount)，错题 \(summary.incorrectCount)。")
                            .font(OpusTypography.body)
                            .foregroundStyle(OpusColorPalette.secondaryText)
                    }
                }
            }

            OpusPrimaryButton(title: "再来一局") {
                Task {
                    await viewModel.retryMission()
                }
            }
        }
    }

    private var dockNavigator: some View {
        HStack(spacing: 12) {
            Button {
                viewModel.goToPreviousBlank()
            } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(OpusColorPalette.secondaryText)
                    .frame(width: 32, height: 32)
                    .background(Circle().fill(OpusColorPalette.surface))
            }
            .buttonStyle(.plain)
            .disabled((viewModel.activeBlankIndex ?? 1) <= 1)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(viewModel.questions) { question in
                        Button {
                            viewModel.selectBlank(question.blankIndex)
                        } label: {
                            Text(viewModel.blankLabel(for: question.blankIndex))
                                .font(OpusTypography.mono)
                                .foregroundStyle(blankForegroundColor(for: question.blankIndex))
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .background(
                                    Capsule(style: .continuous)
                                        .fill(blankBackgroundColor(for: question.blankIndex))
                                )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

            Button {
                viewModel.goToNextBlank()
            } label: {
                Image(systemName: "chevron.right")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(OpusColorPalette.secondaryText)
                    .frame(width: 32, height: 32)
                    .background(Circle().fill(OpusColorPalette.surface))
            }
            .buttonStyle(.plain)
            .disabled((viewModel.activeBlankIndex ?? 1) >= max(viewModel.questions.count, 1))
        }
    }

    private func blankBackgroundColor(for blankIndex: Int) -> Color {
        switch viewModel.blankAccent(for: blankIndex) {
        case .emerald:
            return OpusColorPalette.success.opacity(0.18)
        case .amber:
            return OpusColorPalette.warning.opacity(0.18)
        case .indigo:
            return OpusColorPalette.info.opacity(0.18)
        case .rose:
            return OpusColorPalette.rose.opacity(0.18)
        case .blue:
            return OpusColorPalette.info.opacity(0.18)
        case .violet, .slate:
            return OpusColorPalette.surface
        }
    }

    private func blankForegroundColor(for blankIndex: Int) -> Color {
        switch viewModel.blankAccent(for: blankIndex) {
        case .emerald:
            return OpusColorPalette.success
        case .amber:
            return OpusColorPalette.warning
        case .indigo:
            return OpusColorPalette.info
        case .rose:
            return OpusColorPalette.rose
        case .blue:
            return OpusColorPalette.info
        case .violet, .slate:
            return OpusColorPalette.primaryText
        }
    }

    private func optionBackground(for option: ArenaMissionOption) -> Color {
        guard let activeBlankIndex = viewModel.activeBlankIndex,
              let answerState = viewModel.answerStates[activeBlankIndex]
        else {
            return OpusColorPalette.surface
        }

        if option.isCorrect {
            return OpusColorPalette.success.opacity(0.14)
        }

        if answerState.optionID == option.id {
            return OpusColorPalette.rose.opacity(0.14)
        }

        return OpusColorPalette.surface
    }

    private func optionBorder(for option: ArenaMissionOption) -> Color {
        guard let activeBlankIndex = viewModel.activeBlankIndex,
              let answerState = viewModel.answerStates[activeBlankIndex]
        else {
            return OpusColorPalette.border
        }

        if option.isCorrect {
            return OpusColorPalette.success
        }

        if answerState.optionID == option.id {
            return OpusColorPalette.rose
        }

        return OpusColorPalette.border
    }
}
