#!/usr/bin/env python3
"""Generate PWA icons: gift emoji on #fffbeb cream at 180, 192, 512px."""
import os
import sys
from PIL import Image, ImageDraw

out_dir = os.path.join(os.path.dirname(__file__), '..', 'client', 'public', 'icons')
os.makedirs(out_dir, exist_ok=True)

for size in [180, 192, 512]:
    img = Image.new('RGBA', (size, size), '#fffbeb')
    # Use a pre-rendered emoji approach via ImageFont if available, otherwise
    # fall back to drawing with the system emoji font
    draw = ImageDraw.Draw(img)

    # Try to find a system font that renders emoji
    font = None
    font_size = int(size * 0.60)
    font_paths = [
        '/System/Library/Fonts/Apple Color Emoji.ttc',
        '/System/Library/Fonts/AppleColorEmoji.ttf',
        '/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf',
    ]
    from PIL import ImageFont
    for fp in font_paths:
        if os.path.exists(fp):
            try:
                font = ImageFont.truetype(fp, font_size)
                break
            except Exception:
                pass

    emoji = '🎁'
    if font:
        # Get bounding box to centre the emoji
        bbox = draw.textbbox((0, 0), emoji, font=font)
        w = bbox[2] - bbox[0]
        h = bbox[3] - bbox[1]
        x = (size - w) // 2 - bbox[0]
        y = (size - h) // 2 - bbox[1]
        draw.text((x, y), emoji, font=font, embedded_color=True)
    else:
        # Fallback: use default font and draw a placeholder 'G' in amber
        draw.ellipse([size*0.15, size*0.15, size*0.85, size*0.85], fill='#d97706')
        fb = ImageFont.load_default(size=int(size * 0.35))
        bbox = draw.textbbox((0, 0), 'G', font=fb)
        w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
        draw.text(((size - w) // 2, (size - h) // 2), 'G', fill='white', font=fb)

    out_path = os.path.join(out_dir, f'icon-{size}.png')
    img.save(out_path, 'PNG')
    print(f'icon-{size}.png')

print('Done.')
