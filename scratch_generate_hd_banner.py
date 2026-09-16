import os
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance, ImageFont

def create_rounded_logo(logo_img, target_width, target_height, corner_radius=18, border_width=5, outer_glow_width=3):
    scale = 4
    mask_w = target_width * scale
    mask_h = target_height * scale
    radius_scaled = corner_radius * scale
    border_scaled = border_width * scale
    glow_scaled = outer_glow_width * scale
    
    comp_scaled = Image.new('RGBA', (mask_w, mask_h), (0, 0, 0, 0))
    draw_scaled = ImageDraw.Draw(comp_scaled)
    
    # Glow / contorno externo verde esmeralda
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


def generate_hd_banner():
    user_img_path = r'C:\Users\Patrick & Família\.gemini\antigravity-ide\brain\06d8ee4a-2c81-4bdb-ad0f-fe1485708a30\.user_uploaded\media_1789413638666.jpg'
    logo_path = r'x:\2 Projetos\1 PROJETOS\Projeto-ASSOMOBEC-Encomendas\public\logo_assomobec.png'
    dest_path = r'x:\2 Projetos\1 PROJETOS\Projeto-ASSOMOBEC-Encomendas\public\banner_fundo_completo.png'
    
    # Carregar imagem base completa 2048x902
    img = Image.open(user_img_path).convert('RGBA')
    banner = img.resize((2048, 902), Image.Resampling.LANCZOS)
    
    # Ajuste de cores vivas e nitidez
    r, g, b, a = banner.split()
    rgb = Image.merge('RGB', (r, g, b))
    rgb = ImageEnhance.Contrast(rgb).enhance(1.22)
    rgb = ImageEnhance.Color(rgb).enhance(1.35)
    rgb = ImageEnhance.Brightness(rgb).enhance(1.02)
    rgb = ImageEnhance.Sharpness(rgb).enhance(1.3)
    rgb = rgb.filter(ImageFilter.UnsharpMask(radius=1.2, percent=110, threshold=2))
    r2, g2, b2 = rgb.split()
    banner = Image.merge('RGBA', (r2, g2, b2, a))
    
    # Suavização perfeita e contínua do centro superior
    bg_sample = banner.crop((700, 0, 1348, 280))
    bg_blurred = bg_sample.filter(ImageFilter.GaussianBlur(15))
    
    mask = Image.new('L', (648, 280), 0)
    mdraw = ImageDraw.Draw(mask)
    mdraw.rounded_rectangle([(30, 0), (618, 270)], radius=40, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(20))
    
    banner.paste(bg_blurred, (700, 0), mask)
    
    # Criar e colar a nova moldura da logo perfeita
    logo_orig = Image.open(logo_path).convert('RGBA')
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
    pos_y = 16
    
    # Drop shadow
    shadow = Image.new('RGBA', (frame_w + 16, frame_h + 16), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow)
    sdraw.rounded_rectangle([(8, 8), (frame_w + 8, frame_h + 8)], radius=corner_radius + 2, fill=(0, 0, 0, 80))
    shadow = shadow.filter(ImageFilter.GaussianBlur(4))
    
    banner.paste(shadow, (pos_x - 8, pos_y - 4), shadow)
    banner.paste(logo_framed, (pos_x, pos_y), logo_framed)
    
    # Textos do topo com máxima nitidez
    draw = ImageDraw.Draw(banner)
    try:
        font_title = ImageFont.truetype("arialbd.ttf", 36)
        font_sub = ImageFont.truetype("arialbd.ttf", 18)
        font_loc = ImageFont.truetype("arial.ttf", 15)
    except:
        font_title = ImageFont.load_default()
        font_sub = font_title
        font_loc = font_title
        
    text_title = "ASSOMOBEC"
    bbox_title = draw.textbbox((0, 0), text_title, font=font_title)
    w_title = bbox_title[2] - bbox_title[0]
    draw.text((1024 - w_title // 2, 160), text_title, fill=(255, 255, 255, 255), font=font_title)
    
    text_sub = "Controle de Encomendas"
    bbox_sub = draw.textbbox((0, 0), text_sub, font=font_sub)
    w_sub = bbox_sub[2] - bbox_sub[0]
    draw.text((1024 - w_sub // 2, 208), text_sub, fill=(52, 211, 153, 255), font=font_sub)
    
    text_loc = "Camarão Dumas Adjacências"
    bbox_loc = draw.textbbox((0, 0), text_loc, font=font_loc)
    w_loc = bbox_loc[2] - bbox_loc[0]
    draw.text((1024 - w_loc // 2, 236), text_loc, fill=(209, 250, 229, 220), font=font_loc)
    
    banner.save(dest_path, 'PNG', optimize=True)
    print(f"Banner HD completo gerado com sucesso em: {dest_path}")

if __name__ == '__main__':
    generate_hd_banner()
