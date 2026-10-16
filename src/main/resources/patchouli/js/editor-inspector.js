/*
 * form widgets and the book/category/entry/page panels
 */
'use strict';

// inspector widgets

function fld(label, input, className) {
    const field = h('div', 'fld' + (className ? ' ' + className : ''));
    const labelElement = h('label', null, { text: label });
    if (className === 'check') {
        field.append(input, labelElement);
    } else {
        field.append(labelElement, input);
    }
    return field;
}

function textF(label, object, key, options) {
    options = options || {};
    const input = h('input', null, {
        type: 'text',
        value: object[key] == null ? '' : String(object[key]),
        placeholder: options.ph || ''
    });
    input.addEventListener('input', () => {
        if (options.deferCommit) {
            return;
        }
        object[key] = input.value;
        if (!options.noBook) {
            renderBook();
        }
    });
    if (options.onChange) {
        const commit = () => options.onChange(input);
        input.addEventListener('change', commit);
        if (options.deferCommit) {
            input.commitGuidebookValue = commit;
        }
    }
    return fld(label, input);
}

function numF(label, object, key, step) {
    const input = h('input', null, { type: 'number', value: object[key], step: step || 1 });
    input.addEventListener('input', () => {
        const v = parseFloat(input.value);
        object[key] = isNaN(v) ? 0 : step ? v : Math.trunc(v);
        renderBook();
    });
    return fld(label, input);
}

function checkF(label, object, key, after) {
    const input = h('input', null, { type: 'checkbox', checked: !!object[key] });
    input.addEventListener('change', () => {
        object[key] = input.checked;
        renderBook();
        if (after) {
            after();
        }
    });
    return fld(label, input, 'check');
}
let activeCustomSelect = null;

function closeCustomSelect() {
    if (!activeCustomSelect) {
        return;
    }
    const { popup, onClose } = activeCustomSelect;
    if (popup && popup.parentNode) {
        popup.parentNode.removeChild(popup);
    }
    if (onClose) {
        onClose();
    }
    activeCustomSelect = null;
}
document.addEventListener('mousedown', e => {
    if (activeCustomSelect && !e.target.closest('.csel-popup, .csel-box')) {
        closeCustomSelect();
    }
});
document.addEventListener(
    'scroll',
    e => {
        if (
            activeCustomSelect &&
            !(activeCustomSelect.popup && activeCustomSelect.popup.contains(e.target))
        ) {
            closeCustomSelect();
        }
    },
    true
);
window.addEventListener('resize', closeCustomSelect);

