/* Small select-only comboboxes backed by the player's existing native selects. */
(() => {
    let dispose = () => {};
    function init() {
        dispose();
        const panel = document.getElementById('music-content');
        if (!panel) return;
        const events = new AbortController(), cleanups = [], closers = [];
        const on = (node, type, fn) => node.addEventListener(type, fn, { signal: events.signal });
        panel.querySelectorAll('.music-library-field select').forEach(select => {
            const field = select.closest('.music-library-field');
            const label = field.querySelector('label');
            const root = document.createElement('div'); root.className = 'music-select';
            const trigger = document.createElement('button');
            trigger.type = 'button'; trigger.className = 'music-select-trigger'; trigger.id = `${select.id}-trigger`;
            trigger.setAttribute('role', 'combobox'); trigger.setAttribute('aria-haspopup', 'listbox');
            trigger.setAttribute('aria-expanded', 'false');
            const list = document.createElement('div'); list.className = 'music-select-menu';
            list.id = `${select.id}-listbox`; list.setAttribute('role', 'listbox'); list.hidden = true;
            trigger.setAttribute('aria-controls', list.id);
            if (label) {
                label.htmlFor = trigger.id;
                trigger.setAttribute('aria-labelledby', `${label.id} ${trigger.id}-value`);
                list.setAttribute('aria-labelledby', label.id);
            } else trigger.setAttribute('aria-label', select.getAttribute('aria-label') || 'Playlist');
            const symbol = document.createElement('i'); symbol.className = 'fas fa-music music-select-symbol'; symbol.setAttribute('aria-hidden', 'true');
            const value = document.createElement('span'); value.className = 'music-select-value'; value.id = `${trigger.id}-value`;
            const count = document.createElement('span'); count.className = 'music-select-count';
            const chevron = document.createElement('i'); chevron.className = 'fas fa-chevron-down music-select-chevron'; chevron.setAttribute('aria-hidden', 'true');
            trigger.append(symbol, value, count, chevron); root.append(trigger, list); select.after(root); select.hidden = true;
            let opened = false, active = -1, buffer = '', typedAt = 0;
            const options = () => [...select.options];
            function parts(option) {
                const match = /^(.*?)\s*·\s*(\d+)$/.exec(option?.textContent || '');
                return match ? { name: match[1], count: match[2] } : { name: option?.textContent || '—', count: '' };
            }
            function setActive(index, scroll = false) {
                active = index;
                [...list.children].forEach((node, i) => node.classList.toggle('is-active', i === active));
                const node = list.children[active];
                if (opened && node) {
                    trigger.setAttribute('aria-activedescendant', node.id);
                    if (scroll) {
                        const a = node.getBoundingClientRect(), b = list.getBoundingClientRect();
                        if (a.top < b.top) list.scrollTop -= b.top - a.top + 6;
                        else if (a.bottom > b.bottom) list.scrollTop += a.bottom - b.bottom + 6;
                    }
                } else trigger.removeAttribute('aria-activedescendant');
            }
            function setOpen(next) {
                if (next && select.disabled) return;
                if (next) closers.forEach(close => close());
                opened = next; root.classList.toggle('is-open', next); list.hidden = !next;
                trigger.setAttribute('aria-expanded', String(next));
                if (next) {
                    const rect = root.getBoundingClientRect(), bounds = panel.getBoundingClientRect();
                    const below = bounds.bottom - rect.bottom - 16, above = rect.top - bounds.top - 16;
                    const up = below < Math.min(list.scrollHeight, 216) && above > below;
                    list.dataset.side = up ? 'up' : 'down';
                    list.style.maxHeight = `${Math.max(80, Math.min(216, up ? above : below))}px`;
                    setActive(select.selectedIndex >= 0 && !select.options[select.selectedIndex]?.disabled ? select.selectedIndex : options().findIndex(option => !option.disabled), true);
                } else { buffer = ''; trigger.removeAttribute('aria-activedescendant'); }
            }
            function render() {
                setOpen(false);
                const selected = parts(select.selectedOptions[0]);
                value.textContent = selected.name; count.textContent = selected.count; count.hidden = !selected.count;
                symbol.classList.toggle('fa-shuffle', select.value === 'random'); symbol.classList.toggle('fa-music', select.value !== 'random');
                trigger.disabled = select.disabled;
                list.replaceChildren(...options().map((option, index) => {
                    const item = document.createElement('div'), text = parts(option);
                    item.className = 'music-select-option'; item.id = `${select.id}-option-${index}`; item.dataset.index = index;
                    item.setAttribute('role', 'option'); item.setAttribute('aria-selected', String(option.selected)); item.setAttribute('aria-disabled', String(option.disabled));
                    const check = document.createElement('i'); check.className = 'fas fa-check music-select-check'; check.setAttribute('aria-hidden', 'true');
                    const name = document.createElement('span'); name.className = 'music-select-value'; name.textContent = text.name;
                    const badge = document.createElement('span'); badge.className = 'music-select-count'; badge.textContent = text.count; badge.hidden = !text.count;
                    item.append(check, name, badge); return item;
                }));
            }
            function commit(index) {
                if (!select.options[index] || select.options[index].disabled) return;
                select.selectedIndex = index; setOpen(false);
                select.dispatchEvent(new Event('change', { bubbles: true }));
            }
            on(select, 'change', render);
            on(trigger, 'click', () => setOpen(!opened));
            on(trigger, 'keydown', event => {
                const available = options().map((option, index) => option.disabled ? -1 : index).filter(index => index >= 0);
                if (!available.length || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
                if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
                    event.preventDefault();
                    if (!opened) { setOpen(true); if (event.key.startsWith('Arrow')) return; }
                    const position = available.indexOf(active);
                    const index = event.key === 'Home' ? available[0] : event.key === 'End' ? available.at(-1) : available[(position + (event.key === 'ArrowDown' ? 1 : -1) + available.length) % available.length];
                    setActive(index, true);
                } else if (event.key === 'Escape' && opened) {
                    event.preventDefault(); event.stopPropagation(); setOpen(false);
                } else if ((event.key === 'Enter' || event.key === ' ') && opened) {
                    event.preventDefault(); commit(active);
                } else if (event.key === 'Tab') setOpen(false);
                else if (event.key.length === 1 && event.key !== ' ') {
                    event.preventDefault();
                    if (!opened) setOpen(true);
                    const now = performance.now(); buffer = now - typedAt < 700 ? buffer + event.key : event.key; typedAt = now;
                    const match = available.find(index => select.options[index].textContent.toLocaleLowerCase().startsWith(buffer.toLocaleLowerCase()));
                    if (match !== undefined) setActive(match, true);
                }
            });
            on(list, 'pointerdown', event => event.preventDefault());
            on(list, 'pointermove', event => {
                const option = event.target.closest('[role="option"]');
                if (option && option.getAttribute('aria-disabled') !== 'true') setActive(Number(option.dataset.index));
            });
            on(list, 'click', event => {
                const option = event.target.closest('[role="option"]');
                if (option) commit(Number(option.dataset.index));
            });
            on(root, 'focusout', event => { if (!root.contains(event.relatedTarget)) setOpen(false); });
            on(document, 'pointerdown', event => { if (!root.contains(event.target)) setOpen(false); });
            on(window, 'resize', () => setOpen(false));
            const observer = new MutationObserver(render);
            observer.observe(select, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['disabled', 'selected'] });
            const close = () => setOpen(false); closers.push(close);
            cleanups.push(() => { observer.disconnect(); root.remove(); select.hidden = false; if (label) label.htmlFor = select.id; });
            render();
        });
        const panelObserver = new MutationObserver(() => { if (!panel.classList.contains('active')) closers.forEach(close => close()); });
        panelObserver.observe(panel, { attributes: true, attributeFilter: ['class'] });
        dispose = () => { events.abort(); panelObserver.disconnect(); cleanups.forEach(cleanup => cleanup()); };
    }
    init();
    window.addEventListener('pagehide', () => dispose());
    window.addEventListener('pageshow', init);
})();
