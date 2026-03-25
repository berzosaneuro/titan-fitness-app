/**
 * Selector tipo bottom sheet (iOS-like) con búsqueda en vivo.
 * Sin <select> nativo.
 */

function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
}

/**
 * @typedef {{ id: string, title: string, subtitle?: string, meta?: string }} PickerItem
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} [opts.placeholder]
 * @param {PickerItem[]} opts.items
 * @param {(item: PickerItem) => void} opts.onSelect
 * @param {string[]} [opts.searchIn] keys to lowercase-match
 */
export function openTitanPicker(opts) {
    const title = opts.title || 'Seleccionar';
    const placeholder = opts.placeholder || 'Buscar…';
    const items = Array.isArray(opts.items) ? opts.items : [];
    const onSelect = typeof opts.onSelect === 'function' ? opts.onSelect : () => {};
    const searchIn = opts.searchIn || ['title', 'subtitle', 'meta'];

    const overlay = document.createElement('div');
    overlay.className = 'titan-sheet-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', title);

    const sheet = document.createElement('div');
    sheet.className = 'titan-sheet';

    sheet.innerHTML =
        '<div class="titan-sheet__handle" aria-hidden="true"></div>' +
        '<div class="titan-sheet__head">' +
        '<span class="titan-sheet__title">' +
        esc(title) +
        '</span>' +
        '<button type="button" class="titan-sheet__close" aria-label="Cerrar">✕</button>' +
        '</div>' +
        '<div class="titan-sheet__search">' +
        '<input type="search" class="titan-sheet__input" placeholder="' +
        esc(placeholder) +
        '" autocomplete="off" />' +
        '</div>' +
        '<div class="titan-sheet__list" role="listbox"></div>';

    overlay.appendChild(sheet);
    document.body.appendChild(overlay);
    document.body.classList.add('titan-sheet-open');

    const listEl = sheet.querySelector('.titan-sheet__list');
    const input = sheet.querySelector('.titan-sheet__input');
    const btnClose = sheet.querySelector('.titan-sheet__close');

    function matches(item, q) {
        if (!q) return true;
        const ql = q.toLowerCase();
        return searchIn.some((k) => String(item[k] || '').toLowerCase().includes(ql));
    }

    function renderList(filtered) {
        if (!listEl) return;
        if (!filtered.length) {
            listEl.innerHTML =
                '<div class="titan-sheet__empty text-small">Sin resultados · ajusta la búsqueda</div>';
            return;
        }
        listEl.innerHTML = filtered
            .map(
                (it) =>
                    '<button type="button" class="titan-sheet__opt" role="option" data-id="' +
                    esc(it.id) +
                    '">' +
                    '<span class="titan-sheet__opt-title">' +
                    esc(it.title) +
                    '</span>' +
                    (it.subtitle
                        ? '<span class="titan-sheet__opt-sub">' + esc(it.subtitle) + '</span>'
                        : '') +
                    (it.meta ? '<span class="titan-sheet__opt-meta">' + esc(it.meta) + '</span>' : '') +
                    '</button>'
            )
            .join('');

        listEl.querySelectorAll('.titan-sheet__opt').forEach((btn) => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const item = filtered.find((x) => x.id === id);
                if (item) onSelect(item);
                close();
            });
        });
    }

    function filterList() {
        const q = (input && input.value) || '';
        renderList(items.filter((it) => matches(it, q)));
    }

    let closed = false;
    function onDocKey(ev) {
        if (ev.key === 'Escape') close();
    }
    function close() {
        if (closed) return;
        closed = true;
        document.removeEventListener('keydown', onDocKey);
        sheet.classList.remove('titan-sheet--open');
        overlay.classList.add('titan-sheet-overlay--out');
        document.body.classList.remove('titan-sheet-open');
        setTimeout(() => {
            overlay.remove();
        }, 320);
    }

    document.addEventListener('keydown', onDocKey);

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
    });
    btnClose.addEventListener('click', () => close());
    input.addEventListener('input', () => filterList());

    filterList();
    requestAnimationFrame(() => {
        sheet.classList.add('titan-sheet--open');
        if (input) {
            input.focus();
        }
    });
}
