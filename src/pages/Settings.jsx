import React, { useState, useEffect } from 'react';
import '@material/web/switch/switch.js';
import '@material/web/button/filled-button.js';
import '@material/web/icon/icon.js';
// Додаємо імпорти для Select
import '@material/web/select/outlined-select.js';
import '@material/web/select/select-option.js';

const Settings = () => {
  const [filterProfanity, setFilterProfanity] = useState(false);
  const [showAdult, setShowAdult] = useState(false);
  const [engSource, setEngSource] = useState(false);
  const [engMode, setEngMode] = useState('mixed'); // 'mixed', 'only_eng'
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    const settings = JSON.parse(localStorage.getItem('uafilms_settings') || '{}');
    setFilterProfanity(settings.filterProfanity || false);
    setShowAdult(settings.showAdult || false);
    setEngSource(settings.engSource || false);
    setEngMode(settings.engMode || 'mixed');
    
    const savedTheme = localStorage.getItem('uafilms_theme') || 'dark';
    setTheme(savedTheme);
  }, []);

  const saveSettings = (key, value) => {
    const current = JSON.parse(localStorage.getItem('uafilms_settings') || '{}');
    const updated = { ...current, [key]: value };
    localStorage.setItem('uafilms_settings', JSON.stringify(updated));
    
    if (key === 'filterProfanity') setFilterProfanity(value);
    if (key === 'showAdult') {
        setShowAdult(value);
        window.location.reload(); 
    }
    if (key === 'engSource') setEngSource(value);
    if (key === 'engMode') setEngMode(value);
  };

  const handleThemeChange = (e) => {
      // md-outlined-select передає значення так само через e.target.value
      const newTheme = e.target.value;
      setTheme(newTheme);
      localStorage.setItem('uafilms_theme', newTheme);
      document.documentElement.setAttribute('data-theme', newTheme);
  };

  const itemStyle = {
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      background: 'var(--md-sys-color-surface-container)', 
      padding: '16px',
  };

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto', color: 'var(--md-sys-color-on-background)' }}>
      <h1 style={{ fontSize: '28px', color: 'var(--md-sys-color-primary)', marginBottom: '12px' }}>Налаштування</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* ГРУПА НАЛАШТУВАНЬ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}> 
            
            {/* 1. Тема оформлення з MD Select */}
            <div style={{ 
                ...itemStyle, 
                borderTopLeftRadius: '16px', 
                borderTopRightRadius: '16px',
                borderBottomLeftRadius: '4px', 
                borderBottomRightRadius: '4px' 
            }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: '18px' }}>Тема оформлення</h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: 'var(--md-sys-color-outline)' }}>
                        Оберіть вигляд інтерфейсу.
                    </p>
                </div>
                
                <md-outlined-select 
                    value={theme}
                    onInput={handleThemeChange}
                    style={{ 
                        minWidth: '150px',
                        '--md-outlined-select-text-field-container-shape': '24px', 
                        '--md-outlined-select-text-field-top-space': '8px',
                        '--md-outlined-select-text-field-bottom-space': '8px',
                        '--md-outlined-select-text-field-input-text-line-height': '20px',
                        '--md-outlined-select-text-field-input-text-color': 'var(--md-sys-color-on-surface)',
                        '--md-outlined-select-text-field-outline-color': 'var(--md-sys-color-outline)',
                    }}
                >
                    <md-select-option value="dark">
                        <div slot="headline">Темна</div>
                    </md-select-option>
                    <md-select-option value="light">
                        <div slot="headline">Світла</div>
                    </md-select-option>
                </md-outlined-select>
            </div>

            {/* 2. Фільтр матюків */}
            <div style={{ ...itemStyle, borderRadius: '4px' }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: '18px' }}>Фільтрувати нецензурну лексику</h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: 'var(--md-sys-color-outline)' }}>
                        Замінює матюки в коментарях на зірочки.
                    </p>
                </div>
                <md-switch 
                    selected={filterProfanity ? true : undefined} 
                    onClick={() => saveSettings('filterProfanity', !filterProfanity)}
                ></md-switch>
            </div>

            {/* 3. Дорослий контент */}
            <div style={{ ...itemStyle, borderRadius: '4px' }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: '18px' }}>Показувати контент 18+</h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: 'var(--md-sys-color-outline)' }}>
                        Додає результати для дорослих у пошук та рекомендації.
                    </p>
                </div>
                <md-switch 
                    selected={showAdult ? true : undefined} 
                    onClick={() => saveSettings('showAdult', !showAdult)}
                ></md-switch>
            </div>

            {/* 4. Англомовні джерела */}
            <div style={{ ...itemStyle, borderRadius: engSource ? '4px' : '4px 4px 16px 16px' }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: '18px' }}>Англомовні джерела</h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: 'var(--md-sys-color-outline)' }}>
                        Додає провайдерів з англійською озвучкою.
                    </p>
                </div>
                <md-switch 
                    selected={engSource ? true : undefined} 
                    onClick={() => saveSettings('engSource', !engSource)}
                ></md-switch>
            </div>

            {/* 5. Режим англійських джерел (тільки якщо увімкнено) */}
            {engSource && (
                <div style={{ 
                    ...itemStyle, 
                    borderTopLeftRadius: '4px', 
                    borderTopRightRadius: '4px',
                    borderBottomLeftRadius: '16px', 
                    borderBottomRightRadius: '16px',
                    background: 'var(--md-sys-color-surface-container-high)' 
                }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '18px' }}>Режим відображення</h3>
                        <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: 'var(--md-sys-color-outline)' }}>
                            Оберіть, які джерела показувати.
                        </p>
                    </div>
                    
                    <md-outlined-select 
                        value={engMode}
                        onInput={(e) => saveSettings('engMode', e.target.value)}
                        style={{ 
                            minWidth: '180px',
                            '--md-outlined-select-text-field-container-shape': '24px', 
                            '--md-outlined-select-text-field-top-space': '8px',
                            '--md-outlined-select-text-field-bottom-space': '8px',
                            '--md-outlined-select-text-field-input-text-line-height': '20px',
                            '--md-outlined-select-text-field-input-text-color': 'var(--md-sys-color-on-surface)',
                            '--md-outlined-select-text-field-outline-color': 'var(--md-sys-color-outline)',
                        }}
                    >
                        <md-select-option value="mixed">
                            <div slot="headline">UA + ENG</div>
                        </md-select-option>
                        <md-select-option value="only_eng">
                            <div slot="headline">Тільки ENG</div>
                        </md-select-option>
                    </md-outlined-select>
                </div>
            )}
        </div>

        {/* Спільнота та Підтримка */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'var(--md-sys-color-primary-container)', color: 'var(--md-sys-color-on-primary-container)', padding: '24px', borderRadius: '24px' }}>
                <div>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <md-icon>groups</md-icon> Спільнота
                    </h3>
                    <p style={{ margin: '0 0 24px 0', fontSize: '14px', opacity: 0.9, lineHeight: '1.5' }}>
                        Обговорення, новини та оновлення проекту в нашому Telegram каналі.
                    </p>
                </div>
                <md-filled-button onClick={() => window.open('https://t.me/uafilms_official', '_blank')} style={{ alignSelf: 'flex-start' }}>
                    Приєднатися
                </md-filled-button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'var(--md-sys-color-tertiary-container)', color: 'var(--md-sys-color-on-tertiary-container)', padding: '24px', borderRadius: '24px' }}>
                <div>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <md-icon>volunteer_activism</md-icon> Підтримка
                    </h3>
                    <p style={{ margin: '0 0 24px 0', fontSize: '14px', opacity: 0.9, lineHeight: '1.5' }}>
                        Подобається проект? Ви можете підтримати розробку фінансово.
                    </p>
                </div>
                <md-filled-button 
                    onClick={() => window.open('https://t.me/migor1103_donate', '_blank')}
                    style={{ alignSelf: 'flex-start', '--md-filled-button-container-color': 'var(--md-sys-color-tertiary)', '--md-filled-button-label-text-color': 'var(--md-sys-color-on-tertiary)' }}
                >
                    Підтримати автора
                </md-filled-button>
            </div>

            {/* НОВИЙ БЛОК API - додано в тому ж стилі сітки */}
            <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'space-between', 
                background: 'var(--md-sys-color-secondary-container)', 
                color: 'var(--md-sys-color-on-secondary-container)', 
                padding: '24px', 
                borderRadius: '24px',
                gridColumn: '1 / -1' // Розтягуємо на всю ширину сітки, якщо хочете окремим рядком
            }}>
                <div>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <md-icon>api</md-icon> API Документація
                    </h3>
                    <p style={{ margin: '0 0 24px 0', fontSize: '14px', opacity: 0.9, lineHeight: '1.5' }}>
                        Створюйте власні рішення на базі нашого сервісу за допомогою публічного API.
                    </p>
                </div>
                <md-filled-button 
                    onClick={() => window.open('https://bfilms.aartzz.pp.ua', '_blank')}
                    style={{ 
                        alignSelf: 'flex-start', 
                        '--md-filled-button-container-color': 'var(--md-sys-color-secondary)', 
                        '--md-filled-button-label-text-color': 'var(--md-sys-color-on-secondary)' 
                    }}
                >
                    Відкрити
                </md-filled-button>
            </div>
        </div>

      </div>
    </div>
  );
};

export default Settings;