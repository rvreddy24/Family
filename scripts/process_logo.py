from PIL import Image
import numpy as np
from collections import deque

def process_logo():
    raw_img = Image.open('d:/Family/packages/shared/assets/logo.png').convert('RGB')
    arr = np.array(raw_img)
    h, w, _ = arr.shape

    r = arr[:, :, 0].astype(int)
    g = arr[:, :, 1].astype(int)
    b = arr[:, :, 2].astype(int)
    chroma = np.maximum.reduce([r, g, b]) - np.minimum.reduce([r, g, b])
    min_rgb = np.minimum.reduce([r, g, b])

    # 1. First, make the window panes inside the orange house pure white
    # Window coords: y 500..676, x 232..399
    # Inside this window box, any light/checker pixel should be pure white (255, 255, 255)
    win_mask = np.zeros((h, w), dtype=bool)
    win_mask[500:676, 232:399] = (min_rgb[500:676, 232:399] > 180) & (chroma[500:676, 232:399] < 20)
    arr[win_mask] = [255, 255, 255]

    # Recalculate r, g, b
    r = arr[:, :, 0].astype(int)
    g = arr[:, :, 1].astype(int)
    b = arr[:, :, 2].astype(int)
    chroma = np.maximum.reduce([r, g, b]) - np.minimum.reduce([r, g, b])
    min_rgb = np.minimum.reduce([r, g, b])

    # 2. Identify all background checkerboard pixels
    # A pixel is background candidate if it is neutral grey/white (chroma < 18, min_rgb > 185)
    is_bg_candidate = (chroma < 18) & (min_rgb > 185)
    # The window panes are now protected (they are inside the orange house, surrounded by orange)
    # Let's do a BFS flood fill from the 4 outer image boundaries to find connected outside background:
    is_outside_bg = np.zeros((h, w), dtype=bool)
    q = deque()

    for y in range(h):
        if is_bg_candidate[y, 0]: is_outside_bg[y, 0] = True; q.append((y, 0))
        if is_bg_candidate[y, w-1]: is_outside_bg[y, w-1] = True; q.append((y, w-1))
    for x in range(w):
        if is_bg_candidate[0, x] and not is_outside_bg[0, x]: is_outside_bg[0, x] = True; q.append((0, x))
        if is_bg_candidate[h-1, x] and not is_outside_bg[h-1, x]: is_outside_bg[h-1, x] = True; q.append((h-1, x))

    while q:
        cy, cx = q.popleft()
        for dy, dx in [(-1,0), (1,0), (0,-1), (0,1)]:
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < h and 0 <= nx < w and not is_outside_bg[ny, nx] and is_bg_candidate[ny, nx]:
                is_outside_bg[ny, nx] = True
                q.append((ny, nx))

    # Also in the text area (y >= 880), any candidate background between letters should be transparent
    is_text_bg = (np.arange(h)[:, None] >= 880) & is_bg_candidate

    total_transparent = is_outside_bg | is_text_bg

    # Create RGBA output
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[:, :, :3] = arr
    rgba[:, :, 3] = np.where(total_transparent, 0, 255)

    # Smooth the antialiased edges:
    # Any pixel with total_transparent == False that is adjacent to a transparent pixel
    # and has high brightness can have soft alpha
    # For now, let's create PIL image:
    full_transparent = Image.fromarray(rgba, 'RGBA')
    full_transparent.save('d:/Family/packages/shared/assets/logo_full_transparent.png')
    print('Saved logo_full_transparent.png')

    # 3. Create Emblem-Only Icon (Cropped tight to the houses and couple)
    # Emblem bounds: y from 171 to 878, x from 67 to 1178
    emblem_arr = rgba[165:882, 60:1185].copy()
    emblem_img = Image.fromarray(emblem_arr, 'RGBA')
    
    # Resize emblem to a standard square with nice padding: 512x512
    # Maintain aspect ratio
    ew, eh = emblem_img.size
    target_size = 512
    scale = (target_size - 40) / max(ew, eh)
    new_w, new_h = int(ew * scale), int(eh * scale)
    emblem_resized = emblem_img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    
    square_icon = Image.new('RGBA', (target_size, target_size), (0, 0, 0, 0))
    offset_x = (target_size - new_w) // 2
    offset_y = (target_size - new_h) // 2
    square_icon.paste(emblem_resized, (offset_x, offset_y), emblem_resized)
    square_icon.save('d:/Family/packages/shared/assets/logo_icon.png')
    print('Saved logo_icon.png (512x512)')

    # 4. Create Favicon (64x64 and 32x32)
    fav64 = square_icon.resize((64, 64), Image.Resampling.LANCZOS)
    fav64.save('d:/Family/packages/shared/assets/favicon.png')
    fav32 = square_icon.resize((32, 32), Image.Resampling.LANCZOS)
    fav32.save('d:/Family/packages/shared/assets/favicon_32.png')
    print('Saved favicon.png (64x64 & 32x32)')

    # 5. Create Crisp Horizontal Brand Logo for Navbars (Emblem + "FamilyHubs")
    # For navbars, an emblem icon next to high-res stylized text or the cropped full logo
    # Let's crop full logo tightly to content:
    content_y, content_x = np.where(rgba[:, :, 3] > 0)
    tight_crop = rgba[content_y.min():content_y.max()+1, content_x.min():content_x.max()+1]
    tight_img = Image.fromarray(tight_crop, 'RGBA')
    tight_img.save('d:/Family/packages/shared/assets/logo_tight.png')
    print('Saved logo_tight.png')

    # 6. Create White Card Version (badge)
    # Perfect for embedding on dark background cards
    badge_w, badge_h = tight_img.size
    pad = 40
    badge = Image.new('RGBA', (badge_w + pad*2, badge_h + pad*2), (255, 255, 255, 255))
    badge.paste(tight_img, (pad, pad), tight_img)
    badge.save('d:/Family/packages/shared/assets/logo_white_card.png')
    print('Saved logo_white_card.png')

process_logo()
