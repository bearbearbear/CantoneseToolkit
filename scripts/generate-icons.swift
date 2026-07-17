import AppKit

struct IconSpec {
  let size: CGFloat
  let output: String
}

let specs = [
  IconSpec(size: 512, output: "public/icon-512.png"),
  IconSpec(size: 192, output: "public/icon-192.png"),
  IconSpec(size: 180, output: "public/apple-touch-icon.png"),
]

let teal = NSColor(calibratedRed: 0.0, green: 0.427, blue: 0.467, alpha: 1)
let gold = NSColor(calibratedRed: 0.949, green: 0.757, blue: 0.361, alpha: 1)
let cream = NSColor(calibratedRed: 1.0, green: 0.973, blue: 0.918, alpha: 1)

func scaled(_ value: CGFloat, _ scale: CGFloat) -> CGFloat {
  value * scale
}

func drawIcon(size: CGFloat) -> NSImage {
  let scale = size / 512
  let image = NSImage(size: NSSize(width: size, height: size))
  image.lockFocus()

  teal.setFill()
  NSRect(x: 0, y: 0, width: size, height: size).fill()

  gold.setStroke()

  let smile = NSBezierPath()
  smile.lineWidth = scaled(28, scale)
  smile.lineCapStyle = .round
  smile.move(to: NSPoint(x: scaled(92, scale), y: scaled(160, scale)))
  smile.curve(
    to: NSPoint(x: scaled(256, scale), y: scaled(82, scale)),
    controlPoint1: NSPoint(x: scaled(134, scale), y: scaled(109, scale)),
    controlPoint2: NSPoint(x: scaled(188, scale), y: scaled(82, scale))
  )
  smile.curve(
    to: NSPoint(x: scaled(420, scale), y: scaled(160, scale)),
    controlPoint1: NSPoint(x: scaled(324, scale), y: scaled(82, scale)),
    controlPoint2: NSPoint(x: scaled(378, scale), y: scaled(109, scale))
  )
  smile.stroke()

  for (radius, width) in [(102.0, 25.0), (58.0, 22.0)] {
    let wave = NSBezierPath()
    wave.lineWidth = scaled(CGFloat(width), scale)
    wave.lineCapStyle = .round
    wave.appendArc(
      withCenter: NSPoint(x: scaled(332, scale), y: scaled(256, scale)),
      radius: scaled(CGFloat(radius), scale),
      startAngle: -55,
      endAngle: 55
    )
    wave.stroke()
  }

  gold.setFill()
  NSBezierPath(
    ovalIn: NSRect(
      x: scaled(315, scale),
      y: scaled(239, scale),
      width: scaled(34, scale),
      height: scaled(34, scale)
    )
  ).fill()

  let font =
    NSFont(name: "PingFangHK-Semibold", size: scaled(218, scale))
    ?? NSFont.systemFont(ofSize: scaled(218, scale), weight: .heavy)
  let paragraph = NSMutableParagraphStyle()
  paragraph.alignment = .left
  let attributes: [NSAttributedString.Key: Any] = [
    .font: font,
    .foregroundColor: cream,
    .paragraphStyle: paragraph,
  ]
  let textRect = NSRect(
    x: scaled(66, scale),
    y: scaled(150, scale),
    width: scaled(260, scale),
    height: scaled(260, scale)
  )
  NSString(string: "粵").draw(in: textRect, withAttributes: attributes)

  cream.withAlphaComponent(0.42).setStroke()
  let underline = NSBezierPath()
  underline.lineWidth = scaled(16, scale)
  underline.lineCapStyle = .round
  underline.move(to: NSPoint(x: scaled(104, scale), y: scaled(124, scale)))
  underline.line(to: NSPoint(x: scaled(408, scale), y: scaled(124, scale)))
  underline.stroke()

  image.unlockFocus()
  return image
}

for spec in specs {
  let image = drawIcon(size: spec.size)
  guard
    let tiff = image.tiffRepresentation,
    let bitmap = NSBitmapImageRep(data: tiff),
    let data = bitmap.representation(using: .png, properties: [:])
  else {
    fatalError("Could not render icon \(spec.output)")
  }
  try data.write(to: URL(fileURLWithPath: spec.output))
  print("Wrote \(spec.output)")
}