function selF(label, object, key, options, after) {
    const asString = v => (v == null ? '' : String(v));
    const wrap = h('div', 'csel');
    const box = h('div', 'csel-box', { tabIndex: 0 });
    wrap.appendChild(box);
    const normalizedOptions = options.map(o =>
        Array.isArray(o)
            ? { value: o[0], label: String(o[1] != null ? o[1] : o[0]), preview: o[2] || '' }
            : { value: o, label: String(o) }
    );
    const currentValue = asString(object[key]);
    if (currentValue && !normalizedOptions.some(o => String(o.value) === currentValue)) {
        normalizedOptions.push({ value: currentValue, label: currentValue });
    }
    function updateLabel() {
        const c = asString(object[key]);
        const found = normalizedOptions.find(o => String(o.value) === c);
        const text = found ? found.label : c || '(none)';
        box.replaceChildren(h('span', 'csel-label', { text }), h('span', 'csel-arrow'));
        if (found?.preview) {
            box.prepend(h('img', 'csel-preview', { src: found.preview, alt: '' }));
        }
        box.title = text;
    }
    updateLabel();
    function openPopup() {
        if (activeCustomSelect && activeCustomSelect.box === box) {
            closeCustomSelect();
            return;
        }
        closeCustomSelect();
        const curVal = asString(object[key]);
        const rect = box.getBoundingClientRect();
        const popup = h('div', 'csel-popup');
        popup.style.width = rect.width + 'px';
        popup.style.left = rect.left + 'px';
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const targetMaxH = 220;
        if (spaceBelow < targetMaxH && spaceAbove > spaceBelow) {
            popup.style.bottom = window.innerHeight - rect.top + 2 + 'px';
            popup.style.maxHeight = Math.min(targetMaxH, spaceAbove - 10) + 'px';
        } else {
            popup.style.top = rect.bottom + 2 + 'px';
            popup.style.maxHeight = Math.min(targetMaxH, spaceBelow - 10) + 'px';
        }
        const searchWrap = h('div', 'csel-search-wrap');
        const searchInput = h('input', 'csel-search-input', {
            type: 'text',
            placeholder: 'Search...'
        });
        searchWrap.appendChild(searchInput);
        const optsList = h('div', 'csel-opts');
        popup.append(searchWrap, optsList);
        let filtered = normalizedOptions.slice();
        let activeIdx = -1;
        function updateActiveOption() {
            optsList
                .querySelectorAll('.csel-opt')
                .forEach((c, i) => c.classList.toggle('active', i === activeIdx));
        }
        function scrollActiveIntoView() {
            const activeEl = optsList.querySelectorAll('.csel-opt')[activeIdx];
            if (activeEl && activeEl.scrollIntoView) {
                activeEl.scrollIntoView({ block: 'nearest' });
            }
        }
        function renderOptions() {
            optsList.textContent = '';
            if (filtered.length === 0) {
                optsList.appendChild(h('div', 'csel-empty', { text: 'No matches found' }));
                activeIdx = -1;
                return;
            }
            if (activeIdx < 0 || activeIdx >= filtered.length) {
                const curIdx = filtered.findIndex(o => String(o.value) === curVal);
                activeIdx = curIdx >= 0 ? curIdx : 0;
            }
            filtered.forEach((o, i) => {
                const cls =
                    'csel-opt' +
                    (String(o.value) === curVal ? ' selected' : '') +
                    (i === activeIdx ? ' active' : '');
                const optEl = h('div', cls, {
                    text: o.label,
                    title: o.label + (o.value && o.value !== o.label ? ' (' + o.value + ')' : '')
                });
                if (o.preview) {
                    optEl.classList.add('has-preview');
                    optEl.replaceChildren(
                        h('img', 'csel-preview', { src: o.preview, alt: '' }),
                        h('span', 'csel-label', { text: o.label })
                    );
                }
                optEl.addEventListener('mousedown', ev => {
                    ev.preventDefault();
                    selectValue(o.value);
                });
                optEl.addEventListener('mouseenter', () => {
                    activeIdx = i;
                    updateActiveOption();
                });
                optsList.appendChild(optEl);
            });
            scrollActiveIntoView();
        }
        function selectValue(val) {
            object[key] = val;
            updateLabel();
            closeCustomSelect();
            renderBook();
            if (after) {
                after();
            }
            box.focus();
        }
        searchInput.addEventListener('input', () => {
            const q = searchInput.value.trim().toLowerCase();
            filtered = q
                ? normalizedOptions.filter(
                      o =>
                          o.label.toLowerCase().includes(q) ||
                          (o.value != null && String(o.value).toLowerCase().includes(q))
                  )
                : normalizedOptions.slice();
            activeIdx = -1;
            renderOptions();
        });
        searchInput.addEventListener('keydown', ev => {
            const n = filtered.length;
            switch (ev.key) {
                case 'ArrowDown':
                case 'ArrowUp':
                    ev.preventDefault();
                    if (n > 0) {
                        activeIdx = (activeIdx + (ev.key === 'ArrowDown' ? 1 : -1) + n) % n;
                        updateActiveOption();
                        scrollActiveIntoView();
                    }
                    break;
                case 'Enter':
                    ev.preventDefault();
                    if (n > 0) {
                        selectValue(
                            filtered[activeIdx >= 0 && activeIdx < n ? activeIdx : 0].value
                        );
                    }
                    break;
                case 'Escape':
                    ev.preventDefault();
                    closeCustomSelect();
                    box.focus();
                    break;
                case 'Tab':
                    closeCustomSelect();
                    break;
            }
        });
        document.body.appendChild(popup);
        activeCustomSelect = { box, popup, onClose: () => box.classList.remove('open') };
        box.classList.add('open');
        renderOptions();
        requestAnimationFrame(() => searchInput.focus());
    }
    box.addEventListener('click', openPopup);
    box.addEventListener('keydown', ev => {
        if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(ev.key)) {
            ev.preventDefault();
            openPopup();
        }
    });
    return label ? fld(label, wrap) : wrap;
}

