/*
 * navigation, book/spread/page rendering and breadcrumb
 */
'use strict';

const SINGLE = { single: true };
const imagePageIndices = new WeakMap(); // preview position isn't saved with the page

// navigation

function go(mode, categoryId, entryId, spread) {
    view = { mode, cat: categoryId || '', entry: entryId || '', spread: spread || 0 };
    sel = { kind: { landing: 'book', category: 'category' }[mode] || 'entry', page: -1 };
    renderAll();
}

function goBack() {
    if (view.mode === 'entry') {
        const e = findEntry(view.entry);
        go('category', e ? bare(e.category) : '', '', 0);
    } else if (view.mode === 'category') {
        const c = findCat(view.cat);
        if (c && c.parent) {
            go('category', bare(c.parent), '', 0);
        } else {
            go('landing');
        }
    }
}

function totalSpreads() {
    if (view.mode === 'entry') {
        const e = findEntry(view.entry);
        return e ? Math.floor(e.pages.length / 2) + 1 : 1;
    }
    if (view.mode === 'category') {
        return (
            1 +
            Math.ceil(
                Math.max(0, sortedEntries(view.cat).length - ENTRIES_FIRST_SPREAD) /
                    (ENTRIES_PER_PAGE * 2)
            )
        );
    }
    return 1;
}

function addCategory(parent) {
    const category = newCategory(uniqueId('category', gb.categories));
    category.parent = parent || '';
    gb.categories.push(category);
    go('category', category.id);
}

function addEntry(categoryId) {
    const entry = newEntry(uniqueId('new_entry', gb.entries), categoryId);
    gb.entries.push(entry);
    go('entry', categoryId, entry.id);
}

function addPage(type) {
    const entry = curEntry();
    if (!entry) {
        return;
    }
    entry.pages.push(newPage(type));
    view.spread = Math.floor((entry.pages.length - 1) / 2);
    sel = { kind: 'page', page: entry.pages.length - 1 };
    renderAll();
}

function pageTypeMenu(event, onPick) {
    showPopup(
        event,
        PAGE_TYPES.map(t => ({ label: t[1], run: () => onPick(t[0]) }))
    );
}

// book rendering

function pageNode(book, side) {
    const page = h('div', 'page ' + side);
    const box = h('div', 'pg-box');
    page.appendChild(box);
    book.appendChild(page);
    return { pg: page, box };
}

function bookTextureFor() {
    const match = /book_([a-z]+)\.png/.exec(gb.bookTexture || '');
    const color = match && BOOK_COLORS.includes(match[1]) ? match[1] : 'brown';
    return new URL(
        '../themes/default_dark/images/patchouli/book_' + color + '.png',
        document.baseURI
    ).href;
}

function renderBook() {
    document.documentElement.style.setProperty(
        '--book-font',
        gb.useBlockyFont
            ? '"Guidebook Minecraft", "Guidebook Uniform", sans-serif'
            : '"Guidebook Uniform", sans-serif'
    );
    document.documentElement.style.setProperty('--book-font-size', '9px');
    document.documentElement.style.setProperty(
        '--book-title-font-size',
        gb.useBlockyFont ? '9px' : '7px'
    );
    document.documentElement.style.setProperty(
        '--book-control-font',
        gb.useBlockyFont
            ? '"Guidebook Minecraft Controls", "Guidebook Uniform", sans-serif'
            : '"Guidebook Uniform", sans-serif'
    );
    const host = $('bookHost');
    host.textContent = '';
    const book = h('div', 'book');
    book.style.setProperty('--book-texture', 'url("' + bookTextureFor() + '")');
    host.appendChild(book);
    if (view.mode === 'category' && !findCat(view.cat)) {
        view.mode = 'landing';
    }
    if (view.mode === 'entry' && !findEntry(view.entry)) {
        view.mode = view.cat ? 'category' : 'landing';
    }
    view.spread = Math.max(0, Math.min(view.spread, totalSpreads() - 1));
    book.classList.toggle('landing', view.mode === 'landing');
    book.classList.toggle('category-index', view.mode === 'category');
    const leftPage = pageNode(book, 'left');
    const rightPage = pageNode(book, 'right');
    if (view.mode === 'landing') {
        renderLanding(leftPage, rightPage);
    } else if (view.mode === 'category') {
        renderCategory(leftPage, rightPage);
    } else {
        renderEntry(leftPage, rightPage);
    }

    // chrome
    if (view.mode !== 'landing') {
        book.appendChild(h('div', 'nav back', { title: 'Back', onclick: goBack }));
    }
    if (view.spread > 0) {
        book.appendChild(
            h('div', 'nav prev', {
                title: 'Previous',
                onclick: () => {
                    view.spread--;
                    sel = { kind: view.mode, page: -1 };
                    renderAll();
                }
            })
        );
    }
    if (view.spread < totalSpreads() - 1) {
        book.appendChild(
            h('div', 'nav next', {
                title: 'Next',
                onclick: () => {
                    view.spread++;
                    sel = { kind: view.mode === 'entry' ? 'entry' : 'category', page: -1 };
                    renderAll();
                }
            })
        );
    }
    fit();
    // overflow markers
    const markOverflow = () =>
        book.querySelectorAll('.pt-text[data-max]').forEach(t => {
            t.classList.toggle('overflow', t.offsetHeight > parseInt(t.dataset.max, 10) + 1);
        });
    markOverflow();
    if (document.fonts) {
        document.fonts.ready.then(markOverflow);
    }
}

