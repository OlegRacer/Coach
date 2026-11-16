import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import RuGate from './RuGate.jsx';
import App from './App.jsx';
import { I18nProvider } from './i18n/index.jsx';
import { AuthProvider } from './auth/index.jsx';
import { UpdateProvider } from './lib/update.jsx';
import { ContentProvider } from './lib/content.jsx';
import { EquipmentProvider } from './lib/equipment.jsx';
import { UiProvider } from './lib/ui.jsx';
import './styles.css';
import './oneui.css';
import './motion.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RuGate>
    <I18nProvider>
      <AuthProvider>
        <UpdateProvider>
          <ContentProvider>
            <EquipmentProvider>
              <UiProvider>
                <HashRouter>
                  <App />
                </HashRouter>
              </UiProvider>
            </EquipmentProvider>
          </ContentProvider>
        </UpdateProvider>
      </AuthProvider>
    </I18nProvider>
    </RuGate>
  </React.StrictMode>
);
