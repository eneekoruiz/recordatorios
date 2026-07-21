const fs = require('fs');

let css = fs.readFileSync('C:\\Users\\User\\Desktop\\PROYECTOS\\recordatorios\\src\\index.css', 'utf-8');

const replacement = `.ios-smart-card h3 {
  color: white;
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  align-self: flex-start;
}
.ios-smart-card .count {
  position: absolute;
  top: 6px;
  right: 12px;
  font-size: 2rem;
  font-weight: 700;
  color: white;
  line-height: 1;
}

.categories-section .section-header {
  font-size: 1.6rem;
  font-weight: 800;
  color: #000;
  margin-bottom: 12px;
}

.ios-list-block {
  background: transparent;
  border-radius: 0;
  overflow: visible;
}
.ios-list-item {
  display: flex;
  align-items: center;
  padding: 14px 16px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  margin-bottom: 8px;
  position: relative;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: var(--shadow-sm);
}
.ios-list-item:not(:last-child)::after {
  display: none;
}
.ios-list-item .list-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  margin-right: 12px;
}
.ios-list-item span.title {
  font-weight: 600;
  font-size: 1rem;
  color: var(--text-primary);
  line-height: 1.4;
}
.ios-list-item .subtitle {
  font-size: 0.8rem;
  color: var(--text-secondary);
  display: block;
  font-weight: 400;
  line-height: 1.4;
  margin-top: 4px;
}
.ios-list-item .count {
  color: var(--text-tertiary);
  font-size: 1rem;
  margin-right: 4px;
}
.ios-list-item:active, .ios-list-item:hover {
  background: var(--bg-hover);
  border-color: var(--border-focus);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

/* Actions Button - Clean layout helper */
.ios-list-item .list-action-btn {
  opacity: 0.3;
  transition: opacity 0.2s ease;
  flex-shrink: 0;
}

@media (hover: hover) {
  .ios-list-item .list-action-btn {
    opacity: 0;
  }
  .ios-list-item:hover .list-action-btn {
    opacity: 0.6;
  }
  .ios-list-item:hover .list-action-btn:hover {
    opacity: 1;
  }
}`;

css = css.replace(
  /\.ios-smart-card h3 \{[\s\S]*?\.ios-list-item:hover \.list-action-btn:hover \{\s*opacity: 1;\s*\}\s*\}/,
  replacement
);

fs.writeFileSync('C:\\Users\\User\\Desktop\\PROYECTOS\\recordatorios\\src\\index.css', css);