function fit() {
    const stage = $('stage');
    const zoom = Math.max(
        1,
        Math.min((stage.clientWidth - 6) / 308, (stage.clientHeight - 6) / 232, 5)
    );
    $('bookHost').style.zoom = Math.floor(zoom * 20) / 20;
}

// reusable page widgets
const inert = el => {
    el.style.pointerEvents = 'none';
    return el;
};
const ellipsize = el => {
    if (el.textContent) {
        el.title = el.textContent;
    }
    return el;
};

function bindEdit(element, object, key, options) {
    element.addEventListener('click', () =>
        startEdit(
            element,
            () => object[key] || '',
            v => {
                object[key] = v;
            },
            options
        )
    );
}

function ghost(parent, label, x, y, width, height, onclick) {
    const placeholder = put(parent, 'add-ghost', x, y, width, height);
    placeholder.textContent = label;
    placeholder.addEventListener('click', onclick);
    return placeholder;
}

function layoutOnPageHover(node, layout) {
    const update = () => layout(node.pg.matches(':hover'));
    node.pg.addEventListener('mouseenter', update);
    node.pg.addEventListener('mouseleave', update);
    update();
}

function titleBlock(parent, text, color, readValue, writeValue) {
    const heading = h('div', 'pt-header' + (readValue ? '' : ' forced-title'), { text });
    heading.style.color = '#' + hex6(color || gb.headerColor);
    if (readValue) {
        heading.addEventListener('click', () => startEdit(heading, readValue, writeValue, SINGLE));
    }
    parent.appendChild(heading);
    parent.appendChild(h('div', 'pt-sep'));
    return heading;
}

function textRegion(parent, object, key, top, placeholder) {
    const region = h('div', 'pt-text');
    region.style.top = top + 'px';
    region.dataset.max = String(153 - top);
    region.dataset.ph = placeholder || 'Click to write text...';
    const value = object[key] || '';
    if (value) {
        renderMarkup(region, value);
    } else {
        region.classList.add('empty');
    }
    bindEdit(region, object, key);
    parent.appendChild(region);
    return region;
}

function header(parent, object, key, placeholder, color) {
    const value = object[key] || '';
    if (value) {
        titleBlock(
            parent,
            value,
            color,
            () => object[key] || '',
            x => {
                object[key] = x;
            }
        );
        return true;
    }
    const placeholderElement = h('div', 'pt-ghost' + (key === 'name' ? ' name' : ''), {
        text: placeholder || '+ title'
    });
    bindEdit(placeholderElement, object, key, SINGLE);
    parent.appendChild(placeholderElement);
    return false;
}

function miniLabel(parent, y, object, key, placeholder, left, width) {
    const label = h('div', 'mini-label');
    label.style.top = y + 'px';
    if (left != null) {
        label.style.left = left + 'px';
        label.style.width = width + 'px';
    }
    label.textContent = object[key] || placeholder;
    if (!object[key]) {
        label.style.opacity = '.55';
    }
    ellipsize(label);
    bindEdit(label, object, key, SINGLE);
    parent.appendChild(label);
    return label;
}

