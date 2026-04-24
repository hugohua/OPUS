import SwiftUI

struct OpusProgressSegment {
    let value: Double
    let color: Color

    init(value: Double, accent: OpusAccent) {
        self.value = value
        self.color = accent.primaryColor
    }

    init(value: Double, color: Color) {
        self.value = value
        self.color = color
    }
}

struct OpusProgressMeter: View {
    let segments: [OpusProgressSegment]
    let height: CGFloat
    let spacing: CGFloat

    init(
        segments: [OpusProgressSegment],
        height: CGFloat = 10,
        spacing: CGFloat = 4
    ) {
        self.segments = segments
        self.height = height
        self.spacing = spacing
    }

    var body: some View {
        GeometryReader { proxy in
            let segments = normalizedSegments
            let availableWidth = max(0, proxy.size.width - spacing * CGFloat(max(segments.count - 1, 0)))

            HStack(spacing: spacing) {
                ForEach(Array(segments.enumerated()), id: \.offset) { _, segment in
                    Capsule(style: .continuous)
                        .fill(segment.color)
                        .frame(width: availableWidth * segment.fraction)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                Capsule(style: .continuous)
                    .fill(OpusColorPalette.progressTrack)
            )
            .clipShape(Capsule(style: .continuous))
        }
        .frame(height: height)
    }

    private var normalizedSegments: [(fraction: Double, color: Color)] {
        let positiveSegments = segments.filter { $0.value > 0 }
        let total = positiveSegments.reduce(0) { $0 + $1.value }

        guard total > 0 else { return [] }

        return positiveSegments.map { segment in
            (fraction: segment.value / total, color: segment.color)
        }
    }
}
