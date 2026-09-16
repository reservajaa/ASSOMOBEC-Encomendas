from PIL import Image, ImageDraw, ImageFilter, ImageEnhance
import os

def create_rounded_logo(logo_img, target_width, target_height, corner_radius=18, border_width=5, outer_glow_width=3):
    scale = 4
    mask_w = target_width * scale
    mask_h = target_height * scale
    radius_scaled = corner_radius * scale
    border_scaled = border_width * scale
    glow_scaled = outer_glow_width * scale
    
    comp_scaled = Image.new('RGBA', (mask_w, mask_h), (0, 0, 0, 0))
    draw_scaled = ImageDraw.Draw(comp_scaled)
    
    # Contorno externo verde esmeralda brilhante
    draw_scaled.rounded_rectangle(
        [(0, 0), (mask_w, mask_h)],
        radius=radius_scaled + glow_scaled,
        fill=(16, 185, 129, 255) # #10b981
    )
    
    # Borda branca sólida
    draw_scaled.rounded_rectangle(
        [(glow_scaled, glow_scaled), (mask_w - glow_scaled, mask_h - glow_scaled)],
        radius=radius_scaled,
        fill=(255, 255, 255, 255)
    )
    
    # Área interna para a logo
    inner_left = glow_scaled + border_scaled
    inner_top = glow_scaled + border_scaled
    inner_right = mask_w - glow_scaled - border_scaled
    inner_bottom = mask_h - glow_scaled - border_scaled
    inner_radius = max(2, radius_scaled - border_scaled)
    
    inner_mask = Image.new('L', (mask_w, mask_h), 0)
    inner_draw = ImageDraw.Draw(inner_mask)
    inner_draw.rounded_rectangle(
        [(inner_left, inner_top), (inner_right, inner_bottom)],
        radius=inner_radius,
        fill=255
    )
    
    logo_w = inner_right - inner_left
    logo_h = inner_bottom - inner_top
    logo_4x = logo_img.resize((logo_w, logo_h), Image.Resampling.LANCZOS).convert('RGBA')
    
    logo_layer = Image.new('RGBA', (mask_w, mask_h), (0, 0, 0, 0))
    logo_layer.paste(logo_4x, (inner_left, inner_top))
    
    comp_scaled.paste(logo_layer, (0, 0), inner_mask)
    
    return comp_scaled.resize((target_width, target_height), Image.Resampling.LANCZOS)


def apply_perfect_banner():
    banner_path = r'x:\2 Projetos\1 PROJETOS\Projeto-ASSOMOBEC-Encomendas\public\banner_tela_inicial.png'
    logo_path = r'x:\2 Projetos\1 PROJETOS\Projeto-ASSOMOBEC-Encomendas\public\logo_assomobec.png'
    backup_path = r'x:\2 Projetos\1 PROJETOS\Projeto-ASSOMOBEC-Encomendas\public\banner_tela_inicial.backup.png'
    
    # 1. Carregar backup em 2048x902
    orig = Image.open(backup_path).convert('RGBA')
    banner = orig.resize((2048, 902), Image.Resampling.LANCZOS)
    
    # 2. Ajustar cores vivas, nitidez e contraste
    r, g, b, a = banner.split()
    rgb = Image.merge('RGB', (r, g, b))
    
    enh_con = ImageEnhance.Contrast(rgb)
    rgb = enh_con.enhance(1.22)
    
    enh_col = ImageEnhance.Color(rgb)
    rgb = enh_col.enhance(1.35)
    
    enh_bri = ImageEnhance.Brightness(rgb)
    rgb = enh_bri.enhance(1.02)
    
    enh_sha = ImageEnhance.Sharpness(rgb)
    rgb = enh_sha.enhance(1.3)
    rgb = rgb.filter(ImageFilter.UnsharpMask(radius=1.2, percent=110, threshold=2))
    
    r2, g2, b2 = rgb.split()
    banner = Image.merge('RGBA', (r2, g2, b2, a))
    
    # 3. Criar a nova moldura da logo em ultra-definição
    logo_orig = Image.open(logo_path).convert('RGBA')
    
    # Dimensões exatas proporcionais:
    frame_w = 264
    frame_h = 126
    corner_radius = 18
    border_width = 5
    outer_glow = 3
    
    logo_framed = create_rounded_logo(
        logo_orig,
        target_width=frame_w,
        target_height=frame_h,
        corner_radius=corner_radius,
        border_width=border_width,
        outer_glow_width=outer_glow
    )
    
    pos_x = 1024 - (frame_w // 2)
    pos_y = 20
    
    # Drop shadow sutil
    shadow = Image.new('RGBA', (frame_w + 16, frame_h + 16), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow)
    sdraw.rounded_rectangle([(8, 8), (frame_w + 8, frame_h + 8)], radius=corner_radius + 2, fill=(0, 0, 0, 80))
    shadow = shadow.filter(ImageFilter.GaussianBlur(4))
    
    banner.paste(shadow, (pos_x - 8, pos_y - 4), shadow)
    banner.paste(logo_framed, (pos_x, pos_y), logo_framed)
    
    banner.save(banner_path, 'PNG', optimize=True)
    print("Banner gerado com sucesso!")

if __name__ == '__main__':
    apply_perfect_banner()