function previewFrame(box, border = true) {
    box.classList.add('preview-page');
    const frame = put(box, 'preview-frame' + (border ? ' bordered' : ''), 5, 7, 106, 106);
    const content = h('div', 'preview-content');
    frame.appendChild(content);
    return { frame, content };
}

function imagePage(box, page) {
    const { content } = previewFrame(box, page.border);
    box.classList.remove('preview-page');
    box.classList.add('image-page');
    const images = page.images.filter(Boolean);
    let index = Math.max(0, Math.min(imagePageIndices.get(page) || 0, images.length - 1));
    if (images.length > 1 && page.border) {
        box.appendChild(h('div', 'image-arrow-shade'));
    }
    const arrow = (direction, x, label) => {
        const button = h('button', 'image-arrow ' + direction, {
            type: 'button', title: label, 'aria-label': label,
            onclick: ev => {
                ev.stopPropagation();
                index += direction === 'prev' ? -1 : 1;
                index = Math.max(0, Math.min(index, images.length - 1));
                updateImage();
            }
        });
        button.style.left = x + 'px';
        box.appendChild(button);
        return button;
    };
    const previous = arrow('prev', 90, 'Previous image');
    const next = arrow('next', 100, 'Next image');
    function updateImage() {
        imagePageIndices.set(page, index);
        previous.classList.toggle('hidden', index <= 0);
        next.classList.toggle('hidden', index >= images.length - 1);
        const location = images[index];
        const source = screenTextureURI(location);
        const placeholder = h('div', 'cap', {
            text: location ? 'Texture unavailable: ' + textureName(location) : 'Choose an image in the panel',
            style: 'top:44px'
        });
        content.replaceChildren(source ? h('img', 'image-texture', {
            alt: textureName(location), draggable: 'false',
            onerror: ev => ev.target.replaceWith(placeholder), src: source
        }) : placeholder);
    }
    updateImage();
}

function slot(parent, x, y, size, value, onclick) {
    const itemSlot = put(parent, 'slot' + (size === 50 ? ' s3' : ''), x, y);
    if (size && size !== 18 && size !== 50) {
        itemSlot.style.width = itemSlot.style.height = size + 'px';
    }
    itemSlot.appendChild(icoEl(value));
    if (onclick) {
        itemSlot.addEventListener('click', onclick);
    }
    return itemSlot;
}

function progressPreview(box) {
    if (!gb.showProgress) {
        return;
    }
    const label = put(box, 'book-progress-title', 4, 117, 106, 9);
    label.textContent = 'Unlock Progress:';
    label.style.color = '#' + hex6(gb.headerColor);
    const progress = put(box, 'progress', 4, 126, 106, 12);
    progress.style.borderColor = '#' + hex6(gb.headerColor);
    progress.style.setProperty('--progress-background', '#' + hex6(gb.progressBarBackground));
    progress.style.setProperty('--progress-color', '#' + hex6(gb.progressBarColor));
    progress.appendChild(h('i'));
}

// landing

