import express from 'express';
import cors from 'cors';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';

const app = express();

app.use(cors());
app.use(express.json());

// Root health check endpoints for cloud deployment platforms (Render, Railway, etc.)
app.get('/', (_req, res) => res.json({ status: 'ok', message: 'Procurement Requisition Backend API is running', health: '/health' }));
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Mount API router
app.use('/api', routes);

// Global Error Handler (must be mounted last)
app.use(errorHandler);

export default app;
