import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App.jsx';
import { I18nProvider } from './i18n/index.jsx';
import { AuthProvider } from './auth/index.jsx';
import { UpdateProvider } from './lib/update.jsx';
import { ContentProvider } from './lib/content.jsx';
import { EquipmentProvider } from './lib/equipment.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <I18nProvider>
      <AuthProvider>
        <UpdateProvider>
          <ContentProvider>
            <EquipmentProvider>
              <HashRouter>
                <App />
              </HashRouter>
            </EquipmentProvider>
          </ContentProvider>
        </UpdateProvider>
      </AuthProvider>
    </I18nProvider>
  </React.StrictMode>
);
