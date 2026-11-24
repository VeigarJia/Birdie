// Renders the 🏸 emoji into the PWA icon PNGs using AppKit (macOS only, no Xcode needed):
//   osascript -l JavaScript scripts/generate-icons.js "$PWD"
ObjC.import("AppKit");

function render(root, size, emojiScale, transparent, relPath) {
  const rep = $.NSBitmapImageRep.alloc.initWithBitmapDataPlanesPixelsWidePixelsHighBitsPerSampleSamplesPerPixelHasAlphaIsPlanarColorSpaceNameBytesPerRowBitsPerPixel(
    null, size, size, 8, 4, true, false, $.NSDeviceRGBColorSpace, 0, 0);
  $.NSGraphicsContext.saveGraphicsState;
  $.NSGraphicsContext.setCurrentContext($.NSGraphicsContext.graphicsContextWithBitmapImageRep(rep));

  const rect = $.NSMakeRect(0, 0, size, size);
  const bg = transparent
    ? $.NSColor.clearColor
    : $.NSColor.colorWithSRGBRedGreenBlueAlpha(0xf2 / 255, 0xf5 / 255, 0xee / 255, 1);
  bg.setFill;
  $.NSRectFill(rect);

  const font = $.NSFont.fontWithNameSize("Apple Color Emoji", size * emojiScale);
  const attrs = $.NSDictionary.dictionaryWithObjectForKey(font, $.NSFontAttributeName);
  const text = $("🏸");
  const b = text.sizeWithAttributes(attrs);
  text.drawAtPointWithAttributes($.NSMakePoint((size - b.width) / 2, (size - b.height) / 2), attrs);
  $.NSGraphicsContext.restoreGraphicsState;

  const png = rep.representationUsingTypeProperties($.NSBitmapImageFileTypePNG, $.NSDictionary.dictionary);
  png.writeToFileAtomically(`${root}/${relPath}`, true);
  return `wrote ${relPath}`;
}

function run(argv) {
  const root = argv[0];
  // Regular icons: emoji at ~62% of the canvas. Maskable: ~48% so it survives the 80% safe zone.
  return [
    render(root, 180, 0.62, false, "public/icons/icon-180.png"),
    render(root, 192, 0.62, false, "public/icons/icon-192.png"),
    render(root, 512, 0.62, false, "public/icons/icon-512.png"),
    render(root, 512, 0.48, false, "public/icons/icon-maskable-512.png"),
    render(root, 64, 0.85, true, "public/favicon.png"),
  ].join("\n");
}
