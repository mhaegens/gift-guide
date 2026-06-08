#!/usr/bin/env python3
"""Generate PWA icons: gift emoji on #fffbeb cream at 180, 192, 512px."""
import os
import shutil
from PIL import Image, ImageDraw, ImageFont

EMOJI_FONT = '/System/Library/Fonts/Apple Color Emoji.ttc'
# Apple Color Emoji is a bitmap font — only specific sizes work: 20, 40, 160
EMOJI_SIZE = 160

out_dir = os.path.join(os.path.dirname(__file__), '..', 'client', 'public', 'icons')
public_dir = os.path.join(os.path.dirname(__file__), '..', 'client', 'public')
os.makedirs(out_dir, exist_ok=True)

# Render the emoji once at 160px on a transparent canvas, then composite onto
# each icon size (scaling up for 512 with LANCZOS).
font = ImageFont.truetype(EMOJI_FONT, EMOJI_SIZE, index=0)
emoji_canvas = Image.new('RGBA', (EMOJI_SIZE, EMOJI_SIZE), (0, 0, 0, 0))
d = ImageDraw.Draw(emoji_canvas)
d.text((0, 0), '🎁', font=font, embedded_color=True)

for size in [180, 192, 512]:
    bg = Image.new('RGBA', (size, size), (255, 251, 235, 255))

    if size <= EMOJI_SIZE * 1.2:
        glyph = emoji_canvas
    else:
        target = int(size * 0.70)
        glyph = emoji_canvas.resize((target, target), Image.LANCZOS)

    gw, gh = glyph.size
    x = (size - gw) // 2
    y = (size - gh) // 2
    bg.paste(glyph, (x, y), glyph)

    # Save as RGB — flatten alpha onto cream, no transparency in final PNG
    rgb = Image.new('RGB', (size, size), (255, 251, 235))
    rgb.paste(bg, mask=bg.split()[3])

    out_path = os.path.join(out_dir, f'icon-{size}.png')
    rgb.save(out_path, 'PNG')
    print(f'icon-{size}.png  ({gw}x{gh} glyph centred on {size}x{size})')

# iOS also looks for /apple-touch-icon.png at the root
shutil.copy(os.path.join(out_dir, 'icon-180.png'), os.path.join(public_dir, 'apple-touch-icon.png'))
print('apple-touch-icon.png -> client/public/')

print('Done.')