function renderLanding(leftPage, rightPage) {
    leftPage.box.addEventListener('mousedown', () => {
        sel = { kind: 'book', page: -1 };
        renderInspector();
    });
    const banner = put(leftPage.box, 'landing-banner', -23, -6, 140, 31);
    banner.style.color = '#' + hex6(gb.nameplateColor);
    const heading = h('div', 'pt-header landing-name', { text: gb.bookName || 'Book Name' });
    bindEdit(heading, gb, 'bookName', SINGLE);
    banner.appendChild(heading);
    if (!gb.bookName) {
        heading.style.opacity = '.5';
    }
    const subtitle = h('div', 'landing-subtitle', { text: gb.subtitle || 'Subtitle' });
    if (!gb.subtitle) {
        subtitle.style.opacity = '.5';
    }
    bindEdit(subtitle, gb, 'subtitle', SINGLE);
    banner.appendChild(subtitle);
    const landingText = textRegion(leftPage.box, gb, 'landingText', 25, 'Landing page text...');
    landingText.dataset.max = String((gb.showProgress ? 100 : 137) - 25);
    const toolsY = gb.showProgress ? 100 : 137;
    ['history', 'advancements', 'editor'].forEach((icon, i) => {
        const tool = put(
            leftPage.box,
            'landing-tool ' + icon,
            (gb.showProgress ? 5 : 10) + i * 15,
            toolsY,
            11,
            11
        );
        tool.title = { history: 'History', advancements: 'Advancements', editor: 'Edit book' }[
            icon
        ];
        tool.setAttribute('role', 'img');
        tool.setAttribute('aria-label', tool.title);
    });
    progressPreview(leftPage.box);
    rightPage.box.appendChild(
        h('div', 'pt-header landing-categories-title', {
            text: 'Categories',
            style: 'color:#' + hex6(gb.headerColor)
        })
    );
    rightPage.box.appendChild(h('div', 'pt-sep', { style: 'top:12px' }));
    // four 20px icons per row, with a 24px step
    const gridPos = i => [10 + (i % 4) * 24, 25 + Math.floor(i / 4) * 24];
    const roots = childCats('');
    roots.forEach((c, i) => {
        const [x, y] = gridPos(i);
        const b = put(rightPage.box, 'cat-btn category-icon' + (c.secret ? ' secret' : ''), x, y);
        b.title = (c.name || c.id) + (c.description ? '\n' + c.description : '');
        b.appendChild(icoEl(c.icon));
        b.style.setProperty('--category-paper-x', -(x + 141) + 'px');
        b.style.setProperty('--category-paper-y', -(y + 18) + 'px');
        b.addEventListener('click', () => go('category', c.id));
    });
    ghost(rightPage.box, '+', ...gridPos(roots.length), 20, 20, () => addCategory('')).title =
        'New category';
    const bottomSeparator = h('div', 'pt-sep');
    rightPage.box.appendChild(bottomSeparator);
    layoutOnPageHover(rightPage, hovered => {
        const count = roots.length + (hovered ? 1 : 0);
        bottomSeparator.style.display = count > 0 && count <= 16 ? '' : 'none';
        bottomSeparator.style.top = 37 + 24 * Math.ceil(count / 4) + 'px';
    });
}

// category index

function renderCategory(leftPage, rightPage) {
    const category = findCat(view.cat);
    const entries = sortedEntries(view.cat);
    const children = childCats(view.cat);
    const row = (parent, ent, y) => {
        const r = put(
            parent,
            'idx-row' + (ent.priority ? ' priority' : '') + (ent.secret ? ' secret' : ''),
            0,
            y
        );
        r.title = ent.name || ent.id;
        r.style.color = '#' + hex6(ent.entryColor || gb.textColor);
        r.appendChild(applyIcon(h('div', 'mini'), ent.icon));
        r.appendChild(h('span', 'nm', { text: ent.name || ent.id }));
        r.addEventListener('click', () => go('entry', category.id, ent.id));
    };
    const addEntryButton = (parent, y) =>
        ghost(parent, '+ New entry', 0, y, 116, 11, () => addEntry(category.id));
    if (view.spread === 0) {
        titleBlock(
            leftPage.box,
            category.name || category.id,
            null,
            () => category.name,
            v => {
                category.name = v;
            }
        );
        rightPage.box.appendChild(
            h('div', 'pt-header', { text: 'Chapters', style: 'color:#' + hex6(gb.headerColor) })
        );
        rightPage.box.appendChild(h('div', 'pt-sep'));
        const subcatBottom = gb.showProgress ? 112 : 153;
        const description = textRegion(
            leftPage.box,
            category,
            'description',
            22,
            'Category description...'
        );
        description.classList.add('category-description');
        description.style.color = '#' + hex6(gb.textColor);
        progressPreview(leftPage.box);
        const subcatBox = put(leftPage.box, 'category-subcategories', 0, subcatBottom, 116, 0);
        const gridPos = i => [10 + (i % 4) * 24, Math.floor(i / 4) * 24];
        children.forEach((c, i) => {
            const [x, y] = gridPos(i);
            const button = put(
                subcatBox,
                'cat-btn category-icon' + (c.secret ? ' secret' : ''),
                x,
                y
            );
            button.title = c.name || c.id;
            button.appendChild(icoEl(c.icon));
            button.style.setProperty('--category-paper-x', -(x + 15) + 'px');
            button.addEventListener('click', () => go('category', c.id));
        });
        ghost(subcatBox, '+', ...gridPos(children.length), 20, 20, () =>
            addCategory(category.id)
        ).title = 'New subcategory';
        layoutOnPageHover(leftPage, hovered => {
            const count = children.length + (hovered ? 1 : 0);
            const rows = Math.min(gb.showProgress ? 2 : 3, Math.ceil(count / 4));
            const height = Math.max(0, rows * 24 - 4);
            const top = subcatBottom - height;
            subcatBox.style.top = top + 'px';
            subcatBox.style.height = height + 'px';
            description.dataset.max = String(top - 4 - 22);
            description.classList.toggle(
                'overflow',
                description.offsetHeight > Number(description.dataset.max) + 1
            );
            subcatBox.querySelectorAll('.category-icon').forEach(button => {
                const y = parseFloat(button.style.top);
                button.style.setProperty('--category-paper-y', -(y + top + 18) + 'px');
            });
        });
        entries
            .slice(0, ENTRIES_FIRST_SPREAD)
            .forEach((ent, i) => row(rightPage.box, ent, 20 + i * 11));
        if (entries.length <= ENTRIES_FIRST_SPREAD) {
            addEntryButton(rightPage.box, 20 + entries.length * 11);
        }
    } else {
        const start = ENTRIES_FIRST_SPREAD + (view.spread - 1) * ENTRIES_PER_PAGE * 2;
        entries
            .slice(start, start + ENTRIES_PER_PAGE)
            .forEach((ent, i) => row(leftPage.box, ent, i * 11));
        const rightEntries = entries.slice(start + ENTRIES_PER_PAGE, start + ENTRIES_PER_PAGE * 2);
        rightEntries.forEach((ent, i) => row(rightPage.box, ent, i * 11));
        if (view.spread === totalSpreads() - 1) {
            addEntryButton(rightPage.box, rightEntries.length * 11);
        }
    }
    leftPage.box.addEventListener('mousedown', () => {
        sel = { kind: 'category', page: -1 };
        renderInspector();
    });
}

