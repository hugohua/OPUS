import SwiftUI

struct SessionRunnerView: View {
    @Bindable var viewModel: SessionRunnerViewModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            LinearGradient.opusBackground
                .ignoresSafeArea()

            switch viewModel.contentState {
            case .loading:
                OpusStateView(
                    state: .loading,
                    loadingTitle: "正在加载训练会话",
                    loadingMessage: "正在同步本轮题目与进度。"
                )
                .padding(OpusSpacing.screenPadding)
            case .error:
                OpusStateView(
                    state: viewModel.contentState,
                    action: {
                        Task { await viewModel.load(force: true) }
                    }
                )
                .padding(OpusSpacing.screenPadding)
            case .empty:
                content
            }
        }
        .navigationTitle(viewModel.sessionTitle)
        .toolbar(isPhraseSession ? .hidden : .visible, for: .navigationBar)
        .toolbar(isPhraseSession ? .hidden : .visible, for: .tabBar)
        .task {
            await viewModel.load()
        }
    }

    @ViewBuilder
    private var content: some View {
        if viewModel.isCompleted {
            completionView
        } else if let card = viewModel.currentCard {
            switch card.interaction {
            case .phraseFlashcard(let phrase):
                phraseSessionView(phrase)
            default:
                ScrollView(.vertical, showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 20) {
                        headerView

                        OpusCard(accent: card.accent, style: .standard) {
                            VStack(alignment: .leading, spacing: 14) {
                                Text(card.title)
                                    .font(OpusTypography.cardTitle)
                                    .foregroundStyle(OpusColorPalette.primaryText)

                                Text(card.prompt)
                                    .font(OpusTypography.body)
                                    .foregroundStyle(OpusColorPalette.primaryText)

                                if !card.supportingText.isEmpty {
                                    Text(card.supportingText)
                                        .font(OpusTypography.body)
                                        .foregroundStyle(OpusColorPalette.secondaryText)
                                }
                            }
                        }

                        interactionView(for: card)

                        if let inlineErrorMessage = viewModel.inlineErrorMessage {
                            OpusCard(accent: .amber, style: .compact) {
                                Text(inlineErrorMessage)
                                    .font(OpusTypography.body)
                                    .foregroundStyle(OpusColorPalette.warning)
                            }
                        }
                    }
                    .padding(OpusSpacing.screenPadding)
                    .padding(.bottom, 120)
                }
            }
        } else {
            OpusStateView(state: .empty(
                title: "当前没有可用训练",
                message: "这一轮暂时没有可消费的题目，请稍后再试。"
            ))
            .padding(OpusSpacing.screenPadding)
        }
    }

    private func phraseSessionView(_ phrase: SessionRunnerPhraseFlashcard) -> some View {
        OpusTrainingShell(
            label: "L0 • PHRASE",
            progress: progressFraction,
            accent: .amber,
            onExit: { dismiss() }
        ) {
            VStack(alignment: .leading, spacing: 22) {
                Text("BUSINESS • PHRASE")
                    .font(.caption2.monospaced().weight(.bold))
                    .tracking(1.8)
                    .foregroundStyle(OpusColorPalette.tertiaryText)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(
                        RoundedRectangle(cornerRadius: 9, style: .continuous)
                            .fill(OpusColorPalette.elevatedSurface)
                            .shadow(color: OpusColorPalette.shadow.opacity(0.45), radius: 8, x: 0, y: 2)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 9, style: .continuous)
                            .stroke(OpusColorPalette.border, lineWidth: 1)
                    )

                OpusHighlightedPhraseText(markdown: phrase.phraseMarkdown, style: .phrase)
                    .accessibilityLabel(phrase.phraseMarkdown.replacingOccurrences(of: "**", with: ""))
                    .accessibilityAddTraits(.isButton)
                    .contentShape(Rectangle())
                    .onTapGesture {
                        Task { await viewModel.playPhraseAudio() }
                    }

                if viewModel.isAnswerRevealed {
                    phraseAnswerView(phrase)
                        .transition(.opacity.combined(with: .move(edge: .bottom)))
                }

                if let inlineErrorMessage = viewModel.inlineErrorMessage {
                    Text(inlineErrorMessage)
                        .font(OpusTypography.body)
                        .foregroundStyle(OpusColorPalette.warning)
                        .padding(14)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .fill(OpusAccent.amber.softColor)
                        )
                }
            }
            .animation(.easeInOut(duration: 0.24), value: viewModel.isAnswerRevealed)
        } footer: {
            if viewModel.isAnswerRevealed {
                OpusFSRSGradeDeck(preview: phrase.fsrsPreview) { grade in
                    Task { await viewModel.submitPhraseGrade(grade) }
                }
            } else {
                OpusRevealControl {
                    viewModel.revealAnswer()
                }
            }
        }
    }

    private func phraseAnswerView(_ phrase: SessionRunnerPhraseFlashcard) -> some View {
        let display = SessionRunnerPhraseDisplay(
            targetWord: phrase.targetWord,
            definition: phrase.definition
        )

        return VStack(alignment: .leading, spacing: 20) {
            if !phrase.translation.isEmpty {
                Text(phrase.translation)
                    .font(.title3.weight(.medium))
                    .foregroundStyle(OpusColorPalette.secondaryText)
                    .lineSpacing(3)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 2)
            }

            Divider()
                .padding(.top, 4)

            VStack(alignment: .leading, spacing: 14) {
                Button {
                    Task { await viewModel.playWordAudio() }
                } label: {
                    phraseDefinitionText(phrase: phrase, display: display)
                        .multilineTextAlignment(.center)
                        .lineSpacing(3)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.vertical, 2)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("播放 \(phrase.targetWord) 发音")

                if let userNote = phrase.userNote, !userNote.isEmpty {
                    phraseInfoRow(systemImage: "sparkle", text: userNote, accent: .amber)
                }

                if let etymology = phrase.etymology {
                    OpusEtymologyCard(etymology: etymology)
                        .padding(.top, 2)
                }
            }
        }
    }

    private func phraseDefinitionText(
        phrase: SessionRunnerPhraseFlashcard,
        display: SessionRunnerPhraseDisplay
    ) -> Text {
        var text = Text("")

        if let phonetic = phrase.phonetic, !phonetic.isEmpty {
            text = text + Text("/\(phonetic.replacingOccurrences(of: "/", with: ""))/ ")
                .font(.body.monospaced())
                .foregroundColor(OpusColorPalette.tertiaryText)
        }

        if !phrase.targetWord.isEmpty {
            text = text + Text(phrase.targetWord)
                .font(.headline.weight(.bold))
                .foregroundColor(OpusAccent.indigo.primaryColor)
        }

        if !display.cleanedDefinition.isEmpty {
            text = text + Text(" : \(display.cleanedDefinition)")
                .font(.headline.weight(.semibold))
                .foregroundColor(OpusColorPalette.primaryText)
        }

        return text
    }

    private func phraseInfoRow(systemImage: String, text: String, accent: OpusAccent) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: systemImage)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(accent.primaryColor)
                .frame(width: 22)

            Text(text)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(OpusColorPalette.primaryText)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(accent.softColor)
        )
    }

    private var headerView: some View {
        OpusCard(accent: .slate, style: .compact) {
            VStack(alignment: .leading, spacing: 8) {
                Text(viewModel.sessionSubtitle)
                    .font(OpusTypography.caption)
                    .foregroundStyle(OpusColorPalette.secondaryText)
                Text(viewModel.progressText)
                    .font(OpusTypography.metric)
                    .foregroundStyle(OpusColorPalette.primaryText)
            }
        }
    }

    @ViewBuilder
    private func interactionView(for card: SessionRunnerCard) -> some View {
        switch card.interaction {
        case .phraseFlashcard:
            EmptyView()
        case .grading:
            VStack(alignment: .leading, spacing: 12) {
                Text("提交本题结果")
                    .font(OpusTypography.sectionTitle)

                ForEach([1, 2, 3, 4], id: \.self) { grade in
                    Button {
                        Task { await viewModel.submit(grade: grade) }
                    } label: {
                        Text(gradeLabel(grade))
                            .font(OpusTypography.body)
                            .foregroundStyle(OpusColorPalette.primaryText)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(16)
                            .background(
                                RoundedRectangle(cornerRadius: 18, style: .continuous)
                                    .fill(OpusColorPalette.surface)
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: 18, style: .continuous)
                                    .stroke(OpusColorPalette.border, lineWidth: 1)
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
        case .choice(let options, _, let explanation):
            VStack(alignment: .leading, spacing: 12) {
                Text("选择正确答案")
                    .font(OpusTypography.sectionTitle)

                ForEach(options) { option in
                    Button {
                        viewModel.selectOption(option)
                    } label: {
                        optionRow(option)
                    }
                    .buttonStyle(.plain)
                    .disabled(isAnswerResolved)
                }

                if case .resolved(_, let isCorrect, _) = viewModel.answerState {
                    OpusCard(accent: isCorrect ? .emerald : .amber, style: .compact) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text(isCorrect ? "回答正确" : "先看解析再继续")
                                .font(OpusTypography.sectionTitle)
                            if let explanation, !explanation.isEmpty {
                                Text(explanation)
                                    .font(OpusTypography.body)
                                    .foregroundStyle(OpusColorPalette.secondaryText)
                            }
                        }
                    }

                    OpusPrimaryButton(title: "继续下一题") {
                        Task { await viewModel.submitResolvedAnswer() }
                    }
                }
            }
        }
    }

    private func optionRow(_ option: SessionRunnerChoiceOption) -> some View {
        let isSelected: Bool
        let isCorrectSelection: Bool
        switch viewModel.answerState {
        case .idle:
            isSelected = false
            isCorrectSelection = false
        case .resolved(let selectedID, let isCorrect, _):
            isSelected = selectedID == option.id
            isCorrectSelection = isSelected && isCorrect
        }

        let strokeColor: Color = isCorrectSelection
            ? OpusColorPalette.success
            : isSelected ? OpusColorPalette.warning : OpusColorPalette.border

        return Text(option.text)
            .font(OpusTypography.body)
            .foregroundStyle(OpusColorPalette.primaryText)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
            .background(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(OpusColorPalette.surface)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(strokeColor, lineWidth: 1.5)
            )
    }

    private var isAnswerResolved: Bool {
        if case .resolved = viewModel.answerState {
            return true
        }
        return false
    }

    private var isPhraseSession: Bool {
        viewModel.isPhraseDestination && !viewModel.isCompleted
    }

    private var progressFraction: Double {
        guard let session = viewModel.session, !session.cards.isEmpty else { return 0 }
        return Double(min(viewModel.currentIndex + 1, session.cards.count)) / Double(session.cards.count)
    }

    private var completionView: some View {
        VStack(alignment: .leading, spacing: 16) {
            OpusStateView(
                state: .empty(
                    title: "本轮训练完成",
                    message: "你已经完成这一轮移动端会话，可以返回训练页继续下一项。"
                )
            )
            .padding(OpusSpacing.screenPadding)

            Spacer()
        }
    }

    private func gradeLabel(_ grade: Int) -> String {
        switch grade {
        case 1:
            return "Again · 完全没想起来"
        case 2:
            return "Hard · 有印象但不稳"
        case 3:
            return "Good · 正常答出"
        default:
            return "Easy · 非常稳"
        }
    }
}