function colorF(label, object, key) {
    const wrap = h('div', 'colorrow');
    const colorInput = h('input', null, { type: 'color', value: '#' + hex6(object[key]) });
    const textInput = h('input', null, {
        type: 'text',
        value: hex6(object[key]).toUpperCase(),
        style: 'width:80px'
    });
    colorInput.addEventListener('input', () => {
        object[key] = colorInput.value.slice(1).toUpperCase();
        textInput.value = object[key];
        renderBook();
    });
    textInput.addEventListener('change', () => {
        object[key] = hex6(textInput.value).toUpperCase();
        colorInput.value = '#' + object[key];
        textInput.value = object[key];
        renderBook();
    });
    wrap.append(colorInput, textInput);
    return fld(label, wrap);
}

function itemF(label, object, key, after) {
    const wrapper = h('div', 'itemfield');
    const itemSlot = h('div', 'islot big' + (object[key] ? '' : ' empty'), { title: 'Pick item' });
    itemSlot.appendChild(icoEl(object[key]));
    const input = h('input', null, {
        type: 'text',
        value: object[key] || '',
        placeholder: 'minecraft:book'
    });
    input.addEventListener('input', () => {
        object[key] = input.value;
        renderBook();
    });
    input.addEventListener('change', () => {
        if (after) {
            after();
        }
    });
    itemSlot.addEventListener('click', () =>
        pickItem(v => {
            object[key] = v;
            renderBook();
            if (after) {
                after();
            }
            renderInspector();
        })
    );
    wrapper.append(itemSlot, input);
    return fld(label, wrapper);
}

function areaF(label, object, key) {
    const textarea = h('textarea', null, { value: object[key] || '' });
    textarea.addEventListener('input', () => {
        object[key] = textarea.value;
        renderBook();
    });
    return fld(label, textarea);
}
const sectionState = {}; // remember open/closed state per section, to survive inspector rebuilds

function section(title, open) {
    const key = view.mode + '|' + title.split(':')[0];
    const details = h('details', 'sec');
    details.open = key in sectionState ? sectionState[key] : !!open;
    details.addEventListener('toggle', () => {
        sectionState[key] = details.open;
    });
    const body = h('div', 'sec-body');
    details.append(h('summary', null, { text: title }), body);
    details._body = body;
    return details;
}

function listF(label, values, placeholder) {
    const wrapper = h('div');
    values.forEach((v, i) => {
        const r = h('div', 'macro-row');
        const inp = h('input', null, { type: 'text', value: v, placeholder: placeholder || '' });
        inp.addEventListener('input', () => {
            values[i] = inp.value;
            renderBook();
        });
        r.append(
            inp,
            h('button', 'btn small', {
                text: '\u2715',
                onclick: () => {
                    values.splice(i, 1);
                    renderAll();
                }
            })
        );
        wrapper.appendChild(r);
    });
    wrapper.appendChild(
        h('button', 'btn small', {
            text: '+ Add',
            onclick: () => {
                values.push('');
                renderInspector();
            }
        })
    );
    return fld(label, wrapper);
}

