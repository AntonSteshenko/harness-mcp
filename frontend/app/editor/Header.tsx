"use client";

import { MenuIcon } from "./Icons";

export function Header({
  osName,
  onToggleSidebar,
}: {
  osName: string;
  onToggleSidebar: () => void;
}) {
  return (
    <header className="app-header">
      <button
        type="button"
        className="sidebar-toggle"
        aria-label="Toggle file browser"
        onClick={onToggleSidebar}
      >
        <MenuIcon />
      </button>
      <span className="logo-mark" aria-hidden="true">
        {osName.charAt(0).toUpperCase()}
      </span>
      <span className="app-name">{osName}</span>
      <style jsx>{`
        .app-header {
          display: flex;
          align-items: center;
          gap: 10px;
          height: 52px;
          flex-shrink: 0;
          padding: 0 16px;
          border-bottom: 1px solid #e5e5e5;
          background: #fff;
        }
        .sidebar-toggle {
          display: none;
        }
        .logo-mark {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 26px;
          border-radius: 7px;
          background: #4f46e5;
          color: #fff;
          font-size: 13px;
          font-weight: 700;
          flex-shrink: 0;
        }
        .app-name {
          font-size: 15px;
          font-weight: 600;
          color: #1a1a1a;
          letter-spacing: -0.01em;
        }

        @media (max-width: 768px) {
          .sidebar-toggle {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            flex-shrink: 0;
            border: 1px solid #ddd;
            border-radius: 8px;
            background: #fff;
            color: #333;
          }
        }
      `}</style>
    </header>
  );
}
