import os
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

def generate_favicons():
    logo_path = r'x:\2 Projetos\1 PROJETOS\Projeto-ASSOMOBEC-Encomendas\public\logo_assomobec.png'
    public_dir = r'x:\2 Projetos\1 PROJETOS\Projeto-ASSOMOBEC-Encomendas\public'
    
    img = Image.open(logo_path).convert('RGBA')
    
    # 1. Recorte do Emblema Oficial (Sol Laranja + Casinhas Brancas + Folhas + Grama)
    # x: 726..1322 (w=596), y: 65..412 (h=347)
    emblem_crop = img.crop((726, 65, 1322, 412))
    
    # Realçar cores do emblema (laranja mais vibrante, verde mais profundo)
    r, g, b, a = emblem_crop.split()
    rgb = Image.merge('RGB', (r, g, b))
    rgb = ImageEnhance.Contrast(rgb).enhance(1.25)
    rgb = ImageEnhance.Color(rgb).enhance(1.4)
    rgb = ImageEnhance.Sharpness(rgb).enhance(1.3)
    r2, g2, b2 = rgb.split()
    emblem = Image.merge('RGBA', (r2, g2, b2, a))
    
    # 2. Criar Base Quadrada Master em 512x512 com fundo circular/arredondado branco e borda verde esmeralda
    master_size = 512
    master = Image.new('RGBA', (master_size, master_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(master)
    
    # Círculo externo verde institucional / esmeralda
    draw.ellipse([(0, 0), (master_size, master_size)], fill=(1, 89, 70, 255)) # Verde Institucional #015946
    
    # Borda verde esmeralda clara
    draw.ellipse([(8, 8), (master_size - 8, master_size - 8)], fill=(16, 185, 129, 255)) # #10b981
    
    # Círculo interno branco puro
    draw.ellipse([(20, 20), (master_size - 20, master_size - 20)], fill=(255, 255, 255, 255))
    
    # Redimensionar o emblema proporcionalmente para caber no centro do círculo branco com margem perfeita
    emblem_target_w = 410
    emblem_target_h = int(emblem_target_w * (emblem.height / emblem.width))
    emblem_resized = emblem.resize((emblem_target_w, emblem_target_h), Image.Resampling.LANCZOS)
    
    # Centralizar
    pos_x = (master_size - emblem_target_w) // 2
    pos_y = (master_size - emblem_target_h) // 2
    
    master.paste(emblem_resized, (pos_x, pos_y), emblem_resized)
    
    # 3. Gerar versões em todos os tamanhos necessários
    # 16x16
    fav_16 = master.resize((16, 16), Image.Resampling.LANCZOS)
    fav_16 = ImageEnhance.Sharpness(fav_16.convert('RGB')).enhance(1.5).convert('RGBA')
    fav_16.save(os.path.join(public_dir, 'favicon-16x16.png'), 'PNG')
    
    # 32x32
    fav_32 = master.resize((32, 32), Image.Resampling.LANCZOS)
    fav_32 = ImageEnhance.Sharpness(fav_32.convert('RGB')).enhance(1.4).convert('RGBA')
    fav_32.save(os.path.join(public_dir, 'favicon-32x32.png'), 'PNG')
    
    # 48x48
    fav_48 = master.resize((48, 48), Image.Resampling.LANCZOS)
    fav_48 = ImageEnhance.Sharpness(fav_48.convert('RGB')).enhance(1.3).convert('RGBA')
    fav_48.save(os.path.join(public_dir, 'favicon-48x48.png'), 'PNG')
    
    # 180x180 (Apple Touch Icon)
    fav_180 = master.resize((180, 180), Image.Resampling.LANCZOS)
    fav_180.save(os.path.join(public_dir, 'apple-touch-icon.png'), 'PNG')
    
    # 192x192 (PWA Android)
    fav_192 = master.resize((192, 192), Image.Resampling.LANCZOS)
    fav_192.save(os.path.join(public_dir, 'icon-192.png'), 'PNG')
    
    # 512x512 (PWA / Splash)
    master.save(os.path.join(public_dir, 'icon-512.png'), 'PNG')
    master.save(os.path.join(public_dir, 'favicon.png'), 'PNG')
    
    # 4. Gerar favicon.ico multi-resolução compatível com Windows e todos os browsers
    ico_img = master.resize((256, 256), Image.Resampling.LANCZOS)
    ico_img.save(
        os.path.join(public_dir, 'favicon.ico'), 
        format='ICO', 
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    )
    
    print("Favicons gerados com sucesso!")

if __name__ == '__main__':
    generate_favicons()
