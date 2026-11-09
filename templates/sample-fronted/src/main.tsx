import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { siteConfig } from './config/site';
import './styles/index.css';

document.documentElement.style.setProperty('--color-primary', siteConfig.primaryColor);
document.title = `${siteConfig.name} — ${siteConfig.description}`;
document.querySelector('meta[name="description"]')?.setAttribute('content', siteConfig.description);
document.querySelector('meta[name="theme-color"]')?.setAttribute('content', siteConfig.primaryColor);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App/></React.StrictMode>,
);
