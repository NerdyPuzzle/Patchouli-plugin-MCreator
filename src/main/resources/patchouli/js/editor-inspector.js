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
            placeholder: window.javabridge.t('elementgui.guidebook.dropdown_search')
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
                optsList.appendChild(h('div', 'csel-empty', { text: window.javabridge.t('elementgui.guidebook.dropdown_no_results') }));
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
            text: window.javabridge.t('elementgui.guidebook.add_list_entry'),
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
        window.javabridge.getScreenTexturesJSON()
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
                text: '\u2715',
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
        wrapper.appendChild(h('div', 'ins-hint', { text: window.javabridge.t('elementgui.guidebook.no_images_found') }));
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

function getCreativeTabOptions() {
    return window.javabridge.getCreativeTabsJSON();
}

function getAdvancementOptions() {
    return window.javabridge.getAdvancementsJSON();
}

function getSoundOptions() {
    return window.javabridge.getSoundsJSON();
}

function bookInspector(inspector) {
    inspector.appendChild(h('div', 'ins-title', { text: window.javabridge.t('elementgui.guidebook.book_settings') }));
    let settingsSection = section(window.javabridge.t('elementgui.guidebook.general'), true);
    settingsSection._body.append(
        textF(window.javabridge.t('elementgui.guidebook.edition'), gb, 'version', { ph: '0' }),
        selF(window.javabridge.t('elementgui.guidebook.creative_tab'), gb, 'creativeTab', getCreativeTabOptions()),
        checkF(window.javabridge.t('elementgui.guidebook.pamphlet'), gb, 'pamphlet'),
        selF(window.javabridge.t('elementgui.guidebook.advancements_root'), gb, 'advancementsTab', getAdvancementOptions()),
        itemF(window.javabridge.t('elementgui.guidebook.index_icon'), gb, 'indexIcon')
    );
    inspector.appendChild(settingsSection);
    settingsSection = section(window.javabridge.t('elementgui.guidebook.book_appearance'), false);
    const colors = BOOK_COLORS.map(c => [
        'patchouli:textures/gui/book_' + c + '.png',
        c[0].toUpperCase() + c.slice(1) + ' book'
    ]);
    settingsSection._body.append(
        selF(window.javabridge.t('elementgui.guidebook.book_texture'), gb, 'bookTexture', colors),
        selF(window.javabridge.t('elementgui.guidebook.item_model'), gb, 'itemModelType', [
            ['default', window.javabridge.t('elementgui.guidebook.item_default')],
            ['texture', window.javabridge.t('elementgui.guidebook.item_texture')],
            ['json', window.javabridge.t('elementgui.guidebook.item_json')]
        ], renderInspector)
    );
    if (gb.itemModelType === 'texture') {
        const textures = window.javabridge.getItemTexturesJSON();
        settingsSection._body.appendChild(selF('Item texture', gb, 'itemTexture',
            [['', 'Choose item texture']].concat(textures)));
    } else if (gb.itemModelType === 'json') {
        const models = window.javabridge.getJSONModelsJSON();
        settingsSection._body.appendChild(selF('JSON model', gb, 'customModelName',
            [['', 'Choose JSON model']].concat(models)));
    }
    settingsSection._body.append(
        textF(window.javabridge.t('elementgui.guidebook.filler_texture'), gb, 'fillerTexture', {
            noBook: true,
            ph: 'modid:textures/gui/filler.png'
        }),
        textF(window.javabridge.t('elementgui.guidebook.crafting_texture'), gb, 'craftingTexture', {
            noBook: true,
            ph: 'modid:textures/gui/crafting.png'
        }),
        colorF(window.javabridge.t('elementgui.guidebook.text_color'), gb, 'textColor'),
        colorF(window.javabridge.t('elementgui.guidebook.header_color'), gb, 'headerColor'),
        colorF(window.javabridge.t('elementgui.guidebook.nameplate_color'), gb, 'nameplateColor'),
        colorF(window.javabridge.t('elementgui.guidebook.link_color'), gb, 'linkColor'),
        colorF(window.javabridge.t('elementgui.guidebook.link_hover_color'), gb, 'linkHoverColor'),
        colorF(window.javabridge.t('elementgui.guidebook.progress_bar_color'), gb, 'progressBarColor'),
        colorF(window.javabridge.t('elementgui.guidebook.progress_bar_background'), gb, 'progressBarBackground'),
        checkF(window.javabridge.t('elementgui.guidebook.use_vanilla_font'), gb, 'useBlockyFont')
    );
    inspector.appendChild(settingsSection);
    settingsSection = section(window.javabridge.t('elementgui.guidebook.behavior'), false);
    const sounds = getSoundOptions();
    settingsSection._body.append(
        checkF(window.javabridge.t('elementgui.guidebook.show_progress_bar'), gb, 'showProgress'),
        checkF(window.javabridge.t('elementgui.guidebook.show_toasts'), gb, 'showToasts'),
        checkF(window.javabridge.t('elementgui.guidebook.pause_singleplayer'), gb, 'pauseGame'),
        selF(window.javabridge.t('elementgui.guidebook.text_overflow'), gb, 'textOverflowMode', ['overflow', 'resize', 'truncate']),
        selF(window.javabridge.t('elementgui.guidebook.open_sound'), gb, 'openSound', sounds),
        selF(window.javabridge.t('elementgui.guidebook.flip_sound'), gb, 'flipSound', sounds)
    );
    inspector.appendChild(settingsSection);
    settingsSection = section(window.javabridge.t('elementgui.guidebook.obtaining'), false);
    settingsSection._body.append(
        checkF(window.javabridge.t('elementgui.guidebook.give_on_join'), gb, 'giveOnFirstJoin'),
        checkF(window.javabridge.t('elementgui.guidebook.book_recipe'), gb, 'hasRecipe', renderInspector)
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
            window.javabridge.t('elementgui.guidebook.recipe_type'),
            gb,
            'recipeType',
            [
                ['shapeless', window.javabridge.t('elementgui.guidebook.shapeless_recipe')],
                ['shaped', window.javabridge.t('elementgui.guidebook.shaped_recipe')]
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
        const s = h('div', 'islot big' + (v ? '' : ' empty'));
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
    parent.appendChild(fld(window.javabridge.t('elementgui.guidebook.selected_slot'), input));
}

function categoryInspector(inspector, category) {
    if (!category) {
        return;
    }
    inspector.appendChild(
        h('div', 'ins-title', { text: window.javabridge.t('elementgui.guidebook.common_category') + ': ' + (category.name || category.id) })
    );
    const settingsSection = section(window.javabridge.t('elementgui.guidebook.common_category'), true);
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
        textF(window.javabridge.t('elementgui.guidebook.common_name'), category, 'name'),
        itemF(window.javabridge.t('elementgui.guidebook.common_icon'), category, 'icon'),
        selF(window.javabridge.t('elementgui.guidebook.parent_category'), category, 'parent', parents, () => {
            if (!canSetCategoryParent(category, category.parent)) {
                category.parent = '';
                renderAll();
            } else {
                renderBreadcrumb();
            }
        }),
        numF(window.javabridge.t('elementgui.guidebook.common_sortnum'), category, 'sortnum'),
        checkF(window.javabridge.t('elementgui.guidebook.secret_category'), category, 'secret')
    );
    inspector.appendChild(settingsSection);
    const row = h('div', 'row');
    row.appendChild(
        dangerBtn(window.javabridge.t('elementgui.guidebook.delete_category'), () => {
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
    const settingsSection = section(window.javabridge.t('elementgui.guidebook.common_entry') + ': ' + (entry.name || entry.id), open);
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
        textF(window.javabridge.t('elementgui.guidebook.common_name'), entry, 'name', { onChange: () => renderAll() }),
        itemF(window.javabridge.t('elementgui.guidebook.common_icon'), entry, 'icon'),
        selF(window.javabridge.t('elementgui.guidebook.common_category'), entry, 'category', categories),
        selF(window.javabridge.t('elementgui.guidebook.common_advancement'), entry, 'advancement', getAdvancementOptions()),
        selF(window.javabridge.t('elementgui.guidebook.entry_turnin'), entry, 'turnin', getAdvancementOptions()),
        numF(window.javabridge.t('elementgui.guidebook.common_sortnum'), entry, 'sortnum'),
        colorF(window.javabridge.t('elementgui.guidebook.entry_color'), entry, 'entryColor'),
        checkF(window.javabridge.t('elementgui.guidebook.entry_priority'), entry, 'priority'),
        checkF(window.javabridge.t('elementgui.guidebook.entry_secret'), entry, 'secret'),
        checkF(window.javabridge.t('elementgui.guidebook.entry_read'), entry, 'readByDefault')
    );
    const row = h('div', 'row');
    row.append(
        h('button', 'btn small', {
            text: window.javabridge.t('elementgui.guidebook.common_duplicate'),
            onclick: () => {
                const c = JSON.parse(JSON.stringify(entry));
                c.id = uniqueId(entry.id + '_copy', gb.entries);
                gb.entries.push(c);
                go('entry', bare(c.category), c.id);
            }
        }),
        dangerBtn(window.javabridge.t('elementgui.guidebook.entry_delete'), () => {
            gb.entries = gb.entries.filter(x => x !== entry);
            go('category', bare(entry.category));
        })
    );
    settingsSection._body.appendChild(row);
    inspector.appendChild(settingsSection);
}

function pageInspector(inspector, entry, pageIndex) {
    const page = entry.pages[pageIndex];
    inspector.appendChild(h('div', 'ins-title', { text: window.javabridge.t('elementgui.guidebook.common_page') + ': ' + (pageIndex + 1) }));
    const settingsSection = section(window.javabridge.t('elementgui.guidebook.common_page'), true);
    const body = settingsSection._body;
    body.appendChild(selF(window.javabridge.t('elementgui.guidebook.page_type'), page, 'type', PAGE_TYPES, () => renderAll()));
    switch (page.type.slice(10)) {
        case 'text':
            if (isEntryTitlePage(entry, page)) {
                body.appendChild(
                    fld(
                        window.javabridge.t('elementgui.guidebook.page_title'),
                        h('input', null, {
                            type: 'text',
                            value: entry.name || entry.id,
                            readonly: true
                        })
                    )
                );
            } else {
                body.appendChild(textF(window.javabridge.t('elementgui.guidebook.page_title'), page, 'title'));
            }
            break;
        case 'relations':
            body.appendChild(textF(window.javabridge.t('elementgui.guidebook.page_title'), page, 'title'));
            break;
        case 'image':
            body.append(
                textF(window.javabridge.t('elementgui.guidebook.page_title'), page, 'title'),
                imageListF(page),
                checkF(window.javabridge.t('elementgui.guidebook.image_border'), page, 'border')
            );
            break;
        case 'crafting':
        case 'smelting':
            body.append(
                textF(window.javabridge.t('elementgui.guidebook.page_title'), page, 'title'),
                textF(window.javabridge.t('elementgui.guidebook.recipe_id'), page, 'recipe', { ph: 'modid:recipe' }),
                textF(window.javabridge.t('elementgui.guidebook.second_recipe_id'), page, 'recipe2')
            );
            break;
        case 'multiblock':
            body.append(
                textF(window.javabridge.t('elementgui.guidebook.common_name'), page, 'name'),
                checkF(window.javabridge.t('elementgui.guidebook.visualize_button'), page, 'enableVisualize'),
                h('button', 'btn', {
                    text: window.javabridge.t('elementgui.guidebook.design_structure'),
                    onclick: () => openMultiblock(page)
                })
            );
            break;
        case 'entity':
            body.append(
                textF(window.javabridge.t('elementgui.guidebook.entity_id'), page, 'entity', { ph: 'minecraft:pig' }),
                textF(window.javabridge.t('elementgui.guidebook.common_name'), page, 'name'),
                numF(window.javabridge.t('elementgui.guidebook.entity_scale'), page, 'scale', 0.1),
                numF(window.javabridge.t('elementgui.guidebook.entity_offset'), page, 'offset', 0.1),
                checkF(window.javabridge.t('elementgui.guidebook.entity_rotate'), page, 'rotate'),
                numF(window.javabridge.t('elementgui.guidebook.entity_default_rot'), page, 'defaultRotation', 1)
            );
            break;
        case 'spotlight':
            body.append(
                itemF(window.javabridge.t('elementgui.guidebook.item_spotlight'), page, 'item'),
                textF(window.javabridge.t('elementgui.guidebook.page_title'), page, 'title'),
                checkF(window.javabridge.t('elementgui.guidebook.link_recipe'), page, 'linkRecipe')
            );
            break;
        case 'link':
            body.append(
                textF(window.javabridge.t('elementgui.guidebook.page_title'), page, 'title'),
                textF(window.javabridge.t('elementgui.guidebook.link_url'), page, 'url'),
                textF(window.javabridge.t('elementgui.guidebook.link_button_text'), page, 'linkText')
            );
            break;
        case 'quest':
            body.append(
                textF(window.javabridge.t('elementgui.guidebook.page_title'), page, 'title'),
                selF(window.javabridge.t('elementgui.guidebook.quest_advancement'), page, 'trigger', getAdvancementOptions())
            );
            break;
        case 'empty':
            body.appendChild(checkF(window.javabridge.t('elementgui.guidebook.draw_filler'), page, 'drawFiller'));
            break;
    }
    body.appendChild(selF(window.javabridge.t('elementgui.guidebook.common_advancement'), page, 'advancement', getAdvancementOptions()));
    inspector.appendChild(settingsSection);
    const row = h('div', 'row', { style: 'margin-bottom:8px' });
    row.append(
        h('button', 'btn small', {
            text: '\u2039 ' + window.javabridge.t('elementgui.guidebook.common_move'),
            onclick: () => movePage(entry, pageIndex, -1)
        }),
        h('button', 'btn small', {
            text: window.javabridge.t('elementgui.guidebook.common_move') + ' \u203A',
            onclick: () => movePage(entry, pageIndex, 1)
        }),
        h('button', 'btn small', {
            text: window.javabridge.t('elementgui.guidebook.common_duplicate'),
            onclick: () => {
                entry.pages.splice(pageIndex + 1, 0, JSON.parse(JSON.stringify(page)));
                sel.page = pageIndex + 1;
                view.spread = Math.floor((pageIndex + 1) / 2);
                renderAll();
            }
        }),
        dangerBtn(window.javabridge.t('elementgui.guidebook.page_delete'), () => {
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