function imageListF(page) {
    const wrapper = h('div');
    const options = [['', 'Choose texture']].concat(
        bridgeList('getScreenTexturesJSON', 'screen textures', [])
    );
    page.images.forEach(value => {
        if (value && !options.some(o => o[0] === value)) {
            options.push([value, textureName(value), screenTextureURI(value)]);
        }
    });
    page.images.forEach((value, i) => {
        wrapper.appendChild(h('div', 'row macro-row image-row', null,
            selF('', page.images, i, options, () => {
                imagePageIndices.set(page, Math.max(0, page.images.slice(0, i + 1).filter(Boolean).length - 1));
                renderBook();
            }),
            h('button', 'btn small', {
                text: '\u2715', title: 'Remove image', 'aria-label': 'Remove image',
                onclick: () => {
                    page.images.splice(i, 1);
                    renderAll();
                }
            })
        ));
    });
    wrapper.appendChild(h('button', 'btn small', {
        text: '+ Add image',
        onclick: () => {
            page.images.push('');
            renderInspector();
        }
    }));
    if (options.length === 1) {
        wrapper.appendChild(h('div', 'ins-hint', { text: 'Import a screen texture to add an image.' }));
    }
    return fld('Images', wrapper);
}
// inspector

function renderInspector() {
    closeCustomSelect();
    const inspector = $('inspector');
    const scrollTop = inspector.scrollTop;
    inspector.textContent = '';
    if (view.mode === 'landing') {
        bookInspector(inspector);
    } else if (view.mode === 'category') {
        categoryInspector(inspector, findCat(view.cat));
    } else {
        const e = findEntry(view.entry);
        if (sel.kind === 'page' && e && e.pages[sel.page]) {
            pageInspector(inspector, e, sel.page);
        }
        if (e) {
            entryInspector(inspector, e, sel.kind !== 'page');
        }
    }
    inspector.scrollTop = scrollTop;
}

function bridgeList(method, what, fallback) {
    if (window.javabridge) {
        try {
            const raw = window.javabridge[method]();
            const list = Array.isArray(raw)
                ? raw
                : typeof raw === 'string'
                  ? JSON.parse(raw)
                  : null;
            if (Array.isArray(list) && list.length > 0) {
                return list;
            }
        } catch (e) {
            console.error('Failed to load ' + what + ' from bridge', e);
        }
    }
    return fallback;
}

function getCreativeTabOptions() {
    return bridgeList('getCreativeTabsJSON', 'creative tabs', [['', 'No creative tab']]);
}

function getAdvancementOptions() {
    return bridgeList('getAdvancementsJSON', 'advancements', [['', 'No advancement']]);
}

function getSoundOptions() {
    return bridgeList('getSoundsJSON', 'sounds', [['', 'Default sound']]);
}

function bookInspector(inspector) {
    inspector.appendChild(h('div', 'ins-title', { text: 'Book Settings' }));
    let settingsSection = section('General', true);
    settingsSection._body.append(
        textF('Edition / version (0 = none)', gb, 'version', { ph: '0' }),
        selF('Creative tab', gb, 'creativeTab', getCreativeTabOptions()),
        checkF('Pamphlet (single category)', gb, 'pamphlet'),
        selF('Advancements root tab', gb, 'advancementsTab', getAdvancementOptions()),
        itemF('Index icon', gb, 'indexIcon')
    );
    inspector.appendChild(settingsSection);
    settingsSection = section('Appearance', false);
    const colors = BOOK_COLORS.map(c => [
        'patchouli:textures/gui/book_' + c + '.png',
        c[0].toUpperCase() + c.slice(1) + ' book'
    ]);
    settingsSection._body.append(
        selF('Book texture', gb, 'bookTexture', colors, () => {
            const m = /book_([a-z]+)\.png/.exec(gb.bookTexture);
            if (m) {
                gb.model = 'patchouli:book_' + m[1];
            }
            renderInspector();
        }),
        textF('Book item model', gb, 'model', { noBook: true }),
        textF('Filler texture', gb, 'fillerTexture', {
            noBook: true,
            ph: 'modid:textures/gui/filler.png'
        }),
        textF('Crafting texture', gb, 'craftingTexture', {
            noBook: true,
            ph: 'modid:textures/gui/crafting.png'
        }),
        colorF('Text color', gb, 'textColor'),
        colorF('Header color', gb, 'headerColor'),
        colorF('Nameplate color', gb, 'nameplateColor'),
        colorF('Link color', gb, 'linkColor'),
        colorF('Link hover color', gb, 'linkHoverColor'),
        colorF('Progress bar color', gb, 'progressBarColor'),
        colorF('Progress bar background', gb, 'progressBarBackground'),
        checkF('Use vanilla (blocky) font', gb, 'useBlockyFont')
    );
    inspector.appendChild(settingsSection);
    settingsSection = section('Behavior', false);
    const sounds = getSoundOptions();
    settingsSection._body.append(
        checkF('Show progress bar', gb, 'showProgress'),
        checkF('Show toasts', gb, 'showToasts'),
        checkF('Pause game in singleplayer', gb, 'pauseGame'),
        selF('Text overflow', gb, 'textOverflowMode', ['overflow', 'resize', 'truncate']),
        selF('Open sound', gb, 'openSound', sounds),
        selF('Flip sound', gb, 'flipSound', sounds)
    );
    inspector.appendChild(settingsSection);
    settingsSection = section('Obtaining the book', false);
    settingsSection._body.append(
        checkF('Give on first world join', gb, 'giveOnFirstJoin'),
        checkF('Crafting recipe', gb, 'hasRecipe', renderInspector)
    );
    if (gb.hasRecipe) {
        recipeEditor(settingsSection._body);
    }
    inspector.appendChild(settingsSection);
}

