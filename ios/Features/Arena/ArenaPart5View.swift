import SwiftUI

struct ArenaPart5View: View {
    @Bindable var viewModel: ArenaPart5ViewModel

    var body: some View {
        ZStack {
            LinearGradient.opusBackground
                .ignoresSafeArea()

            switch viewModel.contentState {
            case .loading:
                OpusStateView(
                    state: .loading,
                    loadingTitle: "正在装填 Part 5",
                    loadingMessage: "正在同步单句竞技题队列。"
                )
                .padding(OpusSpacing.screenPadding)
            case .error:
                OpusStateView(
                    state: viewModel.contentState,
                    action: {
                        Task {
                            await viewModel.retry()
                        }
                    }
                )
                .padding(OpusSpacing.screenPadding)
            case .empty:
                if viewModel.questions.isEmpty {
                    OpusStateView(
                        state: viewModel.contentState,
                        action: {
                            Task {
                                await viewModel.retry()
                            }
                        }
                    )
                    .padding(OpusSpacing.screenPadding)
                } else if viewModel.phase == .completed {
                    completionContent
                } else {
                    questionContent
                }
            }
        }
        .navigationTitle("Part 5")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await viewModel.load()
        }
        .sheet(isPresented: $viewModel.isExplanationPresented) {
            NavigationStack {
                explanationSheet
                    .toolbar {
                        ToolbarItem(placement: .topBarTrailing) {
                            Button("关闭") {
                                viewModel.hideExplanation()
                            }
                        }
                    }
            }
            .presentationDetents([.medium, .large])
        }
    }

    private var questionContent: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 18) {
                headerCard

                if let question = viewModel.currentQuestion {
                    questionCard(question)
                    optionList(question)
                    feedbackCard(question)
                }

                if let inlineErrorMessage = viewModel.inlineErrorMessage {
                    OpusCard(accent: .amber, style: .compact) {
                        Text(inlineErrorMessage)
                            .font(OpusTypography.body)
                            .foregroundStyle(OpusColorPalette.warning)
                    }
                }
            }
            .padding(OpusSpacing.screenPadding)
            .padding(.bottom, 80)
        }
    }

    private var headerCard: some View {
        OpusCard(accent: .violet, style: .standard) {
            VStack(alignment: .leading, spacing: 10) {
                Text(viewModel.title)
                    .font(OpusTypography.pageTitle)

                Text("作答后立即查看结果，可从解析面板复盘，再进入下一题。")
                    .font(OpusTypography.body)
                    .foregroundStyle(OpusColorPalette.secondaryText)

                Text(viewModel.progressText)
                    .font(OpusTypography.mono)
                    .foregroundStyle(OpusColorPalette.info)
            }
        }
    }

    private func questionCard(_ question: ArenaPart5Question) -> some View {
        OpusCard(accent: .indigo, style: .standard) {
            VStack(alignment: .leading, spacing: 12) {
                OpusSectionHeader(title: "题干", subtitle: question.stem)

                Text(question.prompt)
                    .font(OpusTypography.cardTitle)
                    .foregroundStyle(OpusColorPalette.primaryText)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private func optionList(_ question: ArenaPart5Question) -> some View {
        VStack(spacing: 12) {
            ForEach(question.options) { option in
                Button {
                    Task {
                        await viewModel.submitOption(option)
                    }
                } label: {
                    HStack(spacing: 14) {
                        Text(option.id.uppercased())
                            .font(OpusTypography.mono)
                            .frame(width: 30, alignment: .leading)

                        Text(option.text)
                            .font(OpusTypography.body)
                            .foregroundStyle(OpusColorPalette.primaryText)
                            .multilineTextAlignment(.leading)

                        Spacer()
                    }
                    .padding(16)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .fill(optionBackground(option))
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .stroke(optionBorder(option), lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
                .disabled(isAnswered)
            }
        }
    }

    @ViewBuilder
    private func feedbackCard(_ question: ArenaPart5Question) -> some View {
        if case .answered(_, let isCorrect, _) = viewModel.answerState {
            OpusCard(accent: isCorrect ? .emerald : .amber, style: .standard) {
                VStack(alignment: .leading, spacing: 12) {
                    Text(isCorrect ? "回答正确" : "再复盘一下")
                        .font(OpusTypography.sectionTitle)

                    Text(isCorrect ? "这题已经命中，继续保持节奏。" : "正确答案已高亮，建议打开解析面板确认规则。")
                        .font(OpusTypography.body)
                        .foregroundStyle(OpusColorPalette.secondaryText)

                    HStack(spacing: 12) {
                        Button {
                            viewModel.showExplanation()
                        } label: {
                            Text("查看解析")
                                .font(OpusTypography.sectionTitle)
                        }
                        .buttonStyle(.bordered)
                        .disabled(question.explanation == nil)

                        OpusPrimaryButton(
                            title: viewModel.progressText.hasPrefix("\(viewModel.questions.count) /")
                                ? "查看完成页"
                                : "下一题"
                        ) {
                            viewModel.goToNextQuestion()
                        }
                    }
                }
            }
        }
    }

    private var completionContent: some View {
        VStack(alignment: .leading, spacing: 18) {
            OpusCard(accent: .emerald, style: .standard) {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Part 5 完成")
                        .font(OpusTypography.pageTitle)

                    Text("共答 \(viewModel.summary.answeredCount) 题，正确 \(viewModel.summary.correctCount)，错题 \(viewModel.summary.incorrectCount)。")
                        .font(OpusTypography.body)
                        .foregroundStyle(OpusColorPalette.secondaryText)
                }
            }

            OpusPrimaryButton(title: "再来一轮") {
                Task {
                    await viewModel.retry()
                }
            }

            Spacer()
        }
        .padding(OpusSpacing.screenPadding)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private var explanationSheet: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("解析")
                    .font(OpusTypography.pageTitle)

                Text(viewModel.currentExplanation ?? "暂无解析。")
                    .font(OpusTypography.body)
                    .foregroundStyle(OpusColorPalette.primaryText)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(OpusSpacing.screenPadding)
        }
        .navigationTitle("解析")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var isAnswered: Bool {
        if case .answered = viewModel.answerState {
            return true
        }
        return false
    }

    private func optionBackground(_ option: ArenaPart5Option) -> Color {
        guard case .answered(let selectedOptionID, _, let correctOptionID) = viewModel.answerState else {
            return OpusColorPalette.surface
        }

        if option.id == correctOptionID {
            return OpusColorPalette.success.opacity(0.14)
        }

        if option.id == selectedOptionID {
            return OpusColorPalette.rose.opacity(0.14)
        }

        return OpusColorPalette.surface
    }

    private func optionBorder(_ option: ArenaPart5Option) -> Color {
        guard case .answered(let selectedOptionID, _, let correctOptionID) = viewModel.answerState else {
            return OpusColorPalette.border
        }

        if option.id == correctOptionID {
            return OpusColorPalette.success
        }

        if option.id == selectedOptionID {
            return OpusColorPalette.rose
        }

        return OpusColorPalette.border
    }
}
