/**
 * components/dropdown.js — TitanPicker: picker modal con búsqueda en vivo.
 * No depende de app.js; crea y gestiona su propio overlay DOM.
 *
 * Uso:
 *   openTitanPicker({
 *     title: 'Añadir ejercicio',
 *     placeholder: 'Buscar…',
 *     items: [{ id, title, subtitle, meta }],
 *     searchIn: ['title', 'subtitle'],
 *     onSelect: (item) => { ... },
 *   });
 */

let _overlay = null;

/**
 * @typedef {{ id: string, title: string, subtitle?: string, meta?: string }} PickerItem
 */

/**
 * Abre el picker. Si ya hay uno abierto, lo cierra primero.
 * @param {{
 *   title: string,
 *   placeholder?: string,
 *   items: PickerItem[],
 *   searchIn?: string[],
 *   onSelect: (item: PickerItem) => void,
 * }} opts
 */
export function openTitanPicker({ title, placeholder, items, searchIn, onSelect }) {
    closeTitanPicker();

    const overlay = document.createElement('div');
    overlay.className = 'titan-picker-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', title);

    const fields = searchIn && searchIn.length ? searchIn : ['title'];

    overlay.innerHTML =
        '<div class="titan-picker">' +
        '<div class="titan-picker__header">' +
        '<div class="titan-picker__title">' + _esc(title) + '</div>' +
        '<button type="button" class="titan-picker__close" aria-label="Cerrar">✕</button>' +
        '</div>' +
        '<div class="titan-picker__search-wrap">' +
        '<input type="text" class="titan-picker__search cyber-input" placeholder="' + _esc(placeholder || 'Buscar…') + '" autocomplete="off">' +
        '</div>' +
        '<div class="titan-picker__list" role="listbox"></div>' +
        '</div>';

    const picker = overlay.querySelector('.titan-picker');
    const searchInput = overlay.querySelector('.titan-picker__search');
    const listEl = overlay.querySelector('.titan-picker__list');
    const closeBtn = overlay.querySelector('.titan-picker__close');

    function renderItems(filtered) {
        if (!filtered.length) {
            listEl.innerHTML = '<div class="titan-picker__empty text-small">Sin resultados</div>';
            return;
        }
        listEl.innerHTML = filtered
            .map(
                (it) =>
                    '<button type="button" class="titan-picker__item" role="option" data-id="' +
                    _esc(it.id) +
                    '">' +
                    '<span class="titan-picker__item-title">' + _esc(it.title) + '</span>' +
                    (it.subtitle
                        ? '<span class="titan-picker__item-sub text-small">' + _esc(it.subtitle) + '</span>'
                        : '') +
                    (it.meta
                        ? '<span class="titan-picker__item-meta text-small">' + _esc(it.meta) + '</span>'
                        : '') +
                    '</button>'
            )
            .join('');
    }

    function filterItems(query) {
        const q = (query || '').toLowerCase().trim();
        if (!q) return items;
        return items.filter((it) =>
            fields.some((f) => {
                const v = it[f];
                return v && String(v).toLowerCase().includes(q);
            })
        );
    }

    renderItems(items);

    searchInput.addEventListener('input', () => {
        renderItems(filterItems(searchInput.value));
    });

    listEl.addEventListener('click', (e) => {
        const btn = e.target.closest('.titan-picker__item');
        if (!btn) return;
        const id = btn.dataset.id;
        const selected = items.find((it) => it.id === id);
        if (selected) {
            closeTitanPicker();
            try {
                onSelect(selected);
            } catch (err) {
                console.error('[TitanPicker] onSelect', err);
            }
        }
    });

    closeBtn.addEventListener('click', closeTitanPicker);

    // Cerrar al hacer clic fuera del picker
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeTitanPicker();
    });

    // Cerrar con Escape
    overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeTitanPicker();
    });

    document.body.appendChild(overlay);
    _overlay = overlay;

    // Animar entrada y enfocar búsqueda
    requestAnimationFrame(() => {
        overlay.classList.add('titan-picker-overlay--open');
        picker.classList.add('titan-picker--open');
        searchInput.focus();
    });
}

export function closeTitanPicker() {
    if (!_overlay) return;
    const overlay = _overlay;
    _overlay = null;
    overlay.classList.remove('titan-picker-overlay--open');
    overlay.querySelector('.titan-picker')?.classList.remove('titan-picker--open');
    setTimeout(() => overlay.remove(), 250);
}

function _esc(text) {
    const d = document.createElement('div');
    d.textContent = String(text ?? '');
    return d.innerHTML;
}

// ── Estilos integrados (no requiere CSS externo adicional) ────────────────────
// Se inyectan una sola vez en el <head>.
(function injectPickerStyles() {
    if (document.getElementById('titan-picker-styles')) return;
    const style = document.createElement('style');
    style.id = 'titan-picker-styles';
    style.textContent = `
.titan-picker-overlay {
    position: fixed; inset: 0; z-index: 9999;
    background: rgba(0,0,0,0.75);
    display: flex; align-items: flex-end; justify-content: center;
    opacity: 0; transition: opacity 0.2s;
}
.titan-picker-overlay--open { opacity: 1; }

.titan-picker {
    background: #0a0a0a; border: 1px solid #00FF88;
    border-radius: 12px 12px 0 0; width: 100%; max-width: 520px;
    max-height: 75vh; display: flex; flex-direction: column;
    transform: translateY(100%); transition: transform 0.25s cubic-bezier(0.22,1,0.36,1);
    padding-bottom: env(safe-area-inset-bottom, 0);
}
.titan-picker--open { transform: translateY(0); }

.titan-picker__header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 20px 0; flex-shrink: 0;
}
.titan-picker__title {
    font-family: 'Orbitron', sans-serif; font-size: 13px;
    color: #00FF88; text-transform: uppercase; letter-spacing: 0.1em;
}
.titan-picker__close {
    background: none; border: none; color: #666; font-size: 18px;
    cursor: pointer; padding: 4px; line-height: 1;
}
.titan-picker__close:hover { color: #fff; }

.titan-picker__search-wrap { padding: 12px 16px; flex-shrink: 0; }
.titan-picker__search { width: 100%; }

.titan-picker__list {
    overflow-y: auto; flex: 1;
    padding: 0 8px 16px;
    -webkit-overflow-scrolling: touch;
}
.titan-picker__item {
    width: 100%; text-align: left; background: transparent;
    border: none; border-bottom: 1px solid #1a1a1a;
    padding: 12px; cursor: pointer; display: flex;
    flex-direction: column; gap: 2px; color: inherit;
    transition: background 0.15s;
}
.titan-picker__item:hover, .titan-picker__item:focus {
    background: #0d1f14; outline: none;
}
.titan-picker__item-title { color: #e0e0e0; font-size: 14px; font-weight: 500; }
.titan-picker__item-sub { color: #00FF88; font-size: 11px; }
.titan-picker__item-meta { color: #666; font-size: 11px; }
.titan-picker__empty { padding: 24px; text-align: center; color: #555; }
    `;
    document.head.appendChild(style);
})();