function recipeEditor(parent) {
    const getSlots = () => {
        const a = (gb.recipeIngredients || []).slice(0, 9);
        while (a.length < 9) {
            a.push('');
        }
        return a;
    };
    const store = a => {
        gb.recipeIngredients = gb.recipeType === 'shaped' ? a : a.filter(x => x && x.trim());
    };
    parent.appendChild(
        selF(
            'Recipe type',
            gb,
            'recipeType',
            [
                ['shapeless', 'Shapeless'],
                ['shaped', 'Shaped (3\u00D73)']
            ],
            () => {
                store(getSlots());
                renderInspector();
            }
        )
    );
    const grid = h('div', null, {
        style: 'display:grid;grid-template-columns:repeat(3,22px);gap:2px;margin:4px 0 6px'
    });
    const slots = getSlots();
    slots.forEach((v, i) => {
        const s = h('div', 'islot big' + (v ? '' : ' empty'), {
            title: v || 'empty (left-click pick, right-click clear)'
        });
        if (i === recipeSlot) {
            s.style.outline = '2px solid var(--accent)';
        }
        s.appendChild(icoEl(v));
        s.addEventListener('click', () => {
            recipeSlot = i;
            pickItem(val => {
                const a = getSlots();
                a[i] = val;
                store(a);
                renderInspector();
            });
            renderInspector();
        });
        s.addEventListener('contextmenu', ev => {
            ev.preventDefault();
            const a = getSlots();
            a[i] = '';
            store(a);
            renderInspector();
        });
        grid.appendChild(s);
    });
    parent.appendChild(grid);
    const input = h('input', null, {
        type: 'text',
        value: slots[recipeSlot] || '',
        placeholder: 'slot ' + (recipeSlot + 1) + ': item id or #tag'
    });
    input.addEventListener('change', () => {
        const a = getSlots();
        a[recipeSlot] = input.value.trim();
        store(a);
        renderInspector();
    });
    parent.appendChild(fld('Selected slot', input));
    if (gb.recipeType !== 'shaped') {
        parent.appendChild(
            h('div', 'ins-hint', { text: 'Shapeless: slot positions do not matter.' })
        );
    }
}

