import SwiftUI
import UIKit

struct BriefingSelectableTextView: UIViewRepresentable {
    let text: String
    let onLookup: (String) -> Void
    let onAnalyze: (String, String?) -> Void

    func makeUIView(context: Context) -> BriefingTextView {
        let textView = BriefingTextView(frame: CGRect.zero, textContainer: nil)
        textView.backgroundColor = UIColor.clear
        textView.isEditable = false
        textView.isSelectable = true
        textView.isScrollEnabled = false
        textView.textContainerInset = UIEdgeInsets.zero
        textView.textContainer.lineFragmentPadding = 0
        textView.font = UIFont.preferredFont(forTextStyle: UIFont.TextStyle.body)
        textView.textColor = UIColor.label
        textView.setContentCompressionResistancePriority(UILayoutPriority.defaultLow, for: NSLayoutConstraint.Axis.horizontal)
        textView.lookupHandler = onLookup
        textView.analyzeHandler = onAnalyze
        return textView
    }

    func updateUIView(_ uiView: BriefingTextView, context: Context) {
        uiView.text = text
        uiView.lookupHandler = onLookup
        uiView.analyzeHandler = onAnalyze
    }

    func sizeThatFits(_ proposal: ProposedViewSize, uiView: BriefingTextView, context: Context) -> CGSize? {
        let targetSize = CGSize(
            width: proposal.width ?? UIScreen.main.bounds.width,
            height: .greatestFiniteMagnitude
        )
        return uiView.sizeThatFits(targetSize)
    }
}

final class BriefingTextView: UITextView {
    var lookupHandler: ((String) -> Void)?
    var analyzeHandler: ((String, String?) -> Void)?

    override init(frame: CGRect, textContainer: NSTextContainer?) {
        super.init(frame: frame, textContainer: textContainer)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func editMenu(for textRange: UITextRange, suggestedActions: [UIMenuElement]) -> UIMenu? {
        var actions: [UIMenuElement] = []

        if let selectedWord {
            actions.append(
                UIAction(title: "查词") { [weak self] _ in
                    self?.lookupHandler?(selectedWord)
                }
            )
        }

        if !selectedTextValue.isEmpty {
            actions.append(
                UIAction(title: "分析") { [weak self] _ in
                    guard let self else { return }
                    self.analyzeHandler?(self.selectedTextValue, self.enclosingSentence)
                }
            )
        }

        return UIMenu(children: actions + suggestedActions)
    }

    private var selectedTextValue: String {
        guard selectedRange.length > 0 else { return "" }
        let nsText = text as NSString
        return nsText.substring(with: selectedRange)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var selectedWord: String? {
        let cleaned = selectedTextValue
            .trimmingCharacters(in: CharacterSet.alphanumerics.inverted)

        guard !cleaned.isEmpty,
              !cleaned.contains(where: \.isWhitespace) else {
            return nil
        }

        return cleaned
    }

    private var enclosingSentence: String? {
        guard selectedRange.location != NSNotFound else { return nil }
        let nsText = text as NSString
        var start = selectedRange.location
        var end = selectedRange.location + selectedRange.length
        let delimiters = CharacterSet(charactersIn: ".!?\n")

        while start > 0 {
            let scalar = nsText.substring(with: NSRange(location: start - 1, length: 1)).unicodeScalars.first
            if let scalar, delimiters.contains(scalar) {
                break
            }
            start -= 1
        }

        while end < nsText.length {
            let scalar = nsText.substring(with: NSRange(location: end, length: 1)).unicodeScalars.first
            if let scalar, delimiters.contains(scalar) {
                break
            }
            end += 1
        }

        let range = NSRange(location: start, length: max(0, end - start))
        return nsText.substring(with: range)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
