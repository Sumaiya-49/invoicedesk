// Local development server: `npm run dev:api` (Vite forwards /api calls here, see vite.config.js).
import app from './app.js';

const port = Number(process.env.PORT || 3001);
app.listen(port, () => console.log(`API running on http://localhost:${port}`));
