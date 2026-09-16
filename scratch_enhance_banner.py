from PIL import Image, ImageEnhance, ImageFilter, ImageOps
import sys

def enhance_vivid(input_path, output_path):
    img = Image.open(input_path).convert('RGBA')
    
    # Separar canal alfa se existir
    r, g, b, a = img.split()
    rgb = Image.merge('RGB', (r, g, b))
    
    # 1. Ajuste de Contraste para tirar opacidade e nevoeiro
    # Contraste de 1.18 a 1.25 dá muita firmeza nas letras e sombras
    enhancer_con = ImageEnhance.Contrast(rgb)
    rgb_con = enhancer_con.enhance(1.22)
    
    # 2. Aumento de Saturação / Cores Vivas (Color)
    # Aumentar para 1.35 traz o verde rico, amarelo ouro brilhante e laranja intenso
    enhancer_col = ImageEnhance.Color(rgb_con)
    rgb_col = enhancer_col.enhance(1.35)
    
    # 3. Leve ajuste de brilho para iluminar os brancos
    enhancer_bri = ImageEnhance.Brightness(rgb_col)
    rgb_bri = enhancer_bri.enhance(1.03)
    
    # 4. Nitidez / Sharpness para deixar as letras perfeitamente legíveis e destacadas
    enhancer_sha = ImageEnhance.Sharpness(rgb_bri)
    rgb_sha = enhancer_sha.enhance(1.4)
    
    # 5. Aplicar UnsharpMask sutil para clareza máxima nas fontes
    rgb_final = rgb_sha.filter(ImageFilter.UnsharpMask(radius=1.2, percent=120, threshold=2))
    
    # Recombinar com canal alfa
    r2, g2, b2 = rgb_final.split()
    final_img = Image.merge('RGBA', (r2, g2, b2, a))
    
    final_img.save(output_path, 'PNG', optimize=True)
    print(f"Sucesso! Imagem salva em: {output_path}")

if __name__ == '__main__':
    src = r'x:\2 Projetos\1 PROJETOS\Projeto-ASSOMOBEC-Encomendas\public\banner_tela_inicial.png'
    enhance_vivid(src, src)
