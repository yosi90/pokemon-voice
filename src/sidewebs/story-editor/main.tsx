import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { StoryEditor } from './StoryEditor.js';
import './styles.css';

createRoot(document.getElementById('root')!).render(<StrictMode><StoryEditor /></StrictMode>);