function categoryInspector(inspector, category) {
    if (!category) {
        return;
    }
    inspector.appendChild(
        h('div', 'ins-title', { text: 'Category: ' + (category.name || category.id) })
    );
    const settingsSection = section('Category', true);
    const parents = [['', '(none - root)']].concat(
        gb.categories.filter(x => canSetCategoryParent(category, x.id)).map(x => [x.id, x.name || x.id])
    );
    settingsSection._body.append(
        textF('Id', category, 'id', {
            noBook: true,
            deferCommit: true,
            onChange: i => {
                const nid = uniqueId(
                    sanitizeId(i.value) || 'category',
                    gb.categories.filter(x => x !== category)
                );
                const old = category.id;
                category.id = nid;
                gb.entries.forEach(e => {
                    if (bare(e.category) === old) {
                        e.category = nid;
                    }
                });
                gb.categories.forEach(x => {
                    if (bare(x.parent) === old) {
                        x.parent = nid;
                    }
                });
                if (view.cat === old) {
                    view.cat = nid;
                }
                renderAll();
            }
        }),
        textF('Name', category, 'name'),
        itemF('Icon', category, 'icon'),
        selF('Parent category', category, 'parent', parents, () => {
            if (!canSetCategoryParent(category, category.parent)) {
                category.parent = '';
                renderAll();
            } else {
                renderBreadcrumb();
            }
        }),
        numF('Sort number', category, 'sortnum'),
        checkF('Secret (hidden until unlocked)', category, 'secret')
    );
    inspector.appendChild(settingsSection);
    const row = h('div', 'row');
    row.appendChild(
        dangerBtn('Delete category', () => {
            gb.entries = gb.entries.filter(e => bare(e.category) !== category.id);
            gb.categories = gb.categories.filter(x => x !== category);
            gb.categories.forEach(x => {
                if (bare(x.parent) === category.id) {
                    x.parent = '';
                }
            });
            go(category.parent ? 'category' : 'landing', bare(category.parent));
        })
    );
    inspector.appendChild(row);
}

function entryInspector(inspector, entry, open) {
    const settingsSection = section('Entry: ' + (entry.name || entry.id), open);
    const categories = gb.categories.map(c => [c.id, c.name || c.id]);
    settingsSection._body.append(
        textF('Id', entry, 'id', {
            noBook: true,
            deferCommit: true,
            onChange: i => {
                const nid = uniqueId(
                    sanitizeId(i.value) || 'entry',
                    gb.entries.filter(x => x !== entry)
                );
                const old = entry.id;
                entry.id = nid;
                gb.entries.forEach(x =>
                    x.pages.forEach(p => {
                        p.entries = p.entries.map(r =>
                            r === old ? nid : r === modId() + ':' + old ? modId() + ':' + nid : r
                        );
                    })
                );
                if (view.entry === old) {
                    view.entry = nid;
                }
                renderAll();
            }
        }),
        textF('Name', entry, 'name', { onChange: () => renderAll() }),
        itemF('Icon', entry, 'icon'),
        selF('Category', entry, 'category', categories),
        selF('Advancement lock', entry, 'advancement', getAdvancementOptions()),
        selF('Quest turn-in advancement', entry, 'turnin', getAdvancementOptions()),
        numF('Sort number', entry, 'sortnum'),
        colorF('Entry color', entry, 'entryColor'),
        checkF('Priority (italic, pinned first)', entry, 'priority'),
        checkF('Secret', entry, 'secret'),
        checkF('Read by default', entry, 'readByDefault')
    );
    const row = h('div', 'row');
    row.append(
        h('button', 'btn small', {
            text: 'Duplicate',
            onclick: () => {
                const c = JSON.parse(JSON.stringify(entry));
                c.id = uniqueId(entry.id + '_copy', gb.entries);
                gb.entries.push(c);
                go('entry', bare(c.category), c.id);
            }
        }),
        dangerBtn('Delete entry', () => {
            gb.entries = gb.entries.filter(x => x !== entry);
            go('category', bare(entry.category));
        })
    );
    settingsSection._body.appendChild(row);
    inspector.appendChild(settingsSection);
}

