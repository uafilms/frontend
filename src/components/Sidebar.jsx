import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const NavItem = ({ to, icon, label, selectedIcon }) => {
    const isActive = location.pathname === to;
    
    return (
      <div 
        onClick={() => navigate(to)}
        style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          cursor: 'pointer',
          flex: 1, 
          justifyContent: 'center'
        }}
      >
        <md-icon-button 
          toggle 
          selected={isActive} 
          style={{ pointerEvents: 'none' }} 
        >
          <md-icon>{icon}</md-icon>
          <md-icon slot="selected">{selectedIcon || icon}</md-icon>
        </md-icon-button>
        <span style={{ 
            marginTop: '4px', 
            fontSize: '12px', 
            fontWeight: 500,
            color: isActive ? 'var(--md-sys-color-on-surface)' : 'var(--md-sys-color-on-surface-variant)' 
        }}>
            {label}
        </span>
      </div>
    );
  };

  return (
    <>
      <style>{`
        .sidebar-container {
          width: 96px; 
          height: 100vh;
          position: sticky;
          top: 0;
          background-color: var(--md-sys-color-surface);
          display: flex;
          flex-direction: column;
          align-items: center;
          padding-top: 24px;
          z-index: 100;
          border-right: 1px solid var(--md-sys-color-outline-variant);
        }
        .sidebar-logo {
          margin-bottom: 24px;
          color: var(--md-sys-color-primary);
        }
        .nav-items {
          display: flex;
          flex-direction: column;
          gap: 12px;
          width: 100%;
        }
        
        @media (max-width: 768px) {
          .sidebar-container {
            width: 100%;
            height: 80px;
            position: fixed;
            top: auto;
            bottom: 0;
            flex-direction: row;
            padding-top: 0;
            border-right: none;
            border-top: 1px solid var(--md-sys-color-outline-variant);
            justify-content: space-around;
            padding-bottom: env(safe-area-inset-bottom);
            background-color: var(--md-sys-color-surface-container);
          }
          .sidebar-logo {
            display: none;
          }
          .nav-items {
            flex-direction: row;
            justify-content: space-around;
            align-items: center;
            height: 100%;
            gap: 0;
          }
        }
      `}</style>
      
      <div className="sidebar-container">
        <div className="sidebar-logo">
          <svg width="31" height="32" viewBox="0 0 31 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0.557816 9.24832L29.4367 0.035822C30.033 -0.154392 30.6108 0.380053 30.4678 0.989283L23.505 30.6436C23.3493 31.3074 22.4888 31.4853 22.0783 30.9384L13.0188 18.8739C12.961 18.7969 12.89 18.7308 12.809 18.6788L0.371912 10.6918C-0.201881 10.3233 -0.0899653 9.45505 0.557816 9.24832Z" fill="currentColor"/>
          </svg>
        </div>
        
        <div className="nav-items">
            <NavItem to="/" icon="home" selectedIcon="home_filled" label="Головна" />
            {/* NavItem пошуку видалено */}
            <NavItem to="/favorites" icon="favorite_border" selectedIcon="favorite" label="Збережене" />
            <NavItem to="/settings" icon="settings" selectedIcon="settings" label="Налаштування" />
        </div>
      </div>
    </>
  );
};

export default Sidebar;