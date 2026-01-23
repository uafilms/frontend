import React, { useEffect, useRef, useState } from 'react';

const TurnstileWidget = () => {
  const containerRef = useRef(null);
  const widgetId = useRef(null);
  const [isVisible, setIsVisible] = useState(true);

  // Отримуємо налаштування з .env (Vite)
  const IS_ENABLED = import.meta.env.VITE_TURNSTILE_ENABLED === 'true';
  const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;

  useEffect(() => {
    // 1. Якщо Turnstile вимкнено в конфігурації
    if (!IS_ENABLED) {
        window.cfToken = 'disabled'; // Ставимо маркер, щоб Axios знав, що чекати не треба
        window.dispatchEvent(new Event('cf_token_ready'));
        return;
    }

    // 2. Якщо увімкнено, працюємо за стандартною логікою
    window.cfToken = null;

    const initializeTurnstile = () => {
        if (widgetId.current !== null) return;
        
        if (!window.turnstile) {
            return; 
        }

        if (checkInterval.current) clearInterval(checkInterval.current);

        try {
            widgetId.current = window.turnstile.render(containerRef.current, {
                sitekey: SITE_KEY,
                theme: 'dark',
                appearance: 'always', 
                callback: function(token) {
                  console.log('Turnstile success');
                  window.cfToken = token;
                  window.dispatchEvent(new Event('cf_token_ready'));

                  setTimeout(() => {
                    setIsVisible(false);
                  }, 2500);
                },
                'expired-callback': function() {
                  console.log('Turnstile expired');
                  window.cfToken = null;
                  setIsVisible(true);
                },
                'error-callback': function() {
                   console.log('Turnstile error');
                }
            });
        } catch (e) {
            console.error("Turnstile render error:", e);
        }
    };

    const checkInterval = { current: null };
    if (window.turnstile) {
        initializeTurnstile();
    } else {
        checkInterval.current = setInterval(initializeTurnstile, 100);
    }

    return () => {
        if (checkInterval.current) clearInterval(checkInterval.current);
        if (window.turnstile && widgetId.current !== null) {
            try { window.turnstile.remove(widgetId.current); } catch(e) {}
            widgetId.current = null;
        }
    };
  }, [IS_ENABLED, SITE_KEY]);

  // Якщо Turnstile вимкнено або ми хочемо приховати віджет після успіху
  if (!IS_ENABLED) return null;

  return (
    <div 
        ref={containerRef} 
        style={{ 
            display: isVisible ? 'flex' : 'none', 
            justifyContent: 'center', 
            margin: '10px 0' 
        }}
    ></div>
  );
};

export default TurnstileWidget;