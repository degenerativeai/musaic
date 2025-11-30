# Musaic - Dataset Architect

A high-fidelity prompt engineering suite designed to generate, refine, and structure realistic datasets for AI training and evaluation (LoRA/Fine-tuning).

![Musaic Screenshot](https://via.placeholder.com/800x450.png?text=Musaic+Interface)

## Features

- **VisionStruct Analysis**: Extracts detailed biometric and physical profiles from reference images (Headshot/Bodyshot).
- **The Century Protocol**: Generates datasets in batches of 100 with strict diversity and unique outfit enforcement.
- **LoRA & Product Modes**: Specialized generation flows for influencer training sets or UGC product advertising.
- **Secure BYOK Architecture**: Bring Your Own Key. API keys are stored in session storage and never transmitted to a backend.

## Tech Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS
- Google Gemini API (`@google/genai`)

## Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/musaic.git
   cd musaic
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run local server**
   ```bash
   npm run dev
   ```

## Deployment on Vercel

1. Fork this repository.
2. Go to [Vercel](https://vercel.com).
3. "Add New Project" -> Import your Musaic repository.
4. Framework Preset: **Vite**.
5. Deploy.

## License

MIT
