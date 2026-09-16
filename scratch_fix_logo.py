import os
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

def create_rounded_logo(logo_img, target_width, target_height, corner_radius, border_width=8, outer_glow_width=5):
    """
    Cria a logo perfeitamente centralizada e recortada dentro de uma moldura de cantos arredondados,
    com borda branca e contorno verde esmeralda, sem sobrar cantos retos nem cortar a imagem torta.
    """
    # 1. Redimensionar a logo proporcionalmente para caber dentro da área interna da moldura
    inner_w = target_width - (border_width * 2)
    inner_h = target_height - (border_width * 2)
    
    # Redimensionar a logo mantendo a proporção para preencher bem o espaço interno
    logo_resized = logo_img.resize((inner_w, inner_h), Image.Resampling.LANCZOS).convert('RGBA')
    
    # 2. Criar máscara com cantos arredondados em super-resolução (4x) para antialiasing perfeito
    scale = 4
    mask_w = target_width * scale
    mask_h = target_height * scale
    radius_scaled = corner_radius * scale
    border_scaled = border_width * scale
    glow_scaled = outer_glow_width * scale
    
    # Imagem composta final
    comp_scaled = Image.new('RGBA', (mask_w, mask_h), (0, 0, 0, 0))
    draw_scaled = ImageDraw.Draw(comp_scaled)
    
    # Outer Glow / Borda verde esmeralda externa
    draw_scaled.rounded_rectangle(
        [(0, 0), (mask_w, mask_h)],
        radius=radius_scaled + glow_scaled,
        fill=(16, 185, 129, 230) # Verde Esmeralda #10b981
    )
    
    # Borda branca espessa
    draw_scaled.rounded_rectangle(
        [(glow_scaled, glow_scaled), (mask_w - glow_scaled, mask_h - glow_scaled)],
        radius=radius_scaled,
        fill=(255, 255, 255, 255)
    )
    
    # Área interna para a logo
    inner_mask_scaled = Image.new('L', (mask_w, mask_h), 0)
    inner_draw = ImageDraw.Draw(inner_mask_scaled)
    inner_left = glow_scaled + border_scaled
    inner_top = glow_scaled + border_scaled
    inner_right = mask_w - glow_scaled - border_scaled
    inner_bottom = mask_h - glow_scaled - border_scaled
    inner_radius = max(2, radius_scaled - border_scaled)
    
    inner_draw.rounded_rectangle(
        [(inner_left, inner_top), (inner_right, inner_bottom)],
        radius=inner_radius,
        fill=255
    )
    
    # Redimensionar a logo para o tamanho interno em escala 4x
    logo_4x = logo_img.resize((inner_right - inner_left, inner_bottom - inner_top), Image.Resampling.LANCZOS).convert('RGBA')
    
    # Criar imagem final 4x e colar logo com máscara
    logo_layer_4x = Image.new('RGBA', (mask_w, mask_h), (0, 0, 0, 0))
    logo_layer_4x.paste(logo_4x, (inner_left, inner_top))
    
    # Mesclar com a borda
    comp_scaled.paste(logo_layer_4x, (0, 0), inner_mask_scaled)
    
    # Reduzir de volta para o tamanho alvo com antialiasing de alta qualidade
    result = comp_scaled.resize((target_width, target_height), Image.Resampling.LANCZOS)
    return result


def apply_perfect_logo_to_banner():
    banner_path = r'x:\2 Projetos\1 PROJETOS\Projeto-ASSOMOBEC-Encomendas\public\banner_tela_inicial.png'
    logo_path = r'x:\2 Projetos\1 PROJETOS\Projeto-ASSOMOBEC-Encomendas\public\logo_assomobec.png'
    
    banner = Image.open(banner_path).convert('RGBA')
    logo = Image.open(logo_path).convert('RGBA')
    
    # Dimensões da moldura em 2048x902
    # Largura: 280px, Altura: 186px, Centro X = 1024, Topo Y = 16
    frame_w = 286
    frame_h = 188
    corner_radius = 24
    border_width = 6
    outer_glow = 3
    
    logo_framed = create_rounded_logo(
        logo, 
        target_width=frame_w, 
        target_height=frame_h, 
        corner_radius=corner_radius, 
        border_width=border_width, 
        outer_glow_width=outer_glow
    )
    
    # Posição centralizada:
    # Centro X = 1024 -> posX = 1024 - (frame_w // 2)
    pos_x = 1024 - (frame_w // 2)
    pos_y = 16
    
    # 1. Primeiro limpamos a região anterior do topo para não deixar vestígios da logo antiga torta
    # Pegamos a cor sólida de fundo verde da região
    bg_green = (1, 89, 70, 255) # #015946
    
    draw_banner = ImageDraw.Draw(banner)
    # Limpa a área do topo da moldura com a cor verde do fundo
    draw_banner.rectangle(
        [(pos_x - 15, pos_y - 10), (pos_x + frame_w + 15, pos_y + frame_h + 15)],
        fill=bg_green
    )
    
    # 2. Criar uma sombra suave para a moldura (Drop Shadow)
    shadow_offset = 6
    shadow_blur = 12
    shadow = Image.new('RGBA', (frame_w + shadow_blur * 2, frame_h + shadow_blur * 2), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle(
        [(shadow_blur, shadow_blur), (frame_w + shadow_blur, frame_h + shadow_blur)],
        radius=corner_radius + 4,
        fill=(0, 0, 0, 100) # Sombra preta suave
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(shadow_blur // 2))
    
    # Colar a sombra no banner
    banner.paste(shadow, (pos_x - shadow_blur, pos_y - shadow_blur + shadow_offset), shadow)
    
    # Colar a moldura com a logo perfeitamente centralizada e alinhada
    banner.paste(logo_framed, (pos_x, pos_y), logo_framed)
    
    # 3. Salvar o banner atualizado
    banner.save(banner_path, 'PNG', optimize=True)
    print(f"Banner atualizado com sucesso com a logo perfeitamente reta e alinhada em: {banner_path}")

if __name__ == '__main__':
    apply_perfect_logo_to_banner()