// entry pages

function renderEntry(leftPage, rightPage) {
    const entry = findEntry(view.entry);
    [
        [leftPage, view.spread * 2, 'l'],
        [rightPage, view.spread * 2 + 1, 'r']
    ].forEach(([node, idx, tag]) => {
        if (idx < entry.pages.length) {
            node.pg.dataset.idx = idx;
            if (sel.kind === 'page' && sel.page === idx) {
                node.pg.classList.add('selected');
            }
            node.pg.classList.add('clickable');
            node.box.addEventListener('mousedown', () => selectPage(idx));
            buildPage(entry.pages[idx], entry, node.box);
            node.pg.appendChild(
                h('div', 'pnum ' + tag, {
                    text: String(idx + 1),
                    style: 'position:absolute;bottom:-13px;left:43px;font-size:7px;color:#fff;width:30px;text-align:center;-webkit-text-stroke:0.4px #1a1103;paint-order:stroke fill'
                })
            );
        } else if (idx === entry.pages.length) {
            ghost(node.box, '+ Add page', 8, 5, 100, 140, ev =>
                pageTypeMenu(ev, addPage)
            ).style.fontSize = '9px';
        }
    });
}

function selectPage(pageIndex) {
    if (sel.kind === 'page' && sel.page === pageIndex) {
        return;
    }
    sel = { kind: 'page', page: pageIndex };
    document
        .querySelectorAll('.book .page')
        .forEach(p => p.classList.toggle('selected', p.dataset.idx === String(pageIndex)));
    renderInspector();
}

function isEntryTitlePage(entry, page) {
    return entry.pages[0] === page && page.type === 'patchouli:text';
}