function pageInspector(inspector, entry, pageIndex) {
    const page = entry.pages[pageIndex];
    inspector.appendChild(h('div', 'ins-title', { text: 'Page ' + (pageIndex + 1) }));
    const settingsSection = section('Page', true);
    const body = settingsSection._body;
    body.appendChild(selF('Type', page, 'type', PAGE_TYPES, () => renderAll()));
    switch (page.type.slice(10)) {
        case 'text':
            if (isEntryTitlePage(entry, page)) {
                body.appendChild(
                    fld(
                        'Title',
                        h('input', null, {
                            type: 'text',
                            value: entry.name || entry.id,
                            readonly: true
                        })
                    )
                );
            } else {
                body.appendChild(textF('Title', page, 'title'));
            }
            break;
        case 'relations':
            body.appendChild(textF('Title', page, 'title'));
            break;
        case 'image':
            body.append(
                textF('Title', page, 'title'),
                imageListF(page),
                checkF('Draw border', page, 'border')
            );
            break;
        case 'crafting':
        case 'smelting':
            body.append(
                textF('Title', page, 'title'),
                textF('Recipe id', page, 'recipe', { ph: 'modid:recipe' }),
                textF('Second recipe id', page, 'recipe2')
            );
            break;
        case 'multiblock':
            body.append(
                textF('Name', page, 'name'),
                checkF('Allow visualize button', page, 'enableVisualize'),
                h('button', 'btn', {
                    text: 'Design structure...',
                    onclick: () => openMultiblock(page)
                })
            );
            break;
        case 'entity':
            body.append(
                textF('Entity id', page, 'entity', { ph: 'minecraft:pig' }),
                textF('Name', page, 'name'),
                numF('Scale', page, 'scale', 0.1),
                numF('Offset', page, 'offset', 0.1),
                checkF('Rotate', page, 'rotate'),
                numF('Default rotation', page, 'defaultRotation', 1)
            );
            break;
        case 'spotlight':
            body.append(
                itemF('Item', page, 'item'),
                textF('Title', page, 'title'),
                checkF('Link recipe', page, 'linkRecipe')
            );
            break;
        case 'link':
            body.append(
                textF('Title', page, 'title'),
                textF('URL', page, 'url'),
                textF('Button text', page, 'linkText')
            );
            break;
        case 'quest':
            body.append(
                textF('Title', page, 'title'),
                selF('Trigger advancement', page, 'trigger', getAdvancementOptions())
            );
            break;
        case 'empty':
            body.appendChild(checkF('Draw filler', page, 'drawFiller'));
            break;
    }
    body.appendChild(selF('Advancement lock', page, 'advancement', getAdvancementOptions()));
    inspector.appendChild(settingsSection);
    const row = h('div', 'row', { style: 'margin-bottom:8px' });
    row.append(
        h('button', 'btn small', {
            text: '\u2039 Move',
            onclick: () => movePage(entry, pageIndex, -1)
        }),
        h('button', 'btn small', {
            text: 'Move \u203A',
            onclick: () => movePage(entry, pageIndex, 1)
        }),
        h('button', 'btn small', {
            text: 'Duplicate',
            onclick: () => {
                entry.pages.splice(pageIndex + 1, 0, JSON.parse(JSON.stringify(page)));
                sel.page = pageIndex + 1;
                view.spread = Math.floor((pageIndex + 1) / 2);
                renderAll();
            }
        }),
        dangerBtn('Delete', () => {
            entry.pages.splice(pageIndex, 1);
            sel = { kind: 'entry', page: -1 };
            view.spread = Math.min(view.spread, Math.floor(entry.pages.length / 2));
            renderAll();
        })
    );
    inspector.appendChild(row);
}

function movePage(entry, pageIndex, direction) {
    const targetIndex = pageIndex + direction;
    if (targetIndex < 0 || targetIndex >= entry.pages.length) {
        return;
    }
    [entry.pages[pageIndex], entry.pages[targetIndex]] = [
        entry.pages[targetIndex],
        entry.pages[pageIndex]
    ];
    sel.page = targetIndex;
    view.spread = Math.floor(targetIndex / 2);
    renderAll();
}