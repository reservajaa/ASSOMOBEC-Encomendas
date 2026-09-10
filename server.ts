import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import Tesseract from "tesseract.js";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '20mb' }));

// Detecção inteligente de Transportadora / Loja a partir do texto
function detectCarrierFromText(text: string): string | null {
  if (!text) return null;
  const upper = text.toUpperCase();

  // 1. Mercado Livre / Envios
  if (
    upper.includes('MERCADO LIVRE') ||
    upper.includes('MERCADOLIVRE') ||
    upper.includes('MERCADO ENVIOS') ||
    upper.includes('MERCADOENVIOS') ||
    upper.includes('MELI') ||
    upper.includes('ENVIO FULL') ||
    upper.includes('MERCADO PAGO') ||
    /\bML[0-9A-Z]/.test(upper)
  ) {
    return 'Mercado Livre';
  }

  // 2. Shopee / SPX
  if (
    upper.includes('SHOPEE') ||
    upper.includes('SPX') ||
    upper.includes('SHP') ||
    upper.includes('SHOPEE EXPRESS')
  ) {
    return 'Shopee';
  }

  // 3. Amazon
  if (
    upper.includes('AMAZON') ||
    upper.includes('AMZN') ||
    upper.includes('PRIME')
  ) {
    return 'Amazon';
  }

  // 4. Shein
  if (upper.includes('SHEIN')) {
    return 'Shein';
  }

  // 5. AliExpress / Cainiao
  if (
    upper.includes('ALIEXPRESS') ||
    upper.includes('ALI EXPRESS') ||
    upper.includes('CAINIAO')
  ) {
    return 'AliExpress';
  }

  // 6. Magalu / Magazine Luiza
  if (
    upper.includes('MAGALU') ||
    upper.includes('MAGAZINE LUIZA') ||
    upper.includes('MAGALOG')
  ) {
    return 'Magazine Luiza (Magalu)';
  }

  // 7. Correios
  if (
    upper.includes('CORREIOS') ||
    upper.includes('SEDEX') ||
    upper.includes('PAC') ||
    upper.includes('ECT') ||
    upper.includes('EMPRESA BRASILEIRA DE CORREIOS')
  ) {
    return 'Correios';
  }

  // 8. Jadlog
  if (upper.includes('JADLOG') || upper.includes('JAD LOG')) {
    return 'Jadlog';
  }

  // 9. Loggi
  if (upper.includes('LOGGI')) {
    return 'Loggi';
  }

  // 10. Total Express
  if (
    upper.includes('TOTAL EXPRESS') ||
    upper.includes('TOTALEXPRESS') ||
    upper.includes('TEX LOG')
  ) {
    return 'Total Express';
  }

  // 11. J&T Express
  if (
    upper.includes('J&T') ||
    upper.includes('JT EXPRESS') ||
    upper.includes('JET EXPRESS') ||
    upper.includes('J AND T')
  ) {
    return 'J&T Express';
  }

  // 12. TikTok Shop
  if (upper.includes('TIKTOK')) {
    return 'TikTok Shop';
  }

  // 13. Temu
  if (upper.includes('TEMU')) {
    return 'Temu';
  }

  // 14. Azul Cargo
  if (upper.includes('AZUL CARGO') || upper.includes('AZUL LINHAS')) {
    return 'Azul Cargo Express';
  }

  // 15. LATAM Cargo
  if (upper.includes('LATAM CARGO') || upper.includes('LATAM')) {
    return 'LATAM Cargo';
  }

  // 16. Braspress
  if (upper.includes('BRASPRESS')) {
    return 'Braspress';
  }

  // 17. Buslog
  if (upper.includes('BUSLOG')) {
    return 'Buslog';
  }

  // 18. Casas Bahia
  if (upper.includes('CASAS BAHIA') || upper.includes('VIA VAREJO')) {
    return 'Casas Bahia';
  }

  // 19. Americanas
  if (upper.includes('AMERICANAS') || upper.includes('B2W')) {
    return 'Americanas';
  }

  return null;
}

// Extrai possível nome de destinatário da etiqueta
function extractNameFromText(text: string): string | null {
  if (!text) return null;
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toUpperCase();
    if (
      line.includes('DESTINATÁRIO') ||
      line.includes('DESTINATARIO') ||
      line.includes('DEST:') ||
      line.includes('CLIENTE:') ||
      line.includes('RECEBEDOR:') ||
      line.includes('PARA:') ||
      line.includes('NOME:')
    ) {
      // Remove prefixos
      const cleaned = line
        .replace(/^(DESTINAT[AÁ]RIO|DEST|CLIENTE|RECEBEDOR|PARA|NOME)\s*[:.-]?\s*/i, '')
        .trim();
      if (cleaned.length >= 3) return cleaned;
      if (i + 1 < lines.length && lines[i + 1].trim().length >= 3) {
        return lines[i + 1].trim().toUpperCase();
      }
    }
  }

  return null;
}

// Endpoint unificado de OCR (Gemini com fallback Tesseract automático)
app.post("/api/ocr", async (req, res) => {
  const { imageBase64 } = req.body;
  if (!imageBase64) {
    return res.status(400).json({ error: "Nenhuma imagem recebida." });
  }

  let detectedName: string | null = null;
  let detectedCarrier: string | null = null;
  let rawText = '';

  // 1. Tenta Gemini se houver GEMINI_API_KEY
  if (process.env.GEMINI_API_KEY) {
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `Analise atentamente a foto desta etiqueta de encomenda.
Identifique com precisão:
1. "name": O nome completo do destinatário (morador). Se não encontrar, coloque null.
2. "carrier": A transportadora ou loja (ex: Mercado Livre, Shopee, Amazon, Shein, Correios, Jadlog, Loggi, Total Express, Magazine Luiza, AliExpress, Casas Bahia, Americanas, etc.). Se não encontrar, coloque null.

Retorne EXCLUSIVAMENTE um objeto JSON válido:
{"name": "NOME DO DESTINATARIO EM MAIUSCULAS", "carrier": "Nome da Transportadora ou Loja"}`;

      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: imageBase64.split(',')[1],
            mimeType: "image/jpeg"
          }
        }
      ]);

      const response = await result.response;
      const raw = response.text().trim();
      const clean = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(clean);
      if (parsed.name && parsed.name !== 'UNKNOWN') detectedName = parsed.name;
      if (parsed.carrier && parsed.carrier !== 'UNKNOWN') detectedCarrier = parsed.carrier;
    } catch (e) {
      console.warn("Gemini falhou ou indisponível, usando Tesseract local:", e);
    }
  }

  // 2. Se a transportadora ou nome ainda não foram encontrados, usa o Tesseract no Node.js
  if (!detectedCarrier || !detectedName) {
    try {
      const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
      const buffer = Buffer.from(base64Data, 'base64');
      
      const tesseractResult = await Tesseract.recognize(buffer, 'eng', {
        logger: () => {}
      });

      rawText = tesseractResult.data.text || '';

      if (!detectedCarrier) {
        detectedCarrier = detectCarrierFromText(rawText);
      }
      if (!detectedName) {
        detectedName = extractNameFromText(rawText);
      }
    } catch (tessErr) {
      console.error("Erro no Tesseract local:", tessErr);
    }
  }

  res.json({
    success: true,
    name: detectedName,
    carrier: detectedCarrier,
    text: rawText
  });
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