function buildPage(page, entry, box) {
    const pageType = page.type.slice(10);
    const title = () => header(box, page, 'title', '+ title');
    switch (pageType) {
        case 'text': {
            box.classList.add('text-page');
            if (isEntryTitlePage(entry, page)) {
                box.classList.add('entry-title-page');
                titleBlock(box, entry.name || entry.id);
                textRegion(box, page, 'text', 21);
            } else {
                const hasT = title();
                textRegion(box, page, 'text', hasT ? 15 : 0);
            }
            break;
        }
        case 'image': {
            title();
            imagePage(box, page);
            textRegion(box, page, 'text', 120);
            break;
        }
        case 'crafting': {
            box.classList.add('crafting-page');
            const hasT = title();
            let y = craftingRecipeBlock(box, 5, page, 'recipe');
            if (page.recipe2) {
                y = craftingRecipeBlock(box, y, page, 'recipe2');
            }
            if (hasT || !page.recipe2) {
                textRegion(box, page, 'text', y);
            }
            break;
        }
        case 'smelting': {
            box.classList.add('smelting-page');
            const hasT = title();
            let y = smeltingRecipeBlock(box, 8, page, 'recipe');
            if (page.recipe2) {
                y = smeltingRecipeBlock(box, hasT ? y - 10 : y, page, 'recipe2');
            }
            textRegion(box, page, 'text', y - 14);
            break;
        }
        case 'multiblock': {
            if (!page.name) {
                page.name = 'Multiblock';
            }
            header(box, page, 'name', '+ name');
            const { frame, content } = previewFrame(box);
            frame.style.cursor = 'pointer';
            const mbd = page.multiblock;
            let info = 'Click to design structure';
            if (mbd && mbd.pattern.length) {
                const rows = mbd.pattern[0].length;
                const cols = rows ? mbd.pattern[0][0].length : 0;
                info = mbd.pattern.length + ' \u00D7 ' + rows + ' \u00D7 ' + cols + ' structure';
                content.appendChild(mbIsometric(mbd));
                content.appendChild(h('div', 'cap', { text: info, style: 'top:82px' }));
            } else {
                content.appendChild(h('div', 'cap', { text: info, style: 'top:45px' }));
            }
            frame.addEventListener('click', () => openMultiblock(page));
            if (page.enableVisualize) {
                box.appendChild(h('button', 'multiblock-eye', {
                    type: 'button', title: 'Visualize', 'aria-label': 'Visualize',
                    onclick: ev => {
                        ev.stopPropagation();
                        openMultiblock(page);
                    }
                }));
            }
            textRegion(box, page, 'text', 115);
            break;
        }
        case 'entity': {
            header(box, page, 'name', '+ name');
            const { content } = previewFrame(box);
            content.appendChild(
                h('div', 'cap', { text: 'Entity render', style: 'top:28px;font-size:9px' })
            );
            miniLabel(content, 46, page, 'entity', 'minecraft:pig', 0, 100);
            textRegion(box, page, 'text', 115);
            break;
        }
        case 'spotlight': {
            box.classList.add('spotlight-page');
            title();
            slot(box, 48, 18, 20, page.item, () =>
                pickItem(v => {
                    page.item = v;
                    renderAll();
                })
            );
            textRegion(box, page, 'text', 43);
            break;
        }
        case 'link': {
            box.classList.add('link-page');
            textRegion(box, page, 'text', title() ? 15 : 0);
            const b = put(box, 'pt-btn', 8, 123, 100, 20);
            b.appendChild(h('span', 'btn-label', { text: page.linkText || 'Click Here' }));
            b.addEventListener('click', () =>
                startEdit(
                    b,
                    () => page.linkText,
                    v => {
                        page.linkText = v;
                    },
                    SINGLE
                )
            );
            miniLabel(box, 146, page, 'url', 'https://', 0, 116);
            break;
        }
        case 'relations': {
            box.classList.add('relations-page');
            header(box, page, 'title', '+ title (default: Related Chapters)');
            if (!page.title) {
                box.appendChild(
                    h('div', 'pt-header', {
                        text: 'Related Chapters',
                        style: 'pointer-events:none;color:#333'
                    })
                );
                box.appendChild(h('div', 'pt-sep'));
            }
            page.entries.forEach((id, i) => {
                const r = put(box, 'rel-row', 6, 22 + i * 12);
                const en = findEntry(bare(id));
                r.appendChild(document.createTextNode(en ? en.name : id));
                r.appendChild(
                    h('span', 'x', {
                        text: '\u2715',
                        title: 'Remove',
                        onclick: ev => {
                            ev.stopPropagation();
                            page.entries.splice(i, 1);
                            renderAll();
                        }
                    })
                );
            });
            ghost(box, '+ add entry', 6, 22 + page.entries.length * 12, 104, 11, ev => {
                const items = gb.entries
                    .filter(
                        en =>
                            !page.entries.includes(modId() + ':' + en.id) &&
                            !page.entries.includes(en.id)
                    )
                    .map(en => ({
                        label: en.name || en.id,
                        run: () => {
                            page.entries.push(modId() + ':' + en.id);
                            renderAll();
                        }
                    }));
                if (items.length) {
                    showPopup(ev, items);
                }
            });
            break;
        }
        case 'quest': {
            box.classList.add('quest-page');
            const hasT = title();
            const tr = textRegion(box, page, 'text', hasT ? 25 : 0);
            tr.dataset.max = String(135 - (hasT ? 18 : -1) - 6);
            box.appendChild(h('div', 'pt-sep quest-turnin-separator'));
            const c = put(box, 'box-frame quest-box', 8, 139, 100, 14);
            c.appendChild(
                h('div', 'cap', {
                    text: page.trigger ? 'Turn-in: ' + page.trigger : 'No trigger set'
                })
            );
            break;
        }
        case 'empty':
            if (page.drawFiller) {
                put(box, 'box-frame hatch', 8, 5, 100, 140);
            } else {
                box.appendChild(
                    h('div', 'mini-label', { text: '(empty page)', style: 'top:67px' })
                );
            }
            break;
    }
}

