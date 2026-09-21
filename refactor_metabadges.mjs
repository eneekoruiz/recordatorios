import fs from 'fs';

const file = 'src/components/tasks/card/TaskMetaBadges.tsx';
let content = fs.readFileSync(file, 'utf8');

const hasMetaRegex = /const hasMeta = (.*?);/;
content = content.replace(hasMetaRegex, 'const showPrice = task.price !== undefined && task.price > 0;\n  const hasMeta = $1 || showPrice;');

const priceBadge = `
          {showPrice && (
            <span 
              onClick={(e) => {
                e.stopPropagation();
                onEdit(task.id);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                padding: '1.5px 7px',
                borderRadius: 6,
                fontSize: '0.74rem',
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                background: 'rgba(52, 199, 89, 0.1)',
                border: '1px solid rgba(52, 199, 89, 0.2)',
                color: '#248a3d',
                cursor: 'pointer'
              }}
              title={\`Precio: \${task.price} €\${task.quantity && task.quantity > 1 ? \` (\${task.quantity} uds)\` : ''} (Toca para editar)\`}
            >
              {task.quantity && task.quantity > 1 && (
                <span style={{ opacity: 0.7, marginRight: 2 }}>{task.quantity}×</span>
              )}
              <span>{task.price!.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €</span>
            </span>
          )}`;

content = content.replace(/\{cycleBadge && \(/, priceBadge + '\n          {cycleBadge && (');

fs.writeFileSync(file, content);
