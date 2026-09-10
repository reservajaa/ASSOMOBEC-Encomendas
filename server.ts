import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Gemini OCR Endpoint
app.post("/api/ocr", async (req, res) => {
  const { imageBase64 } = req.body;
  
  if (!process.env.GEMINI_API_KEY) {
    return res.status(200).json({ error: "GEMINI_API_KEY is not configured", name: null, carrier: null });
  }

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
    
    try {
      const clean = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(clean);
      res.json({
        name: parsed.name && parsed.name !== 'UNKNOWN' ? parsed.name : null,
        carrier: parsed.carrier && parsed.carrier !== 'UNKNOWN' ? parsed.carrier : null
      });
    } catch {
      res.json({ name: raw !== 'UNKNOWN' ? raw : null, carrier: null });
    }
  } catch (error: any) {
    console.error("Gemini OCR error:", error);
    res.status(200).json({ error: "Failed to process image with AI.", name: null, carrier: null });
  }
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