function craftingRecipeBlock(box, y, page, key) {
    const background = put(box, 'crafting-recipe', 8, y, 100, 62);
    background.title = (page[key] || 'No recipe set') + ' (click to edit recipe ID)';
    const label = miniLabel(box, y + 24, page, key, 'recipe id (modid:name)', 8, 100);
    label.classList.add('recipe-id');
    background.addEventListener('click', () =>
        startEdit(
            label,
            () => page[key] || '',
            v => {
                page[key] = v;
            },
            SINGLE
        )
    );
    const table = inert(put(background, 'spotlight-item', 81, 43, 16, 16));
    table.appendChild(icoEl('minecraft:crafting_table'));
    return y + 67;
}

function smeltingRecipeBlock(box, y, page, key) {
    const background = put(box, 'smelting-recipe', 8, y, 100, 24);
    background.title = (page[key] || 'No recipe set') + ' (click to edit recipe ID)';
    const label = miniLabel(box, y + 8, page, key, 'recipe id (modid:name)', 8, 100);
    label.classList.add('recipe-id');
    background.addEventListener('click', () =>
        startEdit(
            label,
            () => page[key] || '',
            v => {
                page[key] = v;
            },
            SINGLE
        )
    );
    inert(put(background, 'smelting-sprite smelting-slot', 3, 0, 24, 24));
    inert(put(background, 'smelting-sprite smelting-arrow', 29, 8, 9, 9));
    const furnace = inert(put(background, 'spotlight-item', 42, 4, 16, 16));
    furnace.appendChild(icoEl('minecraft:furnace'));
    inert(put(background, 'smelting-sprite smelting-arrow', 62, 8, 9, 9));
    inert(put(background, 'smelting-sprite smelting-slot', 75, 0, 24, 24));
    return y + 45;
}

// breadcrumb

function renderBreadcrumb() {
    const breadcrumb = $('breadcrumb');
    breadcrumb.textContent = '';
    const crumbs = [
        { label: gb.bookName || 'Book', run: () => go('landing'), cur: view.mode === 'landing' }
    ];
    if (view.mode !== 'landing') {
        const chain = [];
        let c = findCat(
            view.mode === 'entry' ? bare((findEntry(view.entry) || {}).category) : view.cat
        );
        let guard = 0;
        // 10 levels of nesting ought to be enough for anybody
        while (c && guard++ < 10) {
            chain.unshift(c);
            c = c.parent ? findCat(bare(c.parent)) : null;
        }
        chain.forEach(cc =>
            crumbs.push({
                label: cc.name || cc.id,
                run: () => go('category', cc.id),
                cur: view.mode === 'category' && cc.id === view.cat
            })
        );
        if (view.mode === 'entry') {
            const e = findEntry(view.entry);
            crumbs.push({ label: e ? e.name || e.id : '', cur: true });
        }
    }
    crumbs.forEach((c, i) => {
        if (i) {
            breadcrumb.appendChild(h('span', 'sep', { text: '\u203A' }));
        }
        breadcrumb.appendChild(
            h('span', 'crumb' + (c.cur ? ' current' : ''), {
                text: c.label,
                onclick: c.cur ? null : c.run
            })
        );
    });
}